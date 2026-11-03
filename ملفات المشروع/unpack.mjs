// unpack.mjs — ينشئ ملفات المشروع من ملفات pack-*.txt الموجودة بجانبه
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const packs = fs.readdirSync(ROOT)
  .filter(f => /^pack-\d+(\.txt){1,2}$/i.test(f))   // يقبل pack-1.txt وحتى pack-1.txt.txt لو تكرر الامتداد
  .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);

if (!packs.length) {
  console.log('No pack-*.txt files found in this folder.');
  console.log('Save the pack file(s) here (UTF-8), then run install.bat again.');
  process.exit(1);
}

let total = 0;
for (const p of packs) {
  const text = fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/^\uFEFF/, '');
  if (text.includes('\uFFFD'))
    console.log('WARNING: ' + p + ' has unreadable characters - re-save it with UTF-8 encoding.');
  let cur = null, buf = [], count = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\/\/<<<FILE: (.+?)>>>\s*$/);
    if (m) { cur = m[1].trim(); buf = []; continue; }
    if (cur !== null && line.trim() === '//<<<END>>>') {
      const abs = path.join(ROOT, cur.replace(/\//g, path.sep));
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, buf.join('\n') + '\n', 'utf8');
      console.log('[OK]', cur);
      count++; total++; cur = null; buf = [];
      continue;
    }
    if (cur !== null) buf.push(line);
  }
  console.log('-- ' + p + ': ' + count + ' file(s)');
}
console.log('Done: ' + total + ' files created. Project folder is ready.');