import { q } from '../database/pool';
import { HttpError } from '../middleware/errors';
import { AuthUser } from '../middleware/auth';
import { UpFile } from '../middleware/upload';
import * as filesSvc from './files';
import { isOptionalIsoDate } from '../utils/date';

export async function list(user: AuthUser, f: { grade?: string; section?: string }) {
  if (user.role === 'student') {
    const sid = user.studentId!;
    const { rows } = await q(
      `SELECT w.id, w.title, w.description, w.grade, w.section, w.work_date, w.due_date,
              COALESCE(t.done, false) AS done,
              (SELECT id FROM files fi WHERE fi.worksheet_id = w.id LIMIT 1) AS file_id
       FROM worksheets w
       LEFT JOIN worksheet_targets t ON t.worksheet_id = w.id AND t.student_id = $1
       WHERE w.grade = (SELECT grade FROM students WHERE id = $1)
         AND w.section = (SELECT section FROM students WHERE id = $1)
         AND (NOT EXISTS (SELECT 1 FROM worksheet_targets x WHERE x.worksheet_id = w.id)
              OR t.student_id IS NOT NULL)
       ORDER BY w.work_date DESC, w.id DESC`, [sid]);
    return rows;
  }
  const { rows } = await q(
    `SELECT w.*,
       (SELECT id FROM files fi WHERE fi.worksheet_id = w.id LIMIT 1) AS file_id,
       COALESCE(json_agg(json_build_object('student_id', s.id, 'name', s.name, 'done', t.done) ORDER BY s.name)
                FILTER (WHERE s.id IS NOT NULL), '[]') AS targets
     FROM worksheets w
     LEFT JOIN worksheet_targets t ON t.worksheet_id = w.id
     LEFT JOIN students s ON s.id = t.student_id
     WHERE ($1::text IS NULL OR w.grade = $1) AND ($2::text IS NULL OR w.section = $2)
     GROUP BY w.id ORDER BY w.work_date DESC, w.id DESC`,
    [f.grade || null, f.section || null]);
  return rows;
}

/** ids تصل من FormData كنص JSON، ومن JSON كمصفوفة — نقبل الشكلين */
function parseIds(raw: any): number[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string' && raw.trim()) {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) arr = p; } catch { /* تجاهل */ }
  }
  return [...new Set(arr.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
}

export async function create(user: AuthUser, b: any, file?: UpFile) {
  if (!b.title || !String(b.title).trim()) throw new HttpError(400, 'عنوان ورقة العمل مطلوب');
  if (!b.grade || !b.section) throw new HttpError(400, 'الصف والشعبة مطلوبان');
  if (!isOptionalIsoDate(b.work_date) || !isOptionalIsoDate(b.due_date)) throw new HttpError(400, 'التاريخ غير صالح');
  if (b.due_date && b.work_date && b.due_date < b.work_date)
    throw new HttpError(400, 'تاريخ التسليم لا يسبق تاريخ الورقة');

  const ids = parseIds(b.ids);
  if (ids.length) {
    const { rows: valid } = await q(
      'SELECT id FROM students WHERE id = ANY($1::int[]) AND grade = $2 AND section = $3',
      [ids, b.grade, b.section]);
    if (valid.length !== ids.length)
      throw new HttpError(400, 'إحدى الطالبات لا تنتمي إلى صف/شعبة الورقة');
  }

  const { rows } = await q(
    `INSERT INTO worksheets(title, description, grade, section, work_date, due_date, created_by)
     VALUES ($1,$2,$3,$4, COALESCE($5::date, CURRENT_DATE), $6::date, $7) RETURNING *`,
    [String(b.title).trim(), b.description || null, b.grade, b.section, b.work_date || null, b.due_date || null, user.id]);
  const w = rows[0];
  if (ids.length) {
    await q(
      'INSERT INTO worksheet_targets(worksheet_id, student_id) SELECT $1, id FROM students WHERE id = ANY($2::int[]) ON CONFLICT DO NOTHING',
      [w.id, ids]);
  }
  let fileId: number | null = null;
  if (file) {
    const registered = await filesSvc.register({
      stored_name: file.filename, original_name: file.originalname, mime: file.mimetype,
      size: file.size, kind: 'worksheet', student_id: null, worksheet_id: w.id, achievement_id: null, uploaded_by: user.id
    });
    fileId = registered.id;
  }
  return { ...w, file_id: fileId, targets_count: ids.length };
}

export async function setStatus(worksheetId: number, studentId: number, done: boolean) {
  const { rows } = await q(
    `INSERT INTO worksheet_targets(worksheet_id, student_id, done) VALUES ($1,$2,$3)
     ON CONFLICT (worksheet_id, student_id) DO UPDATE SET done = EXCLUDED.done, updated_at = now()
     RETURNING *`, [worksheetId, studentId, done]);
  return rows[0];
}

export async function remove(id: number) {
  await filesSvc.deleteFor('worksheet_id', id); // مرفقات الورقة تُحذف من القرص أيضاً
  const { rows } = await q('DELETE FROM worksheets WHERE id = $1 RETURNING id', [id]);
  if (!rows[0]) throw new HttpError(404, 'ورقة العمل غير موجودة');
  return rows[0];
}
