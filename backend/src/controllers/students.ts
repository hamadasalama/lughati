import { wrap, HttpError } from '../middleware/errors';
import * as svc from '../services/students';
import { parseSpreadsheet } from '../services/spreadsheet';
import { audit } from '../services/audit';

export const list = wrap(async (req, res) => res.json(await svc.list(req.query as any)));
export const get = wrap(async (req, res) => res.json(await svc.get(req.user!, +req.params.id)));
export const create = wrap(async (req, res) => {
  const row = await svc.create(req.body, req.user!.id);
  await audit(req, 'student.create', 'student', row.id, { name: row.name, code: row.code });
  res.status(201).json(row);
});
export const update = wrap(async (req, res) => {
  const row = await svc.update(+req.params.id, req.body);
  await audit(req, 'student.update', 'student', row.id, { name: row.name, grade: row.grade, section: row.section });
  res.json(row);
});
export const remove = wrap(async (req, res) => {
  const row = await svc.remove(+req.params.id);
  await audit(req, 'student.delete', 'student', row.id, { name: row.name });
  res.status(204).end();
});
export const importRows = wrap(async (req, res) => {
  const r = await svc.importRows(req.body.rows);
  await audit(req, 'students.import', 'student', null, r);
  res.json(r);
});
export const importFile = wrap(async (req, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) throw new HttpError(400, 'يرجى اختيار ملف Excel أو CSV');
  const parsed = await parseSpreadsheet(file.buffer, file.originalname);
  if (!parsed.rows.length) throw new HttpError(400, 'الملف لا يحتوي على صفوف بيانات — تأكدي من العناوين والبيانات');
  const r = await svc.importRows(parsed.rows);
  const result = {
    ...r,
    truncated: r.truncated || parsed.truncated,
    file: { name: file.originalname, sheet: parsed.sheetName, rows: parsed.rows.length, header: parsed.header },
  };
  await audit(req, 'students.import_file', 'student', null, {
    file: file.originalname, rows: parsed.rows.length,
    added: r.added, updated: r.updated, invalid: r.invalid,
    accountsCreated: r.accountsCreated, accountsUpdated: r.accountsUpdated,
  });
  res.json(result);
});
