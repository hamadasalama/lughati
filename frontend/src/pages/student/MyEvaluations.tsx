import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { Evaluation, Settings } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ui';

const ATT: Record<string, { label: string; badge: string }> = {
  present: { label: 'حاضرة', badge: 'ok' },
  excused: { label: 'بعذر', badge: 'warn' },
  absent: { label: 'غائبة', badge: 'bad' },
};

export default function MyEvaluations() {
  const { me } = useAuth();
  const [rows, setRows] = useState<Evaluation[]>([]);
  const [cfg, setCfg] = useState<Settings>({});
  const { push } = useToast();

  useEffect(() => {
    if (!me?.student_id) return;
    api('/evaluations').then(setRows).catch((e: any) => push(e.message || 'خطأ', true));
    api('/settings').then(setCfg).catch(() => {});
  }, [me?.student_id, push]);

  const labels: Record<string, string> = cfg?.scale?.labels || {};
  const cell = (n: number | null) => (n != null ? n + ' — ' + (labels[String(n)] || '') : '—');

  return (
    <div>
      <div className="page-head"><h2>تقييماتي</h2></div>
      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">لا تقييمات بعد.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>التاريخ</th><th>الحضور</th><th>السلوك</th>
                <th>المشاركة</th><th>الواجب</th><th>ملاحظات المعلمة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td className="num">{v.eval_date}</td>
                  <td><span className={'badge ' + ATT[v.attendance].badge}>{ATT[v.attendance].label}</span></td>
                  <td className="num">{cell(v.behavior)}</td>
                  <td className="num">{cell(v.participation)}</td>
                  <td className="num">{cell(v.homework)}</td>
                  <td>{v.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
