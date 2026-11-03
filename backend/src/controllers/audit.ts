import { wrap } from '../middleware/errors';
import * as svc from '../services/audit';

export const list = wrap(async (req, res) =>
  res.json(await svc.list({
    limit: req.query.limit ? +req.query.limit : undefined,
    offset: req.query.offset ? +req.query.offset : undefined,
    q: req.query.q ? String(req.query.q) : undefined,
    user_id: req.query.user_id ? +req.query.user_id : undefined,
  })));
