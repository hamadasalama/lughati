import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, ensureReady, asTeacher, asStudentA } from './helpers';
import { xlsxBuffer } from './xlsx';

beforeAll(() => ensureReady());

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function csv(rows: string[][]): Buffer {
  const text = '\uFEFF' + rows.map((r) => r.map((c) => {
    const v = String(c ?? '');
    return /[",;\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }).join(',')).join('\r\n');
  return Buffer.from(text, 'utf8');
}

async function loginOk(username: string, password: string) {
  return request(app).post('/api/auth/login').send({ username, password });
}

describe('استيراد الطالبات من Excel/CSV مع الحسابات', () => {
  it('CSV بترويسة عربية ينشئ الطالبة وحسابها ويمكن الدخول به', async () => {
    const cookie = await asTeacher();
    const file = csv([
      ['الرمز', 'الاسم', 'الصف', 'الشعبة', 'اسم المستخدم', 'كلمة المرور', 'ملاحظات'],
      ['ST-101', 'هدى الاختبار', 'الرابع', 'أ', 'huda.test', 'Huda2026', 'مستوردة'],
    ]);
    const res = await request(app).post('/api/students/import-file').set('Cookie', cookie)
      .attach('file', file, { filename: 'students.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ added: 1, updated: 0, invalid: 0, accountsCreated: 1 });
    expect(res.body.file.sheet).toBeNull();

    const found = await request(app).get('/api/students?q=ST-101').set('Cookie', cookie);
    expect(found.body).toHaveLength(1);
    expect(found.body[0]).toMatchObject({ code: 'ST-101', name: 'هدى الاختبار', grade: 'الرابع', section: 'أ' });

    const login = await loginOk('huda.test', 'Huda2026');
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('student');
  });

  it('ملف xlsx بترويسة يُقرأ ويُنشئ الحساب باسم المستخدم المحدد', async () => {
    const cookie = await asTeacher();
    const file = xlsxBuffer([
      ['الرمز', 'الاسم', 'الصف', 'الشعبة', 'اسم المستخدم', 'كلمة المرور'],
      ['ST-201', 'ليان الاختبار', 'الخامس', 'ب', 'layan.test', 'Layan2026'],
    ]);
    const res = await request(app).post('/api/students/import-file').set('Cookie', cookie)
      .attach('file', file, { filename: 'students.xlsx', contentType: XLSX_MIME });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ added: 1, invalid: 0, accountsCreated: 1 });
    expect(res.body.file.sheet).toBe('Students');

    const login = await loginOk('layan.test', 'Layan2026');
    expect(login.status).toBe(200);
  });

  it('إعادة استيراد الرمز نفسه تحدّث كلمة المرور وتُبطل الجلسات القديمة', async () => {
    const first = await loginOk('layan.test', 'Layan2026');
    expect(first.status).toBe(200);
    const oldCookie = [].concat(first.headers['set-cookie'] as any).join('; ');

    const cookie = await asTeacher();
    const file = xlsxBuffer([
      ['الرمز', 'الاسم', 'الصف', 'الشعبة', 'اسم المستخدم', 'كلمة المرور'],
      ['ST-201', 'ليان الاختبار', 'الخامس', 'ب', 'layan.test', 'NewLayan2026'],
    ]);
    const res = await request(app).post('/api/students/import-file').set('Cookie', cookie)
      .attach('file', file, { filename: 'students.xlsx', contentType: XLSX_MIME });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ added: 0, updated: 1, accountsUpdated: 1, invalid: 0 });

    const oldSession = await request(app).get('/api/auth/me').set('Cookie', oldCookie);
    expect(oldSession.status).toBe(401);

    const relogin = await loginOk('layan.test', 'NewLayan2026');
    expect(relogin.status).toBe(200);
    expect((await loginOk('layan.test', 'Layan2026')).status).toBe(401);
  });

  it('كلمة مرور ضعيفة ترفض الصف ولا تُنشئ الطالبة', async () => {
    const cookie = await asTeacher();
    const file = csv([
      ['الرمز', 'الاسم', 'الصف', 'الشعبة', 'اسم المستخدم', 'كلمة المرور'],
      ['ST-301', 'ضعيفة الاختبار', 'الرابع', 'أ', 'weak.test', '123'],
    ]);
    const res = await request(app).post('/api/students/import-file').set('Cookie', cookie)
      .attach('file', file, { filename: 'weak.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ added: 0, invalid: 1, accountsCreated: 0 });
    expect(res.body.errors[0].message).toContain('8');

    const found = await request(app).get('/api/students?q=ST-301').set('Cookie', cookie);
    expect(found.body).toHaveLength(0);
  });

  it('كلمة مرور مفقودة: تُنشأ الطالبة بلا حساب مع تنبيه واضح', async () => {
    const cookie = await asTeacher();
    const file = csv([
      ['الرمز', 'الاسم', 'الصف', 'الشعبة', 'اسم المستخدم', 'كلمة المرور'],
      ['ST-302', 'بدون كلمة الاختبار', 'الرابع', 'أ', 'nopass.test', ''],
    ]);
    const res = await request(app).post('/api/students/import-file').set('Cookie', cookie)
      .attach('file', file, { filename: 'nopass.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ added: 1, invalid: 0, accountsCreated: 0, accountsSkipped: 1 });
    expect(res.body.errors.some((e: any) => String(e.message).includes('كلمة المرور'))).toBe(true);

    const found = await request(app).get('/api/students?q=ST-302').set('Cookie', cookie);
    expect(found.body).toHaveLength(1);
  });

  it('ملف بلا ترويسة يُقرأ بالترتيب: الاسم، الصف، الشعبة، الرمز، المستخدم، المرور', async () => {
    const cookie = await asTeacher();
    const file = csv([
      ['سلمى الاختبار', 'السادس', 'ب', 'ST-401', 'salma.test', 'Salma2026', 'بلا ترويسة'],
    ]);
    const res = await request(app).post('/api/students/import-file').set('Cookie', cookie)
      .attach('file', file, { filename: 'positional.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ added: 1, accountsCreated: 1, invalid: 0 });

    const found = await request(app).get('/api/students?q=ST-401').set('Cookie', cookie);
    expect(found.body[0]).toMatchObject({ name: 'سلمى الاختبار', grade: 'السادس', section: 'ب' });
    expect((await loginOk('salma.test', 'Salma2026')).status).toBe(200);
  });

  it('صف خاطئ لا يمنع استيراد الصفوف الصحيحة (savepoint لكل صف)', async () => {
    const cookie = await asTeacher();
    const file = csv([
      ['الرمز', 'الاسم', 'الصف', 'الشعبة', 'اسم المستخدم', 'كلمة المرور'],
      ['ST-501', 'صحيحة الاختبار', 'الرابع', 'أ', 'good.test', 'Good2026'],
      ['ST-502', 'خاطئة الاختبار', 'الرابع', 'أ', 'bad.test', '123'],
      ['ST-503', 'أخرى الاختبار', 'الرابع', 'ب', 'other.test', 'Other2026'],
    ]);
    const res = await request(app).post('/api/students/import-file').set('Cookie', cookie)
      .attach('file', file, { filename: 'mixed.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ added: 2, invalid: 1, accountsCreated: 2 });
    const bad = await request(app).get('/api/students?q=ST-502').set('Cookie', cookie);
    expect(bad.body).toHaveLength(0);
  });

  it('اسم مستخدم تابع لطالبة أخرى يرفض الصف برسالة واضحة', async () => {
    const cookie = await asTeacher();
    const file = csv([
      ['الرمز', 'الاسم', 'الصف', 'الشعبة', 'اسم المستخدم', 'كلمة المرور'],
      ['ST-601', 'تعارض الاختبار', 'الرابع', 'أ', 'studentA', 'Conflict2026'],
    ]);
    const res = await request(app).post('/api/students/import-file').set('Cookie', cookie)
      .attach('file', file, { filename: 'conflict.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ added: 0, invalid: 1 });
    expect(res.body.errors[0].message).toContain('اسم المستخدم');
    const found = await request(app).get('/api/students?q=ST-601').set('Cookie', cookie);
    expect(found.body).toHaveLength(0);
  });

  it('ترويسة إنجليزية وملف بعمود الاسم فقط مدعومان', async () => {
    const cookie = await asTeacher();
    const english = csv([
      ['قائمة طالبات الصف الرابع'],
      ['code', 'name', 'grade', 'section', 'username', 'password'],
      ['ST-701', 'English Header Test', 'الرابع', 'أ', 'eng.test', 'Eng2026x'],
    ]);
    const res = await request(app).post('/api/students/import-file').set('Cookie', cookie)
      .attach('file', english, { filename: 'english.csv', contentType: 'text/csv' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ added: 1, accountsCreated: 1, invalid: 0 });
    expect((await loginOk('eng.test', 'Eng2026x')).status).toBe(200);

    const namesOnly = csv([['الاسم'], ['طالبة اسم فقط']]);
    const res2 = await request(app).post('/api/students/import-file').set('Cookie', cookie)
      .attach('file', namesOnly, { filename: 'names.csv', contentType: 'text/csv' });
    expect(res2.status).toBe(200);
    expect(res2.body).toMatchObject({ added: 1, invalid: 0, accountsCreated: 0 });
    const found = await request(app).get('/api/students?q=' + encodeURIComponent('طالبة اسم فقط')).set('Cookie', cookie);
    expect(found.body).toHaveLength(1);
    // لا تُستورد كلمة «الاسم» كطالبة
    expect(found.body[0].name).toBe('طالبة اسم فقط');
  });

  it('الطالبة لا تستطيع استيراد ملفات، والملف غير المدعوم يُرفض', async () => {
    const student = await asStudentA();
    const denied = await request(app).post('/api/students/import-file').set('Cookie', student)
      .attach('file', csv([['الاسم'], ['x']]), { filename: 'x.csv', contentType: 'text/csv' });
    expect(denied.status).toBe(403);

    const cookie = await asTeacher();
    const notXlsx = await request(app).post('/api/students/import-file').set('Cookie', cookie)
      .attach('file', Buffer.from('not a zip'), { filename: 'fake.xlsx', contentType: XLSX_MIME });
    expect(notXlsx.status).toBe(400);

    const notAllowed = await request(app).post('/api/students/import-file').set('Cookie', cookie)
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'x.pdf', contentType: 'application/pdf' });
    expect(notAllowed.status).toBe(400);
  });
});
