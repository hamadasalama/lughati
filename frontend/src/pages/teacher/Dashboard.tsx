import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { Star, Student } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useBranding } from '../../branding/BrandingContext';
import Icon from '../../components/Icon';
import { useToast } from '../../components/ui';

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function studentAvg(r: any): number | null {
  const vals = [r.behavior, r.participation, r.homework].map((v) => (v == null ? null : num(v)));
  const ok = vals.filter((v): v is number => v != null);
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'مساء الخير';
  return 'مساء الخير';
}

function todayLabel(): string {
  try {
    return new Date().toLocaleDateString('ar', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function Dashboard() {
  const { me } = useAuth();
  const { branding } = useBranding();
  const { push } = useToast();
  const [summary, setSummary] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [star, setStar] = useState<Star | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setErr('');
    Promise.all([
      api('/reports/summary').catch(() => []),
      api('/students').catch(() => []),
      api('/tests').catch(() => []),
      api('/star/current').catch(() => null),
    ])
      .then(([sum, stus, tst, st]) => {
        if (!alive) return;
        setSummary(Array.isArray(sum) ? sum : Array.isArray(sum?.rows) ? sum.rows : []);
        setStudents(Array.isArray(stus) ? stus.filter((s: Student) => s.active) : []);
        setTests(Array.isArray(tst) ? tst : []);
        setStar(st ?? null);
      })
      .catch((e: any) => {
        if (!alive) return;
        setErr(e?.message || 'تعذر تحميل لوحة التحكم');
        push(e?.message || 'خطأ', true);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [push]);

  if (loading) return <div className="empty">جارٍ تحميل لوحة التحكم…</div>;
  if (err) {
    return (
      <div className="empty">
        {err}
        <div style={{ marginTop: 12 }}>
          <button className="btn ghost sm" onClick={() => window.location.reload()}>إعادة المحاولة</button>
        </div>
      </div>
    );
  }

  const present = summary.reduce((a, r) => a + num(r.present), 0);
  const excused = summary.reduce((a, r) => a + num(r.excused), 0);
  const absent = summary.reduce((a, r) => a + num(r.absent), 0);
  const totalEvals = present + excused + absent;
  const attendance = totalEvals ? Math.round((present / totalEvals) * 100) : null;

  const avgs = summary.map(studentAvg).filter((v): v is number => v != null);
  const overallAvg = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
  const outstanding = avgs.filter((v) => v >= 4.5).length;

  const needHelp = summary
    .map((r) => ({
      id: num(r.id),
      name: String(r.name ?? ''),
      grade: String(r.grade ?? ''),
      section: String(r.section ?? ''),
      avg: studentAvg(r),
      absent: num(r.absent),
    }))
    .filter((r) => (r.avg != null && r.avg < 2.5) || r.absent >= 3)
    .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))
    .slice(0, 5);

  const gradeCount = new Map<string, number>();
  for (const s of students) {
    const key = s.grade + (s.section ? ' / ' + s.section : '');
    gradeCount.set(key, (gradeCount.get(key) ?? 0) + 1);
  }
  const gradeRows = [...gradeCount.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ar'));

  const stats = [
    { icon: 'users', label: 'الطالبات النشطات', value: students.length, hint: gradeRows.length + ' صفوف/شعب' },
    { icon: 'clipboard', label: 'التقييمات المسجّلة', value: totalEvals, hint: 'حضور وغياب' },
    { icon: 'chart', label: 'متوسط الأداء', value: overallAvg == null ? '—' : overallAvg.toFixed(1) + ' / 5', hint: 'السلوك والمشاركة والواجب' },
    { icon: 'star', label: 'طالبات متفوّقات', value: outstanding, hint: 'متوسط 4.5 أو أعلى' },
  ];

  const quick = [
    { to: '/students', icon: 'users', label: 'سجل الطالبات', desc: 'إضافة وتعديل ومتابعة' },
    { to: '/tests', icon: 'exam', label: 'الاختبارات', desc: 'رصد النتائج والتحليل' },
    { to: '/worksheets', icon: 'folder', label: 'أوراق العمل', desc: 'إسناد ومتابعة الإنجاز' },
    { to: '/alerts', icon: 'bell', label: 'التنبيهات', desc: 'طالبات يحتجن متابعة' },
    { to: '/analytics', icon: 'chart', label: 'التقارير', desc: 'مؤشرات وتحليلات' },
    { to: '/settings', icon: 'sliders', label: 'الإعدادات', desc: 'الهوية والنصوص والمظهر' },
  ];

  return (
    <div>
      <div className="dash-hero">
        <div>
          <div className="dash-eyebrow">{branding.schoolName} · {todayLabel()}</div>
          <h2>{greeting()}، {branding.teacher || me?.name || me?.username} 🌿</h2>
          <p>هذه نظرة سريعة على أداء الطالبات ومؤشرات المتابعة اليوم.</p>
        </div>
        <div className="dash-hero-side">
          {attendance != null && (
            <div className="dash-ring" style={{ ['--pct' as any]: attendance + '%' }}>
              <div>
                <b>{attendance}%</b>
                <small>نسبة الحضور</small>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid4">
        {stats.map((s) => (
          <div className="stat stat-pro" key={s.label}>
            <div className="stat-ico"><Icon name={s.icon} size={20} /></div>
            <div className="v">{s.value}</div>
            <div className="k">{s.label}</div>
            <div className="stat-hint">{s.hint}</div>
          </div>
        ))}
      </div>

      {star && (
        <div className="starcard">
          <div className="medal">🏅</div>
          <div>
            <h3>نجمة الأسبوع: {star.student_name ?? '—'}</h3>
            <div className="muted">{star.week_label}{star.reason ? ' — ' + star.reason : ''}</div>
          </div>
        </div>
      )}

      <div className="dash-grid">
        <div className="card">
          <div className="card-head">
            <h3>طالبات يحتجن متابعة</h3>
            <Link className="btn ghost sm" to="/alerts">عرض الكل</Link>
          </div>
          {needHelp.length === 0 ? (
            <div className="empty">لا توجد حالات تستدعي متابعة عاجلة.</div>
          ) : (
            <div className="dash-list">
              {needHelp.map((r) => (
                <Link to={'/students/' + r.id} className="dash-row" key={r.id}>
                  <div className="avatar">{r.name.slice(0, 1)}</div>
                  <div className="grow">
                    <b>{r.name}</b>
                    <small>{r.grade} / {r.section}</small>
                  </div>
                  <div className="dash-metric">
                    {r.avg != null && <span className={r.avg < 2.5 ? 'badge bad' : 'badge warn'}>المتوسط {r.avg.toFixed(1)}</span>}
                    {r.absent >= 3 && <span className="badge warn">غياب {r.absent}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h3>أحدث الاختبارات</h3>
            <Link className="btn ghost sm" to="/tests">إدارة</Link>
          </div>
          {tests.length === 0 ? (
            <div className="empty">لم تُضف اختبارات بعد.</div>
          ) : (
            <div className="dash-list">
              {tests.slice(0, 5).map((t: any) => (
                <div className="dash-row" key={t.id}>
                  <div className={'dot ' + (t.kind === 'nafis' ? 'gold' : '')} />
                  <div className="grow">
                    <b>{t.title}</b>
                    <small>{t.grade} / {t.section} · {t.kind === 'nafis' ? 'نافس' : 'اختبار'}</small>
                  </div>
                  <div className="dash-metric">
                    <span className="badge">{t.results_count ?? 0} نتيجة</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {gradeRows.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>توزيع الطالبات</h3></div>
          <div className="grade-bars">
            {gradeRows.map(([label, count]) => {
              const max = Math.max(...gradeRows.map(([, c]) => c));
              return (
                <div className="grade-bar" key={label}>
                  <span className="grade-label">{label}</span>
                  <span className="grade-track"><i style={{ width: (count / max) * 100 + '%' }} /></span>
                  <b>{count}</b>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3>اختصارات سريعة</h3></div>
        <div className="quick-grid">
          {quick.map((q) => (
            <Link to={q.to} className="quick" key={q.to}>
              <span className="quick-ico"><Icon name={q.icon} size={20} /></span>
              <span>
                <b>{q.label}</b>
                <small>{q.desc}</small>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
