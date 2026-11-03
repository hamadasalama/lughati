import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, fileUrl } from '../../api/client';
import type { Student } from '../../api/types';
import Icon from '../../components/Icon';
import { Modal, useToast } from '../../components/ui';

const EMPTY = {
  student_id: '',
  title: '',
  goal: '',
  actions: '',
  from_date: '',
  to_date: '',
  file: null as File | null,
};

function planBody(p: any): string {
  return p?.actions ?? p?.description ?? '';
}

function fmtDate(v: any): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' } as Intl.DateTimeFormatOptions);
}

export default function Plans() {
  const [rows, setRows] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [edit, setEdit] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [fup, setFup] = useState<any | null>(null);
  const [fnote, setFnote] = useState('');
  const { push } = useToast();

  async function load() {
    const [ps, stus] = await Promise.all([api('/plans'), api('/students')]);
    setRows(Array.isArray(ps) ? ps : []);
    setStudents(stus);
  }

  useEffect(() => { load().catch((e: any) => push(e.message || 'خطأ', true)); }, [push]);

  function openCreate() {
    setForm({ ...EMPTY });
    setShow(true);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!form.student_id) { push('اختاري الطالبة', true); return; }
    try {
      const fd = new FormData();
      fd.append('student_id', String(form.student_id));
      fd.append('title', form.title);
      fd.append('goal', form.goal || '');
      fd.append('actions', form.actions || '');
      if (form.from_date) fd.append('from_date', form.from_date);
      if (form.to_date) fd.append('to_date', form.to_date);
      if (form.file) fd.append('file', form.file);

      await api('/plans', { method: 'POST', body: fd });
      push('أُنشئت الخطة العلاجية');
      setShow(false);
      setForm({ ...EMPTY });
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    try {
      const body: any = {
        title: edit.title,
        goal: edit.goal || null,
        actions: edit.actions ?? edit.description ?? null,
      };
      if (edit.from_date) body.from_date = edit.from_date;
      if (edit.to_date) body.to_date = edit.to_date;
      await api('/plans/' + edit.id, { method: 'PATCH', body: JSON.stringify(body) });
      push('حُفظت التعديلات');
      setEdit(null);
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function toggle(p: any) {
    try {
      await api('/plans/' + p.id, {
        method: 'PATCH',
        body: JSON.stringify({ status: p.status === 'done' ? 'active' : 'done' }),
      });
      push(p.status === 'done' ? 'أُعيد تنشيط الخطة' : 'عُلّمت الخطة مكتملة');
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function addFup() {
    try {
      await api('/plans/' + fup.id + '/followups', { method: 'POST', body: JSON.stringify({ note: fnote.trim() }) });
      push('أُضيفت المتابعة');
      setFnote('');
      const fresh: any[] = await api('/plans');
      setRows(fresh);
      setFup(fresh.find((x) => x.id === fup.id) || null);
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function remove(p: any) {
    if (!confirm('حذف «' + p.title + '» مع متابعاتها ومرفقها؟')) return;
    try {
      await api('/plans/' + p.id, { method: 'DELETE' });
      push('حُذفت الخطة');
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  const sname = (p: any) => p.student_name ?? p.name ?? ('#' + p.student_id);
  const previewMime = String(preview?.file_mime || '').toLowerCase();
  const previewIsPdf = previewMime === 'application/pdf'
    || /\.pdf$/i.test(String(preview?.file_original_name || ''));
  const previewIsImage = previewMime.startsWith('image/');

  return (
    <div>
      <div className="page-head">
        <h2>الخطط العلاجية</h2>
        <button className="btn" onClick={openCreate}>
          <Icon name="plus" size={15} /> خطة جديدة
        </button>
      </div>

      <div className="card">
        {rows.length === 0 ? <div className="empty">لا خطط علاجية بعد.</div> : (
          <table>
            <thead>
              <tr><th>الطالبة</th><th>الخطة</th><th>المدة</th><th>المرفق</th><th>الحالة</th><th>المتابعات</th><th>إجراءات</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const body = planBody(p);
                return (
                  <tr key={p.id}>
                    <td>{sname(p)}</td>
                    <td>
                      <b>{p.title}</b>
                      {p.goal ? <div className="muted" style={{ fontSize: 13.5 }}>الهدف: {p.goal}</div> : null}
                      {body ? <div className="muted" style={{ fontSize: 14 }}>{body}</div> : null}
                    </td>
                    <td className="num" style={{ fontSize: 13.5 }}>
                      {p.from_date || '—'} ← {p.to_date || '—'}
                    </td>
                    <td>
                      {p.file_id
                        ? <button className="btn ghost sm" onClick={() => setPreview(p)}>📎 معاينة</button>
                        : '—'}
                    </td>
                    <td><span className={'badge ' + (p.status === 'done' ? 'ok' : 'warn')}>{p.status === 'done' ? 'مكتملة' : 'نشطة'}</span></td>
                    <td className="num">{Array.isArray(p.followups) ? p.followups.length : '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn ghost sm" onClick={() => { setFnote(''); setFup(p); }}>متابعات</button>
                        <button className="btn ghost sm" onClick={() => setEdit({ ...p, actions: planBody(p) })}>تعديل</button>
                        <button className="btn ghost sm" onClick={() => toggle(p)}>{p.status === 'done' ? 'إعادة تنشيط' : 'إكمال'}</button>
                        <button className="btn danger sm" onClick={() => remove(p)}>حذف</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {show && (
        <Modal title="خطة علاجية جديدة" onClose={() => setShow(false)} wide>
          <form onSubmit={create}>
            <div className="form-grid">
              <div className="fld">
                <label>الطالبة</label>
                <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required>
                  <option value="">اختاري…</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.grade}/{s.section}</option>)}
                </select>
              </div>
              <div className="fld">
                <label>عنوان الخطة</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="مثال: خطة تحسين الطلاقة القرائية" />
              </div>
              <div className="fld full">
                <label>هدف الخطة (اختياري)</label>
                <input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="ما نريد تحقيقه بنهاية الخطة" />
              </div>
              <div className="fld full">
                <label>الوصف / الإجراءات</label>
                <textarea value={form.actions} onChange={(e) => setForm({ ...form, actions: e.target.value })} placeholder="الخطوات والأنشطة العلاجية…" />
              </div>
              <div className="fld">
                <label>من تاريخ (اختياري)</label>
                <input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} />
              </div>
              <div className="fld">
                <label>إلى تاريخ (اختياري)</label>
                <input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} />
              </div>
              <div className="fld full">
                <label>مرفق الخطة (اختياري — PDF أو صورة)</label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
                />
                {form.file ? <div className="muted" style={{ fontSize: 13 }}>{form.file.name}</div> : null}
              </div>
            </div>
            <button className="btn">إنشاء الخطة</button>
          </form>
        </Modal>
      )}

      {edit && (
        <Modal title="تعديل الخطة" onClose={() => setEdit(null)} wide>
          <form onSubmit={saveEdit}>
            <div className="fld">
              <label>العنوان</label>
              <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required />
            </div>
            <div className="fld">
              <label>هدف الخطة (اختياري)</label>
              <input value={edit.goal || ''} onChange={(e) => setEdit({ ...edit, goal: e.target.value })} />
            </div>
            <div className="fld">
              <label>الوصف / الإجراءات</label>
              <textarea value={edit.actions ?? edit.description ?? ''} onChange={(e) => setEdit({ ...edit, actions: e.target.value })} />
            </div>
            <div className="form-grid">
              <div className="fld">
                <label>من تاريخ</label>
                <input type="date" value={edit.from_date || ''} onChange={(e) => setEdit({ ...edit, from_date: e.target.value })} />
              </div>
              <div className="fld">
                <label>إلى تاريخ</label>
                <input type="date" value={edit.to_date || ''} onChange={(e) => setEdit({ ...edit, to_date: e.target.value })} />
              </div>
            </div>
            <button className="btn">حفظ</button>
          </form>
        </Modal>
      )}

      {preview && (
        <Modal title={'معاينة مرفق الخطة — ' + preview.title} onClose={() => setPreview(null)} wide>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ display: 'inline-block', textAlign: 'right', background: 'var(--pk3)', padding: '12px 22px', borderRadius: 12, marginBottom: 16 }}>
              <p style={{ margin: '4px 0' }}><b>الطالبة:</b> {sname(preview)}</p>
              <p style={{ margin: '4px 0' }}><b>الملف:</b> {preview.file_original_name || 'مرفق'}</p>
              <p style={{ margin: '4px 0' }}><b>المدة:</b> {preview.from_date || '—'} ← {preview.to_date || '—'}</p>
            </div>
            {previewIsPdf ? (
              <object
                data={fileUrl(preview.file_id, true)}
                type="application/pdf"
                style={{ width: '100%', height: '60vh', border: '1px solid var(--line)', borderRadius: 8, background: '#f4f4f4' }}
              >
                <p style={{ padding: 20 }}>
                  متصفحك لا يدعم عرض PDF.{' '}
                  <a href={fileUrl(preview.file_id, true)} target="_blank" rel="noreferrer">اضغطي هنا لفتح الملف</a>
                </p>
              </object>
            ) : previewIsImage ? (
              <img
                src={fileUrl(preview.file_id, true)}
                alt={preview.file_original_name || 'مرفق الخطة'}
                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', border: '1px solid var(--line)', borderRadius: 8, background: '#f4f4f4' }}
              />
            ) : (
              <p className="muted">لا يمكن معاينة هذا النوع داخل النافذة.</p>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <a href={fileUrl(preview.file_id)} className="btn ghost">تحميل الملف</a>
            <button className="btn ghost" onClick={() => setPreview(null)}>إغلاق</button>
          </div>
        </Modal>
      )}

      {fup && (
        <Modal title={'متابعات — ' + fup.title} onClose={() => setFup(null)}>
          {Array.isArray(fup.followups) && fup.followups.length ? (
            fup.followups.map((f: any) => (
              <div key={f.id} style={{ marginBottom: 10 }}>
                {f.note}
                <div className="muted" style={{ fontSize: 12.5 }}>{fmtDate(f.created_at || f.follow_date)}</div>
              </div>
            ))
          ) : <p className="muted">لا متابعات بعد.</p>}
          <div className="fld" style={{ marginTop: 10 }}>
            <label>متابعة جديدة</label>
            <textarea value={fnote} onChange={(e) => setFnote(e.target.value)} placeholder="ما تحقق بعد تنفيذ الخطة…" />
          </div>
          <button className="btn" disabled={!fnote.trim()} onClick={addFup}>إضافة المتابعة</button>
        </Modal>
      )}
    </div>
  );
}
