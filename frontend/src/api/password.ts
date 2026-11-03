/**
 * نفس سياسة الخادم (backend/src/services/auth.ts) — للتحقق المبكر في الواجهة فقط.
 * الخادم يبقى المرجع النهائي ولا يُعتمد على هذه الدالة وحدها.
 */
export function passwordError(pw: string): string | null {
  if (pw.length < 8) return 'كلمة المرور يجب ألا تقل عن 8 أحرف';
  if (new TextEncoder().encode(pw).length > 72) return 'كلمة المرور طويلة جداً (72 بايت كحد أقصى)';
  if (!/\p{L}/u.test(pw) || !/[0-9]/.test(pw)) return 'كلمة المرور يجب أن تحتوي حرفاً ورقماً على الأقل';
  return null;
}
