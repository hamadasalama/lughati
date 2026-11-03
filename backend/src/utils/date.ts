/**
 * تحقق صارم من تاريخ ISO (YYYY-MM-DD): الصيغة + أن اليوم موجود فعلاً
 * (2025-02-30 مثلاً صيغته صحيحة لكنه تاريخ غير موجود).
 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** تاريخ اختياري: null أو نص فارغ يُقبلان، وما عداهما يجب أن يكون ISO صالحاً */
export function isOptionalIsoDate(value: unknown): boolean {
  return value == null || value === '' || isIsoDate(value);
}
