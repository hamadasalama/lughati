import { Router } from 'express';
import * as c from '../controllers/tests';
import { requireAuth, requireRole } from '../middleware/auth';
import { upload, verifyUploads } from '../middleware/upload'; // <-- استيراد multer

const r = Router();
r.use(requireAuth);
r.get('/', requireRole('teacher', 'admin', 'student'), c.list);
// إضافة upload.single('file') لاستقبال الملف
r.post('/', requireRole('teacher', 'admin'), upload.single('file'), verifyUploads, c.create); 
r.put('/:id/results', requireRole('teacher', 'admin'), c.saveResults);
r.delete('/:id', requireRole('teacher', 'admin'), c.remove);
export default r;