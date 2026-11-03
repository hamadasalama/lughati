import fs from 'fs';
import path from 'path';
import { q } from '../database/pool';
import { env } from '../config';
import { AuthUser } from '../middleware/auth';

export async function register(f: {
  stored_name: string; original_name: string; mime: string; size: number; kind: string;
  student_id: number | null; worksheet_id: number | null; achievement_id: number | null; uploaded_by: number;
}) {
  // نحتفظ بنسخة داخل قاعدة البيانات كي تبقى الملفات على الاستضافات ذات القرص المؤقت.
  // Multer يكتب الملف على القرص أولاً (للفحص)، ثم نقرأه هنا ونسجّله مع بياناته.
  let data: Buffer | null = null;
  try { data = fs.readFileSync(path.join(env.uploadDirAbs, f.stored_name)); } catch { /* بلا نسخة قرص */ }
  const { rows } = await q(
    `INSERT INTO files(stored_name, original_name, mime, size_bytes, kind, student_id, worksheet_id, achievement_id, uploaded_by, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [f.stored_name, f.original_name, f.mime, f.size, f.kind, f.student_id, f.worksheet_id, f.achievement_id, f.uploaded_by, data]);
  return rows[0];
}

/** محتوى الملف من قاعدة البيانات — بديل عند فقدان نسخة القرص */
export async function getData(id: number): Promise<Buffer | null> {
  const { rows } = await q<{ data: Buffer | null }>('SELECT data FROM files WHERE id = $1', [id]);
  return rows[0]?.data ?? null;
}

export async function getForDownload(id: number, studentId: number | null = null) {
  const { rows } = await q(
    `SELECT f.id, f.stored_name, f.original_name, f.mime, f.size_bytes, f.kind,
            f.student_id, f.worksheet_id, f.achievement_id, f.uploaded_by, f.created_at,
            a.visible AS achievement_visible,
            w.grade AS worksheet_grade, w.section AS worksheet_section,
            EXISTS (SELECT 1 FROM worksheet_targets wt WHERE wt.worksheet_id = f.worksheet_id) AS worksheet_has_targets,
            EXISTS (SELECT 1 FROM worksheet_targets wt
                     WHERE wt.worksheet_id = f.worksheet_id AND wt.student_id = $2) AS worksheet_targeted,
            (SELECT t.grade FROM tests t WHERE t.file_id = f.id LIMIT 1) AS test_grade,
            (SELECT t.section FROM tests t WHERE t.file_id = f.id LIMIT 1) AS test_section,
            (SELECT p.student_id FROM plans p WHERE p.file_id = f.id LIMIT 1) AS plan_student_id
     FROM files f
     LEFT JOIN achievements a ON a.id = f.achievement_id
     LEFT JOIN worksheets w ON w.id = f.worksheet_id
     WHERE f.id = $1`,
    [id, studentId]);
  return rows[0] ?? null;
}

/** قاعدة الوصول: الطالبة تصل فقط لملفها أو ملف صفها، أو إنجاز معلن، أو شعار — غير ذلك 404 بلا كشف */
export function accessible(user: AuthUser, f: any): boolean {
  if (user.role !== 'student') return true;
  if (f.student_id != null) return f.student_id === user.studentId;
  if (f.kind === 'logo') return true; // شعارا المدرسة والوزارة غير حساسان
  if (f.kind === 'worksheet') {
    if (!f.worksheet_grade || f.worksheet_grade !== user.grade || f.worksheet_section !== user.section)
      return false;
    // ورقة بلا إسناد = لكل طالبات الصف/الشعبة؛ بورقة مسندة = للمعيّنات فقط
    return !f.worksheet_has_targets || !!f.worksheet_targeted;
  }
  if (f.kind === 'test')
    return !!f.test_grade && f.test_grade === user.grade && f.test_section === user.section;
  if (f.kind === 'plan')
    return f.plan_student_id != null && f.plan_student_id === user.studentId;
  if (f.kind === 'achievement') return !!f.achievement_visible;
  return false;
}

export function unlinkSafe(storedName: string) {
  try { fs.unlinkSync(path.join(env.uploadDirAbs, storedName)); } catch { /* الملف غير موجود — لا مشكلة */ }
}

/** تنظيف رفع فاشل: يحذف أي صفوف files مسجّلة بهذه الأسماء ثم يمسح الملفات من القرص */
export async function discardUploads(storedNames: string[]) {
  const names = storedNames.filter(Boolean);
  if (!names.length) return;
  await q('DELETE FROM files WHERE stored_name = ANY($1::text[])', [names]);
  for (const n of names) unlinkSafe(n);
}

/** حذف ملف واحد من القاعدة والقرص (يُستخدم عند حذف الاختبار/الخطة أو فشل الإنشاء) */
export async function deleteById(id: number) {
  const { rows } = await q('DELETE FROM files WHERE id = $1 RETURNING stored_name', [id]);
  if (rows[0]) unlinkSafe(rows[0].stored_name);
}

export async function deleteFor(column: 'achievement_id' | 'worksheet_id', id: number) {
  const { rows } = await q(`DELETE FROM files WHERE ${column} = $1 RETURNING stored_name`, [id]);
  for (const r of rows) unlinkSafe(r.stored_name);
}
