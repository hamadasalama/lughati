import { Router } from 'express';
import * as c from '../controllers/achievements';
import { requireAuth, requireRole } from '../middleware/auth';
import { upload, verifyUploads } from '../middleware/upload';

const r = Router();
r.use(requireAuth);
r.get('/', requireRole('teacher', 'admin', 'student'), c.list); // الطالبة ترى المعلن فقط
r.post('/', requireRole('teacher', 'admin'), upload.array('files', 10), verifyUploads, c.create);
r.patch('/:id', requireRole('teacher', 'admin'), c.update);
r.delete('/:id', requireRole('teacher', 'admin'), c.remove);
export default r;
