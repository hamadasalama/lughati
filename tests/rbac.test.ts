import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { app, ensureReady, asTeacher, asStudentA, asStudentB } from './helpers';

beforeAll(() => ensureReady());

describe('الصلاحيات تُفرض على الخادم (وليس في الواجهة)', () => {
  it('طالبة A تحاول قراءة بيانات الطالبة B مباشرة ← 403', async () => {
    const cookie = await asStudentA();
    const res = await request(app).get('/api/students/2').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });
  it('طالبة A تحاول قراءة تقييمات الطالبة B ← 403', async () => {
    const cookie = await asStudentA();
    const res = await request(app).get('/api/evaluations?student_id=2').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });
  it('طالبة تحاول إنشاء تقييم (تزوير درجة) ← 403', async () => {
    const cookie = await asStudentA();
    const res = await request(app).post('/api/evaluations')
      .set('Cookie', cookie)
      .send({ student_id: 1, eval_date: '2025-01-01', attendance: 'present', behavior: 5, participation: 5, homework: 5 });
    expect(res.status).toBe(403);
  });
  it('طالبة تحاول إدخال نتائج اختبار ← 403', async () => {
    const t = await request(app).post('/api/tests').set('Cookie', await asTeacher())
      .send({ title: 'اختبار الصلاحيات', kind: 'test', max_score: 10, grade: 'الرابع', section: 'أ' });
    const cookie = await asStudentA();
    const res = await request(app).put(`/api/tests/${t.body.id}/results`).set('Cookie', cookie)
      .send({ rows: [{ student_id: 1, score: 10 }] });
    expect(res.status).toBe(403);
  });
  it('طالبة ترسل رسالة باسم طالبة أخرى ← 403', async () => {
    const cookie = await asStudentA();
    const res = await request(app).post('/api/messages').set('Cookie', cookie)
      .send({ student_id: 2, body: 'أنا لست صاحبة هذه المحادثة' });
    expect(res.status).toBe(403);
  });
  it('طالبة تحاول اختيار نجم الأسبوع ← 403', async () => {
    const cookie = await asStudentA();
    const res = await request(app).put('/api/star').set('Cookie', cookie)
      .send({ date: '2025-01-05', student_id: 1, reason: 'تزوير' });
    expect(res.status).toBe(403);
  });
  it('طالبة تحاول قراءة سجل التدقيق ← 403', async () => {
    const cookie = await asStudentA();
    const res = await request(app).get('/api/audit').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });
  it('طالبة تحاول إنشاء حساب لطالبة ثالثة ← 403 (لا تسجيل ذاتي)', async () => {
    const cookie = await asStudentA();
    const res = await request(app).post('/api/users').set('Cookie', cookie)
      .send({ username: 'hacker', password: '123456', role: 'student', student_id: 2 });
    expect(res.status).toBe(403);
  });
  it('الطالبة تصل لتقريرها هي فقط، وتُمنع من تقرير غيرها', async () => {
    const cookie = await asStudentA();
    const ok = await request(app).get('/api/reports/student/1').set('Cookie', cookie);
    expect(ok.status).toBe(200);
    const no = await request(app).get('/api/reports/student/2').set('Cookie', cookie);
    expect(no.status).toBe(403);
  });
  it('ملف خاص بطالبة لا تفتحه طالبة أخرى بتغيير رقم الملف، وصاحبته تفتحه', async () => {
    // في التطبيق كل الرفع بيد المعلمة؛ هنا نُنشئ ملفاً خاصاً بطالبة مباشرة في قاعدة الاختبار
    // لنختبر قاعدة الوصول نفسها كما لو حاول أحد التلاعب برابط التنزيل
    const { pool } = await import('./helpers');
    const { env } = await import('../backend/src/config');
    fs.mkdirSync(env.uploadDirAbs, { recursive: true });
    fs.writeFileSync(path.join(env.uploadDirAbs, 'private-x.txt'), 'private content');
    await pool.query(
      `INSERT INTO files(stored_name, original_name, mime, size_bytes, kind, student_id)
       VALUES ('private-x.txt','private.txt','text/plain',15,'worksheet',1)`);
    const privId = (await pool.query(`SELECT id FROM files WHERE stored_name='private-x.txt'`)).rows[0].id;
    const bCookie = await asStudentB();
    const denied = await request(app).get(`/api/files/${privId}`).set('Cookie', bCookie);
    expect([403, 404]).toContain(denied.status);
    const aCookie = await asStudentA();
    const ok = await request(app).get(`/api/files/${privId}`).set('Cookie', aCookie);
    expect(ok.status).toBe(200);
  });
});
