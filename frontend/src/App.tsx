import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { BrandingProvider } from './branding/BrandingContext';
import Layout from './components/Layout';
import { ToastProvider } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/teacher/Dashboard';
import Students from './pages/teacher/Students';
import StudentRecord from './pages/teacher/StudentRecord';
import Worksheets from './pages/teacher/Worksheets';
import Tests from './pages/teacher/Tests';
import Plans from './pages/teacher/Plans';
import Skills from './pages/teacher/Skills';
import Msgs from './pages/teacher/Msgs';
import Ach from './pages/teacher/Ach';
import Alerts from './pages/teacher/Alerts';
import Analytics from './pages/teacher/Analytics';
import Compare from './pages/teacher/Compare';
import Print from './pages/teacher/Print';
import Settings from './pages/teacher/Settings';
import Admin from './pages/admin/Admin';
import Home from './pages/student/Home';
import MyEvaluations from './pages/student/MyEvaluations';
import MyResults from './pages/student/MyResults';
import MyWorksheets from './pages/student/MyWorksheets';
import MyPlan from './pages/student/MyPlan';
import MySkills from './pages/student/MySkills';
import MyAchievements from './pages/student/MyAchievements';
import MyMessages from './pages/student/MyMessages';
import MyAccount from './pages/student/MyAccount';

function Loading() {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--mut)' }}>جارٍ التحميل…</div>;
}

function RootRedirect() {
  const { me, loading } = useAuth();
  if (loading) return <Loading />;
  if (!me) return <Navigate to="/login" replace />;
  return <Navigate to={me.role === 'student' ? '/s_home' : '/dashboard'} replace />;
}

function Protected({ teacher, admin, children }: { teacher?: boolean; admin?: boolean; children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <Loading />;
  if (!me) return <Navigate to="/login" replace />;
  if (admin) {
    if (me.role !== 'admin') return <Navigate to={me.role === 'student' ? '/s_home' : '/dashboard'} replace />;
    return <Layout>{children}</Layout>;
  }
  if (teacher && me.role === 'student') return <Navigate to="/s_home" replace />;
  if (!teacher && me.role !== 'student') return <Navigate to="/dashboard" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <ToastProvider>
      <BrandingProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RootRedirect />} />

            <Route path="/dashboard" element={<Protected teacher><Dashboard /></Protected>} />
            <Route path="/students" element={<Protected teacher><Students /></Protected>} />
            <Route path="/students/:id" element={<Protected teacher><StudentRecord /></Protected>} />
            <Route path="/worksheets" element={<Protected teacher><Worksheets /></Protected>} />
            <Route path="/tests" element={<Protected teacher><Tests /></Protected>} />
            <Route path="/plans" element={<Protected teacher><Plans /></Protected>} />
            <Route path="/skills" element={<Protected teacher><Skills /></Protected>} />
            <Route path="/msgs" element={<Protected teacher><Msgs /></Protected>} />
            <Route path="/ach" element={<Protected teacher><Ach /></Protected>} />
            <Route path="/alerts" element={<Protected teacher><Alerts /></Protected>} />
            <Route path="/analytics" element={<Protected teacher><Analytics /></Protected>} />
            <Route path="/compare" element={<Protected teacher><Compare /></Protected>} />
            <Route path="/print" element={<Protected teacher><Print /></Protected>} />
            <Route path="/settings" element={<Protected teacher><Settings /></Protected>} />
            <Route path="/admin" element={<Protected admin><Admin /></Protected>} />

            <Route path="/s_home" element={<Protected><Home /></Protected>} />
            <Route path="/s_evals" element={<Protected><MyEvaluations /></Protected>} />
            <Route path="/s_results" element={<Protected><MyResults /></Protected>} />
            <Route path="/s_work" element={<Protected><MyWorksheets /></Protected>} />
            <Route path="/s_plan" element={<Protected><MyPlan /></Protected>} />
            <Route path="/s_skills" element={<Protected><MySkills /></Protected>} />
            <Route path="/s_ach" element={<Protected><MyAchievements /></Protected>} />
            <Route path="/s_msgs" element={<Protected><MyMessages /></Protected>} />
            <Route path="/s_account" element={<Protected><MyAccount /></Protected>} />

            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </AuthProvider>
      </BrandingProvider>
    </ToastProvider>
  );
}
