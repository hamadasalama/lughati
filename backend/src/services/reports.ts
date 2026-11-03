import { q } from '../database/pool';
import { AuthUser, assertStudentAccess } from '../middleware/auth';

/** اتجاه الطالبة: لا يُصدَر حكم قبل 4 تقييمات حاضرة على الأقل */
function trend(series: { d: string; v: number }[]) {
  if (series.length < 4) return { enough: false, n: series.length, slope: null };
  const xs = series.map(e => Date.parse(e.d) / 86400000), ys = series.map(e => e.v);
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let a1 = 0, b1 = 0;
  for (let i = 0; i < n; i++) { a1 += (xs[i] - mx) * (ys[i] - my); b1 += (xs[i] - mx) ** 2; }
  return { enough: true, n, slope: b1 ? +(a1 / b1).toFixed(4) : 0 };
}

export async function summary(f: { from?: string; to?: string; grade?: string; section?: string }) {
  const { rows } = await q(
    `SELECT s.id, s.code, s.name, s.grade, s.section,
       count(e.id) FILTER (WHERE e.attendance = 'present')  AS present,
       count(e.id) FILTER (WHERE e.attendance = 'excused')  AS excused,
       count(e.id) FILTER (WHERE e.attendance = 'absent')   AS absent,
       round(avg(e.behavior)      FILTER (WHERE e.attendance = 'present')::numeric, 2)::float8 AS behavior,
       round(avg(e.participation) FILTER (WHERE e.attendance = 'present')::numeric, 2)::float8 AS participation,
       round(avg(e.homework)      FILTER (WHERE e.attendance = 'present')::numeric, 2)::float8 AS homework,
       max(e.eval_date) AS last_eval
     FROM students s
     LEFT JOIN evaluations e ON e.student_id = s.id
       AND ($1::date IS NULL OR e.eval_date >= $1) AND ($2::date IS NULL OR e.eval_date <= $2)
     WHERE s.active AND ($3::text IS NULL OR s.grade = $3) AND ($4::text IS NULL OR s.section = $4)
     GROUP BY s.id ORDER BY s.grade, s.section, s.name`,
    [f.from || null, f.to || null, f.grade || null, f.section || null]);

  const { rows: series } = await q(
    `SELECT student_id, eval_date AS d,
       ((COALESCE(behavior,0) + COALESCE(participation,0) + COALESCE(homework,0))
        / NULLIF((behavior IS NOT NULL)::int + (participation IS NOT NULL)::int + (homework IS NOT NULL)::int, 0))::float8 AS v
     FROM evaluations
     WHERE attendance = 'present' AND ($1::date IS NULL OR eval_date >= $1) AND ($2::date IS NULL OR eval_date <= $2)
     ORDER BY student_id, eval_date`, [f.from || null, f.to || null]);

  const byS = new Map<number, { d: string; v: number }[]>();
  for (const r of series) {
    if (!byS.has(r.student_id)) byS.set(r.student_id, []);
    byS.get(r.student_id)!.push({ d: r.d, v: r.v });
  }
  return rows.map(r => ({ ...r, trend: trend(byS.get(r.id) ?? []) }));
}

export async function compare(f: any) {
  const [a, b] = await Promise.all([
    summary({ from: f.fromA, to: f.toA, grade: f.grade, section: f.section }),
    summary({ from: f.fromB, to: f.toB, grade: f.grade, section: f.section })
  ]);
  const mapB = new Map(b.map((r: any) => [r.id, r]));
  return a.map((ra: any) => {
    const rb: any = mapB.get(ra.id);
    const delta = (k: string) => (rb && ra[k] != null && rb[k] != null) ? +(rb[k] - ra[k]).toFixed(2) : null;
    return {
      student: { id: ra.id, name: ra.name, grade: ra.grade, section: ra.section },
      periodA: ra, periodB: rb ?? null,
      delta: { behavior: delta('behavior'), participation: delta('participation'), homework: delta('homework') },
      trendEnough: ra.trend.enough && (!rb || rb.trend.enough) // لا مقارنة اتجاه بدون بيانات كافية
    };
  });
}

export async function studentReport(user: AuthUser, id: number, f: { from?: string; to?: string }) {
  assertStudentAccess(user, id);
  const [st, evals, counts, tests, worksheets, plans, skills, stars] = await Promise.all([
    q('SELECT * FROM students WHERE id = $1', [id]),
    q(`SELECT * FROM evaluations WHERE student_id = $1 AND ($2::date IS NULL OR eval_date >= $2)
         AND ($3::date IS NULL OR eval_date <= $3) ORDER BY eval_date DESC, id DESC`, [id, f.from || null, f.to || null]),
    q(`SELECT count(*) FILTER (WHERE attendance='present') AS present,
              count(*) FILTER (WHERE attendance='excused') AS excused,
              count(*) FILTER (WHERE attendance='absent')  AS absent,
              round(avg(behavior)      FILTER (WHERE attendance='present')::numeric,2)::float8 AS behavior,
              round(avg(participation) FILTER (WHERE attendance='present')::numeric,2)::float8 AS participation,
              round(avg(homework)      FILTER (WHERE attendance='present')::numeric,2)::float8 AS homework
       FROM evaluations WHERE student_id = $1 AND ($2::date IS NULL OR eval_date >= $2)
         AND ($3::date IS NULL OR eval_date <= $3)`, [id, f.from || null, f.to || null]),
    // اختبارات صف الطالبة وشعبتها فقط — لا عناوين اختبارات من صفوف أخرى
    q(`SELECT t.id, t.title, t.kind, t.max_score::float8 AS max_score, t.test_date, t.file_id,
              r.score::float8 AS score, r.note,
              f.original_name AS file_original_name, f.mime AS file_mime
       FROM tests t
       LEFT JOIN results r ON r.test_id = t.id AND r.student_id = $1
       LEFT JOIN files f ON f.id = t.file_id
       WHERE t.grade = (SELECT grade FROM students WHERE id = $1)
         AND t.section = (SELECT section FROM students WHERE id = $1)
         AND ($2::date IS NULL OR t.test_date >= $2) AND ($3::date IS NULL OR t.test_date <= $3)
       ORDER BY t.test_date DESC`, [id, f.from || null, f.to || null]),
    q(`SELECT w.id, w.title, w.description, w.work_date, w.due_date, COALESCE(t.done, false) AS done,
              (SELECT id FROM files fi WHERE fi.worksheet_id = w.id LIMIT 1) AS file_id
       FROM worksheets w LEFT JOIN worksheet_targets t ON t.worksheet_id = w.id AND t.student_id = $1
       WHERE w.grade = (SELECT grade FROM students WHERE id = $1)
         AND w.section = (SELECT section FROM students WHERE id = $1)
         AND (NOT EXISTS (SELECT 1 FROM worksheet_targets x WHERE x.worksheet_id = w.id) OR t.student_id IS NOT NULL)
       ORDER BY w.work_date DESC`, [id]),
    q(`SELECT p.*, COALESCE(json_agg(json_build_object('id', fu.id, 'follow_date', fu.follow_date, 'note', fu.note,
              'created_at', fu.created_at)
              ORDER BY fu.follow_date, fu.id) FILTER (WHERE fu.id IS NOT NULL), '[]') AS followups
       FROM plans p LEFT JOIN plan_followups fu ON fu.plan_id = p.id
       WHERE p.student_id = $1 GROUP BY p.id ORDER BY p.status, p.to_date DESC NULLS LAST`, [id]),
    q(`SELECT sk.id, sk.name, sk.description, l.level, l.note
       FROM skills sk LEFT JOIN skill_levels l ON l.skill_id = sk.id AND l.student_id = $1 ORDER BY sk.name`, [id]),
    q('SELECT week_start, week_label, reason FROM weekly_star WHERE student_id = $1 ORDER BY week_start DESC', [id])
  ]);
  if (!st.rows[0]) return null;
  return {
    student: st.rows[0],
    evaluations: evals.rows,
    counts: counts.rows[0],
    tests: tests.rows,
    worksheets: worksheets.rows,
    plans: plans.rows,
    skills: skills.rows,
    stars: stars.rows
  };
}
