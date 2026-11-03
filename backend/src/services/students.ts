import crypto from 'crypto';
import { pool, q } from '../database/pool';
import { HttpError } from '../middleware/errors';
import { AuthUser } from '../middleware/auth';
import { hashPassword, validatePassword } from './auth';

export async function list(f: { grade?: string; section?: string; q?: string }) {
  const { rows } = await q(
    `SELECT * FROM students
     WHERE active AND ($1::text IS NULL OR grade = $1) AND ($2::text IS NULL OR section = $2)
       AND ($3::text IS NULL OR name ILIKE '%' || $3 || '%' OR code ILIKE '%' || $3 || '%')
     ORDER BY grade, section, name`,
    [f.grade || null, f.section || null, f.q || null]);
  return rows;
}

export async function get(user: AuthUser, id: number) {
  if (user.role === 'student' && user.studentId !== id)
    throw new HttpError(403, 'غير مصرح بالوصول لهذه البيانات');
  const { rows } = await q('SELECT * FROM students WHERE id = $1', [id]);
  if (!rows[0]) throw new HttpError(404, 'الطالبة غير موجودة');
  return rows[0];
}

async function assertNew(name: any, grade: any, section: any) {
  if (!name || !String(name).trim()) throw new HttpError(400, 'اسم الطالبة مطلوب');
  if (!grade || !section) throw new HttpError(400, 'الصف والشعبة مطلوبان');
}

export async function create(b: any, userId: number) {
  await assertNew(b.name, b.grade, b.section);
  const manual = b.code && String(b.code).trim();
  const code = manual ? String(b.code).trim() : 'TMP-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  let s: any;
  try {
    const { rows } = await q(
      'INSERT INTO students(code, name, grade, section, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [code, String(b.name).trim(), b.grade, b.section, b.notes || null]);
    s = rows[0];
  } catch (e: any) {
    if (e.code === '23505') throw new HttpError(409, 'هذا الرمز مستخدم مسبقاً');
    throw e;
  }
  if (!manual) await q("UPDATE students SET code = 'ST-' || lpad(id::text, 3, '0') WHERE id = $1", [s.id]);
  return { ...s, code: manual ? s.code : 'ST-' + String(s.id).padStart(3, '0') };
}

export async function update(id: number, b: any) {
  const { rows } = await q(
    `UPDATE students SET
       name    = COALESCE($2, name),
       grade   = COALESCE($3, grade),
       section = COALESCE($4, section),
       notes   = COALESCE($5, notes),
       active  = COALESCE($6, active)
     WHERE id = $1 RETURNING *`,
    [id, b.name ?? null, b.grade ?? null, b.section ?? null, b.notes ?? null, b.active ?? null]);
  if (!rows[0]) throw new HttpError(404, 'الطالبة غير موجودة');
  return rows[0];
}

export async function remove(id: number) {
  const { rows } = await q('DELETE FROM students WHERE id = $1 RETURNING id, name', [id]);
  if (!rows[0]) throw new HttpError(404, 'الطالبة غير موجودة');
  return rows[0];
}

const MAX_IMPORT_ROWS = 1000;
const AUTO_CODE = /^(?:TMP-|ST-\d+$)/i;

type PreparedRow = {
  row: number;
  code: string;
  name: string;
  grade: string;
  section: string;
  username: string;
  password: string;
  notes: string;
  passwordHash?: string;
};

const clean = (v: unknown) => String(v ?? '').trim();
const validUsername = (v: string) => /^\S{2,60}$/.test(v);

/** ينفّذ وعداً على عناصر المصفوفة بعدد محدود متوازٍ (تسريع bcrypt بلا إغراق المعالج) */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

function uniqueMessage(e: any): string {
  switch (e?.constraint) {
    case 'students_code_key': return 'الرمز مستخدم لطالبة أخرى';
    case 'users_username_key':
    case 'users_username_lower_uidx': return 'اسم المستخدم مستخدم لحساب آخر';
    case 'users_student_id_key': return 'لهذه الطالبة حساب دخول بالفعل';
    default: return 'تعارض في البيانات: رمز أو اسم مستخدم مكرر';
  }
}

/**
 * استيراد جماعي للطالبات مع حسابات الدخول.
 * - الرمز (code) هو اسم المستخدم الافتراضي إن لم يُحدَّد اسم مستخدم.
 * - كلمة المرور اختيارية للطالبات الموجودات، وإلزامية لإنشاء حساب جديد.
 * - كل صف داخل SAVEPOINT: فشل صف لا يُسقط بقية الملف.
 */
export async function importRows(rowsIn: any[]) {
  if (!Array.isArray(rowsIn) || !rowsIn.length) throw new HttpError(400, 'لا توجد صفوف للاستيراد');
  const capped = rowsIn.slice(0, MAX_IMPORT_ROWS);
  const truncated = rowsIn.length > capped.length;

  const errors: { row: number; message: string }[] = [];
  const seenCodes = new Set<string>();
  const seenNames = new Set<string>();
  const prepared: PreparedRow[] = [];
  let invalid = 0;

  for (let i = 0; i < capped.length; i++) {
    const r = capped[i] ?? {};
    const rowNo = Number.isFinite(+r.row) && +r.row > 0 ? +r.row : i + 1;
    const code = clean(r.code);
    const name = clean(r.name);
    const grade = clean(r.grade) || 'الرابع';
    const section = clean(r.section) || 'أ';
    const username = clean(r.username).toLowerCase();
    const password = clean(r.password);
    const notes = clean(r.notes).slice(0, 2000);

    if (!name) {
      invalid++;
      errors.push({ row: rowNo, message: 'اسم الطالبة مطلوب' });
      continue;
    }
    if (name.length > 120) {
      invalid++;
      errors.push({ row: rowNo, message: 'اسم الطالبة أطول من 120 حرفاً' });
      continue;
    }
    if (code.length > 30) {
      invalid++;
      errors.push({ row: rowNo, message: 'الرمز أطول من 30 حرفاً' });
      continue;
    }
    if (code && !validUsername(code)) {
      invalid++;
      errors.push({ row: rowNo, message: 'الرمز يجب ألا يحتوي مسافات (حتى 30 حرفاً)' });
      continue;
    }
    if (username && !validUsername(username)) {
      invalid++;
      errors.push({ row: rowNo, message: 'اسم المستخدم يجب أن يكون 2–60 حرفاً بلا مسافات' });
      continue;
    }
    if (password) {
      try { validatePassword(password); } catch (e: any) {
        invalid++;
        errors.push({ row: rowNo, message: e?.message || 'كلمة المرور غير صالحة' });
        continue;
      }
    }

    // منع التكرار داخل الملف نفسه: بالرمز إن وُجد وبالاسم+الصف+الشعبة دائماً
    const nameKey = name + '\u0000' + grade + '\u0000' + section;
    const codeKey = code ? code.toLowerCase() : '';
    if (seenNames.has(nameKey) || (codeKey && seenCodes.has(codeKey))) {
      invalid++;
      errors.push({ row: rowNo, message: 'صف مكرر داخل الملف' });
      continue;
    }
    seenNames.add(nameKey);
    if (codeKey) seenCodes.add(codeKey);

    prepared.push({ row: rowNo, code, name, grade, section, username, password, notes });
  }

  // تجهيز التجزئات خارج المعاملة لتقصير مدة القفل
  await mapLimit(prepared, 4, async (r) => {
    if (r.password) r.passwordHash = await hashPassword(r.password);
  });

  let added = 0;
  let updated = 0;
  let accountsCreated = 0;
  let accountsUpdated = 0;
  let accountsSkipped = 0;

  if (prepared.length) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of prepared) {
        await client.query('SAVEPOINT import_row');
        try {
          // 1) مطابقة الطالبة: بالرمز أولاً، ثم بالاسم+الصف+الشعبة
          let student: any = null;
          let matchedBy: 'code' | 'name' = 'name';
          if (r.code) {
            const byCode = await client.query(
              'SELECT * FROM students WHERE lower(code) = lower($1) LIMIT 1', [r.code]);
            if (byCode.rows[0]) { student = byCode.rows[0]; matchedBy = 'code'; }
          }
          if (!student) {
            const byName = await client.query(
              'SELECT * FROM students WHERE name = $1 AND grade = $2 AND section = $3 ORDER BY id LIMIT 1',
              [r.name, r.grade, r.section]);
            // نتبنّى الرمز الجديد فقط إن كان رمز الطالبة الحالي مولّداً تلقائياً
            if (byName.rows[0] && (!r.code || AUTO_CODE.test(String(byName.rows[0].code)))) {
              student = byName.rows[0];
              matchedBy = 'name';
            }
          }

          let isNew = false;
          let changed = false;

          if (!student) {
            const ins = await client.query(
              `INSERT INTO students(code, name, grade, section, notes)
               VALUES ($1, $2, $3, $4, $5) RETURNING *`,
              [r.code || 'TMP-' + crypto.randomBytes(12).toString('hex'), r.name, r.grade, r.section, r.notes || null]);
            student = ins.rows[0];
            if (!r.code) {
              const upd = await client.query(
                "UPDATE students SET code = 'ST-' || lpad(id::text, 3, '0') WHERE id = $1 RETURNING *",
                [student.id]);
              student = upd.rows[0];
            }
            isNew = true;
            changed = true;
          } else {
            const sets: string[] = [];
            const vals: any[] = [student.id];
            const push = (col: string, value: any) => { vals.push(value); sets.push(col + ' = $' + vals.length); };
            if (student.name !== r.name) push('name', r.name);
            if (student.grade !== r.grade) push('grade', r.grade);
            if (student.section !== r.section) push('section', r.section);
            if (r.notes && student.notes !== r.notes) push('notes', r.notes);
            // الرمز لا يتغير لمن وُجد بالرمز؛ يُتبنّى فقط عند المطابقة بالاسم
            if (r.code && matchedBy === 'name' && r.code !== student.code) push('code', r.code);
            if (sets.length) {
              const upd = await client.query(
                'UPDATE students SET ' + sets.join(', ') + ' WHERE id = $1 RETURNING *', vals);
              student = upd.rows[0];
              changed = true;
            }
          }

          // 2) حساب الدخول
          const accRes = await client.query(
            'SELECT id, username, active FROM users WHERE student_id = $1', [student.id]);
          let account = accRes.rows[0] ?? null;
          const username = r.username || String(student.code).toLowerCase();

          if (!account) {
            if (r.passwordHash) {
              if (!validUsername(username))
                throw new HttpError(400, 'اسم المستخدم غير صالح — استخدمي رمزاً بلا مسافات أو اسم مستخدم صريحاً');
              const insAcc = await client.query(
                `INSERT INTO users(username, password_hash, role, student_id)
                 VALUES ($1, $2, 'student', $3) RETURNING id, username`,
                [username, r.passwordHash, student.id]);
              account = insAcc.rows[0];
              accountsCreated++;
              changed = true;
            } else if (r.username) {
              accountsSkipped++;
              errors.push({ row: r.row, message: 'لم يُنشأ حساب: كلمة المرور مطلوبة للحساب الجديد' });
            }
          } else {
            let accChanged = false;
            if (r.username && account.username !== r.username) {
              await client.query('UPDATE users SET username = $2 WHERE id = $1', [account.id, r.username]);
              account.username = r.username;
              accChanged = true;
            }
            if (r.passwordHash) {
              // تغيير كلمة المرور يُبطل كل جلسات الطالبة القديمة
              await client.query(
                'UPDATE users SET password_hash = $2, token_version = token_version + 1 WHERE id = $1',
                [account.id, r.passwordHash]);
              accChanged = true;
            }
            if (accChanged) { accountsUpdated++; changed = true; }
          }

          if (isNew) added++;
          else if (changed) updated++;

          await client.query('RELEASE SAVEPOINT import_row');
        } catch (e: any) {
          await client.query('ROLLBACK TO SAVEPOINT import_row').catch(() => { /* تجاهل */ });
          invalid++;
          const message = e instanceof HttpError ? e.message
            : e?.code === '23505' ? uniqueMessage(e)
            : 'تعذر استيراد الصف';
          if (!(e instanceof HttpError) && e?.code !== '23505') console.error('import row failed:', e);
          errors.push({ row: r.row, message });
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => { /* تجاهل */ });
      throw e;
    } finally {
      client.release();
    }
  }

  // fast-path للتوافق مع الاختبارات/الواجهة القديمة: كل ما لم يُضف أو يُحدَّث يُعد متخطّى
  const skipped = capped.length - added - updated;
  const maxErrors = 200;
  return {
    added, updated, skipped, invalid,
    accountsCreated, accountsUpdated, accountsSkipped,
    truncated,
    errors: errors.slice(0, maxErrors),
    errorsTruncated: errors.length > maxErrors,
  };
}
