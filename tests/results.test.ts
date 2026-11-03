import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, ensureReady, asTeacher, pool } from './helpers';

beforeAll(() => ensureReady());

async function newTest(cookie: string, title: string) {
  const res = await request(app).post('/api/tests').set('Cookie', cookie)
    .send({ title, kind: 'test', max_score: 10, grade: 'الرابع', section: 'أ' });
  expect(res.status).toBe(201);
  return res.body.id;
}

describe('رصد نتائج الاختبارات', () => {
  it('الدرجة الفارغة تحذف النتيجة السابقة', async () => {
    const t = await asTeacher();
    const id = await newTest(t, 'اختبار الحذف');

    let r = await request(app).put(`/api/tests/${id}/results`).set('Cookie', t)
      .send({ rows: [{ student_id: 1, score: 8 }, { student_id: 2, score: 7 }] });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ saved: 2, removed: 0 });

    r = await request(app).put(`/api/tests/${id}/results`).set('Cookie', t)
      .send({ rows: [{ student_id: 1, score: null }, { student_id: 2, score: 9 }] });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ saved: 1, removed: 1 });

    const rows = (await pool.query(
      'SELECT student_id, score::float8 AS score FROM results WHERE test_id = $1 ORDER BY student_id', [id])).rows;
    expect(rows).toEqual([{ student_id: 2, score: 9 }]);
  });

  it('ترفض درجة لطالبة من صف/شعبة آخر', async () => {
    const t = await asTeacher();
    const st = await request(app).post('/api/students').set('Cookie', t)
      .send({ name: 'طالبة صف آخر', grade: 'الخامس', section: 'ب' });
    expect(st.status).toBe(201);

    const id = await newTest(t, 'اختبار الانتماء');
    const r = await request(app).put(`/api/tests/${id}/results`).set('Cookie', t)
      .send({ rows: [{ student_id: st.body.id, score: 5 }] });
    expect(r.status).toBe(400);
  });

  it('درجة غير صالحة تُلغي الحفظ كله (ذرّية)', async () => {
    const t = await asTeacher();
    const id = await newTest(t, 'اختبار الذرّية');
    const r = await request(app).put(`/api/tests/${id}/results`).set('Cookie', t)
      .send({ rows: [{ student_id: 1, score: 5 }, { student_id: 2, score: 11 }] });
    expect(r.status).toBe(400);

    const n = (await pool.query('SELECT count(*)::int AS n FROM results WHERE test_id = $1', [id])).rows[0].n;
    expect(n).toBe(0);
  });
});
