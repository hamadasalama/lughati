import { Router } from 'express';
import * as c from '../controllers/star';
import { requireAuth, requireRole } from '../middleware/auth';

const r = Router();
r.use(requireAuth);
r.get('/current', requireRole('teacher', 'admin', 'student'), c.current);
r.get('/', requireRole('teacher', 'admin', 'student'), c.list);
r.put('/', requireRole('teacher', 'admin'), c.put);
export default r;
