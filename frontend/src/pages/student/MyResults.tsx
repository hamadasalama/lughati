import { useEffect, useState } from 'react';
import { api, fileUrl } from '../../api/client';
import type { StudentReport } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ui';

export default function MyResults() {
  const { me } = useAuth();
  const sid = me?.student_id ?? 0;
  const [rep, setRep] = useState<StudentReport | null>(null);
  const [kind, setKind] = useState<'all' | 'test' | 'nafis'>('all');
  const [err, setErr] = useState('');
  const { push } = useToast();

  useEffect(() => {
    if (!sid) return;
    setErr('');
    api('/reports/student/' + sid)
      .then(setRep)
      .catch((e: any) => {
        setErr(e?.message || 'تعذر تحميل نتائجك — حاولي تحديث الصفحة');
        push(e?.message || 'خطأ', true);
      });
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

  const list = rep.tests.filter((t) => kind === 'all' || t.kind === kind);
  const nafisCount = rep.tests.filter((t) => t.kind === 'nafis').length;

  return (
    <div>
      <div className="page-head"><h2>نتائجي</h2></div>
      <div className="card">
        <div className="seg" style={{ marginBottom: 12 }}>
          <button className={kind === 'all' ? 'on' : ''} onClick={() => setKind('all')}>الكل ({rep.tests.length})</button>
          <button className={kind === 'test' ? 'on' : ''} onClick={() => setKind('test')}>اختبارات صفية</button>
          <button className={kind === 'nafis' ? 'on' : ''} onClick={() => setKind('nafis')}>نافس ({nafisCount})</button>
        </div>
        {list.length === 0 ? (
          <div className="empty">لا نتائج في هذا التصنيف بعد.</div>
        ) : (
          <table>
            <thead>
              <tr><th>الاختبار</th><th>التاريخ</th><th>النوع</th><th>درجتي</th><th>من</th><th>ملاحظة المعلمة</th><th>المرفق</th></tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td className="num">{t.test_date}</td>
                  <td>
                    <span className={'badge ' + (t.kind === 'nafis' ? 'warn' : 'ok')}>
                      {t.kind === 'nafis' ? 'نافس' : 'اختبار'}
                    </span>
                  </td>
                  <td className="num">{t.score != null ? t.score : 'لم تُرصد بعد'}</td>
                  <td className="num">{t.max_score}</td>
                  <td>{t.note || '—'}</td>
                  <td>
                    {t.file_id
                      ? <a className="btn ghost sm" href={fileUrl(t.file_id, true)} target="_blank" rel="noreferrer">📎 عرض</a>
                      : '—'}
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
