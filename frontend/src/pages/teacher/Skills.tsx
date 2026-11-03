import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import type { Student } from '../../api/types';
import Icon from '../../components/Icon';
import { useToast } from '../../components/ui';

export default function Skills() {
  const [rows, setRows] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [vals, setVals] = useState<Record<number, number | null>>({});
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const { push } = useToast();

  async function load() {
    const [sk, stus] = await Promise.all([api('/skills'), api('/students')]);
    const list = Array.isArray(sk) ? sk : [];
    setRows(list);
    setStudents(stus);
    if (list.length && sel == null) setSel(list[0].id);
  }

  useEffect(() => { load().catch((e: any) => push(e.message || 'خطأ', true)); }, [push]);

  useEffect(() => {
    if (sel == null) { setVals({}); setDirty(new Set()); return; }
    const sk = rows.find((r) => r.id === sel);
    const v: Record<number, number | null> = {};
    if (sk && Array.isArray(sk.levels)) {
      for (const l of sk.levels) v[Number(l.student_id)] = Number(l.level);
    }
    setVals(v);
    setDirty(new Set());
  }, [sel, rows]);

  async function addSkill(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api('/skills', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
      push('أُضيفت المهارة');
      setName('');
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  function setLevel(sid: number, lv: number) {
    setVals({ ...vals, [sid]: lv });
    setDirty(new Set(dirty).add(sid));
  }

  async function saveLevels() {
    if (sel == null) return;
    const levels = [...dirty]
      .map((sid) => ({ student_id: sid, level: vals[sid] }))
      .filter((r) => r.level != null);
    if (!levels.length) { push('لا تغييرات لحفظها', true); return; }
    try {
      await api('/skills/' + sel + '/levels', { method: 'PUT', body: JSON.stringify({ levels, rows: levels }) });
      push('حُفظت المستويات');
      setDirty(new Set());
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'خطأ غير متوقع', true);
    }
  }

  return (
    <div>
      <div className="page-head"><h2>المهارات بإتقان</h2></div>

      <form className="card" onSubmit={addSkill} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="fld" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
          <label>مهارة جديدة (مثال: الطلاقة القرائية، خط النسخ)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المهارة" />
        </div>
        <button className="btn" disabled={!name.trim()}><Icon name="plus" size={15} /> إضافة مهارة</button>
      </form>

      <div className="card">
        <div className="fld">
          <label>المهارة</label>
          <select value={sel ?? ''} onChange={(e) => setSel(Number(e.target.value))}>
            {rows.length === 0 && <option value="">لا مهارات بعد</option>}
            {rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        {sel != null && (
          <>
            <p className="muted" style={{ fontSize: 14.5 }}>
              انقري الدرجة (1–5) لكل طالبة ثم احفظي. الطالبات بلا مستوى تظهر لهن «—» في بواباتهن.
            </p>
            <table>
              <thead>
                <tr>
                  <th>الطالبة</th>
                  {[5, 4, 3, 2, 1].map((n) => <th key={n} style={{ textAlign: 'center' }}>{n}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.filter((s) => s.active).map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <td key={n} style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className={'sc' + (vals[s.id] === n ? ' on' : '')}
                          onClick={() => setLevel(s.id, n)}
                        >{n}</button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn" style={{ marginTop: 12 }} onClick={saveLevels} disabled={dirty.size === 0}>
              حفظ المستويات{dirty.size ? ' (' + dirty.size + ')' : ''}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
