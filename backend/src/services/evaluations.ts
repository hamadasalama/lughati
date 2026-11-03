import { q } from '../database/pool';
import { HttpError } from '../middleware/errors';
import { AuthUser, assertStudentAccess } from '../middleware/auth';
import { isIsoDate } from '../utils/date';

const score = (v: any) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new HttpError(400, 'الدرجة يجب أن تكون بين 1 و 5');
  return n;
};

export async function list(user: AuthUser, f: { student_id?: string; from?: string; to?: string }) {
  let sid: number;
  if (user.role === 'student') {
    // الطالبة التي تطلب صراحةً بيانات طالبة أخرى تُرفض 403 — لا تجاوز صامت
    if (f.student_id !== undefined && f.student_id !== '' && Number(f.student_id) !== user.studentId)
      throw new HttpError(403, 'غير مصرح بالوصول لهذه البيانات');
    sid = user.studentId!;
  } else {
    sid = Number(f.student_id);
  }
  if (!sid) throw new HttpError(400, 'حددي طالبة');
  assertStudentAccess(user, sid);
  if ((f.from && !isIsoDate(f.from)) || (f.to && !isIsoDate(f.to)))
    throw new HttpError(400, 'نطاق التاريخ غير صالح');
  const { rows } = await q(
    `SELECT * FROM evaluations WHERE student_id = $1
       AND ($2::date IS NULL OR eval_date >= $2) AND ($3::date IS NULL OR eval_date <= $3)
     ORDER BY eval_date DESC, id DESC`,
    [sid, f.from || null, f.to || null]);
  return rows;
}

export async function create(user: AuthUser, b: any) {
  const sid = Number(b.student_id);
  if (!sid) throw new HttpError(400, 'حددي الطالبة');
  if (!isIsoDate(b.eval_date)) throw new HttpError(400, 'التاريخ غير صالح');
  const attendance = b.attendance;
  if (!['present', 'excused', 'absent'].includes(attendance)) throw new HttpError(400, 'حالة الحضور غير صالحة');
  const st = await q('SELECT 1 FROM students WHERE id = $1', [sid]);
  if (!st.rowCount) throw new HttpError(404, 'الطالبة غير موجودة');
  let behavior: number | null = null, participation: number | null = null, homework: number | null = null;
  if (attendance === 'present') {
    behavior = score(b.behavior); participation = score(b.participation); homework = score(b.homework);
    if (behavior === null || participation === null || homework === null)
      throw new HttpError(400, 'أكملي درجات السلوك والمشاركة والواجب');
  } else if (b.behavior != null || b.participation != null || b.homework != null) {
    throw new HttpError(400, 'لا تُسجَّل درجات لطالبة غير حاضرة'); // الحضور مستقل عن الدرجات
  }
  const { rows } = await q(
    `INSERT INTO evaluations(student_id, eval_date, attendance, behavior, participation, homework, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [sid, b.eval_date, attendance, behavior, participation, homework, b.notes || null, user.id]);
  return rows[0];
}

export async function remove(id: number) {
  const { rows } = await q('DELETE FROM evaluations WHERE id = $1 RETURNING id, student_id', [id]);
  if (!rows[0]) throw new HttpError(404, 'التقييم غير موجود');
  return rows[0];
}
