import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useBranding } from '../branding/BrandingContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const { refresh } = useAuth();
  const { branding } = useBranding();
  const nav = useNavigate();

  // الشعار الرسمي المضغوط داخل public
  const logoUrl = '/logo.png';
  const t = branding.theme.texts;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      
      await refresh();
      nav('/'); 
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : 'تعذر تسجيل الدخول');
      setBusy(false);
    }
  }

  return (
    <div id="loginView">
      
      {/* ===== الجانب الأيمن ===== */}
      <div className="lg-right">
        <div className="lg-brand">
          <div className="slg">
            <img src={logoUrl} alt="شعار المدرسة" />
          </div>
          <div>
            <div className="lg-school">{t.loginSchool}</div>
            <div className="lg-sub">{t.loginSubtitle}</div>
          </div>
        </div>

        <div className="lg-rule" />

        <div className="lg-quote">
          « <i>{t.loginQuote1}</i> »
        </div>
        <div className="lg-quote">
          « {t.loginQuote2} »
        </div>
        <div className="lg-quote" style={{ fontSize: 22 }}>
          « {t.loginQuote3} »
        </div>

        <div className="lg-credit">
          <div className="bar" />
          <div>
            <b>إعداد وتنفيذ: {t.creditName}</b>
            <span style={{ color: '#b9c8b3', fontSize: 13.5 }}>{t.creditRole}</span>
          </div>
        </div>
      </div>

      {/* ===== الجانب الأيسر ===== */}
      <div className="lg-left">
        <form className="lg-card" onSubmit={submit}>
          
          <div className="slg">
            <img src={logoUrl} alt="شعار المدرسة" />
          </div>

          <h2>تسجيل الدخول</h2>
          <div className="sub">أهلاً بعودتك، سجّلي الدخول للمتابعة</div>

          {err && <div className="err-box">{err}</div>}

          <div className="fld">
            <label>اسم المستخدم</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="fld">
            <label>كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-login" disabled={busy}>
            {busy ? 'جارٍ التحقق…' : (
              <>
                دخول المنصة
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
              </>
            )}
          </button>

          
        </form>
      </div>

    </div>
  );
}