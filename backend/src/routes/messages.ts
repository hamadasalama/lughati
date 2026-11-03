import { Router } from 'express';
import * as c from '../controllers/messages';
import { requireAuth, requireRole } from '../middleware/auth';

const r = Router();
r.use(requireAuth);
r.get('/threads', requireRole('teacher', 'admin'), c.threads);
r.get('/:studentId', requireRole('teacher', 'admin', 'student'), c.thread); // الطالبة: محادثتها فقط
r.post('/', requireRole('teacher', 'admin', 'student'), c.send);
export default r;
