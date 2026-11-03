import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, qs } from '../../api/client';
import { passwordError } from '../../api/password';
import type { Account, AuditPage } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import Icon from '../../components/Icon';
import { Modal, useToast } from '../../components/ui';

const ROLE_LABEL: Record<string, string> = {
  teacher: 'معلمة',
  admin: 'إدارة',
  student: 'طالبة',
};

const ACTION_LABEL: Record<string, string> = {
  login: 'دخول ناجح',
  login_fail: 'محاولة دخول فاشلة',
  'password.change': 'تغيير كلمة مرور',
  'file.download': 'تنزيل ملف',
  'evaluation.create': 'إضافة تقييم',
  'evaluation.delete': 'حذف تقييم',
  'worksheet.create': 'إضافة ورقة عمل',
  'worksheet.update': 'تعديل ورقة عمل',
  'worksheet.status': 'تحديث حالة ورقة',
  'worksheet.delete': 'حذف ورقة عمل',
  'test.create': 'إضافة اختبار',
  'test.results': 'رصد نتائج',
  'test.delete': 'حذف اختبار',
  'plan.create': 'إضافة خطة علاجية',
  'plan.update': 'تعديل خطة علاجية',
  'plan.followup': 'متابعة خطة',
  'plan.delete': 'حذف خطة علاجية',
  'achievement.create': 'إضافة إنجاز',
  'achievement.update': 'تعديل إنجاز',
  'achievement.delete': 'حذف إنجاز',
  'student.create': 'إضافة طالبة',
  'student.update': 'تعديل طالبة',
  'student.delete': 'حذف طالبة',
  'students.import': 'استيراد طالبات',
  'account.create': 'إنشاء حساب',
  'account.update': 'تعديل حساب',
  'account.delete': 'حذف حساب',
};

const PAGE = 50;

function fmtDate(v: string) {
  try {
    return new Date(v).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return v;
  }
}

function fmtDetails(d: any) {
  if (d == null) return '';
  if (typeof d === 'string') return d;
  try {
    const s = JSON.stringify(d);
    return s.length > 90 ? s.slice(0, 90) + '…' : s;
  } catch {
    return '';
  }
}

export default function Admin() {
  const [tab, setTab] = useState<'users' | 'audit'>('users');
  const [users, setUsers] = useState<Account[]>([]);
  const [creating, setCreating] = useState<any>(null);
  const [audit, setAudit] = useState<AuditPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [term, setTerm] = useState('');
  const [appliedTerm, setAppliedTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  const { me } = useAuth();

  const loadUsers = useCallback(async () => {
    // حسابات الطالبات تُدار من سجل الطالبة؛ هنا المعلمات والإدارة فقط
    const rows: Account[] = await api('/users');
    setUsers(rows.filter((u) => u.role !== 'student'));
  }, []);

  const loadAudit = useCallback(async () => {
    setAudit(await api('/audit' + qs({ limit: PAGE, offset, q: appliedTerm })));
  }, [offset, appliedTerm]);

  useEffect(() => {
    if (tab === 'users') loadUsers().catch((e: any) => push(e.message || 'خطأ', true));
    else loadAudit().catch((e: any) => push(e.message || 'خطأ', true));
  }, [tab, loadUsers, loadAudit, push]);

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    const perr = passwordError(String(creating?.password ?? ''));
    if (perr) { push(perr, true); return; }
    setBusy(true);
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({ username: creating.username, password: creating.password, role: creating.role }),
      });
      push('تم إنشاء الحساب');
      setCreating(null);
      loadUsers();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(u: Account) {
    try {
      await api('/users/' + u.id, { method: 'PATCH', body: JSON.stringify({ active: !u.active }) });
      push(u.active ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب');
      loadUsers();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function resetPassword(u: Account) {
    const p = prompt(`كلمة المرور الجديدة للحساب «${u.username}» (8 أحرف على الأقل، حرف ورقم):`);
    if (!p) return;
    const perr = passwordError(p);
    if (perr) { push(perr, true); return; }
    try {
      await api('/users/' + u.id, { method: 'PATCH', body: JSON.stringify({ password: p }) });
      push('تم إعادة تعيين كلمة المرور — ستُبطَل جلساته الحالية');
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function remove(u: Account) {
    if (!confirm(`حذف حساب «${u.username}» نهائياً؟ لا يمكن التراجع.`)) return;
    try {
      await api('/users/' + u.id, { method: 'DELETE' });
      push('تم حذف الحساب');
      loadUsers();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  const pages = audit ? Math.max(1, Math.ceil(audit.total / PAGE)) : 1;
  const pageNo = Math.floor(offset / PAGE) + 1;

  return (
    <div>
      <div className="page-head">
        <h2>الإدارة</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn ghost" to="/settings">
            <Icon name="sliders" size={15} /> الهوية والنصوص والمظهر
          </Link>
          <button className={'btn ' + (tab === 'users' ? '' : 'ghost')} onClick={() => setTab('users')}>
            <Icon name="users" size={15} /> المستخدمون
          </button>
          <button className={'btn ' + (tab === 'audit' ? '' : 'ghost')} onClick={() => setTab('audit')}>
            <Icon name="clipboard" size={15} /> سجل التدقيق
          </button>
        </div>
      </div>

      {tab === 'users' && (
        <>
          <div className="toolbar">
            <div className="fld" style={{ flex: 1 }}>
              <label>إدارة حسابات المعلمات والإدارة</label>
              <div className="muted" style={{ fontSize: 13.5 }}>
                حسابات الطالبات تُنشأ من سجل الطالبة نفسها؛ هنا تُدار حسابات المعلمات والإدارة فقط.
              </div>
            </div>
            <button className="btn" onClick={() => setCreating({ username: '', password: '', role: 'teacher' })}>
              <Icon name="plus" size={15} /> حساب جديد
            </button>
          </div>

          <div className="card">
            {users.length === 0 ? (
              <div className="empty">لا توجد حسابات.</div>
            ) : (
              <table>
                <thead>
                  <tr><th>اسم المستخدم</th><th>الدور</th><th>الربط</th><th>الحالة</th><th>إجراءات</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td><b dir="ltr">{u.username}</b></td>
                      <td><span className="badge">{ROLE_LABEL[u.role] ?? u.role}</span></td>
                      <td className="muted">
                        {u.student_name ? `${u.student_name}${u.student_code ? ' (' + u.student_code + ')' : ''}` : '—'}
                      </td>
                      <td>{u.active ? <span className="badge ok">نشط</span> : <span className="badge warn">موقوف</span>}</td>
                      <td>
                        {me?.id === u.id ? (
                          <span className="muted">حسابك الحالي</span>
                        ) : (
                          <div className="row-actions">
                            <button className="btn ghost sm" onClick={() => toggle(u)}>
                              {u.active ? 'إيقاف' : 'تفعيل'}
                            </button>
                            <button className="btn ghost sm" onClick={() => resetPassword(u)}>إعادة تعيين كلمة المرور</button>
                            <button className="btn danger sm" onClick={() => remove(u)}>حذف</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'audit' && (
        <>
          <div className="toolbar">
            <div className="fld" style={{ flex: 1 }}>
              <label>بحث في السجل (المستخدم / العملية / الكيان)</label>
              <input
                value={term}
                placeholder="مثال: login أو teacher1"
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setOffset(0); setAppliedTerm(term.trim()); } }}
              />
            </div>
            <button className="btn" onClick={() => { setOffset(0); setAppliedTerm(term.trim()); }}>
              بحث
            </button>
            <button className="btn ghost" onClick={() => loadAudit()}>تحديث</button>
          </div>

          <div className="card">
            {!audit || audit.items.length === 0 ? (
              <div className="empty">لا توجد سجلات مطابقة.</div>
            ) : (
              <table>
                <thead>
                  <tr><th>الوقت</th><th>المستخدم</th><th>الدور</th><th>العملية</th><th>الكيان</th><th>التفاصيل</th><th>IP</th></tr>
                </thead>
                <tbody>
                  {audit.items.map((a) => (
                    <tr key={a.id}>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.at)}</td>
                      <td dir="ltr">{a.username ?? '—'}</td>
                      <td>{a.role ? (ROLE_LABEL[a.role] ?? a.role) : '—'}</td>
                      <td>{ACTION_LABEL[a.action] ?? a.action}</td>
                      <td className="muted">
                        {a.entity ? `${a.entity}${a.entity_id ? ' #' + a.entity_id : ''}` : '—'}
                      </td>
                      <td className="muted" title={fmtDetails(a.details)}>
                        <span dir="ltr">{fmtDetails(a.details)}</span>
                      </td>
                      <td className="muted" dir="ltr">{a.ip ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {audit && (
            <div className="toolbar" style={{ justifyContent: 'space-between', marginTop: 12 }}>
              <div className="muted">
                إجمالي السجلات: {audit.total} — الصفحة {pageNo} من {pages}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                  السابق
                </button>
                <button className="btn ghost sm" disabled={offset + PAGE >= audit.total} onClick={() => setOffset(offset + PAGE)}>
                  التالي
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {creating && (
        <Modal title="إنشاء حساب إداري" onClose={() => setCreating(null)}>
          <form onSubmit={createAccount}>
            <div className="form-grid">
              <div className="fld">
                <label>اسم المستخدم</label>
                <input
                  dir="ltr" required value={creating.username}
                  onChange={(e) => setCreating({ ...creating, username: e.target.value })}
                />
              </div>
              <div className="fld">
                <label>الدور</label>
                <select value={creating.role} onChange={(e) => setCreating({ ...creating, role: e.target.value })}>
                  <option value="teacher">معلمة</option>
                  <option value="admin">إدارة</option>
                </select>
              </div>
              <div className="fld full">
                <label>كلمة المرور (8 أحرف على الأقل، حرف ورقم)</label>
                <input
                  type="password" required value={creating.password}
                  onChange={(e) => setCreating({ ...creating, password: e.target.value })}
                />
              </div>
            </div>
            <button className="btn" disabled={busy}>{busy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
