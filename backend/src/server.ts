import path from 'path';
import { createApp } from './app';
import { env } from './config';
import { pool } from './database/pool';
import { runMigrations } from './scripts/migrate';

async function start() {
  // الترحيلات قبل فتح المنفذ: يمنع تشغيل الخادم على مخطط قديم (مثل جدول login_throttle الناقص)
  try {
    await runMigrations();
    console.log('✔ قاعدة البيانات محدّثة (الترحيلات مطبقة)');
  } catch (e: any) {
    console.error('✖ فشل ترحيل قاعدة البيانات — لم يُفتح المنفذ.');
    console.error(e?.message || e);
    process.exit(1);
  }

  const app = createApp({ staticDir: path.resolve(__dirname, '../../frontend/dist') });

  app.listen(env.port, async () => {
    console.log('✔ منصة لغتي تعمل على المنفذ ' + env.port);
    try { await pool.query('SELECT 1'); console.log('✔ اتصال قاعدة البيانات سليم'); }
    catch (e) { console.error('✖ تعذر الاتصال بقاعدة البيانات — راجعي DATABASE_URL', e); }
  });
}

start();
