import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config';
import { q } from '../database/pool';
import { HttpError } from '../middleware/errors';

// قفل محاولات الدخول في PostgreSQL بدل الذاكرة: يظل فعّالاً مع أكثر من نسخة خادم
// ويُصفَّر عند أول دخول ناجح. المفتاح: 'u:<username>' أو 'ip:<address>'.
const WINDOW_MIN = 15;
const USER_MAX = 5;   // 5 محاولات فاشلة لنفس الاسم → قفل 15 دقيقة
const IP_MAX = 20;    // 20 محاولة فاشلة لنفس IP → قفل 15 دقيقة

const userKey = (username: string) => 'u:' + username;
const ipKey = (ip: string) => 'ip:' + ip;

// مقارنة وهمية عند عدم وجود المستخدم حتى لا يكشف زمن الاستجابة وجود الاسم
const DUMMY_HASH = bcrypt.hashSync('lughati-dummy-password', 10);

async function isLocked(bucket: string) {
  const { rows } = await q<{ locked: boolean }>(
    `SELECT COALESCE(locked_until > now(), false) AS locked
       FROM login_throttle WHERE bucket = $1`, [bucket]);
  return !!rows[0]?.locked;
}

async function recordFail(bucket: string, max: number) {
  await q(
    `INSERT INTO login_throttle(bucket, fails, window_start)
     VALUES ($1, 1, now())
     ON CONFLICT (bucket) DO UPDATE SET
       fails = CASE
         WHEN login_throttle.window_start < now() - make_interval(mins => $2) THEN 1
         ELSE login_throttle.fails + 1 END,
       window_start = CASE
         WHEN login_throttle.window_start < now() - make_interval(mins => $2) THEN now()
         ELSE login_throttle.window_start END,
       locked_until = CASE
         WHEN login_throttle.locked_until > now() THEN login_throttle.locked_until
         WHEN login_throttle.window_start < now() - make_interval(mins => $2) THEN NULL
         WHEN login_throttle.fails + 1 >= $3 THEN now() + make_interval(mins => $2)
         ELSE NULL END`,
    [bucket, WINDOW_MIN, max]);
}

/** تنظيف فرصة لصفوف القفل القديمة — لا يمسّ الأقفال الفعّالة */
function pruneThrottle() {
  if (Math.random() > 0.02) return;
  q(`DELETE FROM login_throttle
      WHERE window_start < now() - interval '1 day'
        AND (locked_until IS NULL OR locked_until < now())`).catch(() => { /* تجاهل */ });
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/**
 * سياسة كلمة المرور: 8 خانات على الأقل، حرف ورقم، وبحد أقصى 72 بايت
 * (bcrypt يقصّ ما بعد 72 بايت بصمت، فنرفضه بدل تخزين جزء منه فقط).
 */
export function validatePassword(password: unknown): string {
  const pw = String(password ?? '');
  if (pw.length < 8) throw new HttpError(400, 'كلمة المرور يجب ألا تقل عن 8 أحرف');
  if (Buffer.byteLength(pw, 'utf8') > 72) throw new HttpError(400, 'كلمة المرور طويلة جداً (72 بايت كحد أقصى)');
  if (!/\p{L}/u.test(pw) || !/[0-9]/.test(pw))
    throw new HttpError(400, 'كلمة المرور يجب أن تحتوي حرفاً ورقماً على الأقل');
  return pw;
}

export async function login(username: string, password: string, ip?: string) {
  pruneThrottle();
  const key = String(username ?? '').trim().toLowerCase();
  const uKey = userKey(key);
  // القفل فعّال طوال مدته بغض النظر عن العدّاد
  if (await isLocked(uKey)) throw new HttpError(429, 'تم تجاوز عدد المحاولات المسموح، حاولي بعد قليل');
  if (ip && await isLocked(ipKey(ip))) throw new HttpError(429, 'تم تجاوز عدد المحاولات المسموح، حاولي بعد قليل');
  const { rows } = await q<any>(
    'SELECT id, username, password_hash, role, active, token_version, student_id FROM users WHERE lower(username) = $1',
    [key]);
  const u = rows[0];
  const passwordOk = await verifyPassword(String(password ?? ''), u?.password_hash ?? DUMMY_HASH);
  if (!u || !passwordOk) {
    await recordFail(uKey, USER_MAX);
    if (ip) await recordFail(ipKey(ip), IP_MAX);
    throw new HttpError(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
  }
  if (!u.active) throw new HttpError(403, 'هذا الحساب موقوف، يرجى مراجعة المعلمة');
  // نجاح الدخول يصفّر عدّاد الاسم فقط؛ عدّاد IP ينتهي بانتهاء نافذته حتى لا يُستخدم للتحايل
  await q('DELETE FROM login_throttle WHERE bucket = $1', [uKey]);
  const token = jwt.sign({ uid: u.id, tv: u.token_version }, env.jwtSecret, { expiresIn: '8h' });
  return { token, user: { id: u.id, username: u.username, role: u.role, student_id: u.student_id } };
}

export async function changePassword(userId: number, newPassword: string, current?: string, requireCurrent = false) {
  const { rows } = await q<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw new HttpError(404, 'المستخدم غير موجود');
  if (requireCurrent) {
    if (!current) throw new HttpError(400, 'أدخلي كلمة المرور الحالية');
    if (!(await verifyPassword(current, rows[0].password_hash))) throw new HttpError(400, 'كلمة المرور الحالية غير صحيحة');
  }
  validatePassword(newPassword);
  await q('UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2',
    [await hashPassword(newPassword), userId]);
}
