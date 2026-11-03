import { wrap } from '../middleware/errors';
import * as svc from '../services/evaluations';
import { audit } from '../services/audit';

export const list = wrap(async (req, res) => res.json(await svc.list(req.user!, req.query as any)));
export const create = wrap(async (req, res) => {
  const row = await svc.create(req.user!, req.body);
  await audit(req, 'evaluation.create', 'evaluation', row.id, { student_id: row.student_id, eval_date: row.eval_date });
  res.status(201).json(row);
});
export const remove = wrap(async (req, res) => {
  const row = await svc.remove(+req.params.id);
  await audit(req, 'evaluation.delete', 'evaluation', row.id, { student_id: row.student_id });
  res.status(204).end();
});
