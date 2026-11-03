import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, qs } from '../../api/client';
import type { Student } from '../../api/types';
import Icon from '../../components/Icon';
import { Modal, useToast } from '../../components/ui';

const EMPTY = { name: '', grade: 'الرابع', section: 'أ', code: '', notes: '' };

export default function Students() {
  const [rows, setRows] = useState<Student[]>([]);
  const [grades, setGrades] = useState<string[]>(['الرابع', 'الخامس', 'السادس']);
  const [sections, setSections] = useState<string[]>(['أ', 'ب']);
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importMode, setImportMode] = useState<'file' | 'text'>('file');
  const [importText, setImportText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const { push } = useToast();

  const load = useCallback(async () => {
    setRows(await api('/students' + qs({ grade, section, q })));
  }, [grade, section, q]);

  useEffect(() => { load().catch((e: any) => push(e.message || 'خطأ', true)); }, [load, push]);

  useEffect(() => {
    api('/settings').then((cfg) => {
      if (Array.isArray(cfg.grades) && cfg.grades.length) setGrades(cfg.grades);
      if (Array.isArray(cfg.classes) && cfg.classes.length) setSections(cfg.classes);
    }).catch(() => {});
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const payload: any = { name: edit.name, grade: edit.grade, section: edit.section, notes: edit.notes };
    if (isNew && edit.code) payload.code = edit.code;
    try {
      if (isNew) {
        await api('/students', { method: 'POST', body: JSON.stringify(payload) });
        push('تمت إضافة الطالبة');
      } else {
        await api('/students/' + edit.id, { method: 'PATCH', body: JSON.stringify(payload) });
        push('تم حفظ التعديلات');
      }
      setEdit(null);
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  async function remove(s: Student) {
    if (!confirm('سيُحذف مع كل سجلاتها (تقييمات، اختبارات، رسائل…). هل أنت متأكدة؟')) return;
    try {
      await api('/students/' + s.id, { method: 'DELETE' });
      push('تم حذف ' + s.name);
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  function openImport() {
    setImportMode('file');
    setImportFile(null);
    setImportResult(null);
    setImportText('');
    setShowImport(true);
  }

  function downloadTemplate() {
    const csv = '\uFEFF' + [
      'الرمز,الاسم,الصف,الشعبة,اسم المستخدم,كلمة المرور,ملاحظات',
      'ST-101,نورة العتيبي,الرابع,أ,st101,Nooora123,',
      'ST-102,ريم الشمري,الخامس,ب,reem_sh,Reem2026,طالبة جديدة',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'قالب-استيراد-الطالبات.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importSummary(res: any) {
    const parts = [`أُضيفت ${res.added}`, `حُدِّثت ${res.updated}`];
    if (res.accountsCreated) parts.push(`حسابات جديدة ${res.accountsCreated}`);
    if (res.accountsUpdated) parts.push(`حسابات محدّثة ${res.accountsUpdated}`);
    if (res.invalid) parts.push(`صفوف مرفوضة ${res.invalid}`);
    return parts.join(' · ');
  }

  async function doImportFile() {
    if (!importFile) { push('اختاري ملف Excel أو CSV أولاً', true); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await api('/students/import-file', { method: 'POST', body: fd });
      setImportResult(res);
      if (res.added || res.updated) {
        push(importSummary(res));
        load();
      } else {
        push('لم يُستورد أي صف — راجعي تفاصيل الأخطاء', true);
      }
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    } finally {
      setImporting(false);
    }
  }

  async function doImport() {
    const lines = importText.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    const rowsIn = lines
      .map((l) => {
        const parts = l.split(/[,;\t،]/).map((p) => p.trim());
        return { name: parts[0] || '', grade: parts[1] || 'الرابع', section: parts[2] || 'أ' };
      })
      .filter((r) => r.name);
    if (!rowsIn.length) { push('لا توجد أسماء صالحة للاستيراد', true); return; }
    setImporting(true);
    try {
      const res = await api('/students/import', { method: 'POST', body: JSON.stringify({ rows: rowsIn }) });
      setImportResult(res);
      push(importSummary(res));
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2>الطالبات</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={openImport}>
            <Icon name="folder" size={15} /> استيراد الطالبات
          </button>
          <button className="btn" onClick={() => { setEdit({ ...EMPTY }); setIsNew(true); }}>
            <Icon name="plus" size={15} /> طالبة جديدة
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="fld">
          <label>الصف</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">كل الصفوف</option>
            {grades.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="fld">
          <label>الشعبة</label>
          <select value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="">كل الشعب</option>
            {sections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="fld" style={{ flex: 1 }}>
          <label>بحث بالاسم أو الرمز</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اكتبي جزءاً من الاسم…" />
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">لا توجد طالبات مطابقات — أضيفي أول طالبة أو استخدمي الاستيراد السريع.</div>
        ) : (
          <table>
            <thead>
              <tr><th>الرمز</th><th>الاسم</th><th>الصف</th><th>الشعبة</th><th>إجراءات</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="num">{s.code}</td>
                  <td>
                    <Link to={'/students/' + s.id}>{s.name}</Link>
                    {!s.active && <> <span className="badge warn">موقوفة</span></>}
                  </td>
                  <td>{s.grade}</td>
                  <td>{s.section}</td>
                  <td>
                    <div className="row-actions">
                      <Link className="btn ghost sm" to={'/students/' + s.id}>السجل</Link>
                      <button
                        className="btn ghost sm"
                        onClick={() => {
                          setEdit({ id: s.id, name: s.name, grade: s.grade, section: s.section, notes: s.notes || '' });
                          setIsNew(false);
                        }}
                      >
                        تعديل
                      </button>
                      <button className="btn danger sm" onClick={() => remove(s)}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <Modal title={isNew ? 'إضافة طالبة' : 'تعديل بيانات طالبة'} onClose={() => setEdit(null)}>
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="fld full">
                <label>اسم الطالبة</label>
                <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
              </div>
              <div className="fld">
                <label>الصف</label>
                <select value={edit.grade} onChange={(e) => setEdit({ ...edit, grade: e.target.value })}>
                  {grades.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="fld">
                <label>الشعبة</label>
                <select value={edit.section} onChange={(e) => setEdit({ ...edit, section: e.target.value })}>
                  {sections.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              {isNew && (
                <div className="fld">
                  <label>الرمز (اختياري — يُولَّد تلقائياً)</label>
                  <input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} placeholder="ST-001" />
                </div>
              )}
              <div className="fld full">
                <label>ملاحظات</label>
                <textarea value={edit.notes || ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
              </div>
            </div>
            <button className="btn">حفظ</button>
          </form>
        </Modal>
      )}

      {showImport && (
        <Modal title="استيراد الطالبات من ملف" onClose={() => setShowImport(false)} wide>
          <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button
              type="button"
              className={'btn sm ' + (importMode === 'file' ? '' : 'ghost')}
              onClick={() => { setImportMode('file'); setImportResult(null); }}
            >
              <Icon name="exam" size={14} /> ملف Excel / CSV
            </button>
            <button
              type="button"
              className={'btn sm ' + (importMode === 'text' ? '' : 'ghost')}
              onClick={() => { setImportMode('text'); setImportResult(null); }}
            >
              <Icon name="clipboard" size={14} /> لصق أسماء
            </button>
          </div>

          {importMode === 'file' ? (
            <div>
              <p className="muted" style={{ fontSize: 15, marginTop: 0 }}>
                الأعمدة المدعومة: <b>الرمز</b>، <b>الاسم</b>، <b>الصف</b>، <b>الشعبة</b>،
                {' '}<b>اسم المستخدم</b>، <b>كلمة المرور</b>، <b>ملاحظات</b>.
                الرمز واسم المستخدم وكلمة المرور اختياريان، لكن إنشاء حساب جديد يتطلب كلمة مرور
                (8 أحرف على الأقل وتحتوي حرفاً ورقماً). إن غاب اسم المستخدم فسيُستخدم الرمز.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                <button type="button" className="btn ghost sm" onClick={downloadTemplate}>
                  <Icon name="download" size={14} /> تنزيل قالب CSV
                </button>
                <span className="muted" style={{ fontSize: 13 }}>
                  الصيغ المقبولة: .xlsx أو .csv (حتى 10MB و1000 صف)
                </span>
              </div>
              <div className="fld">
                <label>ملف الطالبات</label>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }}
                />
              </div>
              {importFile && (
                <p className="muted" style={{ fontSize: 14 }}>
                  الملف المختار: <b>{importFile.name}</b> ({Math.ceil(importFile.size / 1024)} KB)
                </p>
              )}
              <button className="btn" onClick={doImportFile} disabled={importing || !importFile}>
                {importing ? 'جارٍ الاستيراد…' : 'استيراد الملف'}
              </button>
            </div>
          ) : (
            <div>
              <p className="muted" style={{ fontSize: 15 }}>
                كل سطر: <b>الاسم، الصف، الشعبة</b> — الصف والشعبة اختياريان (الافتراضي: الرابع / أ).
                مثال: <code>نورة العتيبي، الخامس، ب</code>
              </p>
              <textarea
                style={{ minHeight: 150 }}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={'سارة القحطاني\nريم الشمري، الخامس، ب'}
              />
              <button className="btn" onClick={doImport} disabled={importing}>
                {importing ? 'جارٍ الاستيراد…' : 'استيراد الأسماء'}
              </button>
            </div>
          )}

          {importResult && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>نتيجة الاستيراد</h3>
              {importResult.file && (
                <p className="muted" style={{ fontSize: 14 }}>
                  الملف: <b>{importResult.file.name}</b>
                  {importResult.file.sheet ? ' — الورقة: ' + importResult.file.sheet : ''}
                  {' — '}الصفوف المقروءة: {importResult.file.rows}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span className="badge ok">أُضيفت {importResult.added}</span>
                <span className="badge ok">حُدِّثت {importResult.updated}</span>
                {!!importResult.accountsCreated && <span className="badge ok">حسابات جديدة {importResult.accountsCreated}</span>}
                {!!importResult.accountsUpdated && <span className="badge ok">حسابات محدّثة {importResult.accountsUpdated}</span>}
                {!!importResult.invalid && <span className="badge bad">مرفوضة {importResult.invalid}</span>}
              </div>
              {importResult.truncated && (
                <p className="muted" style={{ color: 'var(--warn, #a16207)', fontSize: 14 }}>
                  الملف أكبر من الحد — استُوردت أول 1000 صف فقط.
                </p>
              )}
              {Array.isArray(importResult.errors) && importResult.errors.length > 0 && (
                <div>
                  <p className="muted" style={{ fontSize: 14 }}>تفاصيل الصفوف التي تحتاج مراجعة:</p>
                  <ul style={{ maxHeight: 220, overflow: 'auto', fontSize: 14, paddingInlineStart: 20 }}>
                    {importResult.errors.map((e: any, i: number) => (
                      <li key={i}>الصف {e.row}: {e.message}</li>
                    ))}
                  </ul>
                  {importResult.errorsTruncated && <p className="muted">… وهناك أخطاء أخرى غير معروضة.</p>}
                </div>
              )}
              <button className="btn ghost sm" onClick={() => { setShowImport(false); load(); }}>
                إغلاق وتحديث القائمة
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
