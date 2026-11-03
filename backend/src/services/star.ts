import { q } from '../database/pool';
import { HttpError } from '../middleware/errors';
import { AuthUser } from '../middleware/auth';

export function sundayOf(dstr: string): string {
  const d = new Date(dstr + 'T00:00:00Z');
  if (isNaN(d.getTime())) throw new HttpError(400, 'التاريخ غير صالح');
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // بداية الأسبوع = الأحد
  return d.toISOString().slice(0, 10);
}

export async function current() {
  const ws = sundayOf(new Date().toISOString().slice(0, 10));
  const { rows } = await q(
    `SELECT w.*, s.name AS student_name FROM weekly_star w JOIN students s ON s.id = w.student_id
     WHERE w.week_start = $1`, [ws]);
  return rows[0] ?? null;
}

export async function list(from?: string, to?: string) {
  const { rows } = await q(
    `SELECT w.*, s.name AS student_name FROM weekly_star w JOIN students s ON s.id = w.student_id
     WHERE ($1::date IS NULL OR w.week_start >= $1) AND ($2::date IS NULL OR w.week_start <= $2)
     ORDER BY w.week_start DESC`, [from || null, to || null]);
  return rows;
}

export async function put(user: AuthUser, b: any) {
  const sid = Number(b.student_id);
  if (!sid) throw new HttpError(400, 'حددي الطالبة');
  const ws = sundayOf(b.date || new Date().toISOString().slice(0, 10));
  const st = await q('SELECT 1 FROM students WHERE id = $1', [sid]);
  if (!st.rowCount) throw new HttpError(404, 'الطالبة غير موجودة');
  const { rows } = await q(
    `INSERT INTO weekly_star(week_start, week_label, student_id, reason, created_by)
     VALUES ($1::date, 'أسبوع ' || $1::text, $2, $3, $4)
     ON CONFLICT (week_start) DO UPDATE SET student_id = EXCLUDED.student_id, reason = EXCLUDED.reason
     RETURNING *`, [ws, sid, b.reason || null, user.id]);
  return rows[0];
}
