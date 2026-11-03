import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, qs } from '../../api/client';
import { passwordError } from '../../api/password';
import type { Account, Evaluation, Settings, Student } from '../../api/types';
import Icon from '../../components/Icon';
import { Modal, useToast } from '../../components/ui';

const ATT: Record<string, { label: string; badge: string }> = {
  present: { label: 'حاضرة', badge: 'ok' },
  excused: { label: 'بعذر', badge: 'warn' },
  absent: { label: 'غائبة', badge: 'bad' },
};

const CRITERIA: [string, string][] = [
  ['behavior', 'السلوك'],
  ['participation', 'المشاركة'],
  ['homework', 'الواجب المنزلي'],
];

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

const EMPTY_EVAL = {
  eval_date: todayStr(),
  attendance: 'present',
  behavior: 0,
  participation: 0,
  homework: 0,
  notes: '',
};

export default function StudentRecord() {
  const { id } = useParams();
  const sid = Number(id);
  const [st, setSt] = useState<Student | null>(null);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [cfg, setCfg] = useState<Settings>({});
  const [acc, setAcc] = useState<Account | null>(null);
  const [showEval, setShowEval] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY_EVAL });
  const [showAcc, setShowAcc] = useState(false);
  const [accForm, setAccForm] = useState({ username: '', password: '' });
  const { push } = useToast();

  const load = useCallback(async () => {
    const [s, evs, c, us] = await Promise.all([
      api('/students/' + sid),
      api('/evaluations' + qs({ student_id: sid })),
      api('/settings'),
      api('/users' + qs({ student_id: sid })),
    ]);
    setSt(s);
    setEvals(evs);
    setCfg(c);
    setAcc(Array.isArray(us) && us.length ? us[0] : null);
  }, [sid]);

  useEffect(() => { load().catch((e: any) => push(e.message || 'خطأ', true)); }, [load, push]);

  const labels: Record<string, string> = cfg?.scale?.labels || {};
  const maxScore = Number(cfg?.scale?.max) || 5;
  const scores = Array.from({ length: maxScore }, (_, i) => maxScore - i);
  const present = evals.filter((v) => v.attendance === 'present');
  const avg = (k: 'behavior' | 'participation' | 'homework') =>
    present.length
      ? (present.reduce((a, v) => a + (Number(v[k]) || 0), 0) / present.length).toFixed(2)
      : '—';
  const absentDays = evals.filter((v) => v.attendance === 'absent').length;
  const complete =
    form.attendance !== 'present' ||
    (form.behavior > 0 && form.participation > 0 && form.homework > 0);

  async function saveEval(e: FormEvent) {
    e.preventDefault();
    try {
      const body: any = {
        student_id: sid,
        eval_date: form.eval_date,
        attendance: form.attendance,
        notes: form.notes,
      };
      if (form.attendance === 'present') {
        body.behavior = form.behavior;
        body.participation = form.participation;
        body.homework = form.homework;
      }
      await api('/evaluations', { method: 'POST', body: JSON.stringify(body) });
      push('تم حفظ التقييم');
      setShowEval(false);
      setForm({ ...EMPTY_EVAL });
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function removeEval(v: Evaluation) {
    if (!confirm('حذف هذا التقييم نهائياً؟')) return;
    try {
      await api('/evaluations/' + v.id, { method: 'DELETE' });
      push('تم حذف التقييم');
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    const perr = passwordError(accForm.password);
    if (perr) { push('كلمة المرور المؤقتة: ' + perr, true); return; }
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          username: accForm.username,
          password: accForm.password,
          role: 'student',
          student_id: sid,
        }),
      });
      push('تم إنشاء حساب الطالبة');
      setShowAcc(false);
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function toggleActive() {
    if (!acc) return;
    try {
      await api('/users/' + acc.id, {
        method: 'PATCH',
        body: JSON.stringify({ active: !acc.active }),
      });
      push(acc.active ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب');
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function resetPassword() {
    if (!acc) return;
    const p = prompt('كلمة المرور الجديدة لحساب «' + acc.username + '» (8 أحرف على الأقل، حرف ورقم):');
    if (!p) return;
    const perr = passwordError(p);
    if (perr) { push(perr, true); return; }
    try {
      await api('/users/' + acc.id, { method: 'PATCH', body: JSON.stringify({ password: p }) });
      push('تم إعادة تعيين كلمة المرور');
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  if (!st) return <div className="empty">جارٍ التحميل…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>{st.name}</h2>
          <div className="muted">
            {st.grade} / {st.section} — الرمز {st.code} · <Link to="/students">← كل الطالبات</Link>
          </div>
        </div>
        <button className="btn" onClick={() => { setForm({ ...EMPTY_EVAL }); setShowEval(true); }}>
          <Icon name="plus" size={15} /> تقييم جديد
        </button>
      </div>

      <div className="grid4">
        <div className="stat"><div className="v">{evals.length}</div><div className="k">عدد التقييمات</div></div>
        <div className="stat"><div className="v">{avg('behavior')}</div><div className="k">متوسط السلوك</div></div>
        <div className="stat"><div className="v">{avg('participation')}</div><div className="k">متوسط المشاركة</div></div>
        <div className="stat"><div className="v">{avg('homework')}</div><div className="k">متوسط الواجب</div></div>
        <div className="stat"><div className="v">{absentDays}</div><div className="k">أيام الغياب</div></div>
      </div>

      <div className="card">
        <h3>سجل التقييمات</h3>
        {evals.length === 0 ? (
          <div className="empty">لا تقييمات بعد.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>التاريخ</th><th>الحضور</th><th>السلوك</th>
                <th>المشاركة</th><th>الواجب</th><th>ملاحظات</th><th></th>
              </tr>
            </thead>
            <tbody>
              {evals.map((v) => (
                <tr key={v.id}>
                  <td className="num">{v.eval_date}</td>
                  <td><span className={'badge ' + ATT[v.attendance].badge}>{ATT[v.attendance].label}</span></td>
                  <td className="num">{v.behavior != null ? v.behavior + ' — ' + (labels[String(v.behavior)] || '') : '—'}</td>
                  <td className="num">{v.participation != null ? v.participation + ' — ' + (labels[String(v.participation)] || '') : '—'}</td>
                  <td className="num">{v.homework != null ? v.homework + ' — ' + (labels[String(v.homework)] || '') : '—'}</td>
                  <td>{v.notes || '—'}</td>
                  <td><button className="btn danger sm" onClick={() => removeEval(v)}>حذف</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>حساب الدخول</h3>
        {!acc ? (
          <div>
            <p className="muted">لا يوجد لهذه الطالبة حساب دخول بعد.</p>
            <button
              className="btn"
              onClick={() => {
                setAccForm({ username: (st.code || '').toLowerCase(), password: '' });
                setShowAcc(true);
              }}
            >
              إنشاء حساب للطالبة
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <b className="num">{acc.username}</b>
            <span className={'badge ' + (acc.active ? 'ok' : 'warn')}>{acc.active ? 'نشط' : 'موقوف'}</span>
            <button className="btn ghost sm" onClick={toggleActive}>
              {acc.active ? 'إيقاف الحساب' : 'تفعيل الحساب'}
            </button>
            <button className="btn ghost sm" onClick={resetPassword}>إعادة تعيين كلمة المرور</button>
          </div>
        )}
      </div>

      {showEval && (
        <Modal title={'تقييم جديد — ' + st.name} onClose={() => setShowEval(false)}>
          <form onSubmit={saveEval}>
            <div className="form-grid">
              <div className="fld">
                <label>التاريخ</label>
                <input
                  type="date" value={form.eval_date} required
                  onChange={(e) => setForm({ ...form, eval_date: e.target.value })}
                />
              </div>
              <div className="fld">
                <label>الحضور</label>
                <div className="seg">
                  {Object.entries(ATT).map(([k, a]) => (
                    <button
                      key={k} type="button"
                      className={form.attendance === k ? 'on' : ''}
                      onClick={() => setForm({ ...form, attendance: k })}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {form.attendance === 'present' ? (
              CRITERIA.map(([k, label]) => (
                <div className="fld" key={k}>
                  <label>{label}</label>
                  <div className="sc-row">
                    {scores.map((n) => (
                      <button
                        key={n} type="button"
                        className={'sc' + (form[k] === n ? ' on' : '')}
                        onClick={() => setForm({ ...form, [k]: n })}
                      >
                        {n}<small>{labels[String(n)] || ''}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">لا تُسجَّل درجات لطالبة غير حاضرة — يُحفظ التقييم كسجل حضور.</p>
            )}
            <div className="fld">
              <label>ملاحظات</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <button className="btn" disabled={!complete}>حفظ التقييم</button>
          </form>
        </Modal>
      )}

      {showAcc && (
        <Modal title="إنشاء حساب للطالبة" onClose={() => setShowAcc(false)}>
          <form onSubmit={createAccount}>
            <div className="fld">
              <label>اسم المستخدم</label>
              <input
                value={accForm.username} required
                onChange={(e) => setAccForm({ ...accForm, username: e.target.value })}
              />
            </div>
            <div className="fld">
              <label>كلمة مرور مؤقتة (8 أحرف على الأقل، حرف ورقم)</label>
              <input
                type="password"
                value={accForm.password} required
                onChange={(e) => setAccForm({ ...accForm, password: e.target.value })}
              />
            </div>
            <p className="muted">ستغيّر الطالبة كلمة مرورها من «حسابي» بعد أول دخول.</p>
            <button className="btn">إنشاء الحساب</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
