import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, fileUrl } from '../../api/client';
import type { Student } from '../../api/types';
import Icon from '../../components/Icon';
import { Modal, useToast } from '../../components/ui';

const CATS = ['فعالية', 'مسرحلة', 'مسابقة', 'مشروع', 'قراءات', 'إنجاز طالبات', 'أخرى'];

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function fid(f: any): number | null {
  if (f == null) return null;
  return typeof f === 'number' ? f : (f.file_id ?? f.id ?? null);
}

export default function Ach() {
  const [rows, setRows] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [star, setStar] = useState<any>(null);
  const [sform, setSform] = useState<any>({ week_date: todayStr(), student_id: '', reason: '' });
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ title: '', description: '', category: 'فعالية', visible: true });
  const [files, setFiles] = useState<FileList | null>(null);
  const { push } = useToast();

  const load = useCallback(async () => {
    const [ach, stus, cur] = await Promise.all([
      api('/achievements'),
      api('/students'),
      api('/star/current').catch(() => null),
    ]);
    setRows(Array.isArray(ach) ? ach : []);
    setStudents(stus);
    setStar(cur);
  }, []);

  useEffect(() => { load().catch((e: any) => push(e.message || 'خطأ', true)); }, [load, push]);

  async function pickStar(e: FormEvent) {
    e.preventDefault();
    if (!sform.student_id) { push('اختاري الطالبة أولاً', true); return; }
    try {
      await api('/star', {
        method: 'PUT',
        body: JSON.stringify({
          week_date: sform.week_date,
          date: sform.week_date,
          student_id: Number(sform.student_id),
          reason: sform.reason || undefined,
        }),
      });
      push('اختيرت أميرة الأسبوع — تظهر في بوابة الطالبات');
      setSform({ ...sform, reason: '' });
      setStar(await api('/star/current'));
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('description', form.description || '');
    fd.append('category', form.category);
    fd.append('visible', form.visible ? 'true' : 'false');
    if (files) Array.from(files).forEach((f) => fd.append('files', f));
    try {
      await api('/achievements', { method: 'POST', body: fd });
      push('أُضيف الإنجاز');
      setShow(false);
      setForm({ title: '', description: '', category: 'فعالية', visible: true });
      setFiles(null);
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function toggle(a: any) {
    try {
      await api('/achievements/' + a.id, { method: 'PATCH', body: JSON.stringify({ visible: !a.visible }) });
      push(a.visible ? 'أُخفي عن الطالبات' : 'أُظهر للطالبات');
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function remove(a: any) {
    if (!confirm('حذف «' + a.title + '» مع صوره ومرفقاته؟')) return;
    try {
      await api('/achievements/' + a.id, { method: 'DELETE' });
      push('حُذف الإنجاز');
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  return (
    <div>
      <div className="page-head"><h2>إنجازات المادة</h2></div>

      <div className="card">
        <h3>👑 أميرتي هذا الأسبوع</h3>
        {star ? (
          <p>
            الحالية: <b>{star.student_name ?? ('#' + star.student_id)}</b> — {star.week_label}
            {star.reason ? ' — ' + star.reason : ''}
          </p>
        ) : <p className="muted">لم يُخترَ أحد بعد لهذا الأسبوع.</p>}
        <form onSubmit={pickStar} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="fld" style={{ marginBottom: 0 }}>
            <label>يوم من الأسبوع (الأسبوع يبدأ الأحد)</label>
            <input type="date" value={sform.week_date} onChange={(e) => setSform({ ...sform, week_date: e.target.value })} required />
          </div>
          <div className="fld" style={{ marginBottom: 0 }}>
            <label>الطالبة</label>
            <select value={sform.student_id} onChange={(e) => setSform({ ...sform, student_id: e.target.value })}>
              <option value="">اختاري…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.grade}/{s.section}</option>)}
            </select>
          </div>
          <div className="fld" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <label>السبب (اختياري)</label>
            <input value={sform.reason} onChange={(e) => setSform({ ...sform, reason: e.target.value })} placeholder="مثال: تفوقها في القراءة والمشاركة" />
          </div>
          <button className="btn">اختيار</button>
        </form>
      </div>

      <div className="page-head" style={{ marginTop: 6 }}>
        <h2 style={{ fontSize: 21 }}>سجل الإنجازات</h2>
        <button className="btn" onClick={() => { setForm({ title: '', description: '', category: 'فعالية', visible: true }); setFiles(null); setShow(true); }}>
          <Icon name="plus" size={15} /> إنجاز جديد
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card"><div className="empty">لا إنجازات مسجّلة بعد.</div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 12 }}>
          {rows.map((a) => (
            <div className="card" key={a.id} style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <b>{a.title}</b>
                <span className="badge">{a.category || 'أخرى'}</span>
              </div>
              {a.description && <div className="muted" style={{ fontSize: 14.5 }}>{a.description}</div>}
              {Array.isArray(a.files) && a.files.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                  {a.files.map((f: any, i: number) => {
                    const id = fid(f);
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
              <div className="row-actions" style={{ marginTop: 8, alignItems: 'center' }}>
                <button className="btn ghost sm" onClick={() => toggle(a)}>{a.visible ? 'إخفاء عن الطالبات' : 'إظهار للطالبات'}</button>
                {!a.visible && <span className="badge warn">مخفي</span>}
                <button className="btn danger sm" onClick={() => remove(a)}>حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {show && (
        <Modal title="إنجاز جديد" onClose={() => setShow(false)}>
          <form onSubmit={create}>
            <div className="fld">
              <label>العنوان</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="fld">
              <label>الوصف</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="fld">
              <label>التصنيف</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fld">
              <label>صور / مرفقات (حتى 10 ملفات)</label>
              <input type="file" multiple onChange={(e) => setFiles(e.target.files)} />
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, marginBottom: 12 }}>
              <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} />
              مرئي للطالبات فوراً
            </label>
            <button className="btn">إضافة الإنجاز</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
