import { q } from '../database/pool';
import { HttpError } from '../middleware/errors';
import { AuthUser, assertStudentAccess } from '../middleware/auth';
import * as filesSvc from './files';
import { isOptionalIsoDate } from '../utils/date';

export async function list(user: AuthUser, studentId?: number) {
  const sid = user.role === 'student' ? user.studentId! : (studentId ?? null);
  assertStudentAccess(user, sid ?? -1);
  const { rows } = await q(
    `SELECT p.*, s.name AS student_name,
            f.original_name AS file_original_name, f.mime AS file_mime,
            COALESCE(json_agg(json_build_object(
                       'id', fu.id, 'follow_date', fu.follow_date,
                       'note', fu.note, 'created_at', fu.created_at
                     ) ORDER BY fu.follow_date, fu.id)
                     FILTER (WHERE fu.id IS NOT NULL), '[]') AS followups
     FROM plans p
     JOIN students s ON s.id = p.student_id
     LEFT JOIN files f ON f.id = p.file_id
     LEFT JOIN plan_followups fu ON fu.plan_id = p.id
     WHERE ($1::int IS NULL OR p.student_id = $1)
     GROUP BY p.id, s.name, f.id
     ORDER BY p.status, p.to_date DESC NULLS LAST, p.id DESC`, [sid]);
  return rows;
}

export async function create(user: AuthUser, b: any) {
  const sid = Number(b.student_id);
  if (!Number.isInteger(sid) || sid <= 0) throw new HttpError(400, 'حددي الطالبة');
  if (!b.title || !String(b.title).trim()) throw new HttpError(400, 'عنوان الخطة مطلوب');
  if (!isOptionalIsoDate(b.from_date) || !isOptionalIsoDate(b.to_date)) throw new HttpError(400, 'التاريخ غير صالح');
  if (b.from_date && b.to_date && b.to_date < b.from_date)
    throw new HttpError(400, 'تاريخ النهاية لا يسبق تاريخ البداية');
  const st = await q('SELECT 1 FROM students WHERE id = $1', [sid]);
  if (!st.rowCount) throw new HttpError(404, 'الطالبة غير موجودة');
  if (b.file_id) {
    const file = await q("SELECT 1 FROM files WHERE id = $1 AND kind = 'plan'", [b.file_id]);
    if (!file.rowCount) throw new HttpError(400, 'ملف الخطة غير صالح');
  }
  // الواجهة تستخدم «الوصف / الإجراءات» ويُخزَّن في actions (مع دعم description للتوافق)
  const actions = b.actions ?? b.description ?? null;
  const { rows } = await q(
    `INSERT INTO plans(student_id, title, goal, actions, from_date, to_date, created_by, file_id)
     VALUES ($1,$2,$3,$4,$5::date,$6::date,$7,$8) RETURNING *`,
    [sid, String(b.title).trim(), b.goal || null, actions, b.from_date || null, b.to_date || null, user.id, b.file_id || null]);
  return rows[0];
}

export async function update(id: number, b: any) {
  if (b.status !== undefined && !['active', 'done'].includes(b.status))
    throw new HttpError(400, 'حالة الخطة غير صالحة');
  if (!isOptionalIsoDate(b.from_date) || !isOptionalIsoDate(b.to_date)) throw new HttpError(400, 'التاريخ غير صالح');
  const actions = b.actions ?? b.description ?? null;
  const { rows } = await q(
    `UPDATE plans SET title = COALESCE($2, title), goal = COALESCE($3, goal), actions = COALESCE($4, actions),
       from_date = COALESCE($5::date, from_date), to_date = COALESCE($6::date, to_date), status = COALESCE($7, status)
     WHERE id = $1 RETURNING *`,
    [id, b.title ?? null, b.goal ?? null, actions, b.from_date || null, b.to_date || null, b.status ?? null]);
  if (!rows[0]) throw new HttpError(404, 'الخطة غير موجودة');
  return rows[0];
}

export async function addFollowup(user: AuthUser, planId: number, b: any) {
  if (!b.note || !String(b.note).trim()) throw new HttpError(400, 'ملاحظة المتابعة مطلوبة');
  const plan = await q('SELECT 1 FROM plans WHERE id = $1', [planId]);
  if (!plan.rowCount) throw new HttpError(404, 'الخطة غير موجودة');
  const { rows } = await q(
    'INSERT INTO plan_followups(plan_id, follow_date, note) VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3) RETURNING *',
    [planId, b.follow_date || null, String(b.note).trim()]);
  return rows[0];
}

export async function remove(id: number) {
  const { rows } = await q('SELECT id, file_id FROM plans WHERE id = $1', [id]);
  if (!rows[0]) throw new HttpError(404, 'الخطة غير موجودة');
  // حذف المرفق من القاعدة والقرص مع الخطة
  if (rows[0].file_id) await filesSvc.deleteById(rows[0].file_id);
  await q('DELETE FROM plans WHERE id = $1', [id]);
  return { id };
}
