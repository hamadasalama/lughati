import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, ensureReady, asTeacher, asStudentA, login } from './helpers';

beforeAll(() => ensureReady());

describe('نجم الأسبوع (أميرتي هذا الأسبوع)', () => {
  it('المعلمة تختار نجمة الأسبوع ويُطبق قاعدة الأحد، وإعادة الاختيار تحدّث نفس الأسبوع', async () => {
    const cookie = await asTeacher();
    const r1 = await request(app).put('/api/star').set('Cookie', cookie)
      .send({ date: '2025-01-08', student_id: 1, reason: 'مشاركة متميزة' }); // أربعاء ← أسبوع يبدأ 2025-01-05
    expect(r1.status).toBe(200);
    expect(r1.body.week_start).toBe('2025-01-05');
    const r2 = await request(app).put('/api/star').set('Cookie', cookie)
      .send({ date: '2025-01-09', student_id: 2, reason: 'أُعيد الاختيار' });
    expect(r2.body.week_start).toBe('2025-01-05');
    const all = await request(app).get('/api/star').set('Cookie', cookie);
    const week = all.body.filter((s: any) => s.week_start === '2025-01-05');
    expect(week.length).toBe(1); // نجمة واحدة لكل أسبوع
  });
  it('النجمة الحالية مرئية للطالبة', async () => {
    const cookie = await asStudentA();
    const res = await request(app).get('/api/star/current').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });
});

describe('إدارة الحسابات', () => {
  it('المعلمة تنشئ حساب طالبة مرتبطاً برمزها الثابت', async () => {
    // الطالبة 1 لها حساب مسبقاً في بيانات الاختبار، لذا نضيف طالبة جديدة بلا حساب
    const { pool } = await import('./helpers');
    const st = await pool.query(`INSERT INTO students(code, name, grade, section)
                                 VALUES ('ST-003', 'طالبة ثالثة', 'الرابع', 'أ')
                                 ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
                                 RETURNING id`);
    const sid = st.rows[0].id;
    const cookie = await asTeacher();
    const res = await request(app).post('/api/users').set('Cookie', cookie)
      .send({ username: 'st001', password: 'secret123', role: 'student', student_id: sid });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.student_id).toBe(sid);
  });
  it('ربط الحساب بطالبة لها حساب بالفعل ← 409، واسم مستخدم مكرر ← 409', async () => {
    const cookie = await asTeacher();
    const dupStudent = await request(app).post('/api/users').set('Cookie', cookie)
      .send({ username: 'another', password: 'secret123', role: 'student', student_id: 1 });
    expect(dupStudent.status).toBe(409);
    const dupUser = await request(app).post('/api/users').set('Cookie', cookie)
      .send({ username: 'st001', password: 'secret123', role: 'student', student_id: 2 });
    expect(dupUser.status).toBe(409);
  });
  it('دورة حياة حساب الطالبة: إنشاء ← دخول ← إيقاف ← رفض ← تفعيل ← دخول', async () => {
    const t = await asTeacher();
    const st = await request(app).post('/api/students').set('Cookie', t)
      .send({ name: 'طالبة دورة حياة', grade: 'الرابع', section: 'أ' });
    expect(st.status).toBe(201);

    const created = await request(app).post('/api/users').set('Cookie', t)
      .send({ username: 'cycle1', password: 'Cycle1234', role: 'student', student_id: st.body.id });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.active).toBe(true);
    const uid = created.body.id;

    const first = await login('cycle1', 'Cycle1234');
    const me = await request(app).get('/api/auth/me').set('Cookie', first);
    expect(me.status).toBe(200);

    // الإيقاف: لا دخول جديد، والجلسة القائمة تُرفض فوراً لأن الحالة تُقرأ من القاعدة
    const off = await request(app).patch('/api/users/' + uid).set('Cookie', t).send({ active: false });
    expect(off.status).toBe(200);
    expect(off.body.active).toBe(false);
    const denied = await request(app).post('/api/auth/login').send({ username: 'cycle1', password: 'Cycle1234' });
    expect(denied.status).toBe(403);
    const oldSession = await request(app).get('/api/auth/me').set('Cookie', first);
    expect(oldSession.status).toBe(401);

    // التفعيل: يعود الدخول للعمل
    const on = await request(app).patch('/api/users/' + uid).set('Cookie', t).send({ active: true });
    expect(on.status).toBe(200);
    expect(on.body.active).toBe(true);
    const second = await login('cycle1', 'Cycle1234');
    const me2 = await request(app).get('/api/auth/me').set('Cookie', second);
    expect(me2.status).toBe(200);
  });
  it('الطالبة تغير كلمتها فتُبطَل الجلسات القديمة (token_version)', async () => {
    const cookie = await asStudentA();
    const ch = await request(app).post('/api/auth/change-password').set('Cookie', cookie)
      .send({ current: 'student-pass', new: 'new-pass-123' });
    expect(ch.status).toBe(200);
    const old = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(old.status).toBe(401);
  });
});

describe('الاستيراد الجماعي', () => {
  const rows = [
    { name: 'مستوردة أ', grade: 'الرابع', section: 'أ' },
    { name: 'مستوردة أ', grade: 'الرابع', section: 'أ' },
    { name: 'مستوردة ب', grade: 'الرابع', section: 'أ' },
    { name: '', grade: 'الرابع', section: 'أ' },
  ];

  it('يتجاهل المكرر داخل الملف والصفوف الناقصة', async () => {
    const cookie = await asTeacher();
    const res = await request(app).post('/api/students/import').set('Cookie', cookie).send({ rows });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ added: 2, skipped: 2, truncated: false });
  });

  it('لا يكرر الطالبة نفسها عند إعادة الاستيراد', async () => {
    const cookie = await asTeacher();
    const res = await request(app).post('/api/students/import').set('Cookie', cookie).send({ rows });
    expect(res.body).toMatchObject({ added: 0, skipped: 4 });
  });
});
