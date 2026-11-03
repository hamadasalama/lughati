// الاستخدام: npm run import:students -- ../database/seeds/students.csv
// كل سطر: الاسم,الصف,الشعبة (الرأس والأسطر التي تبدأ بـ # تُتجاهل، المكرر يُتخطى تلقائياً)
import fs from 'fs';
import path from 'path';
import { pool, q } from '../database/pool';
import { runMigrations } from './migrate';

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('الاستخدام: npm run import:students -- ملف.csv');
  await runMigrations();

  const lines = fs.readFileSync(path.resolve(file), 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let added = 0, skipped = 0;
  for (const [i, line] of lines.entries()) {
    if (line.startsWith('#')) continue;
    const cols = line.split(/[,;\t،]/).map(c => c.trim()).filter(Boolean);
    if (!cols.length) continue;
    const [name, gradeIn, sectionIn] = cols;
    if (i === 0 && /^(الاسم|name)$/i.test(name)) continue;
    const grade = gradeIn || 'الرابع';
    const section = sectionIn || 'أ';
    const ex = await q('SELECT 1 FROM students WHERE name = $1 AND grade = $2 AND section = $3', [name, grade, section]);
    if (ex.rowCount) { skipped++; continue; }
    const r = await q(
      "INSERT INTO students(code, name, grade, section) VALUES ('TMP-' || substr(md5(random()::text), 1, 16), $1,$2,$3) RETURNING id",
      [name, grade, section]);
    await q("UPDATE students SET code = 'ST-' || lpad(id::text, 3, '0') WHERE id = $1", [r.rows[0].id]);
    added++;
  }
  console.log('أُضيف ' + added + ' طالبة، وتخطي ' + skipped + ' (مكرر/غير مكتمل)');
  await pool.end();
}

main().catch(e => { console.error('✖ فشل الاستيراد:', e.message); process.exit(1); });
