import { Request, Response, NextFunction } from 'express';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type H = (req: Request, res: Response, next: NextFunction) => unknown;
export const wrap = (fn: H) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function notFound(_req: Request, res: Response) { res.status(404).json({ error: 'المسار غير موجود' }); }
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  let status = err instanceof HttpError ? err.status : 500;
  let message = err?.message || 'حدث خطأ في الخادم';
  // ملف مرفوع أكبر من الحد المسموح: رسالة واضحة بحالة 400 بدل 500
  if (err?.code === 'LIMIT_FILE_SIZE') { status = 400; message = 'حجم الملف أكبر من الحد المسموح'; }
  else if (err?.code === 'LIMIT_FILE_COUNT' || err?.code === 'LIMIT_UNEXPECTED_FILE') {
    status = 400; message = 'عدد الملفات أو حقل الرفع غير صالح';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400; message = 'صيغة JSON غير صالحة';
  } else if (err?.type === 'entity.too.large') {
    status = 413; message = 'الطلب أكبر من الحد المسموح';
  }
  // لا نكشف تفاصيل الأخطاء الداخلية (SQL/مسارات الملفات) للعميل
  if (status >= 500) {
    console.error(err);
    message = 'حدث خطأ في الخادم';
  }
  res.status(status).json({ error: message });
}
