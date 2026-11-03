import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, fileUrl, qs } from '../../api/client';
import type { Student } from '../../api/types';
import Icon from '../../components/Icon';
import { Modal, useToast } from '../../components/ui';

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export default function Tests() {
  const [rows, setRows] = useState<any[]>([]);
  const [kind, setKind] = useState<'test' | 'nafis'>('test');
  const [grades, setGrades] = useState<string[]>(['الرابع', 'الخامس', 'السادس']);
  const [sections, setSections] = useState<string[]>(['أ', 'ب']);
  
  // حالات النوافذ
  const [show, setShow] = useState(false);
  const [rec, setRec] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);

  // حالة النموذج
  const [form, setForm] = useState<any>({ 
    title: '', kind: 'test', test_date: todayStr(), max_score: 10, grade: 'الرابع', section: 'أ', file: null 
  });

  const [pool, setPool] = useState<Student[]>([]);
  const [vals, setVals] = useState<Record<number, { score: string; note: string }>>({});
  const { push } = useToast();

  const load = useCallback(async () => {
    setRows(await api('/tests'));
  }, []);

  useEffect(() => { load().catch((e: any) => push(e.message || 'خطأ', true)); }, [load, push]);

  useEffect(() => {
    api('/settings').then((c) => {
      if (Array.isArray(c.grades) && c.grades.length) setGrades(c.grades);
      if (Array.isArray(c.classes) && c.classes.length) setSections(c.classes);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!rec) { setPool([]); setVals({}); return; }
    api('/students' + qs({ grade: rec.grade, section: rec.section })).then(setPool).catch(() => setPool([]));
    const v: Record<number, { score: string; note: string }> = {};
    if (Array.isArray(rec.results)) {
      for (const r of rec.results) {
        v[Number(r.student_id)] = { score: r.score != null ? String(r.score) : '', note: r.note || '' };
      }
    }
    setVals(v);
  }, [rec]);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('kind', form.kind);
      fd.append('test_date', form.test_date);
      fd.append('max_score', String(form.max_score));
      fd.append('grade', form.grade);
      fd.append('section', form.section);
      if (form.file) {
        fd.append('file', form.file);
      }

      await api('/tests', { method: 'POST', body: fd });
      
      push(form.kind === 'nafis' ? 'أُنشئ اختبار نافس' : 'أُنشئ الاختبار');
      setShow(false);
      setForm({ title: '', kind, test_date: todayStr(), max_score: 10, grade: 'الرابع', section: 'أ', file: null });
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function remove(t: any) {
    if (!confirm('حذف «' + t.title + '» مع نتائجه؟')) return;
    try {
      await api('/tests/' + t.id, { method: 'DELETE' });
      push('حُذف الاختبار');
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function saveResults(e: FormEvent) {
    e.preventDefault();
    const max = Number(rec.max_score);
    const out: any[] = [];
    for (const s of pool) {
      const v = vals[s.id];
      const raw = String(v?.score ?? '').trim();
      // الحقل الفارغ يعني «امسحي الدرجة» وليس تجاهلها
      if (raw === '') { out.push({ student_id: s.id, score: null }); continue; }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > max) {
        push('إحدى الدرجات غير صالحة — يجب أن تكون بين 0 و ' + max, true);
        return;
      }
      out.push({ student_id: s.id, score: n, note: v?.note || undefined });
    }
    try {
      const r = await api('/tests/' + rec.id + '/results', { method: 'PUT', body: JSON.stringify({ rows: out }) });
      push('حُفظت ' + (r?.saved ?? 0) + ' درجة' + (r?.removed ? ' وحُذفت ' + r.removed : ''));
      setRec(null);
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  const list = rows.filter((t) => t.kind === kind);
  const testCount = rows.filter((t) => t.kind === 'test').length;
  const nafisCount = rows.filter((t) => t.kind === 'nafis').length;
  const previewMime = String(preview?.file_mime || '').toLowerCase();
  const previewIsPdf = previewMime === 'application/pdf'
    || /\.pdf$/i.test(String(preview?.file_original_name || preview?.file_name || ''));
  const previewIsImage = previewMime.startsWith('image/');

  return (
    <div>
      <div className="page-head">
        <h2>الاختبارات ونافس</h2>
        <button className="btn" onClick={() => { setForm({ title: '', kind, test_date: todayStr(), max_score: 10, grade: 'الرابع', section: 'أ', file: null }); setShow(true); }}>
          <Icon name="plus" size={15} /> اختبار جديد
        </button>
      </div>

      <div className="seg" style={{ marginBottom: 14 }}>
        <button className={kind === 'test' ? 'on' : ''} onClick={() => setKind('test')}>اختبارات صفية ({testCount})</button>
        <button className={kind === 'nafis' ? 'on' : ''} onClick={() => setKind('nafis')}>نافس ({nafisCount})</button>
      </div>

      <div className="card">
        {list.length === 0 ? <div className="empty">لا عناصر في هذا التصنيف بعد.</div> : (
          <table>
            <thead>
              <tr><th>العنوان</th><th>التاريخ</th><th>الدرجة العظمى</th><th>المرصود</th><th>إجراءات</th></tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const marked = t.results_count != null
                  ? Number(t.results_count)
                  : (Array.isArray(t.results) ? t.results.filter((r: any) => r.score != null).length : null);
                return (
                  <tr key={t.id}>
                    <td>
                      <b>{t.title}</b>
                      {t.file_id ? <div className="muted" style={{ fontSize: 12.5 }}>📎 {t.file_original_name || 'مرفق'}</div> : null}
                    </td>
                    <td className="num">{t.test_date}</td>
                    <td className="num">{t.max_score}</td>
                    <td className="num">{marked != null ? marked + ' طالبة' : '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn ghost sm" onClick={() => setPreview(t)}>معاينة</button>
                        <button className="btn ghost sm" onClick={() => setRec(t)}>رصد النتائج</button>
                        <button className="btn danger sm" onClick={() => remove(t)}>حذف</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* نافذة إنشاء اختبار جديد */}
      {show && (
        <Modal title="اختبار جديد" onClose={() => setShow(false)}>
          <form onSubmit={create}>
            <div className="fld">
              <label>عنوان الاختبار</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            
            <div className="fld">
              <label>ملف الاختبار (اختياري — PDF أو صورة)</label>
              <input type="file" accept="application/pdf,image/*" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] })} />
            </div>

            <div className="fld">
              <label>النوع</label>
              <div className="seg">
                <button type="button" className={form.kind === 'test' ? 'on' : ''} onClick={() => setForm({ ...form, kind: 'test' })}>اختبار صفي</button>
                <button type="button" className={form.kind === 'nafis' ? 'on' : ''} onClick={() => setForm({ ...form, kind: 'nafis' })}>نافس</button>
              </div>
            </div>
            <div className="form-grid">
              <div className="fld">
                <label>التاريخ</label>
                <input type="date" value={form.test_date} onChange={(e) => setForm({ ...form, test_date: e.target.value })} required />
              </div>
              <div className="fld">
                <label>الدرجة العظمى</label>
                <input type="number" min={0.5} step="0.5" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} required />
              </div>
              <div className="fld">
                <label>الصف</label>
                <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                  {grades.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="fld">
                <label>الشعبة</label>
                <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>
                  {sections.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button className="btn">إنشاء</button>
          </form>
        </Modal>
      )}

      {/* نافذة المعاينة */}
      {preview && (
        <Modal title="معاينة الاختبار" onClose={() => setPreview(null)} wide>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <h2 style={{ color: 'var(--pk)', marginBottom: 10 }}>{preview.title}</h2>
            
            <div style={{ display: 'inline-block', textAlign: 'right', background: 'var(--pk3)', padding: '15px 25px', borderRadius: 12, marginBottom: 20 }}>
              <p style={{ margin: '5px 0' }}><b>النوع:</b> {preview.kind === 'nafis' ? 'نافس' : 'اختبار صفي'}</p>
              <p style={{ margin: '5px 0' }}><b>التاريخ:</b> {preview.test_date}</p>
              <p style={{ margin: '5px 0' }}><b>الدرجة العظمى:</b> {preview.max_score}</p>
              <p style={{ margin: '5px 0' }}><b>الصف والشعبة:</b> {preview.grade} / {preview.section}</p>
            </div>

            {/* عرض الملف إذا وجد — عبر /api/files/:id الذي يفحص المصادقة والملكية */}
            {preview.file_id ? (
              <div style={{ width: '100%', height: '60vh', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: '#f4f4f4' }}>
                {previewIsPdf ? (
                  <object
                    data={fileUrl(preview.file_id, true)}
                    type="application/pdf"
                    style={{ width: '100%', height: '100%' }}
                  >
                    <p style={{ padding: 20 }}>
                      متصفحك لا يدعم عرض PDF.{' '}
                      <a href={fileUrl(preview.file_id, true)} target="_blank" rel="noreferrer">اضغطي هنا لفتح الملف</a>
                    </p>
                  </object>
                ) : previewIsImage ? (
                  <img
                    src={fileUrl(preview.file_id, true)}
                    alt={preview.file_original_name || 'معاينة المرفق'}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ padding: 24 }}>
                    <p>لا يمكن معاينة هذا النوع داخل النافذة.</p>
                    <a className="btn ghost sm" href={fileUrl(preview.file_id)}>تنزيل الملف</a>
                  </div>
                )}
              </div>
            ) : (
              <p className="muted">لا يوجد ملف مرفق لهذا الاختبار.</p>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => { setRec(preview); setPreview(null); }}>رصد النتائج الآن</button>
            {preview.file_id && <a href={fileUrl(preview.file_id)} className="btn ghost">تحميل الملف</a>}
            <button className="btn ghost" onClick={() => setPreview(null)}>إغلاق</button>
          </div>
        </Modal>
      )}

      {/* نافذة رصد النتائج */}
      {rec && (
        <Modal title={'رصد النتائج — ' + rec.title} onClose={() => setRec(null)} wide>
          <form onSubmit={saveResults}>
            <p className="muted" style={{ fontSize: 14.5 }}>
              طالبات {rec.grade}/{rec.section} — الدرجة من {Number(rec.max_score)}. اتركيها فارغة لمن لم تُرصد لها درجة.
            </p>
            {pool.length === 0 ? <div className="empty">لا طالبات في هذا الصف/الشعبة.</div> : (
              <table>
                <thead><tr><th>الطالبة</th><th>الدرجة</th><th>ملاحظة</th></tr></thead>
                <tbody>
                  {pool.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>
                        <input
                          type="number" min={0} max={Number(rec.max_score)} step="0.25"
                          style={{ width: 90 }}
                          value={vals[s.id]?.score ?? ''}
                          onChange={(e) => setVals({ ...vals, [s.id]: { score: e.target.value, note: vals[s.id]?.note ?? '' } })}
                        />
                      </td>
                      <td>
                        <input
                          value={vals[s.id]?.note ?? ''}
                          onChange={(e) => setVals({ ...vals, [s.id]: { score: vals[s.id]?.score ?? '', note: e.target.value } })}
                          placeholder="اختياري"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button className="btn" style={{ marginTop: 12 }}>حفظ النتائج</button>
          </form>
        </Modal>
      )}
    </div>
  );
}