import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import type { Msg } from '../../api/types';
import { useToast } from '../../components/ui';

export default function Msgs() {
  const [threads, setThreads] = useState<any[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const { push } = useToast();

  const loadThreads = useCallback(async () => {
    try { setThreads(await api('/messages/threads')); } catch { /* تجاهل */ }
  }, []);

  const loadMsgs = useCallback(async (sid: number) => {
    try { setMsgs(await api('/messages/' + sid)); } catch { /* تجاهل */ }
  }, []);

  useEffect(() => {
    loadThreads();
    const t = setInterval(loadThreads, 10000);
    return () => clearInterval(t);
  }, [loadThreads]);

  useEffect(() => {
    if (sel != null) loadMsgs(sel).then(loadThreads);
  }, [sel, loadMsgs, loadThreads]);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sel == null) return;
    try {
      await api('/messages', { method: 'POST', body: JSON.stringify({ student_id: sel, body }) });
      setText('');
      await loadMsgs(sel);
      loadThreads();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  return (
    <div>
      <div className="page-head"><h2>الرسائل</h2></div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div className="card" style={{ width: 290, flexShrink: 0, padding: 10, maxHeight: '70vh', overflowY: 'auto' }}>
          {threads.length === 0 ? (
            <div className="empty">لا محادثات بعد — ستظهر هنا محادثات الطالبات.</div>
          ) : threads.map((t) => {
            const sid = Number(t.student_id);
            const nm = t.student_name ?? t.name ?? ('طالبة #' + sid);
            const last = t.last_body ?? t.last ?? '';
            const at = t.last_at ?? t.last_time ?? null;
            const un = Number(t.unread) || 0;
            return (
              <div
                key={sid}
                onClick={() => setSel(sid)}
                style={{
                  cursor: 'pointer',
                  background: sel === sid ? 'var(--pk3)' : 'transparent',
                  border: '1px solid ' + (sel === sid ? 'var(--pk2)' : 'transparent'),
                  borderRadius: 10, padding: '8px 10px', marginBottom: 4,
                }}
              >
                <span style={{ fontWeight: sel === sid ? 'bold' : 'normal' }}>{nm}</span>
                {un > 0 && <> <span className="badge warn">{un} جديدة</span></>}
                {last && (
                  <div className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {last}
                  </div>
                )}
                {at && (
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    {new Date(at).toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' } as Intl.DateTimeFormatOptions)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="card" style={{ flex: 1 }}>
          {sel == null ? (
            <div className="empty">اختاري محادثة من القائمة.</div>
          ) : (
            <div className="chat">
              <div className="chatlist" ref={boxRef}>
                {msgs.length === 0 && <div className="empty">لا رسائل في هذه المحادثة بعد.</div>}
                {msgs.map((m, i) => (
                  <div key={m.id ?? i} className={'mb ' + (m.sender === 'teacher' ? 's' : 't')}>
                    {m.body}
                    <div className="meta">
                      {new Date(m.sent_at).toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' } as Intl.DateTimeFormatOptions)}
                    </div>
                  </div>
                ))}
              </div>
              <form className="chatbar" onSubmit={send}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتبي ردك…" maxLength={4000} />
                <button className="btn">إرسال</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
