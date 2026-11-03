// ينشئ قاعدة البيانات إن لم توجد. لقاعدة الاختبار: npm run db:create -- test
import { Client } from 'pg';
import { env } from '../config';

async function main() {
  let target = env.databaseUrl;
  if (process.argv[2] === 'test') {
    if (!process.env.TEST_DATABASE_URL)
      throw new Error('قاعدة الاختبار تحتاج TEST_DATABASE_URL في ملف .env');
    target = process.env.TEST_DATABASE_URL;
  }
  const url = new URL(target);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!dbName) throw new Error('سلسلة الاتصال لا تحتوي اسم قاعدة البيانات');
  url.pathname = '/postgres'; // الاتصال بقاعدة النظام لإنشاء القاعدة الجديدة
  const c = new Client({ connectionString: url.toString() });
  await c.connect();
  const r = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!r.rowCount) {
    await c.query('CREATE DATABASE "' + dbName.replace(/"/g, '') + '"');
    console.log('✔ أُنشئت القاعدة:', dbName);
  } else {
    console.log('القاعدة موجودة مسبقاً:', dbName);
  }
  await c.end();
}

main().catch(e => { console.error('✖ فشل إنشاء قاعدة البيانات:', e.message); process.exit(1); });
