import { useEffect, useState } from 'react';
import { api, fileUrl } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ui';

export default function MyAchievements() {
  const { me } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);
  const [star, setStar] = useState<any>(null);
  const { push } = useToast();

  useEffect(() => {
    api('/achievements').then(setRows).catch((e: any) => push(e.message || 'خطأ', true));
    api('/star/current')
      .then((s) => setStar(s && s.student_id === me?.student_id ? s : null))
      .catch(() => setStar(null));
  }, [push, me?.student_id]);

  if (rows === null) return <div className="empty">جارٍ التحميل…</div>;

  return (
    <div>
      <div className="page-head"><h2>إنجازات المادة</h2></div>

      {star && (
        <div className="starcard">
          <div className="medal">👑</div>
          <div>
            <h3>أميرة هذا الأسبوع أنتِ! — {star.week_label}</h3>
            {star.reason && <div className="muted">{star.reason}</div>}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card"><div className="empty">لا إنجازات معلنة بعد.</div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 12 }}>
          {rows.map((a) => (
            <div className="card" key={a.id} style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>{a.title}</b>
                <span className="badge">{a.category || 'أخرى'}</span>
              </div>
              {a.description && <div className="muted" style={{ fontSize: 14.5 }}>{a.description}</div>}
              {Array.isArray(a.files) && a.files.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {a.files.map((f: any, i: number) => {
                    const id = typeof f === 'number' ? f : (f?.file_id ?? f?.id);
                    if (!id) return null;
                    const isImg = String(f?.mime || '').startsWith('image/');
                    return isImg ? (
                      <a key={i} href={fileUrl(id, true)} target="_blank" rel="noreferrer">
                        <img
                          src={fileUrl(id, true)}
                          alt={f?.original_name || 'مرفق الإنجاز'}
                          style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }}
                          onError={(e: any) => { e.currentTarget.parentElement!.style.display = 'none'; }}
                        />
                      </a>
                    ) : (
                      <a key={i} className="btn ghost sm" href={fileUrl(id)}>
                        📎 {f?.original_name || 'مرفق'}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
