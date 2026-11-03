import { wrap } from '../middleware/errors';
import * as svc from '../services/tests';
import * as filesSvc from '../services/files';
import { audit } from '../services/audit';

export const list = wrap(async (req, res) => res.json(await svc.list(req.user!, req.query as any)));

export const create = wrap(async (req, res) => {
  let fileId: number | null = null;

  if (req.file) {
    const registered = await filesSvc.register({
      stored_name: req.file.filename,
      original_name: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size,
      kind: 'test',
      student_id: null,
      worksheet_id: null,
      achievement_id: null,
      uploaded_by: req.user!.id,
    });
    fileId = registered.id;
  }

  const data = {
    ...req.body,
    file_id: fileId
  };

  try {
    const row = await svc.create(req.user!, data);
    await audit(req, 'test.create', 'test', row.id, { title: row.title, kind: row.kind, has_file: !!fileId });
    res.status(201).json(row);
  } catch (e) {
    // لا نترك ملفاً مرفوعاً بلا اختبار إذا فشل الحفظ
    if (fileId) await filesSvc.deleteById(fileId);
    throw e;
  }
});

export const saveResults = wrap(async (req, res) => {
  const r = await svc.saveResults(req.user!, +req.params.id, req.body.rows);
  await audit(req, 'test.results', 'test', +req.params.id, { saved: r.saved, removed: r.removed });
  res.json(r);
});

export const remove = wrap(async (req, res) => {
  await svc.remove(+req.params.id);
  res.status(204).end();
});