// تنبيه مهم: متغيرات بيئة الاختبار تُضبط قبل تحميل أي وحدة من الخادم (لذلك التحميل ديناميكي بعدها)
// حتى لا تتصل الاختبارات بقاعدة lughati الحقيقية وتفرّغها — قاعدة الاختبار منفصلة دائماً.
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
// نحمّل .env من جذر المشروع قبل اختيار قاعدة الاختبار (vitest قد يعمل من مجلد backend)
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lughati_test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.UPLOAD_DIR = 'uploads-test';

import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeAll } from 'vitest';

const { createApp } = await import('../backend/src/app');
const { runMigrations } = await import('../backend/src/scripts/migrate');
const { q, pool } = await import('../backend/src/database/pool');

export const app = createApp();

let ready: Promise<void> | null = null;
async function setup() {
  await runMigrations();
  await q(`TRUNCATE audit_logs, login_throttle, files, achievements, weekly_star, messages, skill_levels, skills,
           plan_followups, plans, results, tests, worksheet_targets, worksheets, evaluations,
           users, students, settings RESTART IDENTITY CASCADE`);
  const h1 = bcrypt.hashSync('teacher-pass', 8);
  const h2 = bcrypt.hashSync('student-pass', 8);
  const h3 = bcrypt.hashSync('admin-pass', 8);
  await q(`INSERT INTO students(id, code, name, grade, section) VALUES
           (1,'ST-001','طالبة اختبار أ','الرابع','أ'), (2,'ST-002','طالبة اختبار ب','الرابع','أ')`);
  await q(`INSERT INTO users(id, username, password_hash, role, student_id) VALUES
           (1,'teacher1',$1,'teacher',NULL), (2,'studentA',$2,'student',1),
           (3,'studentB',$2,'student',2), (4,'admin1',$3,'admin',NULL)`, [h1, h2, h3]);
  // الإدخال بمعرّفات صريحة لا يحرّك الـ sequence؛ نضبطه حتى لا تفشل الإدخالات اللاحقة بتكرار المفتاح
  await q(`SELECT setval(pg_get_serial_sequence('students','id'), (SELECT MAX(id) FROM students))`);
  await q(`SELECT setval(pg_get_serial_sequence('users','id'), (SELECT MAX(id) FROM users))`);
}
export function ensureReady() { ready ??= setup(); return ready; }

export async function login(username: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error('فشل تسجيل الدخول: ' + res.status + ' ' + JSON.stringify(res.body));
  return [].concat(res.headers['set-cookie'] as any).join('; ');
}
export const asTeacher = async () => login('teacher1', 'teacher-pass');
export const asStudentA = async () => login('studentA', 'student-pass');
export const asStudentB = async () => login('studentB', 'student-pass');
export const asAdmin = async () => login('admin1', 'admin-pass');
export { beforeAll, pool };
