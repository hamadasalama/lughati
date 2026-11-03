import { q } from '../database/pool';
import { HttpError } from '../middleware/errors';
import { UpFile } from '../middleware/upload';
import * as filesSvc from './files';

/** نصوص الواجهة القابلة للتعديل من الإعدادات — المفاتيح هنا هي المرجع للخادم والواجهة */
export const THEME_TEXT_KEYS = [
  'brandTitle', 'brandSubtitle',
  'loginSchool', 'loginSubtitle',
  'loginQuote1', 'loginQuote2', 'loginQuote3',
  'creditName', 'creditRole',
] as const;

const DEFAULT_THEME = {
  colors: { accent: '#1a5c42', sidebar: '#123f2e', heading: '#123f2e' },
  typography: {
    fontFamily: "'Sakkal Majalla', 'Traditional Arabic', 'Amiri', serif",
    baseSize: 17,
    headingSize: 27,
    lineHeight: 1.65,
  },
  background: {
    type: 'gradient' as 'color' | 'gradient' | 'image',
    color: '#f6f2e8',
    from: '#f7f3e9',
    to: '#e8f0ea',
    angle: 160,
    overlay: 0.45,
    fixed: true,
    image: null as null | { file_id: number },
  },
  texts: {
    brandTitle: 'منصة لغتي',
    brandSubtitle: 'تقييم طالبات مادة اللغة العربية',
    loginSchool: 'مدارس هيا الأهلية',
    loginSubtitle: 'منصة تقييم طالبات مادة لغتي',
    loginQuote1: 'بِكَ تُفْتَحُ أَبْوَابُ العِلْمِ وَتُزْهِرُ الأَجْيَالُ.',
    loginQuote2: 'التعلمُ نورٌ يهدي العقول، والتقييمُ البنّاءُ طريقُ التميّز',
    loginQuote3: 'كلُّ طالبةٍ قادرةٌ على النجاح حين نكتشف مواطن قوّتها وندعمها',
    creditName: 'أستاذة مها',
    creditRole: 'معلمة مادة لغتي',
  },
};

export const DEFAULTS: Record<string, any> = {
  schoolName: 'اسم المدرسة',
  eduAdmin: 'الإدارة العامة للتعليم',
  principal: 'أ. بدور الجارد',
  teacher: 'أستاذة مها',
  grades: ['الرابع', 'الخامس', 'السادس'],
  classes: ['أ', 'ب'],
  scale: { max: 5, labels: { '5': 'ممتاز', '4': 'جيد جدًا', '3': 'جيد', '2': 'يحتاج إلى تحسين', '1': 'يحتاج إلى متابعة' } },
  alerts: { lowStreak: 3, lowThreshold: 2, absenceDays: 3, noEvalDays: 14 },
  info: { about: '', goals: '', bio: '' },
  logoSchool: null,
  logoMoe: null,
  theme: DEFAULT_THEME,
};

function str(v: unknown, fallback: string, max = 200): string {
  return typeof v === 'string' ? v.slice(0, max) : fallback;
}
function color(v: unknown, fallback: string): string {
  // ألوان CSS بصيغة hex فقط — يمنع أي حقن عبر قيمة اللون
  return typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v) ? v : fallback;
}
function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function isObj(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function merge(base: any, patch: any): any {
  if (!isObj(base) || !isObj(patch)) return patch === undefined ? base : patch;
  const out: any = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

/** تطبيع الثيم: يمنع القيم الغريبة ويحصر الصور في معرّفات الملفات المرفوعة */
export function sanitizeTheme(input: any, currentImage: { file_id: number } | null = null) {
  const d = DEFAULT_THEME;
  const t = isObj(input) ? input : {};
  const colors = isObj(t.colors) ? t.colors : {};
  const typo = isObj(t.typography) ? t.typography : {};
  const bg = isObj(t.background) ? t.background : {};
  const texts = isObj(t.texts) ? t.texts : {};
  const type = ['color', 'gradient', 'image'].includes(String(bg.type)) ? String(bg.type) : d.background.type;
  const image = currentImage ?? (isObj(bg.image) && Number.isFinite(+bg.image.file_id)
    ? { file_id: +bg.image.file_id } : null);
  return {
    colors: {
      accent: color(colors.accent, d.colors.accent),
      sidebar: color(colors.sidebar, d.colors.sidebar),
      heading: color(colors.heading, d.colors.heading),
    },
    typography: {
      fontFamily: str(typo.fontFamily, d.typography.fontFamily, 200),
      baseSize: Math.round(num(typo.baseSize, 13, 24, d.typography.baseSize)),
      headingSize: Math.round(num(typo.headingSize, 20, 44, d.typography.headingSize)),
      lineHeight: Math.round(num(typo.lineHeight, 1.3, 2, d.typography.lineHeight) * 100) / 100,
    },
    background: {
      type,
      color: color(bg.color, d.background.color),
      from: color(bg.from, d.background.from),
      to: color(bg.to, d.background.to),
      angle: Math.round(num(bg.angle, 0, 360, d.background.angle)),
      overlay: Math.round(num(bg.overlay, 0, 0.9, d.background.overlay) * 100) / 100,
      fixed: bg.fixed === undefined ? d.background.fixed : !!bg.fixed,
      image,
    },
    texts: Object.fromEntries(
      THEME_TEXT_KEYS.map((k) => [k, str(texts[k], (d.texts as any)[k], 300)])
    ) as Record<(typeof THEME_TEXT_KEYS)[number], string>,
  };
}

export async function getAll() {
  const { rows } = await q<{ key: string; value: any }>('SELECT key, value FROM settings');
  const out: Record<string, any> = { ...DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  out.theme = sanitizeTheme(out.theme, out.theme?.background?.image ?? null);
  return out;
}

/** إعدادات عامة للواجهة (قبل تسجيل الدخول): الهوية والمظهر فقط */
export async function getPublic() {
  const all = await getAll();
  // teacher: الاسم الظاهر في الترحيب والقائمة الجانبية (وليس بيانات دخول)
  return { schoolName: all.schoolName, teacher: all.teacher, logoSchool: all.logoSchool, theme: all.theme };
}

export async function put(patch: Record<string, any>) {
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in DEFAULTS)) throw new HttpError(400, 'مفتاح إعدادات غير معروف: ' + k);
    let value = v;
    if (k === 'theme') {
      const cur = await q('SELECT value FROM settings WHERE key = $1', ['theme']);
      const current = merge(DEFAULT_THEME, isObj(cur.rows[0]?.value) ? cur.rows[0].value : {});
      const incoming = isObj(v) ? v : {};
      // الصورة تُدار فقط عبر مسار الرفع، لا يمكن حقن رابط خارجي من العميل
      const theme = merge(current, incoming);
      const removeImage = isObj(incoming.background) && incoming.background.image === null;
      if (removeImage && current.background?.image?.file_id) {
        const old = await q("DELETE FROM files WHERE id = $1 AND kind = 'background' RETURNING stored_name",
          [current.background.image.file_id]);
        if (old.rows[0]) filesSvc.unlinkSafe(old.rows[0].stored_name);
      }
      value = sanitizeTheme(theme, removeImage ? null : current.background?.image ?? null);
    }
    await q(
      'INSERT INTO settings(key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
      [k, JSON.stringify(value ?? null)]);
  }
  return getAll();
}

async function replaceStoredImage(key: string, kind: string, file: UpFile, userId: number) {
  // الصورة القديمة تُحذف فعلياً من القرص عند الاستبدال
  const cur = await q('SELECT value FROM settings WHERE key = $1', [key]);
  const oldId = key === 'theme'
    ? cur.rows[0]?.value?.background?.image?.file_id
    : cur.rows[0]?.value?.file_id;
  if (oldId) {
    const old = await q('DELETE FROM files WHERE id = $1 AND kind = $2 RETURNING stored_name', [oldId, kind]);
    if (old.rows[0]) filesSvc.unlinkSafe(old.rows[0].stored_name);
  }
  return filesSvc.register({
    stored_name: file.filename, original_name: file.originalname, mime: file.mimetype, size: file.size,
    kind, student_id: null, worksheet_id: null, achievement_id: null, uploaded_by: userId
  });
}

export async function setLogo(file: UpFile, which: 'school' | 'moe', userId: number) {
  const key = which === 'moe' ? 'logoMoe' : 'logoSchool';
  const reg = await replaceStoredImage(key, 'logo', file, userId);
  return put({ [key]: { file_id: reg.id } });
}

export async function setBackground(file: UpFile, userId: number) {
  const reg = await replaceStoredImage('theme', 'background', file, userId);
  const all = await getAll();
  // نحفظ مباشرة بقيمة الصورة الجديدة (put يحافظ على الصورة الحالية عمداً)
  const theme = sanitizeTheme(
    { ...all.theme, background: { ...all.theme.background, type: 'image' } },
    { file_id: reg.id }
  );
  await q(
    'INSERT INTO settings(key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
    ['theme', JSON.stringify(theme)]);
  return getAll();
}
