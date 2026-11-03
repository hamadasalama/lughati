import { Router } from 'express';
import * as c from '../controllers/files';
import { requireAuth } from '../middleware/auth';

const r = Router();
// عام قبل requireAuth: الشعار والخلفية فقط (يفحصهما المتحكم)
r.get('/public/:id', c.publicDownload);
r.use(requireAuth);
r.get('/:id', c.download); // فحص الملكية داخل الخدمة لكل من يطلب
export default r;
