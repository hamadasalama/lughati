import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useBranding } from '../branding/BrandingContext';
import { api } from '../api/client';
import Icon from './Icon';

const TNAV: [string, string, string][] = [
  ['/dashboard', 'لوحة التحكم', 'monitor'],
  ['/students', 'الطالبات', 'users'],
  ['/worksheets', 'أوراق العمل', 'folder'],
  ['/tests', 'الاختبارات', 'exam'],
  ['/plans', 'الخطط العلاجية', 'plan'],
  ['/skills', 'المهارات', 'skill'],
  ['/msgs', 'الرسائل', 'msg'],
  ['/ach', 'إنجازات المادة', 'star'],
  ['/alerts', 'التنبيهات', 'bell'],
  ['/analytics', 'التقارير والتحليلات', 'chart'],
  ['/compare', 'مقارنة الفترات', 'compare'],
  ['/print', 'مركز الطباعة', 'print'],
  ['/settings', 'الإعدادات', 'sliders'],
];

const SNAV: [string, string, string][] = [
  ['/s_home', 'الرئيسية', 'monitor'],
  ['/s_evals', 'تقييماتي', 'clipboard'],
  ['/s_results', 'نتائجي', 'exam'],
  ['/s_work', 'أوراق عملي', 'folder'],
  ['/s_plan', 'خطتي العلاجية', 'plan'],
  ['/s_skills', 'مهاراتي', 'skill'],
  ['/s_ach', 'إنجازات المادة', 'star'],
  ['/s_msgs', 'رسائلي', 'msg'],
  ['/s_account', 'حسابي', 'key'],
];

export default function Layout({ children }: { children: ReactNode }) {
  const { me, setMe } = useAuth();
  const { branding } = useBranding();
  const nav = useNavigate();

  // التحقق الصارم من الدور
  const isStudent = me?.role === 'student';
  const isAdmin = me?.role === 'admin';
  const navs = isStudent ? SNAV : (isAdmin ? [...TNAV, ['/admin', 'الإدارة', 'shield'] as [string, string, string]] : TNAV);
  // الشعار الرسمي المضغوط داخل public — يُستخدم في كل الواجهة
  const logo = '/logo.png';
  const t = branding.theme.texts;
  // اسم المعلمة/الإدارة الظاهر من الإعدادات؛ الطالبة يظهر اسمها الحقيقي
  const displayName = isStudent
    ? (me?.name || me?.username)
    : (branding.teacher || me?.name || me?.username);

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* تجاهل */ }
    setMe(null);
    nav('/login', { replace: true });
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="logo logo-img"><img src={logo} alt="شعار المدرسة" /></div>
          <h1>{t.brandTitle}<span>{t.brandSubtitle}</span></h1>
        </div>
        <nav>
          {navs.map(([to, label, icon]) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) => 'item' + (isActive ? ' on' : '')}
            >
              <Icon name={icon} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidefoot">
          <div className="who">
            {displayName}
            <small>{isStudent ? 'حساب طالبة' : isAdmin ? 'حساب إدارة' : 'حساب المعلمة'}</small>
          </div>
          <button className="btn ghost sm" onClick={logout}>
            <Icon name="logout" size={15} /> خروج
          </button>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}