import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../components/ui';

function colorForScore(v: number): string {
  return v >= 4.5 ? '#1a5c42' : v >= 3.5 ? '#4c8a63' : v >= 2.5 ? '#c9a23f' : v >= 1.5 ? '#cf8a4a' : '#b8503c';
}

export default function MySkills() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const { push } = useToast();

  useEffect(() => {
    api('/skills').then(setRows).catch((e: any) => push(e.message || 'خطأ', true));
    api('/settings').then((c) => setLabels(c?.scale?.labels || {})).catch(() => {});
  }, [push]);

  if (rows === null) return <div className="empty">جارٍ التحميل…</div>;

  return (
    <div>
      <div className="page-head"><h2>مهاراتي</h2></div>
      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">لا مهارات مسجّلة بعد.</div>
        ) : (
          <table>
            <thead><tr><th>المهارة</th><th>مستواي</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="num">
                    {s.level != null ? (
                      <span>
                        <b style={{ color: colorForScore(Number(s.level)) }}>{s.level}</b>
                        {' '}من 5 — {labels[String(s.level)] || ''}
                      </span>
                    ) : '— لم يُرصد بعد'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
