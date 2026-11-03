import { Router } from 'express';
import * as c from '../controllers/audit';
import { requireAuth, requireRole } from '../middleware/auth';

const r = Router();
r.use(requireAuth);
r.get('/', requireRole('admin'), c.list); // سجل التدقيق للإدارة النظام
export default r;
