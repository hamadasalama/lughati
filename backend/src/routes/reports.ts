import { Router } from 'express';
import * as c from '../controllers/reports';
import { requireAuth, requireRole } from '../middleware/auth';

const r = Router();
r.use(requireAuth);
r.get('/summary', requireRole('teacher', 'admin'), c.summary);
r.get('/compare', requireRole('teacher', 'admin'), c.compare);
r.get('/student/:id', requireRole('teacher', 'admin', 'student'), c.student); // الطالبة: تقريرها فقط
export default r;
