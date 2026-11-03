import { Request } from 'express';
import { q } from '../database/pool';

export async function audit(req: Request, action: string, entity: string, entityId?: string | number | null, details?: unknown) {
  const u = req.user;
  try {
    await q(
      'INSERT INTO audit_logs(user_id, username, role, action, entity, entity_id, details, ip) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [u?.id ?? null, u?.username ?? null, u?.role ?? null, action, entity,
       entityId != null ? String(entityId) : null, details ?? null, (req as any).ip ?? null]);
  } catch (e) {
    // فشل سجل التدقيق لا يجب أن يُسقط العملية الأصلية التي نجحت
    console.error('audit failed:', action, e);
  }
}

export async function list(opts: { limit?: number; offset?: number; q?: string; user_id?: number }) {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  const term = String(opts.q ?? '').trim() || null;
  const where = `WHERE ($1::text IS NULL OR username ILIKE '%' || $1 || '%' OR action ILIKE '%' || $1 || '%'
                    OR entity ILIKE '%' || $1 || '%')
                   AND ($2::int IS NULL OR user_id = $2)`;
  const [page, count] = await Promise.all([
    q(`SELECT * FROM audit_logs ${where} ORDER BY at DESC, id DESC LIMIT $3 OFFSET $4`,
      [term, opts.user_id ?? null, limit, offset]),
    q(`SELECT count(*)::int AS n FROM audit_logs ${where}`, [term, opts.user_id ?? null]),
  ]);
  return { items: page.rows, total: count.rows[0].n, limit, offset };
}
