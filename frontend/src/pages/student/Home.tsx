import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { Star, StudentReport } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ui';

export default function Home() {
  const { me } = useAuth();
  const sid = me?.student_id ?? 0;
  const [rep, setRep] = useState<StudentReport | null>(null);
  const [star, setStar] = useState<Star | null>(null);
  const [err, setErr] = useState('');
  const { push } = useToast();

  useEffect(() => {
    if (!sid) return;
    setErr('');
    api('/reports/student/' + sid)
      .then(setRep)
      .catch((e: any) => {
        setErr(e?.message || 'تعذر تحميل بياناتك — حاولي تحديث الصفحة');
        push(e?.message || 'خطأ', true);
      });
    api('/star/current')
      .then((s) => setStar(s && s.student_id === sid ? s : null))
      .catch(() => setStar(null));
  }, [sid, push]);

  if (!sid) return <div className="empty">تعذر تحديد حساب الطالبة — يرجى إعادة تسجيل الدخول.</div>;
  if (err) return (
    <div className="empty">
      {err}
      <div style={{ marginTop: 12 }}>
        <button className="btn ghost sm" onClick={() => window.location.reload()}>إعادة المحاولة</button>
      </div>
    </div>
  );
  if (!rep) return <div className="empty">جارٍ التحميل…</div>;

  const pending = rep.worksheets.filter((w) => !w.done).length;

  return (
    <div>
      <div className="page-head"><h2>مرحباً {me?.name || me?.username} 🌿</h2></div>

      {star && (
        <div className="starcard">
          <div className="medal">👑</div>
          <div>
            <h3>أميرتي هذا الأسبوع — {star.week_label}</h3>
            {star.reason && <div className="muted">{star.reason}</div>}
          </div>
        </div>
      )}

      <div className="grid4">
        <div className="stat"><div className="v">{rep.evaluations.length}</div><div className="k">تقييماتي</div></div>
        <div className="stat">
          <div className="v">{rep.counts.behavior != null ? rep.counts.behavior.toFixed(2) : '—'}</div>
          <div className="k">متوسط سلوكي</div>
        </div>
        <div className="stat">
          <div className="v">{rep.counts.participation != null ? rep.counts.participation.toFixed(2) : '—'}</div>
          <div className="k">مشاركتي</div>
        </div>
        <div className="stat">
          <div className="v">{rep.counts.homework != null ? rep.counts.homework.toFixed(2) : '—'}</div>
          <div className="k">واجباتي</div>
        </div>
        <div className="stat"><div className="v">{rep.counts.absent}</div><div className="k">أيام غيابي</div></div>
        <div className="stat"><div className="v">{pending}</div><div className="k">أوراق لم تُنجز</div></div>
      </div>

      <div className="card">
        <h3>آخر نتائجي في الاختبارات</h3>
        {rep.tests.length === 0 ? (
          <div className="empty">لا نتائج بعد.</div>
        ) : (
          <table>
            <thead>
              <tr><th>الاختبار</th><th>التاريخ</th><th>النوع</th><th>درجتي</th><th>من</th></tr>
            </thead>
            <tbody>
              {rep.tests.slice(0, 4).map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td className="num">{t.test_date}</td>
                  <td>
                    <span className={'badge ' + (t.kind === 'nafis' ? 'warn' : 'ok')}>
                      {t.kind === 'nafis' ? 'نافس' : 'اختبار'}
                    </span>
                  </td>
                  <td className="num">{t.score != null ? t.score : 'لم تُرصد'}</td>
                  <td className="num">{t.max_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>روابط سريعة</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn ghost sm" to="/s_evals">تقييماتي</Link>
          <Link className="btn ghost sm" to="/s_msgs">رسائلي</Link>
          <Link className="btn ghost sm" to="/s_account">حسابي</Link>
        </div>
      </div>
    </div>
  );
}
