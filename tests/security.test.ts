import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, ensureReady, asTeacher, asStudentA, asAdmin, login } from './helpers';

beforeAll(() => ensureReady());

describe('تقوية أمنية', () => {
  it('ترويسات الأمان الأساسية موجودة والخادم لا يكشف نفسه', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('الخروج يُبطل الجلسة من الخادم وليس الكوكي فقط', async () => {
    const cookie = await login('studentA', 'student-pass');
    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(401);

    // تسجيل دخول جديد يعمل بعد الإبطال
    const fresh = await asStudentA();
    const me2 = await request(app).get('/api/auth/me').set('Cookie', fresh);
    expect(me2.status).toBe(200);
  });

  it('ملف PDF مزيف المحتوى يُرفض ولا يُنشأ الاختبار', async () => {
    const t = await asTeacher();
    const res = await request(app).post('/api/tests').set('Cookie', t)
      .field('title', 'اختبار بملف مزيف')
      .field('kind', 'test')
      .field('max_score', '10')
      .field('grade', 'الرابع')
      .field('section', 'أ')
      .attach('file', Buffer.from('<html>not a pdf</html>'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    const list = await request(app).get('/api/tests').set('Cookie', t);
    expect(list.body.some((x: any) => x.title === 'اختبار بملف مزيف')).toBe(false);
  });

  it('دور admin يستطيع العمليات الإدارية كالمعلمة', async () => {
    const cookie = await asAdmin();
    const r = await request(app).post('/api/students').set('Cookie', cookie)
      .send({ name: 'طالبة إدارة', grade: 'الرابع', section: 'أ' });
    expect(r.status).toBe(201);
  });

  it('لا يمكن للإدارة إيقاف أو حذف حسابها الحالي', async () => {
    const admin = await asAdmin();
    const me = await request(app).get('/api/auth/me').set('Cookie', admin);
    const id = me.body.user.id;
    const off = await request(app).patch('/api/users/' + id).set('Cookie', admin).send({ active: false });
    expect(off.status).toBe(400);
    const del = await request(app).delete('/api/users/' + id).set('Cookie', admin);
    expect(del.status).toBe(400);
  });

  it('سجل التدقيق متاح للإدارة فقط وبشكل صفحة { items, total, limit, offset }', async () => {
    const teacher = await asTeacher();
    const denied = await request(app).get('/api/audit').set('Cookie', teacher);
    expect(denied.status).toBe(403);

    const admin = await asAdmin();
    const res = await request(app).get('/api/audit?limit=2').set('Cookie', admin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.limit).toBe(2);
    expect(res.body.offset).toBe(0);
    expect(res.body.total).toBeGreaterThanOrEqual(res.body.items.length);

    const filtered = await request(app).get('/api/audit?q=login&limit=5').set('Cookie', admin);
    expect(filtered.status).toBe(200);
    expect(filtered.body.items.every((x: any) => /login/i.test(x.action))).toBe(true);
  });

  it('سياسة كلمة المرور ترفض القصيرة أو بلا رقم، وتقبل المطابقة', async () => {
    const t = await asTeacher();
    const st = await request(app).post('/api/students').set('Cookie', t)
      .send({ name: 'طالبة سياسة المرور', grade: 'الرابع', section: 'أ' });
    const sid = st.body.id;

    const weak = [
      '12345678',          // بلا حرف
      'password',          // بلا رقم
      'Ab1',               // قصيرة
      'A1'.repeat(40),     // أكثر من 72 بايت
    ];
    for (const password of weak) {
      const res = await request(app).post('/api/users').set('Cookie', t)
        .send({ username: 'weak-' + password.slice(0, 4), password, role: 'student', student_id: sid });
      expect(res.status).toBe(400);
    }
    const ok = await request(app).post('/api/users').set('Cookie', t)
      .send({ username: 'strong1', password: 'Lughati2026', role: 'student', student_id: sid });
    expect(ok.status).toBe(201);
  });
});
