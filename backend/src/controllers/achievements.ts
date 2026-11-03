import { wrap } from '../middleware/errors';
import * as svc from '../services/achievements';
import * as filesSvc from '../services/files';
import { audit } from '../services/audit';

export const list = wrap(async (req, res) => res.json(await svc.list(req.user!)));
export const create = wrap(async (req, res) => {
  const uploaded = ((req as any).files ?? []) as { filename: string }[];
  try {
    const row = await svc.create(req.user!, req.body, uploaded as any);
    await audit(req, 'achievement.create', 'achievement', row.id, { title: row.title, files: uploaded.length });
    res.status(201).json(row);
  } catch (e) {
    // حذف الملفات من القرص والقاعدة إن فشل إنشاء الإنجاز
    await filesSvc.discardUploads(uploaded.map((f) => f.filename));
    throw e;
  }
});
export const update = wrap(async (req, res) => res.json(await svc.update(+req.params.id, req.body)));
export const remove = wrap(async (req, res) => { await svc.remove(+req.params.id); res.status(204).end(); });
