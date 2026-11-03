import fs from 'fs';
import path from 'path';
import { env } from '../config';
import { pool } from '../database/pool';

// قفل استشاري ثابت يمنع نسختين من الخادم من تطبيق نفس الترحيل في وقت واحد
const MIGRATION_LOCK = 918273645;

export async function runMigrations(dir = env.migrationsDir) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations(name varchar(120) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    for (const f of files) {
      const done = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [f]);
      if (done.rowCount) continue;
      await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
      console.log('✔ migration:', f);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => { /* تجاهل */ });
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(e => { console.error('✖ فشل الترحيل:', e.message); process.exit(1); });
}
