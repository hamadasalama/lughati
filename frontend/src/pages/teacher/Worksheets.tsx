import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, fileUrl, qs } from '../../api/client';
import type { Student } from '../../api/types';
import Icon from '../../components/Icon';
import { Modal, useToast } from '../../components/ui';

const EMPTY = { title: '', description: '', grade: 'الرابع', section: 'أ', due_date: '', ids: [] as number[] };

export default function Worksheets() {
  const [rows, setRows] = useState<any[]>([]);
  const [grades, setGrades] = useState<string[]>(['الرابع', 'الخامس', 'السادس']);
  const [sections, setSections] = useState<string[]>(['أ', 'ب']);
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [file, setFile] = useState<File | undefined>(undefined);
  const [track, setTrack] = useState<any | null>(null);
  const [tmap, setTmap] = useState<Record<number, boolean>>({});
  const [pool, setPool] = useState<Student[]>([]);
  const { push } = useToast();

  const load = useCallback(async () => {
    setRows(await api('/worksheets' + qs({ grade, section })));
  }, [grade, section]);

  useEffect(() => { load().catch((e: any) => push(e.message || 'خطأ', true)); }, [load, push]);

  useEffect(() => {
    api('/settings').then((c) => {
      if (Array.isArray(c.grades) && c.grades.length) setGrades(c.grades);
      if (Array.isArray(c.classes) && c.classes.length) setSections(c.classes);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!show) return;
    api('/students' + qs({ grade: form.grade, section: form.section })).then(setPool).catch(() => setPool([]));
  }, [show, form.grade, form.section]);

  useEffect(() => {
    if (!track) { setPool([]); setTmap({}); return; }
    api('/students' + qs({ grade: track.grade, section: track.section })).then(setPool).catch(() => setPool([]));
    const m: Record<number, boolean> = {};
    if (Array.isArray(track.targets)) {
      for (const t of track.targets) m[Number(t.student_id)] = !!t.done;
    }
    setTmap(m);
  }, [track]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('description', form.description || '');
    fd.append('grade', form.grade);
    fd.append('section', form.section);
    if (form.due_date) fd.append('due_date', form.due_date);
    fd.append('ids', JSON.stringify(form.ids));
    if (file) fd.append('file', file);
    try {
      await api('/worksheets', { method: 'POST', body: fd });
      push(form.ids.length ? 'أُنشئت الورقة وأُسندت للطالبات المحددات' : 'أُنشئت الورقة لكل طالبات الصف والشعبة');
      setShow(false);
      setForm({ ...EMPTY });
      setFile(undefined);
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function remove(w: any) {
    if (!confirm('حذف «' + w.title + '» مع مرفقاتها وإسناداتها؟')) return;
    try {
      await api('/worksheets/' + w.id, { method: 'DELETE' });
      push('حُذفت الورقة');
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function mark(sid: number, done: boolean) {
    try {
      await api('/worksheets/' + track.id + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ student_id: sid, done }),
      });
      setTmap({ ...tmap, [sid]: done });
      push(done ? 'عُلّمت كمنجَزة' : 'أُلغيت التعليم');
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  function tstate(sid: number): 'done' | 'not' | 'unknown' {
    if (tmap[sid] === undefined) return 'unknown';
    return tmap[sid] ? 'done' : 'not';
  }

  return (
    <div>
      <div className="page-head">
        <h2>أوراق العمل</h2>
        <button className="btn" onClick={() => { setForm({ ...EMPTY }); setFile(undefined); setShow(true); }}>
          <Icon name="plus" size={15} /> ورقة جديدة
        </button>
      </div>

      <div className="toolbar">
        <div className="fld">
          <label>الصف</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">كل الصفوف</option>
            {grades.map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div className="fld">
          <label>الشعبة</label>
          <select value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="">كل الشعب</option>
            {sections.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? <div className="empty">لا أوراق عمل بعد.</div> : (
          <table>
            <thead>
              <tr><th>العنوان</th><th>الصف / الشعبة</th><th>آخر تسليم</th><th>المرفق</th><th>إجراءات</th></tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td>
                    <b>{w.title}</b>
                    {w.description ? <div className="muted" style={{ fontSize: 14 }}>{w.description}</div> : null}
                  </td>
                  <td>{w.grade} / {w.section}</td>
                  <td className="num">{w.due_date || '—'}</td>
                  <td>
                    {w.file_id
                      ? <a className="btn ghost sm" href={fileUrl(w.file_id, true)} target="_blank" rel="noreferrer"><Icon name="download" size={14} /> فتح</a>
                      : '—'}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn ghost sm" onClick={() => setTrack(w)}>رصد الإنجاز</button>
                      <button className="btn danger sm" onClick={() => remove(w)}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {show && (
        <Modal title="ورقة عمل جديدة" onClose={() => setShow(false)} wide>
          <form onSubmit={create}>
            <div className="form-grid">
              <div className="fld full">
                <label>عنوان الورقة</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="fld full">
                <label>وصف / تعليمات</label>
                <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="fld">
                <label>الصف</label>
                <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value, ids: [] })}>
                  {grades.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="fld">
                <label>الشعبة</label>
                <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value, ids: [] })}>
                  {sections.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="fld">
                <label>آخر موعد للتسليم (اختياري)</label>
                <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="fld">
                <label>مرفق (اختياري — حتى 6MB)</label>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0])} />
              </div>
            </div>
            {pool.length > 0 && (
              <div className="fld">
                <label>إسناد لطالبات محددات (اتركيها فارغة لتشمل كل طالبات {form.grade}/{form.section})</label>
                <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {pool.map((s) => (
                    <label key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 15, background: form.ids.includes(s.id) ? 'var(--pk3)' : 'transparent', borderRadius: 8, padding: '2px 8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.ids.includes(s.id)}
                        onChange={(e) => setForm({
                          ...form,
                          ids: e.target.checked ? [...form.ids, s.id] : form.ids.filter((x: number) => x !== s.id),
                        })}
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <button className="btn">إنشاء الورقة</button>
          </form>
        </Modal>
      )}

      {track && (
        <Modal title={'رصد الإنجاز — ' + track.title} onClose={() => setTrack(null)} wide>
          {pool.length === 0 ? <div className="empty">لا طالبات في هذا الصف/الشعبة.</div> : (
            <table>
              <thead><tr><th>الطالبة</th><th>الحالة</th><th>تعليم</th></tr></thead>
              <tbody>
                {pool.map((s) => {
                  const st = tstate(s.id);
                  return (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>
                        {st === 'done' ? <span className="badge ok">أُنجزت</span>
                          : st === 'not' ? <span className="badge">لم تُنجز</span>
                          : <span className="badge warn">غير مسجّل</span>}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="btn ghost sm" disabled={st === 'done'} onClick={() => mark(s.id, true)}>أُنجزت</button>
                          <button className="btn ghost sm" disabled={st === 'not'} onClick={() => mark(s.id, false)}>إلغاء</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="muted" style={{ fontSize: 14 }}>
            إن كانت الورقة عامة (بلا إسنادات محددة) فتُسجَّل حالة كل طالبة عند أول تعليم لها.
          </p>
        </Modal>
      )}
    </div>
  );
}
