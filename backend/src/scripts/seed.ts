import fs from 'fs';
import path from 'path';
import { env } from '../config';
import { pool, q } from '../database/pool';
import { runMigrations } from './migrate';
import { hashPassword } from '../services/auth';

async function createAdmin() {
  const username = (process.env.ADMIN_USERNAME || 'maha').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (env.nodeEnv === 'production' ? '' : 'lughati1234');
  // في الإنتاج لا نسمح بكلمة المرور الافتراضية المهروبة داخل الكود
  if (!password) throw new Error('ADMIN_PASSWORD مطلوب في الإنتاج لإنشاء حساب المعلمة');
  const { rowCount } = await q('SELECT 1 FROM users WHERE username = $1', [username]);
  if (rowCount) { console.log('حساب المعلمة موجود مسبقاً:', username); return; }
  await q("INSERT INTO users(username, password_hash, role) VALUES ($1,$2,'teacher')",
    [username, await hashPassword(password)]);
  console.log('✔ أُنشئ حساب المعلمة — اسم المستخدم: ' + username + ' (غيّري كلمة المرور فوراً من الإعدادات)');
}

async function main() {
  await runMigrations();
  const seedFile = path.join(env.seedsDir, 'seed.sql');
  if (fs.existsSync(seedFile)) {
    await pool.query(fs.readFileSync(seedFile, 'utf8')); // idempotent: ON CONFLICT DO NOTHING
    console.log('✔ seed.sql نُفّذ');
  } else {
    console.log('-- لا يوجد seed.sql — تم تجاوز البذر');
  }
  await createAdmin();
  await pool.end();
}

main().catch(e => { console.error('✖ فشل البذر:', e.message); process.exit(1); });
