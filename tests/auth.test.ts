import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, ensureReady, asTeacher, asStudentA, pool } from './helpers';

beforeAll(() => ensureReady());

describe('الاتصال الفعلي بقاعدة البيانات', () => {
  it('GET /api/health يتحقق من اتصال PostgreSQL حقيقياً', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('ok');
    expect(res.body.now).toBeTruthy();
  });
  it('استعلام مباشر يعمل', async () => {
    const r = await pool.query('SELECT count(*)::int AS n FROM users');
    expect(r.rows[0].n).toBeGreaterThanOrEqual(3);
  });
});

describe('المصادقة', () => {
  it('دخول صحيح يعيد المستخدم ويضع كوكي جلسة', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'teacher1', password: 'teacher-pass' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('teacher');
    expect(res.headers['set-cookie']).toBeTruthy();
  });
  it('دخول بكلمة مرور خاطئة ← 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'teacher1', password: 'wrong' });
    expect(res.status).toBe(401);
  });
  it('كلمة المرور لا تُعاد أبداً في أي استجابة', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'teacher1', password: 'teacher-pass' });
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });
  it('مسار محمي بدون جلسة ← 401', async () => {
    const res = await request(app).get('/api/students');
    expect(res.status).toBe(401);
  });
  it('GET /api/auth/me بجلسة سليمة يعرف صاحبة الجلسة', async () => {
    const cookie = await asTeacher();
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('teacher1');
  });
  it('GET /api/auth/me يعيد student_id بصيغة الواجهة للطالبة', async () => {
    const cookie = await asStudentA();
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('student');
    expect(res.body.user.student_id).toBe(1);
    expect(res.body.user.name).toBe('طالبة اختبار أ');
  });
  it('قفل محاولات الدخول بعد 5 محاولات فاشلة، ويُصفَّر بعد إزالة القفل', async () => {
    for (let i = 1; i <= 5; i++) {
      const r = await request(app).post('/api/auth/login').send({ username: 'teacher1', password: 'wrong-' + i });
      expect(r.status).toBe(401);
    }
    // حتى كلمة المرور الصحيحة مرفوضة أثناء القفل
    const locked = await request(app).post('/api/auth/login').send({ username: 'teacher1', password: 'teacher-pass' });
    expect(locked.status).toBe(429);

    const row = await pool.query(`SELECT fails FROM login_throttle WHERE bucket = 'u:teacher1'`);
    expect(row.rows[0]?.fails).toBeGreaterThanOrEqual(5);

    // القفل مُخزَّن في PostgreSQL فيعمل مع أكثر من نسخة خادم
    await pool.query(`DELETE FROM login_throttle WHERE bucket = 'u:teacher1'`);
    const ok = await request(app).post('/api/auth/login').send({ username: 'teacher1', password: 'teacher-pass' });
    expect(ok.status).toBe(200);
  });
});
