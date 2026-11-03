import { wrap } from '../middleware/errors';
import * as svc from '../services/worksheets';
import * as filesSvc from '../services/files';
import { audit } from '../services/audit';

export const list = wrap(async (req, res) => res.json(await svc.list(req.user!, req.query as any)));
export const create = wrap(async (req, res) => {
  const file = (req as any).file;
  try {
    const row = await svc.create(req.user!, req.body, file);
    await audit(req, 'worksheet.create', 'worksheet', row.id, {
      title: row.title, grade: row.grade, section: row.section,
      has_file: !!file, targets_count: row.targets_count
    });
    res.status(201).json(row);
  } catch (e) {
    // لا نترك ملفاً مرفوعاً بلا ورقة إذا فشل الحفظ
    if (file) await filesSvc.discardUploads([file.filename]);
    throw e;
  }
});
export const setStatus = wrap(async (req, res) => res.json(await svc.setStatus(+req.params.id, Number(req.body.student_id), !!req.body.done)));
export const remove = wrap(async (req, res) => { await svc.remove(+req.params.id); res.status(204).end(); });
