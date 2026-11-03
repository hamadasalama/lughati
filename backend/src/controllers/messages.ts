import { wrap } from '../middleware/errors';
import * as svc from '../services/messages';

export const threads = wrap(async (req, res) => res.json(await svc.threads()));
export const thread = wrap(async (req, res) => res.json(await svc.thread(req.user!, +req.params.studentId)));
export const send = wrap(async (req, res) => res.status(201).json(await svc.send(req.user!, Number(req.body.student_id), req.body.body)));
