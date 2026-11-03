import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config';
import { q } from '../database/pool';
import { HttpError, wrap } from './errors';

export const COOKIE = 'lg_tok';
export interface AuthUser {
  id: number; username: string; role: 'teacher' | 'student' | 'admin';
  studentId: number | null; name?: string; tokenVersion: number;
  grade?: string | null; section?: string | null;
}
declare global {
  namespace Express { interface Request { user?: AuthUser } }
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: env.nodeEnv === 'production',
    maxAge: 8 * 3600 * 1000, path: '/'
  });
}
export function clearAuthCookie(res: Response) { res.clearCookie(COOKIE, { path: '/' }); }

export const requireAuth = wrap(async (req: Request, _res: Response, next: NextFunction) => {
  const tok = (req as any).cookies?.[COOKIE];
  if (!tok) throw new HttpError(401, 'الجلسة منتهية، يرجى تسجيل الدخول');
  let p: any;
  try { p = jwt.verify(tok, env.jwtSecret); } catch { throw new HttpError(401, 'الجلسة منتهية، يرجى تسجيل الدخول'); }
  // الدور وحالة الحساب مصدرهما قاعدة البيانات في كل طلب — لا يُوثق بما يقوله المتصفح
  const { rows } = await q<any>(
    'SELECT u.id, u.username, u.role, u.active, u.token_version, u.student_id, s.name AS student_name, ' +
    's.grade AS student_grade, s.section AS student_section ' +
    'FROM users u LEFT JOIN students s ON s.id = u.student_id WHERE u.id = $1', [p.uid]);
  const u = rows[0];
  if (!u || !u.active || u.token_version !== p.tv) throw new HttpError(401, 'الجلسة غير صالحة');
  req.user = {
    id: u.id, username: u.username, role: u.role, tokenVersion: u.token_version,
    studentId: u.student_id, name: u.student_name ?? undefined,
    grade: u.student_grade ?? null, section: u.student_section ?? null
  };
  next();
});

export const requireRole = (...roles: string[]) =>
  wrap((req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new HttpError(401, 'غير مصادق');
    if (!roles.includes(req.user.role)) throw new HttpError(403, 'غير مصرح بهذه العملية لدورك');
    next();
  });

/** تُمنع الطالبة من أي student_id ليس معرّفها — تُستدعى داخل الخدمات نفسها كخط دفاع ثانٍ */
export function assertStudentAccess(user: AuthUser, studentId: number) {
  if (user.role === 'student' && user.studentId !== studentId)
    throw new HttpError(403, 'غير مصرح بالوصول لهذه البيانات');
}
