import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import type { Msg } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ui';

export default function MyMessages() {
  const { me } = useAuth();
  const sid = me?.student_id ?? 0;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const { push } = useToast();

  const load = useCallback(async () => {
    if (!sid) return;
    try { setMsgs(await api('/messages/' + sid)); } catch { /* تجاهل */ }
  }, [sid]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    try {
      await api('/messages', { method: 'POST', body: JSON.stringify({ student_id: sid, body }) });
      setText('');
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  return (
    <div>
      <div className="page-head"><h2>رسائلي</h2></div>
      <div className="card">
        <div className="chat">
          <div className="chatlist" ref={boxRef}>
            {msgs.length === 0 && (
              <div className="empty">لا رسائل بعد — اكتبي رسالتك الأولى لمعلمة المادة.</div>
            )}
            {msgs.map((m, i) => (
              <div key={m.id ?? i} className={'mb ' + (m.sender === 'student' ? 's' : 't')}>
                {m.body}
                <div className="meta">
                  {new Date(m.sent_at).toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' } as Intl.DateTimeFormatOptions)}
                </div>
              </div>
            ))}
          </div>
          <form className="chatbar" onSubmit={send}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="اكتبي رسالتك…"
              maxLength={4000}
            />
            <button className="btn">إرسال</button>
          </form>
        </div>
      </div>
    </div>
  );
}
