import { wrap } from '../middleware/errors';
import * as svc from '../services/reports';

export const summary = wrap(async (req, res) => res.json(await svc.summary(req.query as any)));
export const compare = wrap(async (req, res) => res.json(await svc.compare(req.query as any)));
export const student = wrap(async (req, res) => {
  const r = await svc.studentReport(req.user!, +req.params.id, req.query as any);
  if (!r) return res.status(404).json({ error: 'الطالبة غير موجودة' });
  res.json(r);
});
