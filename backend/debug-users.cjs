const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
(async () => {
  console.log('URL?', !!process.env.DATABASE_URL);
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query('SELECT id, username, role, active FROM users ORDER BY id');
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
})().catch(e => { console.error('ERR', e); process.exit(1); });
