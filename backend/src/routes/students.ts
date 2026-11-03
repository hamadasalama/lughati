import { Router } from 'express';
import * as c from '../controllers/students';
import { requireAuth, requireRole } from '../middleware/auth';
import { spreadsheetUpload, verifySpreadsheet } from '../middleware/upload';

const r = Router();
r.use(requireAuth);
r.get('/', requireRole('teacher', 'admin'), c.list);
r.get('/:id', requireRole('teacher', 'admin', 'student'), c.get); // الطالبة: نفسها فقط (يُفرض داخل الخدمة)
r.post('/', requireRole('teacher', 'admin'), c.create);
r.post('/import', requireRole('teacher', 'admin'), c.importRows);
r.post('/import-file', requireRole('teacher', 'admin'), spreadsheetUpload.single('file'), verifySpreadsheet, c.importFile);
r.patch('/:id', requireRole('teacher', 'admin'), c.update);
r.delete('/:id', requireRole('teacher', 'admin'), c.remove);
export default r;
