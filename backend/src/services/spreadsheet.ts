import path from 'path';
import readXlsxFile from 'read-excel-file/node';
import { HttpError } from '../middleware/errors';

/** أقصى عدد صفوف يُقرأ من الملف — ما زاد يُقتطع ويُبلَّغ عنه */
export const MAX_IMPORT_ROWS = 1000;

export type SpreadsheetRow = {
  /** رقم الصف كما يراه المستخدم في Excel (يبدأ من 1) */
  row: number;
  code: string;
  name: string;
  grade: string;
  section: string;
  username: string;
  password: string;
  notes: string;
};

export type SpreadsheetResult = {
  rows: SpreadsheetRow[];
  sheetName: string | null;
  header: boolean;
  truncated: boolean;
};

type Field = 'code' | 'name' | 'grade' | 'section' | 'username' | 'password' | 'notes';

const FIELDS: Field[] = ['code', 'name', 'grade', 'section', 'username', 'password', 'notes'];

// أسماء الأعمدة المقبولة بالعربية والإنجليزية — تُقارن بعد التطبيع (بلا همزات/تشكيل/مسافات زائدة)
const ALIASES: Record<Field, string[]> = {
  code: ['code', 'studentcode', 'studentid', 'الرمز', 'رمز', 'رمزالطالبة', 'الكود', 'كود', 'الرقم', 'رقمالطالبة'],
  name: ['name', 'studentname', 'الاسم', 'اسم', 'اسمالطالبة', 'اسمالطالب'],
  grade: ['grade', 'level', 'الصف', 'صف', 'الصفالدراسي', 'المرحلة'],
  section: ['section', 'class', 'division', 'الشعبة', 'شعبة', 'القسم', 'الفصل'],
  username: ['username', 'user', 'login', 'اسمالدخول', 'اسمالمستخدم', 'المستخدم', 'حسابالدخول'],
  password: ['password', 'pass', 'passcode', 'secret', 'كلمةالمرور', 'كلمةالسر', 'الرمزالسري', 'كلمهالمرور'],
  notes: ['notes', 'note', 'comments', 'ملاحظات', 'ملاحظة', 'تعليق', 'تعليقات'],
};

// عند غياب صف الترويسة: الاسم، الصف، الشعبة، الرمز، اسم المستخدم، كلمة المرور، ملاحظات
const POSITIONAL: Record<Field, number> = {
  name: 0, grade: 1, section: 2, code: 3, username: 4, password: 5, notes: 6,
};

/** تطبيع للمقارنة فقط: همزات/تاء مربوطة/تشكيل/مسافات */
function norm(v: unknown): string {
  return String(v ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/[\u200B-\u200F\u202A-\u202E]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, '');
}

function text(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return v.getFullYear() + '-' + p(v.getMonth() + 1) + '-' + p(v.getDate());
  }
  if (typeof v === 'number') {
    // منع الصيغة العلمية للأرقام الكبيرة (كلمة مرور رقمية مثلاً)
    return Number.isInteger(v) && Math.abs(v) < 1e21 ? v.toFixed(0) : String(v);
  }
  return String(v).replace(/\u00A0/g, ' ').trim();
}

function mapHeader(cells: unknown[]): { map: Partial<Record<Field, number>>; found: number } | null {
  const map: Partial<Record<Field, number>> = {};
  let found = 0;
  cells.forEach((cell, index) => {
    const key = norm(cell);
    if (!key) return;
    for (const field of FIELDS) {
      if (map[field] === undefined && ALIASES[field].some((a) => norm(a) === key)) {
        map[field] = index;
        found++;
        return;
      }
    }
  });
  return map.name !== undefined ? { map, found } : null;
}

function decodeCsv(buf: Buffer): string {
  // غالباً UTF-8؛ بعض ملفات Windows تُحفظ بـ Windows-1256 فنحاول её قبل الاستسلام
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, '');
  } catch {
    try { return new TextDecoder('windows-1256').decode(buf); } catch { return buf.toString('utf8'); }
  }
}

function detectDelimiter(text: string): string {
  const candidates = [',', ';', '\t', '،'];
  const counts: Record<string, number> = {};
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { quoted = !quoted; continue; }
    if (quoted) continue;
    if (ch === '\n' || ch === '\r') break;
    if (candidates.includes(ch)) counts[ch] = (counts[ch] || 0) + 1;
  }
  let best = ',';
  let max = 0;
  for (const c of candidates) if ((counts[c] || 0) > max) { max = counts[c]; best = c; }
  return best;
}

/** قارئ CSV يدعم الاقتباس المزدوج والفواصل العربية والترميزين UTF-8/1256 */
export function parseCsv(buf: Buffer): unknown[][] {
  const text = decodeCsv(buf);
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '') { quoted = true; continue; }
    if (ch === delimiter) { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (ch === '\r') continue;
    field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toRows(matrix: unknown[][]): SpreadsheetResult {
  const clean = matrix
    .map((cells) => (Array.isArray(cells) ? cells : []))
    .map((cells) => cells.slice(0, 30));

  // أول صف غير فارغ هو بداية البيانات، لكن قد تسبقه عناوين/صفوف فارغة
  const firstIdx = clean.findIndex((cells) => cells.some((c) => text(c) !== ''));
  if (firstIdx < 0) return { rows: [], sheetName: null, header: false, truncated: false };

  // نبحث عن ترويسة واضحة (اسم + عمود معروف آخر) في أول 10 صفوف لتجاوز عناوين التقرير
  let headerIdx = -1;
  let headerMap: Partial<Record<Field, number>> | null = null;
  for (let i = 0; i < clean.length && i < firstIdx + 10; i++) {
    if (!clean[i].some((c) => text(c) !== '')) continue;
    const h = mapHeader(clean[i]);
    if (h && h.found >= 2) { headerIdx = i; headerMap = h.map; break; }
  }
  // ملف بعمود الاسم فقط: أول صف غير فارغ هو الترويسة
  if (headerIdx < 0) {
    const h = mapHeader(clean[firstIdx]);
    if (h) { headerIdx = firstIdx; headerMap = h.map; }
  }

  const map = (headerMap ?? POSITIONAL) as Record<Field, number>;
  const start = headerMap ? headerIdx + 1 : firstIdx;
  const out: SpreadsheetRow[] = [];

  for (let i = start; i < clean.length; i++) {
    const cells = clean[i];
    if (!cells.some((c) => text(c) !== '')) continue;
    const pick = (field: Field) => text(cells[map[field]]);
    out.push({
      row: i + 1,
      code: pick('code').slice(0, 30),
      name: pick('name').slice(0, 120),
      grade: pick('grade'),
      section: pick('section'),
      username: pick('username').slice(0, 60),
      password: pick('password'),
      notes: pick('notes').slice(0, 2000),
    });
  }

  const truncated = out.length > MAX_IMPORT_ROWS;
  return {
    rows: truncated ? out.slice(0, MAX_IMPORT_ROWS) : out,
    sheetName: null,
    header: !!headerMap,
    truncated,
  };
}

/** يقرأ ملف Excel/CSV من الذاكرة ويعيد صفوفاً موحّدة — لا يتحقق من صحة البيانات (خدمة الطالبات تفعل) */
export async function parseSpreadsheet(buf: Buffer, originalName: string): Promise<SpreadsheetResult> {
  const ext = path.extname(originalName || '').toLowerCase();
  if (ext === '.csv') return toRows(parseCsv(buf));
  if (ext !== '.xlsx') throw new HttpError(400, 'صيغة الملف غير مدعومة — استخدمي .xlsx أو .csv');

  let matrix: unknown[][];
  let sheetName: string | null = null;
  try {
    const sheets = await readXlsxFile(buf);
    const first = sheets[0];
    if (!first) throw new HttpError(400, 'ملف Excel لا يحتوي على أوراق عمل');
    matrix = first.data as unknown[][];
    sheetName = first.sheet;
  } catch (e: any) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, 'تعذر قراءة ملف Excel — تأكدي من أنه ملف .xlsx صالح وغير محمي بكلمة مرور');
  }
  return { ...toRows(matrix), sheetName };
}
