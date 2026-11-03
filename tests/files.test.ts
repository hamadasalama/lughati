import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, ensureReady, asTeacher, asStudentA, asStudentB } from './helpers';

beforeAll(() => ensureReady());

const pdf = Buffer.from('%PDF-1.4\n% test file\n%%EOF');

describe('الوصول لمرفقات أوراق العمل', () => {
  it('ورقة مسندة لطالبة واحدة: مرفقها لا يُفتح لزميلتها، ويُفتح للمعيّنة', async () => {
    const t = await asTeacher();
    const res = await request(app).post('/api/worksheets')
      .set('Cookie', t)
      .field('title', 'ورقة خاصة')
      .field('grade', 'الرابع')
      .field('section', 'أ')
      .field('ids', JSON.stringify([1]))
      .attach('file', pdf, { filename: 'w.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    const fileId = res.body.file_id;
    expect(fileId).toBeTruthy();

    const b = await asStudentB();
    const denied = await request(app).get(`/api/files/${fileId}`).set('Cookie', b);
    expect(denied.status).toBe(404);

    const a = await asStudentA();
    const ok = await request(app).get(`/api/files/${fileId}`).set('Cookie', a);
    expect(ok.status).toBe(200);
  });

  it('ورقة غير مسندة متاحة لكل طالبات الصف والشعبة', async () => {
    const t = await asTeacher();
    const res = await request(app).post('/api/worksheets')
      .set('Cookie', t)
      .field('title', 'ورقة عامة')
      .field('grade', 'الرابع')
      .field('section', 'أ')
      .attach('file', pdf, { filename: 'all.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    const b = await asStudentB();
    const ok = await request(app).get(`/api/files/${res.body.file_id}`).set('Cookie', b);
    expect(ok.status).toBe(200);
  });

  it('لا تُسند الورقة لطالبة من صف/شعبة آخر', async () => {
    const t = await asTeacher();
    const res = await request(app).post('/api/worksheets')
      .set('Cookie', t)
      .field('title', 'صف آخر')
      .field('grade', 'الخامس')
      .field('section', 'أ')
      .field('ids', JSON.stringify([1]));

    expect(res.status).toBe(400);
  });
});
