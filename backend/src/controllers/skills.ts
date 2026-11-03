import { wrap } from '../middleware/errors';
import * as svc from '../services/skills';

export const list = wrap(async (req, res) => res.json(await svc.list(req.user!, req.query.student_id ? +req.query.student_id : undefined)));
export const create = wrap(async (req, res) => res.status(201).json(await svc.create(req.user!, req.body)));
export const setLevels = wrap(async (req, res) => res.json(await svc.setLevels(req.user!, +req.params.id, req.body.rows)));
export const remove = wrap(async (req, res) => { await svc.remove(+req.params.id); res.status(204).end(); });
