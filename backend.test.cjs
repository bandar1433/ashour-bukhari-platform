// These tests isolate transport. Live identity and Neon persistence require deployment tests.
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('backend/index.ts', 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;
const uuid = '10000000-0000-0000-0000-000000000001';
function runtime(role = 'teacher', configured = true) {
  const calls = [];
  const sdk = {
    router: (r) => r,
    json: (data, status = 200) => ({
      statusCode: status,
      body: JSON.stringify(data),
    }),
    error: (message, status = 500) => ({
      statusCode: status,
      body: JSON.stringify({ message }),
    }),
    requireAuth: () => (ctx) =>
      ctx.user ? undefined : sdk.error('Unauthorized', 401),
    withScopes: () => () => undefined,
    requireAdminEmailAllowlist: (emails) => (ctx) =>
      emails.includes(ctx.user.email) ? undefined : sdk.error('Forbidden', 403),
    secrets: {
      readSecret: async () => {
        if (!configured) throw Error('missing');
        return 'postgresql://test:test@unit.neon.tech/test';
      },
    },
  };
  class Pool {
    async query(sql, args) {
      calls.push({ sql, args });
      if (sql.startsWith('SELECT id,role'))
        return {
          rows: role === 'unknown' ? [] : [{ id: uuid, role, center_id: uuid }],
          rowCount: 1,
        };
      if (sql.startsWith('SELECT s.*'))
        return {
          rows: [{ id: uuid, status: 'active', circle_id: uuid }],
          rowCount: 1,
        };
      return { rows: [], rowCount: 0 };
    }
  }
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (n) => (n === '@appdeploy/sdk' ? sdk : { Pool }),
    URL,
    Date,
    Error,
  });
  return {
    calls,
    async request(
      route,
      body = {},
      user = { userId: uuid, email: 'teacher@example.test' },
    ) {
      for (const fn of exports.handler[route]) {
        const r = await fn({ user, body, params: { id: uuid }, query: {} });
        if (r) return r;
      }
      throw Error('No response');
    },
  };
}
test('anonymous student access denied before database', async () => {
  const r = runtime();
  assert.equal(
    (await r.request('GET /api/students', {}, null)).statusCode,
    401,
  );
  assert.equal(r.calls.length, 0);
});
test('unprovisioned account denied', async () => {
  assert.equal(
    (await runtime('unknown').request('GET /api/students')).statusCode,
    403,
  );
});
test('student cannot award points', async () => {
  const r = runtime('student');
  assert.equal(
    (
      await r.request('POST /api/points', {
        student_id: uuid,
        points: 5,
        reason: 'test',
      })
    ).statusCode,
    403,
  );
  assert.equal(r.calls.length, 1);
});
test('teacher cannot bootstrap admin or create center', async () => {
  const r = runtime();
  assert.equal((await r.request('POST /api/bootstrap')).statusCode, 403);
  assert.equal(
    (await r.request('POST /api/centers', { name: 'test' })).statusCode,
    403,
  );
  assert.equal(r.calls.length, 0);
});
test('impossible date rejected without writes', async () => {
  const r = runtime();
  assert.equal(
    (
      await r.request('POST /api/attendance', {
        student_id: uuid,
        attendance_date: '2026-02-31',
        status: 'present',
      })
    ).statusCode,
    400,
  );
  assert.ok(r.calls.every((c) => c.sql.startsWith('SELECT')));
});
test('reversed verse range rejected', async () => {
  assert.equal(
    (
      await runtime().request('POST /api/memorization', {
        student_id: uuid,
        surah_no: 1,
        from_ayah: 7,
        to_ayah: 1,
      })
    ).statusCode,
    400,
  );
});
test('verse beyond surah length rejected', async () => {
  const r = await runtime().request('POST /api/memorization', {
    student_id: uuid,
    surah_no: 1,
    from_ayah: 1,
    to_ayah: 8,
  });
  assert.equal(r.statusCode, 400);
  assert.match(r.body, /عدد آيات/);
});
test('unsupported attendance status rejected', async () => {
  assert.equal(
    (
      await runtime().request('POST /api/attendance', {
        student_id: uuid,
        attendance_date: '2026-09-16',
        status: 'invented',
      })
    ).statusCode,
    400,
  );
});
test('insufficient points shows failure', async () => {
  assert.equal(
    (
      await runtime().request('POST /api/points', {
        student_id: uuid,
        points: -50,
        reason: 'test',
      })
    ).statusCode,
    400,
  );
});
test('missing secret reported as setup state', async () => {
  const r = runtime('teacher', false);
  assert.equal(
    JSON.parse((await r.request('GET /api/status')).body).configured,
    false,
  );
  assert.equal(r.calls.length, 0);
});
