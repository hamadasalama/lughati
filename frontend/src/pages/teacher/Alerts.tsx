import { useEffect, useState } from 'react';
import { api, qs } from '../../api/client';
import type { Student } from '../../api/types';
import { useToast } from '../../components/ui';

interface Item { name: string; cls: string; kind: string; text: string; }

export default function Alerts() {
  const [cfg, setCfg] = useState<any>({});
  const [items, setItems] = useState<Item[] | null>(null);
  const [noEvalNames, setNoEvalNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    api('/settings').then(setCfg).catch(() => {});
  }, []);

  const a = cfg?.alerts || {};
  const lowThreshold = Number(a.lowThreshold) || 2;
  const lowStreak = Number(a.lowStreak) || 3;
  const absenceDays = Number(a.absenceDays) || 3;
  const noEvalDays = Number(a.noEvalDays) || 14;

  async function analyze() {
    setBusy(true);
    setItems(null);
    try {
      const [stus, c] = await Promise.all([api('/students'), api('/settings')]);
      setCfg(c);
      const al = c?.alerts || {};
      const lowT = Number(al.lowThreshold) || 2;
      const lowS = Number(al.lowStreak) || 3;
      const absD = Number(al.absenceDays) || 3;
      const noD = Number(al.noEvalDays) || 14;
      const active: Student[] = stus.filter((s: Student) => s.active);
      const res = await Promise.all(active.map((s) =>
        api('/evaluations' + qs({ student_id: s.id }))
          .then((evs) => ({ s, evs: Array.isArray(evs) ? evs : [] }))
          .catch(() => ({ s, evs: [] as any[] }))
      ));
      const out: Item[] = [];
      const none: string[] = [];
      const today = Date.now();
      for (const { s, evs } of res) {
        const cls = s.grade + '/' + s.section;
        const sorted = [...evs].sort((x: any, y: any) => (x.eval_date < y.eval_date ? -1 : 1));
        const absent = sorted.filter((v: any) => v.attendance === 'absent').length;
        if (absent >= absD) {
          out.push({ name: s.name, cls, kind: 'غياب', text: 'غياب متكرر (' + absent + ' أيام) — يوصى بالتواصل مع الأسرة لدعم حضورها.' });
        }
        if (sorted.length === 0) {
          none.push(s.name);
        } else {
          const lastD = Date.parse(sorted[sorted.length - 1].eval_date + 'T00:00:00Z');
          const days = Math.floor((today - lastD) / 86400000);
          if (days >= noD) {
            out.push({ name: s.name, cls, kind: 'متابعة تقييم', text: 'لم تُسجَّل لها تقييمات منذ ' + days + ' يوماً — يوصى بمراجعة سجلها.' });
          }
        }
        let streak = 0;
        for (let i = sorted.length - 1; i >= 0; i--) {
          const v: any = sorted[i];
          if (v.attendance !== 'present') break;
          const av = ((Number(v.behavior) || 0) + (Number(v.participation) || 0) + (Number(v.homework) || 0)) / 3;
          if (av < lowT) streak++; else break;
        }
        if (streak >= lowS) {
          out.push({ name: s.name, cls, kind: 'مستوى', text: 'انخفاض في درجاتها في آخر ' + streak + ' تقييمات متتالية — تحتاج إلى متابعة وتعزيز.' });
        }
      }
      out.sort((x, y) => x.name.localeCompare(y.name, 'ar'));
      setItems(out);
      setNoEvalNames(none);
    } catch (err: any) {
      push(err?.message || 'خطأ غير متوقع', true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2>التنبيهات والتوصيات</h2>
        <button className="btn" onClick={analyze} disabled={busy}>{busy ? 'جارٍ التحليل…' : 'تحليل الوضع الحالي'}</button>
      </div>

      <div className="card">
        <h3>معايير التنبيه (من الإعدادات)</h3>
        <div className="muted">
          {lowStreak} تقييمات متتالية بمتوسط أقل من {lowThreshold} · غياب {absenceDays} أيام أو أكثر · بلا تقييم منذ {noEvalDays} يوماً أو أكثر
        </div>
        <p className="muted" style={{ fontSize: 14, marginBottom: 0 }}>
          التوصيات صياغات بنّاءة للاسترشاد وليست أحكاماً نهائية على الطالبات.
        </p>
      </div>

      {items === null ? (
        <div className="empty">انقري «تحليل الوضع الحالي» لعرض التوصيات.</div>
      ) : items.length === 0 ? (
        <div className="card"><div className="empty">لا توصيات حالياً وفق المعايير المحددة 🌿</div></div>
      ) : (
        <div className="card">
          <table>
            <thead><tr><th>الطالبة</th><th>الصف/الشعبة</th><th>النوع</th><th>التوصية</th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td><b>{it.name}</b></td>
                  <td>{it.cls}</td>
                  <td><span className={'badge ' + (it.kind === 'غياب' ? 'bad' : it.kind === 'مستوى' ? 'warn' : '')}>{it.kind}</span></td>
                  <td>{it.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items !== null && noEvalNames.length > 0 && (
        <div className="card">
          <b>طالبات بلا أي تقييم بعد ({noEvalNames.length}):</b>
          <div className="muted">{noEvalNames.join('، ')}</div>
        </div>
      )}
    </div>
  );
}
