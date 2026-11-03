import { useEffect, useState } from 'react';
import { api, fileUrl } from '../../api/client';
import { useToast } from '../../components/ui';

export default function MyWorksheets() {
  const [rows, setRows] = useState<any[] | null>(null);
  const { push } = useToast();

  useEffect(() => {
    api('/worksheets').then(setRows).catch((e: any) => push(e.message || 'خطأ', true));
  }, [push]);

  if (rows === null) return <div className="empty">جارٍ التحميل…</div>;

  return (
    <div>
      <div className="page-head"><h2>أوراق عملي</h2></div>
      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">لا أوراق عمل حالياً.</div>
        ) : (
          <table>
            <thead><tr><th>الورقة</th><th>آخر تسليم</th><th>الحالة</th><th>المرفق</th></tr></thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td>
                    <b>{w.title}</b>
                    {w.description ? <div className="muted" style={{ fontSize: 14 }}>{w.description}</div> : null}
                  </td>
                  <td className="num">{w.due_date || '—'}</td>
                  <td>
                    {w.done
                      ? <span className="badge ok">أنجزتُها</span>
                      : <span className="badge">لم أُنجزها بعد</span>}
                  </td>
                  <td>
                    {w.file_id
                      ? <a className="btn ghost sm" href={fileUrl(w.file_id, true)} target="_blank" rel="noreferrer">عرض المرفق</a>
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="muted" style={{ fontSize: 14 }}>
        تُحدَّث حالة «أنجزتُها» من قبل معلمة المادة بعد تسليمك الورقة.
      </p>
    </div>
  );
}
