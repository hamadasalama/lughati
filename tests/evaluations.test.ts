import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, ensureReady, asTeacher, pool } from './helpers';

beforeAll(() => ensureReady());

describe('التقييمات: تراكمية ومقيّدة', () => {
  it('المعلمة تنشئ تقييماً وينجح', async () => {
    const cookie = await asTeacher();
    const res = await request(app).post('/api/evaluations').set('Cookie', cookie)
      .send({ student_id: 1, eval_date: '2025-01-10', attendance: 'present', behavior: 5, participation: 4, homework: 4, notes: 'مشاركة ممتازة' });
    expect(res.status).toBe(201);
    expect(res.body.attendance).toBe('present');
  });
  it('تقييم ثانٍ بنفس التاريخ يُقبَل (التراكمية — لا كتابة فوق السابق)', async () => {
    const cookie = await asTeacher();
    const res = await request(app).post('/api/evaluations').set('Cookie', cookie)
      .send({ student_id: 1, eval_date: '2025-01-10', attendance: 'present', behavior: 3, participation: 3, homework: 3 });
    expect(res.status).toBe(201);
    const list = await request(app).get('/api/evaluations?student_id=1').set('Cookie', cookie);
    const sameDay = list.body.filter((e: any) => e.eval_date === '2025-01-10');
    expect(sameDay.length).toBe(2);
  });
  it('درجة خارج السلم (9) ← 400', async () => {
    const cookie = await asTeacher();
    const res = await request(app).post('/api/evaluations').set('Cookie', cookie)
      .send({ student_id: 1, eval_date: '2025-01-11', attendance: 'present', behavior: 9, participation: 4, homework: 4 });
    expect(res.status).toBe(400);
  });
  it('درجات لطالبة غائبة ← 400 (الحضور مستقل عن الدرجات)', async () => {
    const cookie = await asTeacher();
    const res = await request(app).post('/api/evaluations').set('Cookie', cookie)
      .send({ student_id: 1, eval_date: '2025-01-12', attendance: 'absent', behavior: 4, participation: 4, homework: 4 });
    expect(res.status).toBe(400);
    const ok = await request(app).post('/api/evaluations').set('Cookie', cookie)
      .send({ student_id: 1, eval_date: '2025-01-12', attendance: 'absent' });
    expect(ok.status).toBe(201);
    expect(ok.body.behavior).toBeNull();
  });
  it('كل عملية إنشاء/حذف تقييم تُسجَّل في سجل التدقيق', async () => {
    const cookie = await asTeacher();
    const created = await request(app).post('/api/evaluations').set('Cookie', cookie)
      .send({ student_id: 1, eval_date: '2025-01-13', attendance: 'present', behavior: 4, participation: 4, homework: 4 });
    await request(app).delete(`/api/evaluations/${created.body.id}`).set('Cookie', cookie);
    const logs = await pool.query(`SELECT action FROM audit_logs WHERE entity = 'evaluation' ORDER BY id DESC LIMIT 2`);
    expect(logs.rows.map(r => r.action)).toEqual(['evaluation.delete', 'evaluation.create']);
  });
});
