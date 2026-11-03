import { useState } from 'react';
import { api, ApiError, qs } from '../../api/client';
import { useToast } from '../../components/ui';

const METRICS: [string, string, string][] = [
  ['behavior', 'behavior_avg', 'السلوك'],
  ['participation', 'participation_avg', 'المشاركة'],
  ['homework', 'homework_avg', 'الواجب'],
];

function countOf(o: any): number | null {
  if (!o) return null;
  const c = o.count ?? o.n ?? o.present ?? o.present_count;
  return c == null ? null : Number(c);
}

export default function Compare() {
  const [f, setF] = useState({ fromA: '', toA: '', fromB: '', toB: '' });
  const [res, setRes] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  async function run() {
    if (!f.fromA || !f.toA || !f.fromB || !f.toB) { push('حدّدي الفترتين كاملتين', true); return; }
    setBusy(true);
    try {
      setRes(await api('/reports/compare' + qs({ fromA: f.fromA, toA: f.toA, fromB: f.fromB, toB: f.toB })));
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    } finally {
      setBusy(false);
    }
  }

  const A = res?.A ?? res?.a ?? res?.first ?? {};
  const B = res?.B ?? res?.b ?? res?.second ?? {};
  const cA = countOf(A);
  const cB = countOf(B);
  const okA = cA == null || cA >= 4;
  const okB = cB == null || cB >= 4;

  let trendLine: string | null = null;
  const tr = res?.trend;
  if (tr && tr.enough) {
    const s = Number(tr.slope);
    trendLine = s > 0
      ? '📈 الاتجاه العام بين الفترتين: تحسّن تدريجي — استمري بنفس الأسلوب.'
      : s < 0
        ? '📉 الاتجاه العام: يحتاج تعزيزاً عبر أنشطة داعمة.'
        : '➡️ الاتجاه العام: مستقر.';
  }
  const notEnough = res != null && (res.enough === false || res.trendEnough === false || !okA || !okB);

  return (
    <div>
      <div className="page-head"><h2>مقارنة الفترات</h2></div>

      <div className="card">
        <h3>الفترتان</h3>
        <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
          المقارنة العادلة تحتاج 4 تقييمات بحضور «حاضرة» على الأقل في كل فترة — وإلا تُخفى النتائج ولا يُستنتج منها حكم.
        </p>
        <div className="form-grid">
          <div className="fld">
            <label>الفترة الأولى — من</label>
            <input type="date" value={f.fromA} onChange={(e) => setF({ ...f, fromA: e.target.value })} />
          </div>
          <div className="fld">
            <label>الفترة الأولى — إلى</label>
            <input type="date" value={f.toA} onChange={(e) => setF({ ...f, toA: e.target.value })} />
          </div>
          <div className="fld">
            <label>الفترة الثانية — من</label>
            <input type="date" value={f.fromB} onChange={(e) => setF({ ...f, fromB: e.target.value })} />
          </div>
          <div className="fld">
            <label>الفترة الثانية — إلى</label>
            <input type="date" value={f.toB} onChange={(e) => setF({ ...f, toB: e.target.value })} />
          </div>
        </div>
        <button className="btn" onClick={run} disabled={busy}>{busy ? 'جارٍ الحساب…' : 'قارني'}</button>
      </div>

      {res && (
        <div className="card">
          <h3>النتيجة</h3>
          <p className="muted" style={{ fontSize: 14 }}>
            عدد التقييمات الحاضرة: الفترة الأولى {cA ?? '—'} · الفترة الثانية {cB ?? '—'}
          </p>
          <table>
            <thead>
              <tr>
                <th>المعيار</th>
                <th>الفترة الأولى</th>
                <th>الفترة الثانية</th>
                <th>الفارق</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map(([k, alt, label]) => {
                const av = A?.[k] ?? A?.[alt];
                const bv = B?.[k] ?? B?.[alt];
                const showA = okA && av != null && av !== '' ? Number(av).toFixed(2) : '—';
                const showB = okB && bv != null && bv !== '' ? Number(bv).toFixed(2) : '—';
                const d = av != null && bv !== '' && av !== '' && bv != null && okA && okB
                  ? Math.round((Number(bv) - Number(av)) * 100) / 100
                  : null;
                return (
                  <tr key={k}>
                    <td>{label}</td>
                    <td className="num">{showA}</td>
                    <td className="num">{showB}</td>
                    <td className="num">
                      {d == null ? '—' : (
                        <span className={'badge ' + (d > 0 ? 'ok' : d < 0 ? 'warn' : '')}>
                          {(d > 0 ? '+ ' : '') + d.toFixed(2)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {notEnough && (
            <p className="muted" style={{ fontSize: 14 }}>
              لا تُعرض بعض القيم لعدم توفر 4 تقييمات حاضرة على الأقل في إحدى الفترتين.
            </p>
          )}
          {trendLine && <p>{trendLine}</p>}
        </div>
      )}
    </div>
  );
}
