import { q, pool } from '../database/pool';
import { HttpError } from '../middleware/errors';
import { AuthUser, assertStudentAccess } from '../middleware/auth';

export async function list(user: AuthUser, studentId?: number) {
  if (user.role === 'student') {
    const sid = user.studentId!;
    const { rows } = await q(
      `SELECT sk.id, sk.name, sk.description, l.level, l.note
       FROM skills sk LEFT JOIN skill_levels l ON l.skill_id = sk.id AND l.student_id = $1
       ORDER BY sk.name`, [sid]);
    return rows;
  }
  const sid = studentId ?? null;
  assertStudentAccess(user, sid ?? -1);
  const { rows } = await q(
    `SELECT sk.*, COALESCE(json_agg(json_build_object('student_id', l.student_id, 'level', l.level, 'note', l.note))
            FILTER (WHERE l.student_id IS NOT NULL), '[]') AS levels
     FROM skills sk LEFT JOIN skill_levels l ON l.skill_id = sk.id
       AND ($1::int IS NULL OR l.student_id = $1)
     GROUP BY sk.id ORDER BY sk.name`, [sid]);
  return rows;
}

export async function create(user: AuthUser, b: any) {
  if (!b.name || !String(b.name).trim()) throw new HttpError(400, 'اسم المهارة مطلوب');
  try {
    const { rows } = await q('INSERT INTO skills(name, description) VALUES ($1,$2) RETURNING *',
      [String(b.name).trim(), b.description || null]);
    return rows[0];
  } catch (e: any) {
    if (e.code === '23505') throw new HttpError(409, 'هذه المهارة موجودة مسبقاً');
    throw e;
  }
}

export async function setLevels(user: AuthUser, skillId: number, rowsIn: any[]) {
  const sk = await q('SELECT 1 FROM skills WHERE id = $1', [skillId]);
  if (!sk.rowCount) throw new HttpError(404, 'المهارة غير موجودة');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of rowsIn ?? []) {
      const sid = Number(r.student_id), lv = Number(r.level);
      if (!sid || !Number.isInteger(lv) || lv < 1 || lv > 5)
        throw new HttpError(400, 'مستوى الإتقان يجب أن يكون بين 1 و 5');
      await client.query(
        `INSERT INTO skill_levels(skill_id, student_id, level, note) VALUES ($1,$2,$3,$4)
         ON CONFLICT (skill_id, student_id) DO UPDATE SET level = EXCLUDED.level, note = EXCLUDED.note, updated_at = now()`,
        [skillId, sid, lv, r.note || null]);
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
  return { saved: (rowsIn ?? []).length, skill_id: skillId, updated_by: user.id };
}

export async function remove(id: number) {
  const { rows } = await q('DELETE FROM skills WHERE id = $1 RETURNING id', [id]);
  if (!rows[0]) throw new HttpError(404, 'المهارة غير موجودة');
  return rows[0];
}
