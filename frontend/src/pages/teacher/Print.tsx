import { useEffect, useState } from 'react';
import { api, ApiError, fileUrl, qs } from '../../api/client';
import type { Student, StudentReport } from '../../api/types';
import Icon from '../../components/Icon';
import { useToast } from '../../components/ui';

const PARTS: [string, string][] = [
  ['summary', 'ملخص الحضور والمتوسطات'],
  ['charts', 'خريطة الألوان'],
  ['tests', 'الاختبارات الصفية'],
  ['nafis', 'نافس'],
  ['works', 'أوراق العمل'],
  ['plans', 'الخطط العلاجية'],
  ['skills', 'المهارات'],
  ['star', 'أميرتي هذا الأسبوع'],
  ['absence', 'الغياب المتكرر'],
  ['notes', 'ملاحظات الطالبات'],
];

const METRICS: [string, string, string][] = [
  ['behavior', 'behavior_avg', 'السلوك'],
  ['participation', 'participation_avg', 'المشاركة'],
  ['homework', 'homework_avg', 'الواجب'],
];

type Doc = {
  title: string;
  period: string;
  rep?: StudentReport | null;
  compare?: any;
  srows?: any[];
  testsList?: any[];
  nafisList?: any[];
  testsRows?: any[];
  nafisRows?: any[];
  works?: any[];
  plans?: any[];
  skillsLines?: string[];
  starLines?: string[];
  absenceRows?: { name: string; grade: string; section: string; n: number }[];
  notesRows?: { name: string; grade: string; section: string; note: string }[];
};

function pick(row: any, keys: string[]): any {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
  }
  return null;
}

function colorForScore(v: number): string {
  return v >= 4.5 ? '#1a5c42' : v >= 3.5 ? '#4c8a63' : v >= 2.5 ? '#c9a23f' : v >= 1.5 ? '#cf8a4a' : '#b8503c';
}

function rowAvg(r: any, keys: string[]): number | null {
  const v = pick(r, keys);
  return v == null || v === '' ? null : Number(v);
}

function fmt(v: number | null): string {
  return v == null || Number.isNaN(v) ? '—' : v.toFixed(2);
}

function csvCell(v: any): string {
  const s = v == null ? '' : String(v);
  return '"' + s.replace(/"/g, '""') + '"';
}

function trendBadge(r: any) {
  const t = r?.trend;
  if (!t || !t.enough) return <span className="muted">—</span>;
  const s = Number(t.slope);
  if (s > 0) return <span className="badge ok">↑ تتحسن</span>;
  if (s < 0) return <span className="badge warn">↓ تعزيز</span>;
  return <span className="badge">→ مستقرة</span>;
}

export default function Print() {
  const [ptype, setPtype] = useState('all');
  const [grade, setGrade] = useState('');
  const [sid, setSid] = useState('');
  const [group, setGroup] = useState<number[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [c, setC] = useState({ fromA: '', toA: '', fromB: '', toB: '' });
  const [parts, setParts] = useState<Record<string, boolean>>({
    summary: true, charts: true, tests: true, nafis: true, works: false,
    plans: true, skills: false, star: true, absence: true, notes: false,
  });
  const [cfg, setCfg] = useState<any>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<string[]>(['الرابع', 'الخامس', 'السادس']);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    api('/students').then(setStudents).catch(() => {});
    api('/settings').then((x) => {
      setCfg(x);
      if (Array.isArray(x.grades) && x.grades.length) setGrades(x.grades);
    }).catch(() => {});
  }, []);

  const absenceLimit = Number(cfg?.alerts?.absenceDays) || 3;

  async function build() {
    setBusy(true);
    try {
      const x = await api('/settings');
      setCfg(x);
      const absLimit = Number(x?.alerts?.absenceDays) || 3;
      const d: Doc = { title: '', period: '' };

      if (ptype === 'compare') {
        if (!c.fromA || !c.toA || !c.fromB || !c.toB) { push('حدّدي الفترتين كاملتين', true); return; }
        d.title = 'تقرير مقارنة فترتين';
        d.period = 'الفترة الأولى: ' + c.fromA + ' — ' + c.toA + '  |  الفترة الثانية: ' + c.fromB + ' — ' + c.toB;
        d.compare = await api('/reports/compare' + qs({ fromA: c.fromA, toA: c.toA, fromB: c.fromB, toB: c.toB }));
      } else {
        d.period = from && to ? 'الفترة من ' + from + ' إلى ' + to : 'كل الفترات';
      }

      if (ptype === 'student') {
        if (!sid) { push('اختاري الطالبة', true); return; }
        const rep: StudentReport = await api('/reports/student/' + sid);
        d.title = 'تقرير الطالبة: ' + rep.student.name;
        d.rep = rep;
        d.srows = [{
          student_id: rep.student.id, name: rep.student.name,
          grade: rep.student.grade, section: rep.student.section,
          present: rep.counts.present, excused: rep.counts.excused, absent: rep.counts.absent,
          behavior: rep.counts.behavior, participation: rep.counts.participation, homework: rep.counts.homework,
        }];
        d.testsList = rep.tests.filter((t) => t.kind === 'test');
        d.nafisList = rep.tests.filter((t) => t.kind === 'nafis');
        d.testsRows = rep.tests.filter((t) => t.kind === 'test' && t.score != null)
          .map((t) => ({ name: rep.student.name, test: t.title, date: t.test_date, score: t.score, max: t.max_score }));
        d.nafisRows = rep.tests.filter((t) => t.kind === 'nafis' && t.score != null)
          .map((t) => ({ name: rep.student.name, test: t.title, date: t.test_date, score: t.score, max: t.max_score }));
        d.works = rep.worksheets;
        d.plans = rep.plans.map((p) => ({ ...p, student_name: rep.student.name }));
        d.skillsLines = rep.skills.map((s) => s.name + ': ' + (s.level != null ? s.level + ' من 5' : 'لم يُرصد بعد'));
        d.starLines = rep.stars.map((s) => s.week_label + (s.reason ? ' — ' + s.reason : ''));
        if (rep.student.notes) {
          d.notesRows = [{ name: rep.student.name, grade: rep.student.grade, section: rep.student.section, note: rep.student.notes }];
        }
        d.absenceRows = rep.counts.absent >= absLimit
          ? [{ name: rep.student.name, grade: rep.student.grade, section: rep.student.section, n: rep.counts.absent }]
          : [];
      } else if (ptype !== 'compare') {
        const [sum, tests, works, plans, skills, cur, stus] = await Promise.all([
          api('/reports/summary'), api('/tests'), api('/worksheets'), api('/plans'), api('/skills'),
          api('/star/current').catch(() => null), api('/students'),
        ]);
        const smap = new Map<number, any>(stus.map((s: any) => [s.id, s]));
        let rows: any[] = Array.isArray(sum) ? sum : Array.isArray(sum?.rows) ? sum.rows : [];
        if (ptype === 'grade' && grade) {
          rows = rows.filter((r) => String(pick(r, ['grade'])) === grade);
        }
        if (ptype === 'group') {
          const set = new Set(group);
          rows = rows.filter((r) => set.has(Number(pick(r, ['student_id', 'id']))));
        }
        d.srows = rows;
        d.title = ptype === 'grade' ? 'تقرير الصف: ' + grade : ptype === 'group' ? 'تقرير مجموعة طالبات' : 'التقرير العام';
        const scope = new Set<number>(rows.map((r) => Number(pick(r, ['student_id', 'id']))));
        const inScope = (id: number) => ptype === 'all' || scope.has(id);

        const tList = tests.filter((t: any) => t.kind === 'test');
        const nList = tests.filter((t: any) => t.kind === 'nafis');
        d.testsList = tList;
        d.nafisList = nList;
        d.testsRows = tList.flatMap((t: any) =>
          (Array.isArray(t.results) ? t.results : [])
            .filter((r: any) => r.score != null && inScope(Number(r.student_id)))
            .map((r: any) => ({
              name: smap.get(Number(r.student_id))?.name ?? ('#' + r.student_id),
              test: t.title, date: t.test_date, score: r.score, max: t.max_score,
            }))
        );
        d.nafisRows = nList.flatMap((t: any) =>
          (Array.isArray(t.results) ? t.results : [])
            .filter((r: any) => r.score != null && inScope(Number(r.student_id)))
            .map((r: any) => ({
              name: smap.get(Number(r.student_id))?.name ?? ('#' + r.student_id),
              test: t.title, date: t.test_date, score: r.score, max: t.max_score,
            }))
        );
        d.works = works.filter((w: any) => ptype !== 'grade' || !grade || w.grade === grade);
        d.plans = plans.filter((p: any) => inScope(Number(p.student_id)));
        d.skillsLines = skills.map((s: any) => {
          if (Array.isArray(s.levels) && s.levels.length) {
            const inner = s.levels
              .filter((l: any) => inScope(Number(l.student_id)))
              .map((l: any) => (smap.get(Number(l.student_id))?.name ?? '#' + l.student_id) + ': ' + l.level + '/5')
              .join('، ');
            return s.name + ': ' + (inner || '—');
          }
          return s.name;
        });
        d.starLines = cur && inScope(Number(cur.student_id))
          ? [(cur.week_label || '') + ': ' + (cur.student_name ?? smap.get(Number(cur.student_id))?.name ?? '#' + cur.student_id) + (cur.reason ? ' — ' + cur.reason : '')]
          : [];
        d.notesRows = stus
          .filter((s: any) => inScope(Number(s.id)) && s.notes)
          .map((s: any) => ({ name: s.name, grade: s.grade, section: s.section, note: s.notes }));
        d.absenceRows = rows
          .filter((r) => (Number(pick(r, ['absent', 'absent_count'])) || 0) >= absLimit)
          .map((r) => ({
            name: String(pick(r, ['name', 'student_name']) ?? ''),
            grade: String(pick(r, ['grade']) ?? ''),
            section: String(pick(r, ['section']) ?? ''),
            n: Number(pick(r, ['absent', 'absent_count'])) || 0,
          }));
      }

      setDoc(d);
      push('بُنيت المعاينة — استخدمي زر الطباعة');
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    try {
      const sum = await api('/reports/summary');
      const rows: any[] = Array.isArray(sum) ? sum : Array.isArray(sum?.rows) ? sum.rows : [];
      const head = ['الاسم', 'الصف', 'الشعبة', 'حاضرة', 'بعذر', 'غائبة', 'السلوك', 'المشاركة', 'الواجب'];
      const lines = [head.map(csvCell).join(',')];
      for (const r of rows) {
        lines.push([
          pick(r, ['name', 'student_name']), pick(r, ['grade']), pick(r, ['section']),
          pick(r, ['present', 'present_count']), pick(r, ['excused', 'excused_count']), pick(r, ['absent', 'absent_count']),
          pick(r, ['behavior', 'behavior_avg']), pick(r, ['participation', 'participation_avg']), pick(r, ['homework', 'homework_avg']),
        ].map(csvCell).join(','));
      }
      const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const aEl = document.createElement('a');
      aEl.href = URL.createObjectURL(blob);
      aEl.download = 'lughati-summary.csv';
      aEl.click();
      URL.revokeObjectURL(aEl.href);
      push('تم تنزيل ملف CSV — يفتح في Excel بدعم كامل للعربية');
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  return (
    <div>
      <div className="no-print">
        <div className="page-head"><h2>مركز الطباعة A4</h2></div>

        <div className="card">
          <h3>نوع التقرير</h3>
          <div className="seg">
            {[['all', 'عام'], ['grade', 'صف كامل'], ['group', 'مجموعة طالبات'], ['student', 'طالبة واحدة'], ['compare', 'مقارنة فترتين']].map(([v, l]) => (
              <button key={v} className={ptype === v ? 'on' : ''} onClick={() => { setPtype(v); setDoc(null); }}>{l}</button>
            ))}
          </div>

          {ptype === 'grade' && (
            <div className="fld" style={{ marginTop: 10 }}>
              <label>الصف</label>
              <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                {grades.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
          )}
          {ptype === 'student' && (
            <div className="fld" style={{ marginTop: 10 }}>
              <label>الطالبة</label>
              <select value={sid} onChange={(e) => setSid(e.target.value)}>
                <option value="">اختاري…</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.grade}/{s.section}</option>)}
              </select>
            </div>
          )}
          {ptype === 'group' && (
            <div className="fld" style={{ marginTop: 10 }}>
              <label>اختاري الطالبات ({group.length} محددات)</label>
              <div style={{ maxHeight: 170, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {students.map((s) => (
                  <label key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 15, background: group.includes(s.id) ? 'var(--pk3)' : 'transparent', borderRadius: 8, padding: '2px 8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={group.includes(s.id)}
                      onChange={(e) => setGroup(e.target.checked ? [...group, s.id] : group.filter((x) => x !== s.id))}
                    />
                    {s.name} — {s.grade}/{s.section}
                  </label>
                ))}
              </div>
            </div>
          )}

          {ptype === 'compare' ? (
            <div className="form-grid" style={{ marginTop: 10 }}>
              <div className="fld"><label>الفترة الأولى — من</label><input type="date" value={c.fromA} onChange={(e) => setC({ ...c, fromA: e.target.value })} /></div>
              <div className="fld"><label>الفترة الأولى — إلى</label><input type="date" value={c.toA} onChange={(e) => setC({ ...c, toA: e.target.value })} /></div>
              <div className="fld"><label>الفترة الثانية — من</label><input type="date" value={c.fromB} onChange={(e) => setC({ ...c, fromB: e.target.value })} /></div>
              <div className="fld"><label>الفترة الثانية — إلى</label><input type="date" value={c.toB} onChange={(e) => setC({ ...c, toB: e.target.value })} /></div>
            </div>
          ) : (
            <div className="form-grid" style={{ marginTop: 10 }}>
              <div className="fld"><label>من تاريخ (اختياري)</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="fld"><label>إلى تاريخ (اختياري)</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
          )}

          <h3>أجزاء التقرير</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PARTS.map(([k, label]) => (
              <label key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, background: parts[k] ? 'var(--pk3)' : 'transparent', borderRadius: 8, padding: '3px 10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={parts[k]} onChange={() => setParts({ ...parts, [k]: !parts[k] })} />
                {label}
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn" onClick={build} disabled={busy}>{busy ? 'جارٍ البناء…' : 'بناء المعاينة'}</button>
            <button className="btn ghost" onClick={() => window.print()} disabled={!doc}>
              <Icon name="print" size={15} /> طباعة / حفظ PDF
            </button>
            <button className="btn ghost" onClick={exportCsv}>تنزيل CSV للدرجات</button>
          </div>
          <p className="muted" style={{ fontSize: 14, marginBottom: 0 }}>
            لتحويل التقرير إلى PDF: عند فتح نافذة الطباعة اختاري الوجهة «حفظ باسم PDF». المعاينة أدناه بمقاس A4.
          </p>
        </div>
      </div>

      {doc && (
        <div className="report-doc" dir="rtl">
          <div className="rp-head">
            <div className="rp-logos">
              {cfg?.logoSchool?.file_id
                ? <img src={fileUrl(cfg.logoSchool.file_id, true)} alt="شعار المدرسة" />
                : <span />}
              <div>
                <div style={{ fontWeight: 'bold' }}>{cfg?.eduAdmin || 'الإدارة العامة للتعليم'}</div>
                <div>{cfg?.schoolName || ''}</div>
              </div>
              {cfg?.logoMoe?.file_id
                ? <img src={fileUrl(cfg.logoMoe.file_id, true)} alt="شعار وزارة التعليم" />
                : <span />}
            </div>
            <div className="rp-title">{doc.title}</div>
            <div className="rp-sub">{doc.period}</div>
            <div className="rp-sub">إعداد وتنفيذ: {cfg?.teacher || 'أستاذة مها'} — معلمة اللغة العربية</div>
          </div>

          {doc.compare && (
            <div style={{ marginBottom: 16 }}>
              <h3>مقارنة الفترتين</h3>
              <table>
                <thead><tr><th>المعيار</th><th>الفترة الأولى</th><th>الفترة الثانية</th><th>الفارق</th></tr></thead>
                <tbody>
                  {METRICS.map(([k, alt, label]) => {
                    const A = doc.compare?.A ?? doc.compare?.a ?? doc.compare?.first ?? {};
                    const B = doc.compare?.B ?? doc.compare?.b ?? doc.compare?.second ?? {};
                    const av = A?.[k] ?? A?.[alt];
                    const bv = B?.[k] ?? B?.[alt];
                    const d = av != null && av !== '' && bv != null && bv !== ''
                      ? Math.round((Number(bv) - Number(av)) * 100) / 100
                      : null;
                    return (
                      <tr key={k}>
                        <td>{label}</td>
                        <td className="num">{av != null && av !== '' ? Number(av).toFixed(2) : '—'}</td>
                        <td className="num">{bv != null && bv !== '' ? Number(bv).toFixed(2) : '—'}</td>
                        <td className="num">{d == null ? '—' : (d > 0 ? '+ ' : '') + d.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {parts.summary && doc.srows && (
            <div style={{ marginBottom: 16 }}>
              <h3>ملخص الحضور والمتوسطات</h3>
              <table>
                <thead>
                  <tr>
                    <th>الطالبة</th><th>الصف</th><th>الشعبة</th>
                    <th>حاضرة</th><th>بعذر</th><th>غائبة</th>
                    <th>السلوك</th><th>المشاركة</th><th>الواجب</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.srows.map((r, i) => (
                    <tr key={i}>
                      <td>{String(pick(r, ['name', 'student_name']) ?? '')}</td>
                      <td>{String(pick(r, ['grade']) ?? '')}</td>
                      <td>{String(pick(r, ['section']) ?? '')}</td>
                      <td className="num">{String(pick(r, ['present', 'present_count']) ?? '—')}</td>
                      <td className="num">{String(pick(r, ['excused', 'excused_count']) ?? '—')}</td>
                      <td className="num">{String(pick(r, ['absent', 'absent_count']) ?? '—')}</td>
                      <td className="num">{fmt(rowAvg(r, ['behavior', 'behavior_avg']))}</td>
                      <td className="num">{fmt(rowAvg(r, ['participation', 'participation_avg']))}</td>
                      <td className="num">{fmt(rowAvg(r, ['homework', 'homework_avg']))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {parts.charts && doc.srows && (
            <div style={{ marginBottom: 16 }}>
              <h3>خريطة الألوان — المتوسطات (حاضرة فقط)</h3>
              <table>
                <thead>
                  <tr>
                    <th>الطالبة</th><th>الصف/الشعبة</th>
                    <th>السلوك</th><th>المشاركة</th><th>الواجب</th><th>المتوسط</th><th>الاتجاه</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.srows.map((r, i) => {
                    const xs = [
                      rowAvg(r, ['behavior', 'behavior_avg']),
                      rowAvg(r, ['participation', 'participation_avg']),
                      rowAvg(r, ['homework', 'homework_avg']),
                    ].filter((x): x is number => x != null && !Number.isNaN(x));
                    const mean = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
                    const cell = (v: number | null) => {
                      if (v == null || Number.isNaN(v)) return <td className="num" style={{ color: '#888' }}>—</td>;
                      return (
                        <td
                          className="num"
                          style={{ background: colorForScore(v), color: '#fff', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as any}
                        >{v.toFixed(2)}</td>
                      );
                    };
                    return (
                      <tr key={i}>
                        <td>{String(pick(r, ['name', 'student_name']) ?? '')}</td>
                        <td>{String(pick(r, ['grade']) ?? '')}/{String(pick(r, ['section']) ?? '')}</td>
                        {cell(rowAvg(r, ['behavior', 'behavior_avg']))}
                        {cell(rowAvg(r, ['participation', 'participation_avg']))}
                        {cell(rowAvg(r, ['homework', 'homework_avg']))}
                        <td className="num"><b>{fmt(mean)}</b></td>
                        <td>{trendBadge(r)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {parts.tests && (
            <div style={{ marginBottom: 16 }}>
              <h3>الاختبارات الصفية</h3>
              {doc.testsRows && doc.testsRows.length > 0 ? (
                <table>
                  <thead><tr><th>الطالبة</th><th>الاختبار</th><th>التاريخ</th><th>الدرجة</th><th>من</th></tr></thead>
                  <tbody>
                    {doc.testsRows.map((r, i) => (
                      <tr key={i}><td>{r.name}</td><td>{r.test}</td><td className="num">{r.date}</td><td className="num">{r.score}</td><td className="num">{r.max}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : doc.testsList && doc.testsList.length > 0 ? (
                <table>
                  <thead><tr><th>الاختبار</th><th>التاريخ</th><th>الدرجة العظمى</th></tr></thead>
                  <tbody>
                    {doc.testsList.map((t: any, i: number) => (
                      <tr key={i}><td>{t.title}</td><td className="num">{t.test_date}</td><td className="num">{t.max_score}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="muted">لا اختبارات.</p>}
            </div>
          )}

          {parts.nafis && (
            <div style={{ marginBottom: 16 }}>
              <h3>نافس</h3>
              {doc.nafisRows && doc.nafisRows.length > 0 ? (
                <table>
                  <thead><tr><th>الطالبة</th><th>نافس</th><th>التاريخ</th><th>الدرجة</th><th>من</th></tr></thead>
                  <tbody>
                    {doc.nafisRows.map((r, i) => (
                      <tr key={i}><td>{r.name}</td><td>{r.test}</td><td className="num">{r.date}</td><td className="num">{r.score}</td><td className="num">{r.max}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : doc.nafisList && doc.nafisList.length > 0 ? (
                <table>
                  <thead><tr><th>نافس</th><th>التاريخ</th><th>الدرجة العظمى</th></tr></thead>
                  <tbody>
                    {doc.nafisList.map((t: any, i: number) => (
                      <tr key={i}><td>{t.title}</td><td className="num">{t.test_date}</td><td className="num">{t.max_score}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="muted">لا اختبارات نافس.</p>}
            </div>
          )}

          {parts.works && (
            <div style={{ marginBottom: 16 }}>
              <h3>أوراق العمل</h3>
              {doc.works && doc.works.length > 0 ? (
                doc.rep ? (
                  <table>
                    <thead><tr><th>الورقة</th><th>التسليم</th><th>الحالة</th></tr></thead>
                    <tbody>
                      {doc.works.map((w: any, i: number) => (
                        <tr key={i}><td>{w.title}</td><td className="num">{w.due_date || '—'}</td><td>{w.done ? 'منجزة' : 'لم تُنجز'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table>
                    <thead><tr><th>الورقة</th><th>الصف/الشعبة</th><th>التسليم</th></tr></thead>
                    <tbody>
                      {doc.works.map((w: any, i: number) => (
                        <tr key={i}><td>{w.title}</td><td>{w.grade} / {w.section}</td><td className="num">{w.due_date || '—'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : <p className="muted">لا أوراق عمل.</p>}
            </div>
          )}

          {parts.plans && (
            <div style={{ marginBottom: 16 }}>
              <h3>الخطط العلاجية</h3>
              {doc.plans && doc.plans.length > 0 ? (
                <table>
                  <thead><tr><th>الطالبة</th><th>الخطة</th><th>الحالة</th><th>المتابعات</th></tr></thead>
                  <tbody>
                    {doc.plans.map((p: any, i: number) => (
                      <tr key={i}>
                        <td>{p.student_name ?? '#' + p.student_id}</td>
                        <td>
                          {p.title}
                          {Array.isArray(p.followups) && p.followups.length > 0 && (
                            <div style={{ fontSize: 13.5, color: '#555' }}>
                              {p.followups.map((f: any) => <div key={f.id}>• {f.note}</div>)}
                            </div>
                          )}
                        </td>
                        <td>{p.status === 'done' ? 'مكتملة' : 'نشطة'}</td>
                        <td className="num">{Array.isArray(p.followups) ? p.followups.length : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="muted">لا خطط علاجية.</p>}
            </div>
          )}

          {parts.skills && (
            <div style={{ marginBottom: 16 }}>
              <h3>المهارات</h3>
              {doc.skillsLines && doc.skillsLines.length > 0 ? (
                <ul style={{ margin: 0, paddingRight: 18 }}>
                  {doc.skillsLines.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              ) : <p className="muted">لا مهارات.</p>}
            </div>
          )}

          {parts.star && (
            <div style={{ marginBottom: 16 }}>
              <h3>👑 أميرتي هذا الأسبوع</h3>
              {doc.starLines && doc.starLines.length > 0
                ? doc.starLines.map((l, i) => <div key={i}>{l}</div>)
                : <p className="muted">لا اختيار لهذا الأسبوع.</p>}
            </div>
          )}

          {parts.absence && (
            <div style={{ marginBottom: 16 }}>
              <h3>الغياب المتكرر (≥ {absenceLimit} أيام)</h3>
              {doc.absenceRows && doc.absenceRows.length > 0 ? (
                <table>
                  <thead><tr><th>الطالبة</th><th>الصف/الشعبة</th><th>أيام الغياب</th></tr></thead>
                  <tbody>
                    {doc.absenceRows.map((r, i) => (
                      <tr key={i}><td>{r.name}</td><td>{r.grade}/{r.section}</td><td className="num">{r.n}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="muted">لا حالات غياب متكرر.</p>}
            </div>
          )}

          {parts.notes && (
            <div style={{ marginBottom: 16 }}>
              <h3>ملاحظات على الطالبات</h3>
              {doc.notesRows && doc.notesRows.length > 0 ? (
                <table>
                  <thead><tr><th>الطالبة</th><th>الملاحظة</th></tr></thead>
                  <tbody>
                    {doc.notesRows.map((r, i) => (
                      <tr key={i}><td>{r.name}</td><td>{r.note}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="muted">لا ملاحظات مسجلة.</p>}
            </div>
          )}

          <div className="rp-foot">
            <div>
              معلمة المادة: <b>{cfg?.teacher || 'أستاذة مها'}</b>
              <br /><span className="sigline" />
            </div>
            <div style={{ alignSelf: 'flex-end', fontSize: 13.5, color: '#666' }}>
              تاريخ الإصدار: {new Date().toLocaleDateString('ar')}
            </div>
            <div>
              مديرة المدرسة: <b>{cfg?.principal || 'أ. بدور الجارد'}</b>
              <br /><span className="sigline" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
