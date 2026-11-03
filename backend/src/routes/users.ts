import { Router } from 'express';
import * as c from '../controllers/users';
import { requireAuth, requireRole } from '../middleware/auth';

const r = Router();
r.use(requireAuth);
r.get('/', requireRole('teacher', 'admin'), c.list);
r.post('/', requireRole('teacher', 'admin'), c.create);       // المعلمة: حسابات طالبات فقط (يُفرض داخل الخدمة)
r.patch('/:id', requireRole('teacher', 'admin'), c.update);    // المعلمة: حسابات طالبات فقط
r.delete('/:id', requireRole('admin'), c.remove);
export default r;
