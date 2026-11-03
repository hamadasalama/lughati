import { Router } from 'express';
import * as c from '../controllers/settings';
import { requireAuth, requireRole } from '../middleware/auth';
import { upload, verifyUploads } from '../middleware/upload';

const r = Router();
// عام: صفحة الدخول تحتاج الهوية والمظهر قبل المصادقة
r.get('/public', c.publicSettings);
r.use(requireAuth);
r.get('/', c.get);                                   // التسميات والشعارات يحتاجها الجميع
r.put('/', requireRole('teacher', 'admin'), c.put);
r.post('/logo', requireRole('teacher', 'admin'), upload.single('logo'), verifyUploads, c.logo);
r.post('/background', requireRole('teacher', 'admin'), upload.single('background'), verifyUploads, c.background);
export default r;
