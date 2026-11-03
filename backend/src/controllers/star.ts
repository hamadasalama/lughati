import { wrap } from '../middleware/errors';
import * as svc from '../services/star';

export const current = wrap(async (req, res) => res.json(await svc.current()));
export const list = wrap(async (req, res) => res.json(await svc.list((req.query as any).from, (req.query as any).to)));
export const put = wrap(async (req, res) => res.json(await svc.put(req.user!, req.body)));
