import {
  router,
  json,
  error,
  requireAuth,
  withScopes,
  requireAdminEmailAllowlist,
  secrets,
} from '@appdeploy/sdk';
import type { RouterContext, RouterMiddleware } from '@appdeploy/sdk';
import pg from 'pg';

// Administrator retained from the earlier project source, not a public role selector.
const ADMIN_EMAILS = ['bandar143376@gmail.com'];
let pool: pg.Pool | undefined;
async function database() {
  if (!pool) {
    let connectionString: string;
    try {
      connectionString = await secrets.readSecret('DATABASE_URL');
    } catch {
      throw new Fault('لم يكتمل إعداد اتصال قاعدة البيانات بعد.', 503);
    }
    const url = new URL(connectionString);
    if (!url.hostname.endsWith('.neon.tech'))
      throw new Fault('إعداد اتصال Neon غير صالح.', 503);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('channel_binding');
    pool = new pg.Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: true },
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
    });
  }
  return pool;
}
async function query(sql: string, values: unknown[] = []) {
  return (await database()).query(sql, values);
}
class Fault extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const wrap =
  (fn: RouterMiddleware): RouterMiddleware =>
  async (ctx) => {
    try {
      return await fn(ctx);
    } catch (e) {
      if (e instanceof Fault) return error(e.message, e.status);
      const code = (e as { code?: string }).code;
      if (code === '23505')
        return error('السجل موجود مسبقاً أو المعلم مرتبط بحلقة أخرى.', 409);
      if (code === '23503' || code === '22P02' || code === '23514')
        return error('تحقق من القيم والروابط المطلوبة.', 400);
      return error('تعذر إتمام العملية. تحقق من الاتصال وأعد المحاولة.', 503);
    }
  };
const text = (v: unknown, label: string, max = 200) => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max)
    throw new Fault(`${label} مطلوب وبحد أقصى ${max} حرفاً`);
  return v.trim();
};
const id = (v: unknown) => {
  if (
    typeof v !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  )
    throw new Fault('معرف السجل غير صالح');
  return v;
};
const integer = (v: unknown, min: number, max: number) => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    throw new Fault(`أدخل عدداً صحيحاً بين ${min} و${max}`);
  return v;
};
const choice = (v: unknown, allowed: string[]) => {
  if (typeof v !== 'string' || !allowed.includes(v))
    throw new Fault('القيمة المختارة غير صالحة');
  return v;
};
const body = (ctx: RouterContext) => {
  if (!ctx.body || typeof ctx.body !== 'object' || Array.isArray(ctx.body))
    throw new Fault('بيانات الطلب غير صالحة');
  return ctx.body as Record<string, unknown>;
};
const date = (v: unknown) => {
  const s = text(v, 'التاريخ', 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw new Fault('التاريخ غير صالح');
  return s;
};
type Actor = {
  id: string;
  role: string;
  center_id: string | null;
  full_name: string;
  email: string;
};
async function actor(ctx: RouterContext): Promise<Actor> {
  const r = await query(
    'SELECT id,role,center_id,full_name,email FROM users WHERE auth_subject=$1 AND is_active',
    [ctx.user!.userId],
  );
  if (!r.rows[0])
    throw new Fault('حسابك غير مفعّل. تواصل مع مدير المنصة لإضافتك.', 403);
  return r.rows[0];
}
function permit(u: Actor, roles: string[]) {
  if (!roles.includes(u.role))
    throw new Fault('ليست لديك صلاحية لهذه العملية', 403);
}
const staff = ['system_admin', 'center_manager', 'supervisor', 'teacher'];
const managers = ['system_admin', 'center_manager'];
// Every protected read is constrained by the verified account and its database role.
function studentScope(u: Actor) {
  return {
    sql: `( $1='system_admin' OR ($1 IN ('center_manager','supervisor') AND s.center_id=$2::uuid) OR ($1='teacher' AND EXISTS(SELECT 1 FROM circles h WHERE h.id=s.circle_id AND h.teacher_user_id=$3::uuid)) OR ($1='student' AND s.user_id=$3::uuid) OR ($1='guardian' AND EXISTS(SELECT 1 FROM guardian_students gs JOIN guardians g ON g.id=gs.guardian_id WHERE gs.student_id=s.id AND g.user_id=$3::uuid)))`,
    args: [u.role, u.center_id, u.id],
  };
}
async function student(u: Actor, studentId: unknown) {
  const scope = studentScope(u);
  const r = await query(
    `SELECT s.* FROM students s WHERE ${scope.sql} AND s.id=$4`,
    [...scope.args, id(studentId)],
  );
  if (!r.rows[0]) throw new Fault('الطالب غير موجود أو خارج نطاق صلاحيتك', 404);
  return r.rows[0];
}
async function center(u: Actor, centerId: unknown) {
  const value = id(centerId);
  if (u.role !== 'system_admin' && u.center_id !== value)
    throw new Fault('المركز خارج نطاق صلاحيتك', 403);
  if (
    !(await query('SELECT id FROM centers WHERE id=$1 AND is_active', [value]))
      .rowCount
  )
    throw new Fault('المركز غير متاح');
  return value;
}
async function circle(centerId: string, circleId: unknown) {
  if (!circleId) return null;
  const value = id(circleId);
  if (
    !(
      await query(
        'SELECT id FROM circles WHERE id=$1 AND center_id=$2 AND is_active',
        [value, centerId],
      )
    ).rowCount
  )
    throw new Fault('الحلقة لا تتبع المركز المحدد');
  return value;
}
const protectedRoute = (fn: RouterMiddleware) => [
  requireAuth(),
  withScopes('email'),
  wrap(fn),
];
const adminRoute = (fn: RouterMiddleware) => [
  requireAuth(),
  withScopes('email'),
  requireAdminEmailAllowlist(ADMIN_EMAILS),
  wrap(fn),
];
const routes: Record<string, RouterMiddleware[]> = {
  'GET /api/status': [
    wrap(async () => {
      try {
        await query('SELECT 1');
        return json({ configured: true, database: 'connected' });
      } catch {
        return json({
          configured: false,
          database: 'unavailable',
          message:
            'المنصة قيد الإعداد؛ لم يتم التحقق من اتصال قاعدة البيانات بعد.',
        });
      }
    }),
  ],
  'POST /api/bootstrap': adminRoute(async (ctx) => {
    await query(
      `INSERT INTO users(auth_subject,email,full_name,role) VALUES($1,$2,$3,'system_admin') ON CONFLICT(email) DO NOTHING`,
      [
        ctx.user!.userId,
        ctx.user!.email!.toLowerCase(),
        ctx.user!.name || 'مدير النظام',
      ],
    );
    return json({ success: true });
  }),
  'POST /api/session': protectedRoute(async (ctx) => {
    // Only pre-provisioned accounts may bind their verified identity; no first-user-admin rule.
    const email = ctx.user!.email?.toLowerCase();
    await query(
      'UPDATE users SET auth_subject=$1,updated_at=now() WHERE lower(email)=$2 AND auth_subject IS NULL AND is_active',
      [ctx.user!.userId, email],
    );
    return json(await actor(ctx));
  }),
  'GET /api/students': protectedRoute(async (ctx) => {
    const u = await actor(ctx);
    const scope = studentScope(u);
    return json(
      (
        await query(
          `SELECT s.*,c.name center_name,h.name circle_name,coalesce((SELECT round(100.0*count(*) FILTER(WHERE a.status IN ('present','late'))/nullif(count(*),0)) FROM attendance a WHERE a.student_id=s.id),0)::int attendance_rate FROM students s JOIN centers c ON c.id=s.center_id LEFT JOIN circles h ON h.id=s.circle_id WHERE ${scope.sql} ORDER BY s.full_name`,
          scope.args,
        )
      ).rows,
    );
  }),
  'GET /api/centers': protectedRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, staff);
    return json(
      (
        await query(
          `SELECT c.*,count(DISTINCT h.id)::int circles_count FROM centers c LEFT JOIN circles h ON h.center_id=c.id WHERE $1='system_admin' OR c.id=$2::uuid GROUP BY c.id ORDER BY c.name`,
          [u.role, u.center_id],
        )
      ).rows,
    );
  }),
  'POST /api/centers': adminRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, ['system_admin']);
    const b = body(ctx);
    return json(
      (
        await query(
          'INSERT INTO centers(name,location) VALUES($1,$2) RETURNING *',
          [
            text(b.name, 'اسم المركز'),
            typeof b.location === 'string' ? b.location.slice(0, 500) : null,
          ],
        )
      ).rows[0],
      201,
    );
  }),
  'GET /api/circles': protectedRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, staff);
    return json(
      (
        await query(
          `SELECT h.*,c.name center_name,u.full_name teacher_name FROM circles h JOIN centers c ON c.id=h.center_id LEFT JOIN users u ON u.id=h.teacher_user_id WHERE $1='system_admin' OR ($1 IN ('center_manager','supervisor') AND h.center_id=$2::uuid) OR ($1='teacher' AND h.teacher_user_id=$3::uuid) ORDER BY h.name`,
          [u.role, u.center_id, u.id],
        )
      ).rows,
    );
  }),
  'POST /api/circles': protectedRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, managers);
    const b = body(ctx);
    const centerId = await center(u, b.center_id);
    const teacher = b.teacher_user_id ? id(b.teacher_user_id) : null;
    if (
      teacher &&
      !(
        await query(
          `SELECT id FROM users WHERE id=$1 AND center_id=$2 AND role='teacher' AND is_active`,
          [teacher, centerId],
        )
      ).rowCount
    )
      throw new Fault('المعلم لا يتبع هذا المركز');
    return json(
      (
        await query(
          'INSERT INTO circles(center_id,name,teacher_user_id,schedule) VALUES($1,$2,$3,$4) RETURNING *',
          [
            centerId,
            text(b.name, 'اسم الحلقة'),
            teacher,
            typeof b.schedule === 'string' ? b.schedule.slice(0, 200) : null,
          ],
        )
      ).rows[0],
      201,
    );
  }),
  'POST /api/students': protectedRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, managers);
    const b = body(ctx);
    const centerId = await center(u, b.center_id);
    const circleId = await circle(centerId, b.circle_id);
    return json(
      (
        await query(
          'INSERT INTO students(full_name,center_id,circle_id) VALUES($1,$2,$3) RETURNING *',
          [text(b.full_name, 'اسم الطالب'), centerId, circleId],
        )
      ).rows[0],
      201,
    );
  }),
  'PUT /api/students/:id': protectedRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, managers);
    const s = await student(u, ctx.params.id);
    const b = body(ctx);
    const targetCenter = b.center_id
      ? await center(u, b.center_id)
      : s.center_id;
    const targetCircle =
      'circle_id' in b
        ? await circle(targetCenter, b.circle_id)
        : await circle(targetCenter, s.circle_id);
    const status =
      'status' in b
        ? choice(b.status, ['active', 'excused', 'suspended'])
        : s.status;
    return json(
      (
        await query(
          'UPDATE students SET status=$1,center_id=$2,circle_id=$3,updated_at=now() WHERE id=$4 RETURNING *',
          [status, targetCenter, targetCircle, s.id],
        )
      ).rows[0],
    );
  }),
  'GET /api/attendance': protectedRoute(async (ctx) => {
    const u = await actor(ctx);
    const scope = studentScope(u);
    return json(
      (
        await query(
          `SELECT a.* FROM attendance a JOIN students s ON s.id=a.student_id WHERE ${scope.sql} AND a.attendance_date=$4`,
          [...scope.args, date(ctx.query.date)],
        )
      ).rows,
    );
  }),
  'POST /api/attendance': protectedRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, staff);
    const b = body(ctx);
    const s = await student(u, b.student_id);
    if (!s.circle_id || s.status !== 'active')
      throw new Fault('يلزم طالب نشط مرتبط بحلقة');
    return json(
      (
        await query(
          `INSERT INTO attendance(student_id,circle_id,attendance_date,status,recorded_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(student_id,attendance_date) DO UPDATE SET status=excluded.status,recorded_by=excluded.recorded_by RETURNING *`,
          [
            s.id,
            s.circle_id,
            date(b.attendance_date),
            choice(b.status, ['present', 'late', 'absent', 'excused']),
            u.id,
          ],
        )
      ).rows[0],
    );
  }),
  'POST /api/memorization': protectedRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, staff);
    const b = body(ctx);
    const s = await student(u, b.student_id);
    if (s.status !== 'active') throw new Fault('الطالب غير نشط');
    const surah = integer(b.surah_no, 1, 114);
    const from = integer(b.from_ayah, 1, 286);
    const to = integer(b.to_ayah, from, 286);
    // Verse counts for the Kufan numbering used by the Hafs mushaf.
    const counts = [
      7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128,
      111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73,
      54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60,
      49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52,
      44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19,
      26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6,
      3, 5, 4, 5, 6,
    ];
    if (to > counts[surah - 1])
      throw new Fault('رقم الآية يتجاوز عدد آيات السورة');
    return json(
      (
        await query(
          `INSERT INTO memorization_records(student_id,record_type,surah_no,from_ayah,to_ayah,ayah_count,grade,notes,approved,recorded_by,record_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10) RETURNING *`,
          [
            s.id,
            choice(b.record_type, ['new', 'review', 'recitation']),
            surah,
            from,
            to,
            to - from + 1,
            b.grade == null ? null : integer(b.grade, 0, 100),
            typeof b.notes === 'string' ? b.notes.slice(0, 2000) : null,
            u.id,
            date(b.record_date),
          ],
        )
      ).rows[0],
      201,
    );
  }),
  'POST /api/points': protectedRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, staff);
    const b = body(ctx);
    const s = await student(u, b.student_id);
    const points = integer(b.points, -10000, 10000);
    if (!points) throw new Fault('النقاط لا يمكن أن تكون صفراً');
    const reason = text(b.reason, 'السبب', 500);
    // Atomic update and ledger entry; insufficient balance causes neither to be written.
    const r = await query(
      `WITH changed AS (UPDATE students SET points_balance=points_balance+$1,updated_at=now() WHERE id=$2 AND points_balance+$1>=0 RETURNING id,points_balance), entry AS (INSERT INTO points_ledger(student_id,points,reason,created_by) SELECT id,$1,$3,$4 FROM changed RETURNING id) SELECT points_balance FROM changed`,
      [points, s.id, reason, u.id],
    );
    if (!r.rowCount) throw new Fault('الرصيد غير كافٍ لخصم النقاط');
    return json(r.rows[0]);
  }),
  'GET /api/reports/student/:id': protectedRoute(async (ctx) => {
    const u = await actor(ctx);
    const s = await student(u, ctx.params.id);
    const from = date(ctx.query.from || '2000-01-01');
    const to = date(ctx.query.to || new Date().toISOString().slice(0, 10));
    if (from > to) throw new Fault('بداية الفترة بعد نهايتها');
    const [a, m, p] = await Promise.all([
      query(
        'SELECT * FROM attendance WHERE student_id=$1 AND attendance_date BETWEEN $2 AND $3 ORDER BY attendance_date DESC',
        [s.id, from, to],
      ),
      query(
        'SELECT * FROM memorization_records WHERE student_id=$1 AND record_date BETWEEN $2 AND $3 ORDER BY record_date DESC',
        [s.id, from, to],
      ),
      query(
        'SELECT * FROM points_ledger WHERE student_id=$1 AND created_at >= $2::date AND created_at < $3::date+1 ORDER BY created_at DESC',
        [s.id, from, to],
      ),
    ]);
    return json({
      student: s,
      attendance: a.rows,
      memorization: m.rows,
      points: p.rows,
      from,
      to,
    });
  }),
  'GET /api/users': protectedRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, managers);
    return json(
      (
        await query(
          `SELECT id,full_name,email,role,center_id,is_active FROM users WHERE $1='system_admin' OR (center_id=$2::uuid AND role='teacher') ORDER BY full_name`,
          [u.role, u.center_id],
        )
      ).rows,
    );
  }),
  'POST /api/users': adminRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, ['system_admin']);
    const b = body(ctx);
    const email = text(b.email, 'البريد الإلكتروني').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Fault('البريد الإلكتروني غير صالح');
    const role = choice(b.role, [
      'center_manager',
      'supervisor',
      'teacher',
      'student',
      'guardian',
    ]);
    const centerId = b.center_id ? await center(u, b.center_id) : null;
    if (['center_manager', 'supervisor', 'teacher'].includes(role) && !centerId)
      throw new Fault('حدد المركز لهذا الدور');
    return json(
      (
        await query(
          'INSERT INTO users(full_name,email,role,center_id) VALUES($1,$2,$3,$4) RETURNING id,full_name,email,role,center_id',
          [text(b.full_name, 'الاسم'), email, role, centerId],
        )
      ).rows[0],
      201,
    );
  }),
  'PUT /api/users/:id': adminRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, ['system_admin']);
    const b = body(ctx);
    if (typeof b.is_active !== 'boolean')
      throw new Fault('حالة الحساب غير صالحة');
    const r = await query(
      `UPDATE users SET is_active=$1,updated_at=now() WHERE id=$2 AND role<>'system_admin' RETURNING id`,
      [b.is_active, id(ctx.params.id)],
    );
    if (!r.rowCount) throw new Fault('الحساب غير متاح للتعديل');
    return json({ success: true });
  }),
  'POST /api/account-links': adminRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, ['system_admin']);
    const b = body(ctx);
    const s = await student(u, b.student_id);
    const account = (
      await query('SELECT id,role FROM users WHERE id=$1 AND is_active', [
        id(b.user_id),
      ])
    ).rows[0];
    if (!account) throw new Fault('الحساب غير موجود');
    if (account.role === 'student')
      await query('UPDATE students SET user_id=$1 WHERE id=$2', [
        account.id,
        s.id,
      ]);
    else if (account.role === 'guardian')
      await query(
        `WITH g AS (INSERT INTO guardians(user_id) VALUES($1) ON CONFLICT(user_id) DO UPDATE SET user_id=excluded.user_id RETURNING id) INSERT INTO guardian_students(guardian_id,student_id) SELECT id,$2 FROM g ON CONFLICT DO NOTHING`,
        [account.id, s.id],
      );
    else throw new Fault('اختر حساب طالب أو ولي أمر');
    return json({ success: true });
  }),
  'GET /api/news': [
    wrap(async () =>
      json(
        (
          await query(
            `SELECT id,title,body,kind,published_at FROM news_events WHERE status='published' ORDER BY published_at DESC LIMIT 50`,
          )
        ).rows,
      ),
    ),
  ],
  'POST /api/news': adminRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, ['system_admin']);
    const b = body(ctx);
    return json(
      (
        await query(
          `INSERT INTO news_events(title,body,kind,status,created_by,published_at) VALUES($1,$2,$3,'published',$4,now()) RETURNING id,title,body`,
          [
            text(b.title, 'العنوان'),
            text(b.body, 'النص', 10000),
            choice(b.kind, ['news', 'event', 'achievement']),
            u.id,
          ],
        )
      ).rows[0],
      201,
    );
  }),
  'GET /api/rewards': protectedRoute(async (ctx) => {
    await actor(ctx);
    return json(
      (
        await query(
          'SELECT * FROM rewards WHERE is_active ORDER BY points_cost',
        )
      ).rows,
    );
  }),
  'POST /api/rewards': adminRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, ['system_admin']);
    const b = body(ctx);
    return json(
      (
        await query(
          'INSERT INTO rewards(name,points_cost,stock) VALUES($1,$2,$3) RETURNING *',
          [
            text(b.name, 'اسم الجائزة'),
            integer(b.points_cost, 1, 100000),
            integer(b.stock, 0, 100000),
          ],
        )
      ).rows[0],
      201,
    );
  }),
  'POST /api/rewards/:id/redeem': protectedRoute(async (ctx) => {
    const u = await actor(ctx);
    permit(u, managers);
    const b = body(ctx);
    const s = await student(u, b.student_id);
    const client = await (await database()).connect();
    try {
      await client.query('BEGIN');
      const r = (
        await client.query(
          'SELECT * FROM rewards WHERE id=$1 AND is_active FOR UPDATE',
          [id(ctx.params.id)],
        )
      ).rows[0];
      if (!r || (r.stock !== null && r.stock < 1))
        throw new Fault('الجائزة غير متاحة');
      const changed = await client.query(
        'UPDATE students SET points_balance=points_balance-$1 WHERE id=$2 AND points_balance >= $1 RETURNING id',
        [r.points_cost, s.id],
      );
      if (!changed.rowCount) throw new Fault('رصيد النقاط غير كافٍ');
      await client.query(
        'UPDATE rewards SET stock=stock-1 WHERE id=$1 AND stock IS NOT NULL',
        [r.id],
      );
      const request = (
        await client.query(
          `INSERT INTO reward_requests(reward_id,student_id,status,decided_at,decided_by) VALUES($1,$2,'delivered',now(),$3) RETURNING id`,
          [r.id, s.id, u.id],
        )
      ).rows[0];
      await client.query(
        `INSERT INTO points_ledger(student_id,points,reason,source_type,source_id,created_by) VALUES($1,$2,$3,'reward',$4,$5)`,
        [s.id, -r.points_cost, `استلام جائزة: ${r.name}`, request.id, u.id],
      );
      await client.query('COMMIT');
      return json({ success: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }),
};
export const handler = router(routes);
