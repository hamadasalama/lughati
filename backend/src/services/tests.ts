import { q, pool } from '../database/pool';
import { HttpError } from '../middleware/errors';
import { AuthUser } from '../middleware/auth';
import * as filesSvc from './files';
import { isIsoDate } from '../utils/date';

const norm = (r: any) => ({ ...r, score: r.score == null ? null : Number(r.score), max_score: Number(r.max_score) });

export async function list(user: AuthUser, f: { kind?: string; grade?: string; section?: string }) {
  if (user.role === 'student') {
    const sid = user.studentId!;
    const { rows } = await q(
      `SELECT t.id, t.title, t.kind, t.max_score, t.test_date, t.file_id,
              r.score, r.note,
              f.stored_name AS file_name, f.original_name AS file_original_name, f.mime AS file_mime
       FROM tests t
       LEFT JOIN results r ON r.test_id = t.id AND r.student_id = $1
       LEFT JOIN files f ON f.id = t.file_id
       WHERE t.grade = (SELECT grade FROM students WHERE id = $1)
         AND t.section = (SELECT section FROM students WHERE id = $1)
         AND ($2::text IS NULL OR t.kind = $2)
       ORDER BY t.test_date DESC, t.id DESC`, [sid, f.kind || null]);
    return rows.map(norm);
  }

  const { rows } = await q(
    `SELECT t.*, 
            (SELECT count(*)::int FROM results r WHERE r.test_id = t.id) AS results_count,
            COALESCE((SELECT json_agg(json_build_object('student_id', r.student_id, 'score', r.score, 'note', r.note)
                                      ORDER BY r.student_id)
                      FROM results r WHERE r.test_id = t.id), '[]') AS results,
            f.stored_name AS file_name, f.original_name AS file_original_name, f.mime AS file_mime
     FROM tests t
     LEFT JOIN files f ON f.id = t.file_id
     WHERE ($1::text IS NULL OR t.kind = $1) 
       AND ($2::text IS NULL OR t.grade = $2) 
       AND ($3::text IS NULL OR t.section = $3)
     ORDER BY t.test_date DESC, t.id DESC`, 
    [f.kind || null, f.grade || null, f.section || null]
  );
  return rows.map(norm);
}

export async function create(user: AuthUser, b: any) {
  if (!b.title || !String(b.title).trim()) throw new HttpError(400, 'عنوان الاختبار مطلوب');
  if (!['test', 'nafis'].includes(b.kind)) throw new HttpError(400, 'نوع الاختبار غير صالح');
  const max = Number(b.max_score);
  if (!Number.isFinite(max) || max <= 0) throw new HttpError(400, 'الدرجة العظمى غير صالحة');
  if (!b.grade || !b.section) throw new HttpError(400, 'الصف والشعبة مطلوبان');
  if (b.test_date != null && b.test_date !== '' && !isIsoDate(b.test_date))
    throw new HttpError(400, 'تاريخ الاختبار غير صالح');
  if (b.file_id) {
    const file = await q("SELECT 1 FROM files WHERE id = $1 AND kind = 'test'", [b.file_id]);
    if (!file.rowCount) throw new HttpError(400, 'ملف الاختبار غير صالح');
  }

  const { rows } = await q(
    `INSERT INTO tests(title, kind, max_score, test_date, grade, section, created_by, file_id)
     VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, $7, $8) RETURNING *`,
    [
      String(b.title).trim(), 
      b.kind, 
      max, 
      b.test_date || null, 
      b.grade, 
      b.section, 
      user.id,
      b.file_id || null
    ]
  );
  return norm(rows[0]);
}

export async function saveResults(user: AuthUser, testId: number, rowsIn: any[]) {
  if (!Array.isArray(rowsIn)) throw new HttpError(400, 'قائمة الدرجات غير صالحة');
  const t = await q('SELECT * FROM tests WHERE id = $1', [testId]);
  if (!t.rows[0]) throw new HttpError(404, 'الاختبار غير موجود');
  const test = t.rows[0];
  const max = Number(test.max_score);

  // فرّق بين الدرجات التي تُحفظ وتلك التي مُسحت (حقل فارغ = حذف النتيجة)
  const seen = new Set<number>();
  const upserts: { sid: number; score: number; note: string | null }[] = [];
  const deletes: number[] = [];
  for (const r of rowsIn ?? []) {
    const sid = Number(r.student_id);
    if (!Number.isInteger(sid) || sid <= 0)
      throw new HttpError(400, 'معرّف طالبة غير صالح');
    if (seen.has(sid))
      throw new HttpError(400, 'تكرار في قائمة الطالبات');
    seen.add(sid);
    const raw = r.score;
    if (raw == null || String(raw).trim() === '') { deletes.push(sid); continue; }
    const sc = Number(raw);
    if (!Number.isFinite(sc) || sc < 0 || sc > max)
      throw new HttpError(400, 'درجة غير صالحة (تأكدي أنها بين 0 والدرجة العظمى)');
    upserts.push({ sid, score: sc, note: r.note || null });
  }

  // لا تُرصد درجة لطالبة خارج صف/شعبة الاختبار، ولا لطالبة غير موجودة
  if (seen.size) {
    const sids = [...seen];
    const { rows: studs } = await q(
      'SELECT id, grade, section FROM students WHERE id = ANY($1::int[])', [sids]);
    if (studs.length !== sids.length) throw new HttpError(400, 'إحدى الطالبات غير موجودة');
    const outside = studs.find((s: any) => s.grade !== test.grade || s.section !== test.section);
    if (outside) throw new HttpError(400, 'إحدى الطالبات لا تنتمي إلى صف/شعبة الاختبار');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (deletes.length) {
      await client.query(
        'DELETE FROM results WHERE test_id = $1 AND student_id = ANY($2::int[])',
        [testId, deletes]);
    }
    for (const r of upserts) {
      await client.query(
        `INSERT INTO results(test_id, student_id, score, note) VALUES ($1,$2,$3,$4)
         ON CONFLICT (test_id, student_id) DO UPDATE SET score = EXCLUDED.score, note = EXCLUDED.note, updated_at = now()`,
        [testId, r.sid, r.score, r.note]);
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
  return { saved: upserts.length, removed: deletes.length, test_id: testId, updated_by: user.id };
}

export async function remove(id: number) {
  const { rows } = await q('SELECT id, file_id FROM tests WHERE id = $1', [id]);
  if (!rows[0]) throw new HttpError(404, 'الاختبار غير موجود');
  // حذف المرفق من القاعدة والقرص مع الاختبار — لا ملفات يتيمة
  if (rows[0].file_id) await filesSvc.deleteById(rows[0].file_id);
  await q('DELETE FROM tests WHERE id = $1', [id]);
  return { id };
}