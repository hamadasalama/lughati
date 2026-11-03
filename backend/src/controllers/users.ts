import { wrap, HttpError } from '../middleware/errors';
import * as svc from '../services/users';
import { audit } from '../services/audit';

export const list = wrap(async (req, res) => res.json(await svc.list(req.user!, req.query as any)));
export const create = wrap(async (req, res) => {
  const row = await svc.create(req.user!, req.body);
  await audit(req, 'account.create', 'user', row.id, { username: row.username, role: row.role, student_id: row.student_id });
  res.status(201).json(row);
});
export const update = wrap(async (req, res) => {
  const id = +req.params.id;
  // لا توقفين حسابك أنتِ فتخرجين من الإدارة بلا طريق للعودة
  if (id === req.user!.id && req.body?.active === false)
    throw new HttpError(400, 'لا يمكنك إيقاف حسابك الحالي');
  const row = await svc.update(req.user!, id, req.body);
  await audit(req, 'account.update', 'user', row.id, { active: row.active, password_reset: !!req.body.password });
  res.json(row);
});
export const remove = wrap(async (req, res) => {
  if (+req.params.id === req.user!.id) throw new HttpError(400, 'لا يمكنك حذف حسابك الحالي');
  const row = await svc.remove(+req.params.id);
  await audit(req, 'account.delete', 'user', row.id, { username: row.username });
  res.status(204).end();
});
