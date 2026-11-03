import path from 'path';
import fs from 'fs';
import { wrap } from '../middleware/errors';
import * as svc from '../services/files';
import { audit } from '../services/audit';
import { env } from '../config';
import { HttpError } from '../middleware/errors';

async function sendStored(f: any, req: any, res: any) {
  const abs = path.join(env.uploadDirAbs, f.stored_name);
  const onDisk = fs.existsSync(abs);

  const mime = String(f.mime || 'application/octet-stream').toLowerCase();
  const wantsInline = String(req.query.inline ?? '') === '1' || String(req.query.inline) === 'true';
  const canInline = mime === 'application/pdf' || mime.startsWith('image/');
  const inline = wantsInline && canInline;

  // على الاستضافات ذات القرص المؤقت قد يكون الملف قد اختفى بعد إعادة النشر؛
  // نقرأ النسخة المحفوظة في قاعدة البيانات بدلاً من إرجاع 404.
  const data = onDisk ? null : await svc.getData(f.id);
  if (!onDisk && !data) throw new HttpError(404, 'الملف غير موجود');

  const headers = () => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (inline) {
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', "inline; filename*=UTF-8''" + encodeURIComponent(f.original_name));
      res.setHeader('Cache-Control', 'private, max-age=3600');
      // SVG يمكن أن يحمل سكربتاً عند فتحه مباشرة — نعزله في سياق آمن
      if (mime === 'image/svg+xml')
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    } else {
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(f.original_name));
    }
  };

  headers();
  if (onDisk) return inline ? res.sendFile(abs) : res.download(abs, f.original_name);
  return res.send(data);
}

export const download = wrap(async (req, res) => {
  const f = await svc.getForDownload(+req.params.id, req.user?.studentId ?? null);
  // 404 بدل 403 عند عدم الملكية: لا نكشف حتى وجود الملف لمن يحاول تخمين الروابط
  if (!f || !svc.accessible(req.user!, f)) throw new HttpError(404, 'الملف غير موجود');
  await audit(req, 'file.download', 'file', f.id, { kind: f.kind });
  await sendStored(f, req, res);
});

/** ملفات الهوية العامة فقط (الشعار والخلفية) — متاحة قبل تسجيل الدخول لصفحة الدخول */
export const publicDownload = wrap(async (req, res) => {
  const f = await svc.getForDownload(+req.params.id, null);
  if (!f || (f.kind !== 'logo' && f.kind !== 'background')) throw new HttpError(404, 'الملف غير موجود');
  await sendStored(f, req, res);
});
