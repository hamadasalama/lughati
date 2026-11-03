import { q } from '../database/pool';
import { HttpError } from '../middleware/errors';
import { AuthUser } from '../middleware/auth';
import { UpFile } from '../middleware/upload';
import * as filesSvc from './files';

export async function list(user: AuthUser) {
  if (user.role === 'student') {
    const { rows } = await q(
      `SELECT a.*, (SELECT count(*)::int FROM files f WHERE f.achievement_id = a.id) AS files_count,
              COALESCE((SELECT json_agg(json_build_object('id', f.id, 'original_name', f.original_name, 'mime', f.mime)
                                       ORDER BY f.id) FROM files f WHERE f.achievement_id = a.id), '[]') AS files
       FROM achievements a WHERE a.visible ORDER BY a.ach_date DESC, a.id DESC`);
    return rows;
  }
  const { rows } = await q(
    `SELECT a.*, (SELECT count(*)::int FROM files f WHERE f.achievement_id = a.id) AS files_count,
            COALESCE((SELECT json_agg(json_build_object('id', f.id, 'original_name', f.original_name, 'mime', f.mime)
                                     ORDER BY f.id) FROM files f WHERE f.achievement_id = a.id), '[]') AS files
     FROM achievements a ORDER BY a.ach_date DESC, a.id DESC`);
  return rows;
}

export async function create(user: AuthUser, b: any, files: UpFile[]) {
  if (!b.title || !String(b.title).trim()) throw new HttpError(400, 'عنوان الإنجاز مطلوب');
  const { rows } = await q(
    `INSERT INTO achievements(title, description, category, ach_date, visible, created_by)
     VALUES ($1,$2, COALESCE($3,'أخرى'), COALESCE($4::date, CURRENT_DATE), COALESCE($5, true), $6) RETURNING *`,
    [String(b.title).trim(), b.description || null, b.category || null, b.ach_date || null, b.visible ?? null, user.id]);
  const a = rows[0];
  for (const f of files ?? []) await filesSvc.register({
    stored_name: f.filename, original_name: f.originalname, mime: f.mimetype, size: f.size,
    kind: 'achievement', student_id: null, worksheet_id: null, achievement_id: a.id, uploaded_by: user.id
  });
  return a;
}

export async function update(id: number, b: any) {
  const { rows } = await q(
    `UPDATE achievements SET title = COALESCE($2, title), description = COALESCE($3, description),
       category = COALESCE($4, category), ach_date = COALESCE($5::date, ach_date), visible = COALESCE($6, visible)
     WHERE id = $1 RETURNING *`,
    [id, b.title ?? null, b.description ?? null, b.category ?? null, b.ach_date ?? null, b.visible ?? null]);
  if (!rows[0]) throw new HttpError(404, 'الإنجاز غير موجود');
  return rows[0];
}

export async function remove(id: number) {
  await filesSvc.deleteFor('achievement_id', id); // يحذف الملفات من القرص أيضاً
  const { rows } = await q('DELETE FROM achievements WHERE id = $1 RETURNING id', [id]);
  if (!rows[0]) throw new HttpError(404, 'الإنجاز غير موجود');
  return rows[0];
}
