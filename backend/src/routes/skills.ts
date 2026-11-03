import { Router } from 'express';
import * as c from '../controllers/skills';
import { requireAuth, requireRole } from '../middleware/auth';

const r = Router();
r.use(requireAuth);
r.get('/', requireRole('teacher', 'admin', 'student'), c.list);
r.post('/', requireRole('teacher', 'admin'), c.create);
r.put('/:id/levels', requireRole('teacher', 'admin'), c.setLevels);
r.delete('/:id', requireRole('teacher', 'admin'), c.remove);
export default r;
