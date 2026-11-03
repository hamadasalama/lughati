import { useEffect, useState } from 'react';
import { api, fileUrl } from '../../api/client';
import { useToast } from '../../components/ui';

function fmtDate(v: any): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ar');
}

export default function MyPlan() {
  const [rows, setRows] = useState<any[] | null>(null);
  const { push } = useToast();

  useEffect(() => {
    api('/plans').then(setRows).catch((e: any) => push(e.message || 'خطأ', true));
  }, [push]);

  if (rows === null) return <div className="empty">جارٍ التحميل…</div>;

  return (
    <div>
      <div className="page-head"><h2>خطتي العلاجية</h2></div>
      {rows.length === 0 ? (
        <div className="card">
          <div className="empty">لا خطط علاجية حالياً — هذا مؤشر إيجابي على تقدمك 🌿</div>
        </div>
      ) : rows.map((p) => (
        <div className="card" key={p.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <b>{p.title}</b>
            <span className={'badge ' + (p.status === 'done' ? 'ok' : '')}>{p.status === 'done' ? 'مكتملة' : 'نشطة'}</span>
          </div>
          {p.from_date || p.to_date ? (
            <div className="muted" style={{ fontSize: 13.5 }}>المدة: {p.from_date || '—'} ← {p.to_date || '—'}</div>
          ) : null}
          {p.goal && <p style={{ margin: '6px 0' }}><b>الهدف:</b> {p.goal}</p>}
          {(p.actions ?? p.description) && <p style={{ margin: '6px 0' }}>{p.actions ?? p.description}</p>}
          {p.file_id && (
            <p style={{ margin: '6px 0' }}>
              <a className="btn ghost sm" href={fileUrl(p.file_id, true)} target="_blank" rel="noreferrer">
                📎 عرض مرفق الخطة
              </a>{' '}
              <a className="btn ghost sm" href={fileUrl(p.file_id)}>تنزيل</a>
            </p>
          )}
          {Array.isArray(p.followups) && p.followups.length > 0 && (
            <div>
              <b style={{ fontSize: 14.5, color: 'var(--mut)' }}>متابعات المعلمة:</b>
              {p.followups.map((f: any) => (
                <div key={f.id} style={{ fontSize: 15 }}>
                  • {f.note}
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {' '}({fmtDate(f.created_at || f.follow_date)})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
