export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api(path: string, opts: RequestInit = {}): Promise<any> {
  const init: RequestInit = { credentials: 'include', ...opts };
  if (opts.body && !(opts.body instanceof FormData)) {
    init.headers = { 'Content-Type': 'application/json', ...((opts.headers as any) || {}) };
  }
  let res: Response;
  try {
    res = await fetch('/api' + path, init);
  } catch {
    throw new ApiError(0, 'تعذر الاتصال بالخادم — تأكدي من تشغيله (npm run dev:server)');
  }
  if (res.status === 204) return undefined;
  let data: any = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || ('خطأ ' + res.status));
  return data;
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}

/** رابط موحّد للملفات يمر عبر الخادم (مصادقة + ملكية) بدل الوصول المباشر لمجلد uploads */
export function fileUrl(id: number | string, inline = false): string {
  return '/api/files/' + id + (inline ? '?inline=1' : '');
}

/** ملفات الهوية (الشعار/الخلفية) متاحة قبل تسجيل الدخول لصفحة الدخول */
export function publicFileUrl(id: number | string, inline = false): string {
  return '/api/files/public/' + id + (inline ? '?inline=1' : '');
}
