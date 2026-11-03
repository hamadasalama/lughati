import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config';
import { HttpError } from './errors';

const execFileAsync = promisify(execFile);

// أنواع مسموحة فقط: PDF وصور. منع HTML/SVG النشط كملفات عامة يقلّل خطر XSS.
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

export type UpFile = Express.Multer.File;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => { fs.mkdirSync(env.uploadDirAbs, { recursive: true }); cb(null, env.uploadDirAbs); },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, crypto.randomUUID() + ext);
  }
});
export const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(String(file.mimetype).toLowerCase()))
      return cb(new HttpError(400, 'نوع الملف غير مدعوم — المسموح: PDF أو صورة (PNG/JPG/WEBP/GIF/SVG)'));
    cb(null, true);
  }
});

/**
 * رافع جداول الطالبات: يبقى في الذاكرة (لا يُحفظ على القرص) لأن الملف يُقرأ مرة واحدة ثم يُهمل.
 * الامتداد هو الحكم لا Content-Type، لأن المتصفحات ترسل .csv بأنواع مختلفة.
 */
const SPREADSHEET_EXT = new Set(['.xlsx', '.csv']);
const SPREADSHEET_MAX_MB = 10;

export const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SPREADSHEET_MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext === '.xls')
      return cb(new HttpError(400, 'صيغة Excel 97-2003 (.xls) غير مدعومة — احفظي الملف بصيغة .xlsx أو .csv'));
    if (!SPREADSHEET_EXT.has(ext))
      return cb(new HttpError(400, 'نوع الملف غير مدعوم — المسموح: Excel (.xlsx) أو CSV'));
    cb(null, true);
  }
});

/** فحص محتوى الجدول فعلياً: xlsx ملف ZIP، وCSV نص وليس ملفاً ثنائياً */
export function verifySpreadsheet(req: Request, _res: Response, next: NextFunction) {
  const f = (req as any).file as Express.Multer.File | undefined;
  if (!f) return next(new HttpError(400, 'يرجى اختيار ملف Excel أو CSV'));
  const ext = path.extname(f.originalname || '').toLowerCase();
  try {
    if (!f.size) throw new HttpError(400, 'الملف فارغ');
    if (ext === '.xlsx') {
      if (!f.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])))
        throw new HttpError(400, 'محتوى الملف لا يطابق صيغة xlsx — تأكدي من حفظه كملف Excel حديث');
    } else {
      const head = f.buffer.subarray(0, 8192);
      if (head.includes(0)) throw new HttpError(400, 'ملف CSV يحتوي بيانات ثنائية غير صالحة');
      if (!head.toString('utf8').replace(/^\uFEFF/, '').trim())
        throw new HttpError(400, 'الملف فارغ');
    }
    next();
  } catch (e) {
    next(e);
  }
}

/** فحص البايتات السحرية: لا نثق بـ Content-Type القادم من المتصفح */
const HEAD_BYTES = 2048;

function readHead(filePath: string): Buffer {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const n = fs.readSync(fd, buf, 0, HEAD_BYTES, 0);
    return buf.subarray(0, n);
  } finally { fs.closeSync(fd); }
}

function matchesMime(mime: string, head: Buffer): boolean {
  const ascii = (a: number, b: number) => head.subarray(a, b).toString('latin1');
  const text = head.toString('utf8').replace(/^\uFEFF/, '').trimStart().toLowerCase();
  switch (mime) {
    case 'application/pdf': return ascii(0, 5) === '%PDF-';
    case 'image/png': return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/jpeg':
    case 'image/jpg': return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case 'image/gif': return ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a';
    case 'image/webp': return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
    case 'image/svg+xml': {
      // نسمح بإعلان XML/تعليقات/DOCTYPE قبل وسم <svg> فقط، لا بصفحة HTML تحوي SVG
      const idx = text.indexOf('<svg');
      if (idx < 0) return false;
      const before = text.slice(0, idx);
      return /^(?:\s|<\?xml[^>]*\?>|<!--[\s\S]*?-->|<!doctype[^>]*>)*$/.test(before);
    }
    default: return false;
  }
}

/** فحص ClamAV اختياري: يُفعّل بـ CLAMAV_ENABLED=true. فشل الفحص = رفض الملف (fail-closed). */
async function scanWithClamAv(filePath: string): Promise<void> {
  try {
    const { stdout } = await execFileAsync(env.clamav.bin, ['--no-summary', '--', filePath], {
      timeout: env.clamav.timeoutMs,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    if (/FOUND\s*$/im.test(String(stdout))) throw new HttpError(400, 'الملف مصاب ببرمجية خبيثة');
  } catch (e: any) {
    if (e instanceof HttpError) throw e;
    // clamdscan/clamscan يُرجع 1 عند العثور على إصابة ويطبع FOUND
    if (e?.code === 1 && /FOUND/i.test(String(e.stdout ?? '')))
      throw new HttpError(400, 'الملف مصاب ببرمجية خبيثة');
    if (e?.code === 'ENOENT')
      throw new HttpError(503, 'فحص الملفات غير متاح على الخادم — راجعي إعداد CLAMAV_BIN');
    if (e?.killed || e?.signal)
      throw new HttpError(503, 'انتهت مهلة فحص الملف — حاولي مجدداً');
    throw new HttpError(503, 'تعذر فحص الملف — حاولي مجدداً');
  }
}

/** يُركّب بعد Multer: يتحقق من محتوى الملف فعلياً (ويفحصه إن فُعّل ClamAV) ويحذف الدفعة كلها عند الفشل */
export async function verifyUploads(req: Request, _res: Response, next: NextFunction) {
  const files: Express.Multer.File[] = [
    ...((req as any).file ? [(req as any).file] : []),
    ...(((req as any).files as Express.Multer.File[]) ?? [])
  ];
  try {
    for (const f of files) {
      const mime = String(f.mimetype || '').toLowerCase();
      if (!matchesMime(mime, readHead(f.path)))
        throw new HttpError(400, 'محتوى الملف لا يطابق نوعه — تأكدي من صحة الملف');
    }
    if (env.clamav.enabled) {
      for (const f of files) await scanWithClamAv(f.path);
    }
    next();
  } catch (e) {
    for (const f of files) { try { fs.unlinkSync(f.path); } catch { /* تجاهل */ } }
    next(e);
  }
}
