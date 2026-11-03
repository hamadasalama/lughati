import { q } from '../database/pool';
import { HttpError } from '../middleware/errors';
import { AuthUser } from '../middleware/auth';
import { hashPassword, validatePassword } from './auth';

export async function list(user: AuthUser, fIn: { role?: string; student_id?: number }) {
  // المعلمة ترى حسابات الطالبات فقط؛ الإدارة النظام ترى الجميع (وفق مصفوفة الصلاحيات)
  const f = user.role === 'admin' ? fIn : { ...fIn, role: 'student' };
  const { rows } = await q(
    `SELECT u.id, u.username, u.role, u.active, u.student_id, s.name AS student_name, s.code AS student_code
     FROM users u LEFT JOIN students s ON s.id = u.student_id
     WHERE ($1::text IS NULL OR u.role = $1) AND ($2::int IS NULL OR u.student_id = $2)
     ORDER BY u.id`, [f.role || null, f.student_id ?? null]);
  return rows; // كلمات المرور لا تُعاد أبداً
}

export async function create(actor: AuthUser, b: any) {
  const role = b.role ?? 'student';
  const username = String(b.username ?? '').trim().toLowerCase();
  if (!username) throw new HttpError(400, 'اسم المستخدم مطلوب');
  if (!b.password) throw new HttpError(400, 'كلمة المرور مطلوبة');
  validatePassword(b.password);
  // المعلمة تنشئ حسابات طالبات فقط؛ إنشاء حسابات معلمات/إدارة حكر على الإدارة النظام — لا تسجيل ذاتي إطلاقاً
  if (actor.role !== 'admin' && role !== 'student') throw new HttpError(403, 'إنشاء حسابات المعلمات/الإدارة متاح للإدارة النظام فقط');
  let studentId: number | null = null;
  if (role === 'student') {
    studentId = Number(b.student_id);
    if (!studentId) throw new HttpError(400, 'يجب ربط الحساب بالطالبة عبر رمزها الثابت');
    const s = await q('SELECT id FROM students WHERE id = $1', [studentId]);
    if (!s.rowCount) throw new HttpError(404, 'الطالبة غير موجودة');
    const taken = await q('SELECT 1 FROM users WHERE student_id = $1', [studentId]);
    if (taken.rowCount) throw new HttpError(409, 'لهذه الطالبة حساب بالفعل');
  }
  try {
    const { rows } = await q(
      'INSERT INTO users(username, password_hash, role, student_id) VALUES ($1,$2,$3,$4) RETURNING id, username, role, active, student_id',
      [username, await hashPassword(String(b.password)), role, studentId]);
    return rows[0];
  } catch (e: any) {
    if (e.code === '23505') throw new HttpError(409, 'اسم المستخدم مستخدم مسبقاً');
    throw e;
  }
}

export async function update(actor: AuthUser, id: number, b: any) {
  const { rows } = await q('SELECT * FROM users WHERE id = $1', [id]);
  const u = rows[0];
  if (!u) throw new HttpError(404, 'المستخدم غير موجود');
  if (actor.role !== 'admin' && u.role !== 'student') throw new HttpError(403, 'غير مصرح');
  // student_id غير قابل للتعديل عمداً: الربط بالرمز الثابت لا يتغير
  try {
    if (b.username) {
      const un = String(b.username).trim().toLowerCase();
      await q('UPDATE users SET username = $2 WHERE id = $1', [id, un]);
    }
    if (b.active !== undefined) await q('UPDATE users SET active = $2 WHERE id = $1', [id, !!b.active]);
    if (b.password) {
      validatePassword(b.password);
      await q('UPDATE users SET password_hash = $2, token_version = token_version + 1 WHERE id = $1',
        [id, await hashPassword(String(b.password))]);
    }
  } catch (e: any) {
    if (e.code === '23505') throw new HttpError(409, 'اسم المستخدم مستخدم مسبقاً');
    throw e;
  }
  const { rows: out } = await q('SELECT id, username, role, active, student_id FROM users WHERE id = $1', [id]);
  return out[0];
}

export async function remove(id: number) {
  const { rows } = await q('DELETE FROM users WHERE id = $1 RETURNING id, username', [id]);
  if (!rows[0]) throw new HttpError(404, 'المستخدم غير موجود');
  return rows[0];
}
