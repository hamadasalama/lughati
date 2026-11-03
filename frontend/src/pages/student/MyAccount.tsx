import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { passwordError } from '../../api/password';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ui';

export default function MyAccount() {
  const { me, setMe } = useAuth();
  const [form, setForm] = useState({ current: '', nw: '', confirm: '' });
  const { push } = useToast();
  const nav = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.nw !== form.confirm) { push('كلمتا المرور الجديدتان غير متطابقتين', true); return; }
    const perr = passwordError(form.nw);
    if (perr) { push(perr, true); return; }
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current: form.current, new: form.nw }),
      });
      push('تم تغيير كلمة مرورك بنجاح — يُرجى تسجيل الدخول من جديد');
      setTimeout(async () => {
        try { await api('/auth/logout', { method: 'POST' }); } catch { /* تجاهل */ }
        setMe(null);
        nav('/login', { replace: true });
      }, 1200);
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  return (
    <div>
      <div className="page-head"><h2>حسابي</h2></div>
      <div className="card" style={{ maxWidth: 560 }}>
        <p>
          اسم المستخدم: <b>{me?.username}</b>
          {me?.name ? <> — {me.name}</> : null}
        </p>
        <p className="muted">
          كلمة مرورك مرتبطة بحسابك الشخصي فقط، ولا يمكن لأحد غيرك رؤيتها أو تغييرها.
          تغييرها من هنا يُبطل أي جلسة مفتوحة بحسابك.
        </p>
        <form onSubmit={submit}>
          <div className="fld">
            <label>كلمة المرور الحالية</label>
            <input type="password" value={form.current} required onChange={(e) => setForm({ ...form, current: e.target.value })} />
          </div>
          <div className="fld">
            <label>كلمة المرور الجديدة (8 أحرف على الأقل، حرف ورقم)</label>
            <input type="password" value={form.nw} required onChange={(e) => setForm({ ...form, nw: e.target.value })} />
          </div>
          <div className="fld">
            <label>تأكيد كلمة المرور الجديدة</label>
            <input type="password" value={form.confirm} required onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          </div>
          <button className="btn">حفظ كلمة المرور الجديدة</button>
        </form>
      </div>
    </div>
  );
}
