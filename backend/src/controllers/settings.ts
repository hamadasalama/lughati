import fs from 'fs';
import { wrap } from '../middleware/errors';
import * as svc from '../services/settings';
import { HttpError } from '../middleware/errors';

export const get = wrap(async (_req, res) => res.json(await svc.getAll()));
export const publicSettings = wrap(async (_req, res) => res.json(await svc.getPublic()));
export const put = wrap(async (req, res) => res.json(await svc.put(req.body)));
export const logo = wrap(async (req, res) => {
  const f = (req as any).file;
  if (!f) throw new HttpError(400, 'اختاري ملف الشعار');
  res.json(await svc.setLogo(f, (req.body.which === 'moe' ? 'moe' : 'school'), req.user!.id));
});
export const background = wrap(async (req, res) => {
  const f = (req as any).file;
  if (!f) throw new HttpError(400, 'اختاري صورة الخلفية');
  if (!String(f.mimetype).startsWith('image/')) {
    try { fs.unlinkSync(f.path); } catch { /* تجاهل */ }
    throw new HttpError(400, 'الخلفية يجب أن تكون صورة');
  }
  res.json(await svc.setBackground(f, req.user!.id));
});
