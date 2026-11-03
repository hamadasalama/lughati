import { wrap } from '../middleware/errors';
import * as svc from '../services/auth';
import { setAuthCookie, clearAuthCookie, COOKIE } from '../middleware/auth';
import { audit } from '../services/audit';
import { q } from '../database/pool';
import { env } from '../config';
import jwt from 'jsonwebtoken';

export const login = wrap(async (req, res) => {
  try {
    const r = await svc.login(req.body.username, req.body.password, req.ip);
    setAuthCookie(res, r.token);
    await audit(req, 'login', 'user', r.user.id, { username: r.user.username });
    res.json({ user: r.user });
  } catch (e) {
    await audit(req, 'login_fail', 'user', null, { username: String(req.body?.username ?? '') });
    throw e;
  }
});

export const logout = wrap(async (req, res) => {
  // إبطال الجلسة من الخادم فعلياً (لا يكفي مسح الكوكي): يرفع token_version
  const tok = (req as any).cookies?.[COOKIE];
  if (tok) {
    try {
      const p: any = jwt.verify(tok, env.jwtSecret);
      await q('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [p.uid]);
    } catch { /* جلسة منتهية أو تالفة — لا شيء نُبطله */ }
  }
  clearAuthCookie(res);
  res.json({ ok: true });
});
export const me = wrap(async (req, res) => {
  // نُعيد الحقول بصيغة snake_case المتفق عليها في الواجهة (Me.student_id)
  const u = req.user!;
  res.json({
    user: {
      id: u.id,
      username: u.username,
      role: u.role,
      student_id: u.studentId,
      name: u.name ?? null,
    },
  });
});
export const changePassword = wrap(async (req, res) => {
  await svc.changePassword(req.user!.id, req.body.new, req.body.current, true);
  await audit(req, 'password.change', 'user', req.user!.id, {});
  res.json({ ok: true }); // كل الجلسات الأخرى بطلت تلقائياً (token_version)
});
