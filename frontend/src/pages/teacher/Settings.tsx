import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, fileUrl, publicFileUrl } from '../../api/client';
import { passwordError } from '../../api/password';
import type { Settings } from '../../api/types';
import { useToast } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import {
  DEFAULT_BRANDING,
  FONT_OPTIONS,
  useBranding,
  type ThemeTextKey,
} from '../../branding/BrandingContext';

const SCALE_ROWS: [string, string][] = [
  ['l5', 'تسمية الدرجة 5'],
  ['l4', 'تسمية الدرجة 4'],
  ['l3', 'تسمية الدرجة 3'],
  ['l2', 'تسمية الدرجة 2'],
  ['l1', 'تسمية الدرجة 1'],
];

const TEXT_FIELDS: { key: ThemeTextKey; label: string; hint?: string; long?: boolean }[] = [
  { key: 'brandTitle', label: 'عنوان المنصة (الشريط الجانبي)' },
  { key: 'brandSubtitle', label: 'الوصف أسفل عنوان المنصة' },
  { key: 'loginSchool', label: 'اسم المدرسة في صفحة الدخول' },
  { key: 'loginSubtitle', label: 'وصف المنصة في صفحة الدخول' },
  { key: 'loginQuote1', label: 'الاقتباس الأول', long: true },
  { key: 'loginQuote2', label: 'الاقتباس الثاني', long: true },
  { key: 'loginQuote3', label: 'الاقتباس الثالث', long: true },
  { key: 'creditName', label: 'اسم معدّة المنصة' },
  { key: 'creditRole', label: 'المسمى الوظيفي' },
];

const COLOR_FIELDS: { key: 'accent' | 'sidebar' | 'heading'; label: string; hint: string }[] = [
  { key: 'accent', label: 'اللون الأساسي', hint: 'الأزرار والروابط' },
  { key: 'sidebar', label: 'لون القائمة الجانبية', hint: 'خلفية الشريط الجانبي' },
  { key: 'heading', label: 'لون العناوين', hint: 'عناوين الصفحات والبطاقات' },
];

export default function Settings() {
  const [cfg, setCfg] = useState<Settings>({});
  const [form, setForm] = useState<any>(null);
  const [theme, setTheme] = useState<any>(null);
  const [pw, setPw] = useState({ current: '', nw: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  const { setMe } = useAuth();
  const { refresh } = useBranding();
  const nav = useNavigate();

  useEffect(() => {
    api('/settings').then((c) => {
      setCfg(c);
      setTheme(c.theme ?? DEFAULT_BRANDING.theme);
      setForm({
        schoolName: c.schoolName ?? '',
        eduAdmin: c.eduAdmin ?? '',
        principal: c.principal ?? '',
        teacher: c.teacher ?? '',
        grades: Array.isArray(c.grades) ? c.grades.join('، ') : '',
        classes: Array.isArray(c.classes) ? c.classes.join('، ') : '',
        l5: c.scale?.labels?.['5'] ?? '',
        l4: c.scale?.labels?.['4'] ?? '',
        l3: c.scale?.labels?.['3'] ?? '',
        l2: c.scale?.labels?.['2'] ?? '',
        l1: c.scale?.labels?.['1'] ?? '',
      });
    }).catch((e: any) => push(e.message || 'خطأ', true));
  }, [push]);

  if (!form || !theme) return <div className="empty">جارٍ التحميل…</div>;

  const bg = theme.background;

  function setText(key: ThemeTextKey, value: string) {
    setTheme({ ...theme, texts: { ...theme.texts, [key]: value } });
  }
  function setColor(key: string, value: string) {
    setTheme({ ...theme, colors: { ...theme.colors, [key]: value } });
  }
  function setTypo(key: string, value: any) {
    setTheme({ ...theme, typography: { ...theme.typography, [key]: value } });
  }
  function setBg(patch: any) {
    setTheme({ ...theme, background: { ...theme.background, ...patch } });
  }

  function previewBackground(): string {
    if (bg.type === 'image' && bg.image?.file_id) {
      const overlay = `rgba(0,0,0,${Number(bg.overlay) || 0})`;
      return `linear-gradient(${overlay}, ${overlay}), url("${publicFileUrl(bg.image.file_id, true)}") center/cover no-repeat`;
    }
    if (bg.type === 'gradient') {
      return `linear-gradient(${Number(bg.angle) || 0}deg, ${bg.from}, ${bg.to})`;
    }
    return bg.color;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const body = {
      schoolName: form.schoolName,
      eduAdmin: form.eduAdmin,
      principal: form.principal,
      teacher: form.teacher,
      grades: form.grades.split(/[،,]/).map((s: string) => s.trim()).filter(Boolean),
      classes: form.classes.split(/[،,]/).map((s: string) => s.trim()).filter(Boolean),
      scale: {
        max: 5,
        labels: { '5': form.l5, '4': form.l4, '3': form.l3, '2': form.l2, '1': form.l1 },
      },
    };
    try {
      await api('/settings', { method: 'PUT', body: JSON.stringify(body) });
      setCfg(await api('/settings'));
      await refresh(); // يحدّث الاسم الظاهر في القائمة الجانبية فوراً
      push('تم حفظ الإعدادات');
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function saveTheme() {
    setBusy(true);
    try {
      const body = {
        theme: {
          colors: theme.colors,
          typography: {
            ...theme.typography,
            baseSize: Number(theme.typography.baseSize),
            headingSize: Number(theme.typography.headingSize),
            lineHeight: Number(theme.typography.lineHeight),
          },
          background: {
            type: bg.type,
            color: bg.color,
            from: bg.from,
            to: bg.to,
            angle: Number(bg.angle),
            overlay: Number(bg.overlay),
            fixed: !!bg.fixed,
          },
          texts: theme.texts,
        },
      };
      await api('/settings', { method: 'PUT', body: JSON.stringify(body) });
      const fresh = await api('/settings');
      setCfg(fresh);
      setTheme(fresh.theme);
      await refresh();
      push('تم حفظ المظهر والنصوص');
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    } finally {
      setBusy(false);
    }
  }

  async function syncAfterThemeChange() {
    const fresh = await api('/settings');
    setCfg(fresh);
    setTheme(fresh.theme);
    await refresh();
  }

  async function uploadBackground(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('background', file);
    try {
      await api('/settings/background', { method: 'POST', body: fd });
      await syncAfterThemeChange();
      push('تم تحديث صورة الخلفية');
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    } finally {
      setBusy(false);
    }
  }

  async function removeBackground() {
    setBusy(true);
    try {
      await api('/settings', {
        method: 'PUT',
        body: JSON.stringify({ theme: { background: { image: null, type: 'gradient' } } }),
      });
      await syncAfterThemeChange();
      push('تمت إزالة صورة الخلفية');
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    } finally {
      setBusy(false);
    }
  }

  async function resetTheme() {
    if (!confirm('استعادة المظهر الافتراضي (الألوان والخطوط والنصوص والخلفية)؟')) return;
    setBusy(true);
    try {
      const t = DEFAULT_BRANDING.theme;
      await api('/settings', {
        method: 'PUT',
        body: JSON.stringify({ theme: { ...t, background: { ...t.background, image: null } } }),
      });
      await syncAfterThemeChange();
      push('تمت استعادة المظهر الافتراضي');
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(file: File | undefined, which: 'school' | 'moe') {
    if (!file) return;
    const fd = new FormData();
    fd.append('logo', file);
    fd.append('which', which);
    try {
      await api('/settings/logo', { method: 'POST', body: fd });
      setCfg(await api('/settings'));
      await refresh();
      push('تم رفع الشعار');
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function changePw(e: FormEvent) {
    e.preventDefault();
    if (pw.nw !== pw.confirm) { push('كلمتا المرور غير متطابقتين', true); return; }
    const perr = passwordError(pw.nw);
    if (perr) { push(perr, true); return; }
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current: pw.current, new: pw.nw }),
      });
      push('تم تغيير كلمة المرور — جارٍ تحويلك لتسجيل الدخول…');
      setTimeout(async () => {
        try { await api('/auth/logout', { method: 'POST' }); } catch { /* تجاهل */ }
        setMe(null);
        nav('/login', { replace: true });
      }, 1200);
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  // الشعار الظاهر في الشريط الجانبي (الشعار الرسمي المضغوط)
  const logoUrl = '/logo.png';

  return (
    <div>
      <div className="page-head"><h2>الإعدادات</h2></div>

      <div className="card">
        <div className="card-head">
          <h3>المظهر والنصوص</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn ghost sm" onClick={resetTheme} disabled={busy}>استعادة الافتراضي</button>
            <button type="button" className="btn sm" onClick={saveTheme} disabled={busy}>
              {busy ? 'جارٍ الحفظ…' : 'حفظ المظهر'}
            </button>
          </div>
        </div>

        <div className="theme-preview" style={{ fontFamily: theme.typography.fontFamily }}>
          <div className="tp-bg" style={{ background: previewBackground() }} />
          <div
            className="tp-side"
            style={{ background: `linear-gradient(170deg, ${theme.colors.sidebar}, ${theme.colors.accent})` }}
          >
            <div className="tp-logo"><img src={logoUrl} alt="" /></div>
            <b>{theme.texts.brandTitle}</b>
            <small>{theme.texts.brandSubtitle}</small>
          </div>
          <div className="tp-main">
            <h4 style={{ color: theme.colors.heading }}>{theme.texts.loginSchool}</h4>
            <p>{theme.texts.loginSubtitle}</p>
            <span className="tp-btn" style={{ background: theme.colors.accent }}>دخول المنصة</span>
            <div className="tp-quote">« {theme.texts.loginQuote2} »</div>
          </div>
        </div>

        <h4 className="theme-sub">نصوص الواجهة</h4>
        <div className="form-grid">
          {TEXT_FIELDS.map((f) => (
            <div className={'fld' + (f.long ? ' full' : '')} key={f.key}>
              <label>{f.label}</label>
              {f.long ? (
                <textarea
                  value={theme.texts[f.key]}
                  rows={2}
                  onChange={(e) => setText(f.key, e.target.value)}
                />
              ) : (
                <input
                  value={theme.texts[f.key]}
                  onChange={(e) => setText(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <h4 className="theme-sub">الألوان</h4>
        <div className="form-grid">
          {COLOR_FIELDS.map((c) => (
            <div className="fld" key={c.key}>
              <label>{c.label} <span className="muted">— {c.hint}</span></label>
              <div className="color-row">
                <input
                  type="color"
                  value={theme.colors[c.key]}
                  onChange={(e) => setColor(c.key, e.target.value)}
                  aria-label={c.label}
                />
                <input
                  dir="ltr"
                  value={theme.colors[c.key]}
                  onChange={(e) => setColor(c.key, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <h4 className="theme-sub">الخط والقياسات</h4>
        <div className="form-grid">
          <div className="fld full">
            <label>نوع الخط</label>
            <select
              value={theme.typography.fontFamily}
              onChange={(e) => setTypo('fontFamily', e.target.value)}
            >
              {FONT_OPTIONS.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>حجم النص الأساسي: {theme.typography.baseSize}px</label>
            <input
              type="range" min={13} max={24} step={1}
              value={theme.typography.baseSize}
              onChange={(e) => setTypo('baseSize', Number(e.target.value))}
            />
          </div>
          <div className="fld">
            <label>حجم العناوين: {theme.typography.headingSize}px</label>
            <input
              type="range" min={20} max={44} step={1}
              value={theme.typography.headingSize}
              onChange={(e) => setTypo('headingSize', Number(e.target.value))}
            />
          </div>
          <div className="fld">
            <label>تباعد الأسطر: {theme.typography.lineHeight}</label>
            <input
              type="range" min={1.3} max={2} step={0.05}
              value={theme.typography.lineHeight}
              onChange={(e) => setTypo('lineHeight', Number(e.target.value))}
            />
          </div>
        </div>

        <h4 className="theme-sub">الخلفية</h4>
        <div className="form-grid">
          <div className="fld">
            <label>نوع الخلفية</label>
            <select value={bg.type} onChange={(e) => setBg({ type: e.target.value })}>
              <option value="gradient">تدرّج لوني</option>
              <option value="color">لون ثابت</option>
              <option value="image">صورة مرفوعة</option>
            </select>
          </div>

          {bg.type === 'color' && (
            <div className="fld">
              <label>لون الخلفية</label>
              <div className="color-row">
                <input type="color" value={bg.color} onChange={(e) => setBg({ color: e.target.value })} />
                <input dir="ltr" value={bg.color} onChange={(e) => setBg({ color: e.target.value })} />
              </div>
            </div>
          )}

          {bg.type === 'gradient' && (
            <>
              <div className="fld">
                <label>من اللون</label>
                <div className="color-row">
                  <input type="color" value={bg.from} onChange={(e) => setBg({ from: e.target.value })} />
                  <input dir="ltr" value={bg.from} onChange={(e) => setBg({ from: e.target.value })} />
                </div>
              </div>
              <div className="fld">
                <label>إلى اللون</label>
                <div className="color-row">
                  <input type="color" value={bg.to} onChange={(e) => setBg({ to: e.target.value })} />
                  <input dir="ltr" value={bg.to} onChange={(e) => setBg({ to: e.target.value })} />
                </div>
              </div>
              <div className="fld">
                <label>زاوية التدرّج: {bg.angle}°</label>
                <input type="range" min={0} max={360} step={5} value={bg.angle} onChange={(e) => setBg({ angle: Number(e.target.value) })} />
              </div>
            </>
          )}

          {bg.type === 'image' && (
            <div className="fld full">
              <label>صورة الخلفية</label>
              {bg.image?.file_id ? (
                <div className="bg-preview">
                  <img src={publicFileUrl(bg.image.file_id, true)} alt="صورة الخلفية" />
                  <button type="button" className="btn danger sm" onClick={removeBackground} disabled={busy}>إزالة الصورة</button>
                </div>
              ) : (
                <span className="badge" style={{ alignSelf: 'flex-start' }}>لا توجد صورة مرفوعة</span>
              )}
              <input type="file" accept="image/*" onChange={(e) => uploadBackground(e.target.files?.[0])} disabled={busy} />
              <small className="muted">تُرفع الصورة فوراً وتُطبَّق على الخلفية. يُفضّل صورة أفقية عالية الجودة.</small>
            </div>
          )}

          {(bg.type === 'image' || bg.type === 'gradient') && bg.image?.file_id && (
            <div className="fld">
              <label>تعتيم فوق الصورة: {Math.round(bg.overlay * 100)}%</label>
              <input type="range" min={0} max={0.9} step={0.05} value={bg.overlay} onChange={(e) => setBg({ overlay: Number(e.target.value) })} />
            </div>
          )}

          <div className="fld">
            <label>ثبات الخلفية عند التمرير</label>
            <select value={bg.fixed ? '1' : '0'} onChange={(e) => setBg({ fixed: e.target.value === '1' })}>
              <option value="1">ثابتة</option>
              <option value="0">تتحرك مع الصفحة</option>
            </select>
          </div>
        </div>

        <p className="muted" style={{ fontSize: 13.5, marginBottom: 0 }}>
          التغييرات تُطبَّق على كل صفحات المنصة بعد الحفظ، بما فيها صفحة الدخول.
        </p>
      </div>

      <form className="card" onSubmit={save}>
        <h3>بيانات المدرسة</h3>
        <div className="form-grid">
          <div className="fld">
            <label>اسم المدرسة</label>
            <input value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} />
          </div>
          <div className="fld">
            <label>الإدارة التعليمية</label>
            <input value={form.eduAdmin} onChange={(e) => setForm({ ...form, eduAdmin: e.target.value })} />
          </div>
          <div className="fld">
            <label>مديرة المدرسة</label>
            <input value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} />
          </div>
          <div className="fld">
            <label>الاسم الظاهر (الترحيب والقائمة الجانبية)</label>
            <input value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} />
            <small className="muted">يظهر لجميع الحسابات بدل اسم الدخول «maha».</small>
          </div>
          <div className="fld">
            <label>الصفوف (مفصولة بفاصلة)</label>
            <input value={form.grades} onChange={(e) => setForm({ ...form, grades: e.target.value })} />
          </div>
          <div className="fld">
            <label>الشعب (مفصولة بفاصلة)</label>
            <input value={form.classes} onChange={(e) => setForm({ ...form, classes: e.target.value })} />
          </div>
        </div>

        <h3>تسميات سلّم التقييم (من 5 إلى 1)</h3>
        <div className="form-grid">
          {SCALE_ROWS.map(([k, hint]) => (
            <div className="fld" key={k}>
              <label>{hint}</label>
              <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <button className="btn">حفظ الإعدادات</button>
      </form>

      <div className="card">
        <h3>الشعارات</h3>
        <div className="form-grid">
          <div className="fld">
            <label>شعار المدرسة</label>
            {cfg.logoSchool?.file_id ? (
              <img src={fileUrl(cfg.logoSchool.file_id, true)} alt="شعار المدرسة" style={{ maxHeight: 64, marginBottom: 6 }} />
            ) : (
              <span className="badge" style={{ marginBottom: 6 }}>لا شعار — يُستخدم الشعار الافتراضي</span>
            )}
            <input type="file" accept="image/*" onChange={(e) => uploadLogo(e.target.files?.[0], 'school')} />
          </div>
          <div className="fld">
            <label>شعار وزارة التعليم</label>
            {cfg.logoMoe?.file_id ? (
              <img src={fileUrl(cfg.logoMoe.file_id, true)} alt="شعار وزارة التعليم" style={{ maxHeight: 64, marginBottom: 6 }} />
            ) : (
              <span className="badge" style={{ marginBottom: 6 }}>لا شعار</span>
            )}
            <input type="file" accept="image/*" onChange={(e) => uploadLogo(e.target.files?.[0], 'moe')} />
          </div>
        </div>
      </div>

      <form className="card" onSubmit={changePw}>
        <h3>تغيير كلمة المرور</h3>
        <div className="form-grid">
          <div className="fld">
            <label>كلمة المرور الحالية</label>
            <input type="password" value={pw.current} required onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </div>
          <div className="fld">
            <label>كلمة المرور الجديدة (8 أحرف على الأقل، حرف ورقم)</label>
            <input type="password" value={pw.nw} required onChange={(e) => setPw({ ...pw, nw: e.target.value })} />
          </div>
          <div className="fld">
            <label>تأكيد كلمة المرور الجديدة</label>
            <input type="password" value={pw.confirm} required onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </div>
        </div>
        <p className="muted">بعد التغيير ستحتاجين إلى تسجيل الدخول من جديد.</p>
        <button className="btn">تغيير كلمة المرور</button>
      </form>
    </div>
  );
}
