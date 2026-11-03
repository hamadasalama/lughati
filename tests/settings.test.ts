import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { app, ensureReady, asTeacher, asStudentA, asAdmin, pool } from './helpers';

beforeAll(() => ensureReady());

// أصغر PNG صالح (1×1) — فحص البايتات السحرية يكتفي بالترويسة
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('المظهر والنصوص العامة', () => {
  it('GET /api/settings/public متاح قبل تسجيل الدخول ويعيد الهوية فقط', async () => {
    const res = await request(app).get('/api/settings/public');
    expect(res.status).toBe(200);
    expect(res.body.schoolName).toBeTruthy();
    expect(res.body.theme.texts.brandTitle).toBe('منصة لغتي');
    expect(res.body.theme.background.type).toMatch(/color|gradient|image/);
    expect(res.body.teacher).toBe('أستاذة مها');
    // لا تُسرَّب إعدادات داخلية أخرى
    expect(res.body.alerts).toBeUndefined();
    expect(res.body.scale).toBeUndefined();
    expect(res.body.grades).toBeUndefined();
  });

  it('الاسم الظاهر للمعلمة يُحفظ ويظهر في الإعدادات العامة', async () => {
    const cookie = await asTeacher();
    const res = await request(app).put('/api/settings').set('Cookie', cookie)
      .send({ teacher: 'أستاذة تجربة' });
    expect(res.status).toBe(200);
    expect(res.body.teacher).toBe('أستاذة تجربة');

    const pub = await request(app).get('/api/settings/public');
    expect(pub.body.teacher).toBe('أستاذة تجربة');
  });

  it('المعلمة تحدّث نصوص الواجهة وألوانها وتُحفظ فعلياً', async () => {
    const cookie = await asTeacher();
    const res = await request(app).put('/api/settings').set('Cookie', cookie).send({
      theme: {
        texts: { brandTitle: 'لغتي الجميلة', loginSchool: 'مدرسة الاختبار' },
        colors: { accent: '#225544' },
        typography: { baseSize: 19 },
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.theme.texts.brandTitle).toBe('لغتي الجميلة');
    expect(res.body.theme.texts.loginSchool).toBe('مدرسة الاختبار');
    expect(res.body.theme.colors.accent).toBe('#225544');
    expect(res.body.theme.typography.baseSize).toBe(19);

    const pub = await request(app).get('/api/settings/public');
    expect(pub.body.theme.texts.brandTitle).toBe('لغتي الجميلة');
  });

  it('الخادم ينقّي الثيم: مفاتيح نصوص غير معروفة تُهمل والقيم تُقيَّد بحدودها', async () => {
    const cookie = await asTeacher();
    const res = await request(app).put('/api/settings').set('Cookie', cookie).send({
      theme: {
        texts: { brandTitle: 'x'.repeat(500), hacked: 'لا يمر' },
        typography: { baseSize: 99, headingSize: 1, lineHeight: 9 },
        background: { color: 'red; background:url(javascript:alert(1))' },
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.theme.texts.brandTitle.length).toBeLessThanOrEqual(300);
    expect(res.body.theme.texts.hacked).toBeUndefined();
    expect(res.body.theme.typography.baseSize).toBe(24);
    expect(res.body.theme.typography.headingSize).toBe(20);
    expect(res.body.theme.typography.lineHeight).toBe(2);
    // لون غير صالح (حقن CSS) يُستبدل بالافتراضي
    expect(res.body.theme.background.color).toBe('#f6f2e8');
    // لا تُحقن صورة من العميل مباشرة
    expect(res.body.theme.background.image).toBeNull();
  });

  it('الطالبة لا تستطيع تعديل الإعدادات أو المظهر', async () => {
    const cookie = await asStudentA();
    const res = await request(app).put('/api/settings').set('Cookie', cookie)
      .send({ theme: { texts: { brandTitle: 'محاولة' } } });
    expect(res.status).toBe(403);
  });

  it('الإدارة تستطيع تعديل المظهر أيضاً', async () => {
    const cookie = await asAdmin();
    const res = await request(app).put('/api/settings').set('Cookie', cookie)
      .send({ theme: { colors: { heading: '#334455' } } });
    expect(res.status).toBe(200);
    expect(res.body.theme.colors.heading).toBe('#334455');
  });
});

describe('رفع صورة الخلفية والوصول العام', () => {
  it('رفع PNG صالح يضبط الخلفية كصورة ويجعل الملف متاحاً قبل الدخول', async () => {
    const cookie = await asTeacher();
    const res = await request(app).post('/api/settings/background').set('Cookie', cookie)
      .attach('background', png, { filename: 'bg.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.theme.background.type).toBe('image');
    const fileId = res.body.theme.background.image.file_id;
    expect(fileId).toBeGreaterThan(0);

    const pub = await request(app).get('/api/files/public/' + fileId);
    expect(pub.status).toBe(200);
    expect(pub.headers['content-type']).toContain('image/png');
  });

  it('المرفق يبقى متاحاً من قاعدة البيانات بعد فقدان نسخة القرص', async () => {
    const cookie = await asTeacher();
    const up = await request(app).post('/api/settings/background').set('Cookie', cookie)
      .attach('background', png, { filename: 'persist.png', contentType: 'image/png' });
    expect(up.status).toBe(200);
    const fileId = up.body.theme.background.image.file_id;

    const { rows } = await pool.query(
      'SELECT stored_name, octet_length(data) AS len FROM files WHERE id = $1', [fileId]);
    expect(rows[0].len).toBe(png.length);

    // نحاكي اختفاء القرص المؤقت على الاستضافة المجانية
    const dir = fileURLToPath(new URL('../backend/uploads-test/', import.meta.url));
    fs.rmSync(path.join(dir, rows[0].stored_name), { force: true });

    const res = await request(app).get('/api/files/public/' + fileId);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.body.length).toBe(png.length);
  });

  it('رفع ملف ليس صورة يُرفض ولا يغيّر الخلفية', async () => {
    const cookie = await asTeacher();
    const before = await request(app).get('/api/settings/public');
    const beforeId = before.body.theme.background.image?.file_id ?? null;

    const res = await request(app).post('/api/settings/background').set('Cookie', cookie)
      .attach('background', Buffer.from('%PDF-1.4\n%%EOF'), {
        filename: 'not-image.pdf', contentType: 'application/pdf',
      });
    expect(res.status).toBe(400);

    const after = await request(app).get('/api/settings/public');
    expect(after.body.theme.background.image?.file_id ?? null).toBe(beforeId);
  });

  it('استبدال الصورة يحذف الملف القديم ويمنع الوصول إليه', async () => {
    const cookie = await asTeacher();
    const first = await request(app).post('/api/settings/background').set('Cookie', cookie)
      .attach('background', png, { filename: 'bg1.png', contentType: 'image/png' });
    expect(first.status).toBe(200);
    const oldId = first.body.theme.background.image.file_id;

    const second = await request(app).post('/api/settings/background').set('Cookie', cookie)
      .attach('background', png, { filename: 'bg2.png', contentType: 'image/png' });
    expect(second.status).toBe(200);
    const newId = second.body.theme.background.image.file_id;
    expect(newId).not.toBe(oldId);

    const oldFile = await request(app).get('/api/files/public/' + oldId);
    expect(oldFile.status).toBe(404);
  });

  it('ملف عام من نوع آخر (شعار وزارة) متاح، وغير الهوية غير متاح', async () => {
    // شعار يُرفع عبر مسار الشعارات ثم يُقرأ من المسار العام
    const cookie = await asTeacher();
    const logo = await request(app).post('/api/settings/logo').set('Cookie', cookie)
      .attach('logo', png, { filename: 'logo.png', contentType: 'image/png' });
    expect(logo.status).toBe(200);
    const logoId = logo.body.logoSchool.file_id;
    const pub = await request(app).get('/api/files/public/' + logoId);
    expect(pub.status).toBe(200);

    // ملف اختبار (PDF) لا يُكشف عبر المسار العام
    const t = await request(app).post('/api/tests').set('Cookie', cookie)
      .field('title', 'اختبار بملف')
      .field('kind', 'test')
      .field('max_score', '10')
      .field('grade', 'الرابع')
      .field('section', 'أ')
      .attach('file', Buffer.from('%PDF-1.4\n% test\n%%EOF'), {
        filename: 'test.pdf', contentType: 'application/pdf',
      });
    expect(t.status).toBe(201);
    const fileId = t.body.file_id;
    if (fileId) {
      const denied = await request(app).get('/api/files/public/' + fileId);
      expect(denied.status).toBe(404);
    }
  });

  it('إزالة صورة الخلفية تحذف الملف وتعيد الخلفية إلى الألوان', async () => {
    const cookie = await asTeacher();
    const res = await request(app).put('/api/settings').set('Cookie', cookie)
      .send({ theme: { background: { image: null, type: 'gradient' } } });
    expect(res.status).toBe(200);
    expect(res.body.theme.background.image).toBeNull();
    expect(res.body.theme.background.type).toBe('gradient');

    // استعادة النصوص الافتراضية لبقية الاختبارات
    await request(app).put('/api/settings').set('Cookie', cookie).send({
      theme: { texts: { brandTitle: 'منصة لغتي', loginSchool: 'مدارس هيا الأهلية' } },
    });
  });
});
