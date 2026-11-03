import { useEffect, useState } from 'react';
import { api } from '../../api/client';

// ===== دوال مساعدة =====
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

function avgArr(arr: (number | null)[]): number | null {
  const f = arr.filter((x): x is number => x != null && !isNaN(x));
  return f.length ? f.reduce((a, b) => a + b, 0) / f.length : null;
}

// ===== مكونات صغيرة =====
function Bar({ label, value, color }: { label: string; value: number | null; color?: string }) {
  const w = value == null ? 0 : (value / 5) * 100;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 50px', alignItems: 'center', gap: 10, margin: '10px 0', fontSize: 14 }}>
      <span style={{ color: 'var(--ink)' }}>{label}</span>
      <span style={{ background: '#efe9d8', borderRadius: 6, height: 18, overflow: 'hidden', display: 'block' }}>
        <i style={{ display: 'block', height: '100%', width: `${w}%`, background: color || colorForScore(value || 0), borderRadius: 6 }} />
      </span>
      <span style={{ textAlign: 'left', fontWeight: 700, color: 'var(--pk)' }}>{value == null ? '—' : value.toFixed(1)}</span>
    </div>
  );
}

// ===== المكون الرئيسي =====
export default function Analytics() {
  const [summary, setSummary] = useState<any[]>([]);
  const [allEvals, setAllEvals] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [gradeFilter, setGradeFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [sum, cfg] = await Promise.all([
          api('/reports/summary').catch(() => []),
          api('/settings').catch(() => ({}))
        ]);
        
        const rows = Array.isArray(sum) ? sum : Array.isArray(sum?.rows) ? sum.rows : [];
        setSummary(rows);
        setSettings(cfg || {});

        // جلب التقييمات لكل طالبة
        const evalsArrays = await Promise.all(
          rows.map((r: any) => api('/evaluations?student_id=' + Number(pick(r, ['student_id', 'id']))).catch(() => []))
        );
        setAllEvals(evalsArrays.flat());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="empty">جارٍ التحميل…</div>;
  if (summary.length === 0) return <div className="empty">لا توجد بيانات مسجلة بعد. سجّلي تقييمات أولاً.</div>;

  // فلترة الطالبات
  const filteredSummary = summary.filter(r => {
    const g = String(pick(r, ['grade']));
    const s = String(pick(r, ['section']));
    return (!gradeFilter || g === gradeFilter) && (!sectionFilter || s === sectionFilter);
  });

  const filteredSids = filteredSummary.map(r => Number(pick(r, ['student_id', 'id'])));
  const filteredEvals = allEvals.filter(e => filteredSids.includes(Number(e.student_id)));

  // إحصائيات عامة
  const total = filteredSummary.length;
  const evaluated = filteredSummary.filter(r => Number(pick(r, ['present', 'present_count'])) > 0).length;
  const absentT = filteredSummary.reduce((a, r) => a + (Number(pick(r, ['absent', 'absent_count'])) || 0), 0);
  const absentX = filteredSummary.reduce((a, r) => a + (Number(pick(r, ['excused', 'excused_count'])) || 0), 0);
  
  const avgB = avgArr(filteredSummary.map(r => rowAvg(r, ['behavior', 'behavior_avg'])));
  const avgP = avgArr(filteredSummary.map(r => rowAvg(r, ['participation', 'participation_avg'])));
  const avgH = avgArr(filteredSummary.map(r => rowAvg(r, ['homework', 'homework_avg'])));

  const TABS = [
    { k: 'overview', l: 'نظرة عامة' },
    { k: 'behavior', l: 'السلوك' },
    { k: 'participation', l: 'المشاركة' },
    { k: 'homework', l: 'الواجبات' },
    { k: 'absence', l: 'الغياب' },
    { k: 'heat', l: 'الخرائط الحرارية' },
  ];

  return (
    <div>
      <div className="page-head"><h2>التقارير والتحليلات</h2></div>

      {/* الفلاتر */}
      <div className="toolbar" style={{ marginBottom: 20 }}>
        <div className="fld">
          <label>الصف</label>
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
            <option value="">كل الصفوف</option>
            {(settings.grades || ['الرابع', 'الخامس', 'السادس']).map((g: string) => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div className="fld">
          <label>الشعبة</label>
          <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
            <option value="">كل الشعب</option>
            {(settings.classes || ['أ', 'ب']).map((s: string) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* التبويبات */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '2px solid var(--line)' }}>
        {TABS.map(t => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            style={{
              background: 'none', border: 'none', padding: '10px 16px',
              borderBottom: tab === t.k ? '3px solid var(--gold)' : '3px solid transparent',
              color: tab === t.k ? 'var(--pk)' : 'var(--mut)',
              fontWeight: tab === t.k ? 'bold' : 'normal',
              cursor: 'pointer', fontSize: 16, marginBottom: -2
            }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* 1. نظرة عامة */}
      {tab === 'overview' && (
        <div>
          <div className="grid4" style={{ marginBottom: 20 }}>
            <div className="stat"><div className="k">إجمالي الطالبات</div><div className="v">{total}</div></div>
            <div className="stat"><div className="k">تم تقييمهن</div><div className="v">{evaluated}</div><div className="n">{total ? Math.round(evaluated / total * 100) : 0}% اكتمال</div></div>
            <div className="stat"><div className="k">لم يتم تقييمهن</div><div className="v">{total - evaluated}</div></div>
            <div className="stat"><div className="k">إجمالي الغياب</div><div className="v">{absentT + absentX}</div><div className="n">بدون عذر {absentT} — بعذر {absentX}</div></div>
          </div>

          <div className="card">
            <h3>متوسطات الأداء العامة</h3>
            <Bar label="السلوك" value={avgB} />
            <Bar label="المشاركة" value={avgP} />
            <Bar label="الواجبات" value={avgH} />
          </div>
        </div>
      )}

      {/* 2. تبويبات المقاييس */}
      {['behavior', 'participation', 'homework'].includes(tab) && (
        <MetricTab 
          metric={tab} 
          title={tab === 'behavior' ? 'السلوك' : tab === 'participation' ? 'المشاركة' : 'الواجبات'} 
          summary={filteredSummary} 
          evals={filteredEvals} 
          settings={settings} 
        />
      )}

      {/* 3. الغياب */}
      {tab === 'absence' && (
        <AbsenceTab summary={filteredSummary} evals={filteredEvals} />
      )}

      {/* 4. الخرائط الحرارية */}
      {tab === 'heat' && (
        <HeatmapTab summary={filteredSummary} evals={filteredEvals} />
      )}
    </div>
  );
}

// ===== تبويب المقاييس =====
function MetricTab({ metric, title, summary, evals, settings }: { metric: string; title: string; summary: any[]; evals: any[]; settings: any }) {
  // توزيع الطالبات
  const dist = [5, 4, 3, 2, 1].map(v => ({
    v,
    n: summary.filter(r => {
      const a = rowAvg(r, [metric, `${metric}_avg`]);
      return a != null && Math.round(a) === v;
    }).length
  }));
  const total = dist.reduce((a, b) => a + b.n, 0);

  // التطور
  const vals = evals.filter((e: any) => e.attendance === 'present' && e[metric] != null).map((e: any) => Number(e[metric])).filter((v: number) => !isNaN(v));
  let trend = 'بيانات غير كافية';
  let trendColor = 'var(--mut)';
  if (vals.length >= 4) {
    const mid = Math.floor(vals.length / 2);
    const a1 = avgArr(vals.slice(0, mid)) || 0;
    const a2 = avgArr(vals.slice(mid)) || 0;
    const delta = a2 - a1;
    if (delta > 0.2) { trend = 'تحسن ملحوظ'; trendColor = 'var(--ok)'; }
    else if (delta < -0.2) { trend = 'تراجع يستدعي المتابعة'; trendColor = 'var(--w4)'; }
    else { trend = 'أداء مستقر'; trendColor = 'var(--gold)'; }
  }

  const grades: string[] = settings.grades || ['الرابع', 'الخامس', 'السادس'];
  const avgByGrade = grades.map((g) => {
    const st = summary.filter(r => String(pick(r, ['grade'])) === g);
    const v = avgArr(st.map(r => rowAvg(r, [metric, `${metric}_avg`])));
    return { g, v };
  });

  return (
    <div>
      <div className="card" style={{ background: 'var(--pk3)', borderColor: 'var(--pk2)', marginBottom: 20 }}>
        <h3 style={{ margin: 0 }}>مستوى التطور في {title}</h3>
        <div style={{ fontSize: 20, fontWeight: 'bold', color: trendColor, marginTop: 8 }}>{trend}</div>
      </div>

      <div className="grid4" style={{ marginBottom: 20 }}>
        {dist.map(d => (
          <div className="card stat" key={d.v}>
            <div className="k">{d.v} — {d.v === 5 ? 'ممتاز' : d.v === 4 ? 'جيد جداً' : d.v === 3 ? 'جيد' : d.v === 2 ? 'يحتاج تحسين' : 'يحتاج متابعة'}</div>
            <div className="v">{d.n}</div>
            <div className="n">{total ? Math.round(d.n / total * 100) : 0}%</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>متوسط {title} لكل صف</h3>
        {avgByGrade.map(x => <Bar key={x.g} label={x.g} value={x.v} />)}
      </div>
    </div>
  );
}

// ===== تبويب الغياب =====
function AbsenceTab({ summary, evals }: { summary: any[]; evals: any[] }) {
  const abT = evals.filter((e: any) => e.attendance === 'absent').length;
  const abX = evals.filter((e: any) => e.attendance === 'excused').length;
  
  const abList = summary.map(r => ({
    name: String(pick(r, ['name', 'student_name']) || ''),
    n: Number(pick(r, ['absent', 'absent_count'])) || 0,
    x: Number(pick(r, ['excused', 'excused_count'])) || 0
  })).filter(r => r.n + r.x > 0).sort((a, b) => (b.n + b.x) - (a.n + a.x));

  return (
    <div>
      <div className="grid4" style={{ marginBottom: 20 }}>
        <div className="stat"><div className="k">إجمالي أيام الغياب</div><div className="v">{abT + abX}</div></div>
        <div className="stat"><div className="k">غياب بدون عذر</div><div className="v">{abT}</div></div>
        <div className="stat"><div className="k">غياب بعذر</div><div className="v">{abX}</div></div>
        <div className="stat"><div className="k">أكثر الطالبات غياباً</div><div className="v" style={{ fontSize: 18 }}>{abList.slice(0, 3).map(r => r.name.split(' ')[0]).join('، ') || '—'}</div></div>
      </div>

      <div className="card">
        <h3>الطالبات الأكثر غياباً</h3>
        {abList.length === 0 ? <div className="empty">لا يوجد غياب مسجل.</div> : (
          <table>
            <thead><tr><th>الطالبة</th><th>بدون عذر</th><th>بعذر</th><th>الإجمالي</th></tr></thead>
            <tbody>
              {abList.slice(0, 10).map((r, i) => (
                <tr key={i}><td>{r.name}</td><td>{r.n}</td><td>{r.x}</td><td><b>{r.n + r.x}</b></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ===== تبويب الخرائط الحرارية =====
function HeatmapTab({ summary, evals }: { summary: any[]; evals: any[] }) {
  const months = [...new Set(evals.map((e: any) => String(e.date || e.eval_date).slice(0, 7)))].sort();
  const val = (e: any) => avgArr([Number(e.behavior), Number(e.participation), Number(e.homework)]);

  return (
    <div className="card">
      <h3>الخريطة الحرارية — متوسطات الطالبات</h3>
      <p className="muted">كل خلية تمثل متوسط الطالبة خلال الشهر. الألوان تدل على مستوى الأداء.</p>
      
      {months.length === 0 ? <div className="empty">لا توجد تقييمات لعرض الخريطة الحرارية.</div> : (
        <div className="tbl-wrap">
          <table className="heat">
            <thead>
              <tr>
                <th style={{ textAlign: 'right' }}>الطالبة</th>
                {months.map(m => <th key={m} style={{ textAlign: 'center', fontSize: 12 }}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {summary.map((r, i) => {
                const sid = Number(pick(r, ['student_id', 'id']));
                const name = String(pick(r, ['name', 'student_name']));
                return (
                  <tr key={i}>
                    <td className="nm"><b style={{ fontSize: 13 }}>{name}</b></td>
                    {months.map(m => {
                      const evs = evals.filter((e: any) => Number(e.student_id) === sid && e.attendance === 'present' && String(e.date || e.eval_date).startsWith(m));
                      const v = avgArr(evs.map(val));
                      return (
                        <td key={m} className="c" style={{
                          background: v == null ? '#f1ede2' : colorForScore(v),
                          color: v == null ? '#b9b3a0' : '#fff'
                        }}>
                          {v == null ? '—' : v.toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}