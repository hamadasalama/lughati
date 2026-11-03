import { wrap } from '../middleware/errors';
import * as svc from '../services/plans';
import * as filesSvc from '../services/files';
import { audit } from '../services/audit';

export const list = wrap(async (req, res) => res.json(await svc.list(req.user!, req.query.student_id ? +req.query.student_id : undefined)));

export const create = wrap(async (req, res) => {
  let fileId: number | null = null;
  if (req.file) {
    const registered = await filesSvc.register({
      stored_name: req.file.filename,
      original_name: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size,
      kind: 'plan',
      student_id: null,
      worksheet_id: null,
      achievement_id: null,
      uploaded_by: req.user!.id,
    });
    fileId = registered.id;
  }
  try {
    const row = await svc.create(req.user!, { ...req.body, file_id: fileId });
    await audit(req, 'plan.create', 'plan', row.id, { title: row.title, student_id: row.student_id, has_file: !!fileId });
    res.status(201).json(row);
  } catch (e) {
    if (fileId) await filesSvc.deleteById(fileId);
    throw e;
  }
});

export const update = wrap(async (req, res) => {
  const row = await svc.update(+req.params.id, req.body);
  await audit(req, 'plan.update', 'plan', row.id, { status: row.status });
  res.json(row);
});

export const addFollowup = wrap(async (req, res) => {
  const row = await svc.addFollowup(req.user!, +req.params.id, req.body);
  await audit(req, 'plan.followup', 'plan', +req.params.id, { followup_id: row.id });
  res.status(201).json(row);
});

export const remove = wrap(async (req, res) => {
  const row = await svc.remove(+req.params.id);
  await audit(req, 'plan.delete', 'plan', row.id, {});
  res.status(204).end();
});
