import { q } from '../database/pool';
import { HttpError } from '../middleware/errors';
import { AuthUser, assertStudentAccess } from '../middleware/auth';

export async function threads() { // للمعلمة: كل المحادثات مع غير المقروء
  const { rows } = await q(
    `SELECT s.id AS student_id, s.name, s.grade, s.section,
            m.body AS last_body, m.sent_at AS last_at, m.sender AS last_sender,
            (SELECT count(*) FROM messages x
              WHERE x.student_id = s.id AND x.sender = 'student' AND x.seen_teacher = false) AS unread
     FROM students s
     LEFT JOIN LATERAL (SELECT * FROM messages m WHERE m.student_id = s.id ORDER BY m.sent_at DESC LIMIT 1) m ON true
     WHERE s.active
     ORDER BY (SELECT count(*) FROM messages x WHERE x.student_id = s.id AND x.sender='student' AND x.seen_teacher=false) DESC,
              m.sent_at DESC NULLS LAST, s.name`);
  return rows;
}

export async function thread(user: AuthUser, studentId: number) {
  assertStudentAccess(user, studentId);
  if (user.role === 'student')
    await q("UPDATE messages SET seen_student = true WHERE student_id = $1 AND sender = 'teacher' AND seen_student = false", [studentId]);
  else
    await q("UPDATE messages SET seen_teacher = true WHERE student_id = $1 AND sender = 'student' AND seen_teacher = false", [studentId]);
  const { rows } = await q(
    'SELECT id, sender, body, sent_at FROM messages WHERE student_id = $1 ORDER BY sent_at ASC LIMIT 200', [studentId]);
  return rows;
}

export async function send(user: AuthUser, studentId: number, body: string) {
  assertStudentAccess(user, studentId);
  const text = String(body ?? '').trim();
  if (!text) throw new HttpError(400, 'نص الرسالة مطلوب');
  if (text.length > 4000) throw new HttpError(400, 'الرسالة طويلة جداً');
  const { rows } = await q(
    'INSERT INTO messages(student_id, sender, body) VALUES ($1,$2,$3) RETURNING *',
    [studentId, user.role === 'student' ? 'student' : 'teacher', text]);
  return rows[0];
}
