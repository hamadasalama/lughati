import { Router } from 'express';
import * as c from '../controllers/plans';
import { requireAuth, requireRole } from '../middleware/auth';
import { upload, verifyUploads } from '../middleware/upload';

const r = Router();
r.use(requireAuth);
r.get('/', requireRole('teacher', 'admin', 'student'), c.list);
r.post('/', requireRole('teacher', 'admin'), upload.single('file'), verifyUploads, c.create);
r.patch('/:id', requireRole('teacher', 'admin'), c.update);
r.post('/:id/followups', requireRole('teacher', 'admin'), c.addFollowup);
r.delete('/:id', requireRole('teacher', 'admin'), c.remove);
export default r;
