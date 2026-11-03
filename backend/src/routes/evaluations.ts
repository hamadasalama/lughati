import { Router } from 'express';
import * as c from '../controllers/evaluations';
import { requireAuth, requireRole } from '../middleware/auth';

const r = Router();
r.use(requireAuth);
r.get('/', requireRole('teacher', 'admin', 'student'), c.list);
r.post('/', requireRole('teacher', 'admin'), c.create);
r.delete('/:id', requireRole('teacher', 'admin'), c.remove);
export default r;
