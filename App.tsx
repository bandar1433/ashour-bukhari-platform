import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { api, auth } from './client';
import './index.css';

type Row = { id: string; [key: string]: any };
type Account = { id: string; full_name: string; role: string; email: string };
const roles: Record<string, string> = {
  system_admin: 'مدير النظام',
  center_manager: 'مدير المركز',
  supervisor: 'المشرف',
  teacher: 'المعلم',
  student: 'الطالب',
  guardian: 'ولي الأمر',
};
const statuses: Record<string, string> = {
  active: 'نشط',
  excused: 'مستأذن',
  suspended: 'موقوف',
  present: 'حاضر',
  late: 'متأخر',
  absent: 'غائب',
};
const recordTypes: Record<string, string> = {
  new: 'حفظ جديد',
  review: 'مراجعة',
};
const surahNames = [
  'الفاتحة','البقرة','آل عمران','النساء','المائدة','الأنعام','الأعراف','الأنفال','التوبة','يونس','هود','يوسف','الرعد','إبراهيم','الحجر','النحل','الإسراء','الكهف','مريم','طه','الأنبياء','الحج','المؤمنون','النور','الفرقان','الشعراء','النمل','القصص','العنكبوت','الروم','لقمان','السجدة','الأحزاب','سبأ','فاطر','يس','الصافات','ص','الزمر','غافر','فصلت','الشورى','الزخرف','الدخان','الجاثية','الأحقاف','محمد','الفتح','الحجرات','ق','الذاريات','الطور','النجم','القمر','الرحمن','الواقعة','الحديد','المجادلة','الحشر','الممتحنة','الصف','الجمعة','المنافقون','التغابن','الطلاق','التحريم','الملك','القلم','الحاقة','المعارج','نوح','الجن','المزمل','المدثر','القيامة','الإنسان','المرسلات','النبأ','النازعات','عبس','التكوير','الانفطار','المطففين','الانشقاق','البروج','الطارق','الأعلى','الغاشية','الفجر','البلد','الشمس','الليل','الضحى','الشرح','التين','العلق','القدر','البينة','الزلزلة','العاديات','القارعة','التكاثر','العصر','الهمزة','الفيل','قريش','الماعون','الكوثر','الكافرون','النصر','المسد','الإخلاص','الفلق','الناس'
];
const surahAyahCounts = [
  7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,
  59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,
  52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,
  21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6
];
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const get = async (path: string) => (await api.get(path)).data;
const post = async (path: string, data: unknown) =>
  (await api.post(path, data)).data;
function message(e: unknown) {
  const err = e as {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
    code?: string;
  };
  if (err.code === 'popup_blocked')
    return 'اسمح بالنوافذ المنبثقة لإكمال تسجيل الدخول.';
  if (err.code === 'popup_closed')
    return 'أُغلقت نافذة الدخول؛ يمكنك المحاولة مجدداً.';
  return (
    err.response?.data?.message ||
    err.response?.data?.error ||
    err.message ||
    'تعذر إتمام العملية'
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Pick({
  rows,
  value,
  onChange,
  label = 'اختر',
  required = true,
}: {
  rows: Row[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
  required?: boolean;
}) {
  return (
    <select
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{label}</option>
      {rows.map((r) => (
        <option key={r.id} value={r.id}>
          {r.full_name || r.name}
        </option>
      ))}
    </select>
  );
}
function Table({ heads, rows }: { heads: string[]; rows: ReactNode[][] }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td key={j}>{v}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={heads.length}>لا توجد سجلات بعد.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [dashboard, setDashboard] = useState(false);
  const [panel, setPanel] = useState('لوحة المؤشرات');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<boolean | null>(null);
  const [students, setStudents] = useState<Row[]>([]);
  const [centers, setCenters] = useState<Row[]>([]);
  const [circles, setCircles] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const [news, setNews] = useState<Row[]>([]);
  const [rewards, setRewards] = useState<Row[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [day, setDay] = useState(today());
  const [report, setReport] = useState<any>(null);
  const admin = account?.role === 'system_admin';
  const manager = admin || account?.role === 'center_manager';
  const staff =
    !!account &&
    ['system_admin', 'center_manager', 'supervisor', 'teacher'].includes(
      account.role,
    );
  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const run = async (action: () => Promise<void>, success = '') => {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      await action();
      if (success) setNotice(success);
    } catch (e) {
      setNotice(message(e));
    } finally {
      setBusy(false);
    }
  };
  const refresh = async (a: Account) => {
    const isStaff = [
      'system_admin',
      'center_manager',
      'supervisor',
      'teacher',
    ].includes(a.role);
    const isManager = ['system_admin', 'center_manager'].includes(a.role);
    const [s, c, h, u, r] = await Promise.all([
      get('/api/students'),
      isStaff ? get('/api/centers') : [],
      isStaff ? get('/api/circles') : [],
      isManager ? get('/api/users') : [],
      get('/api/rewards'),
    ]);
    setStudents(s);
    setCenters(c);
    setCircles(h);
    setUsers(u);
    setRewards(r);
  };
  const loadSession = async () => {
    const identity = await auth.getUser();
    if (identity?.email?.toLowerCase() === 'bandar143376@gmail.com')
      await post('/api/bootstrap', {});
    const a = await post('/api/session', {});
    await refresh(a);
    setAccount(a);
    setDashboard(true);
  };
  const login = () =>
    run(async () => {
      await auth.signIn({ scope: 'openid email profile offline_access' });
      await loadSession();
    });
  const logout = () =>
    run(async () => {
      await auth.signOut();
      setAccount(null);
      setDashboard(false);
      setStudents([]);
      setCenters([]);
      setCircles([]);
      setUsers([]);
      setReport(null);
      setAttendance([]);
      setRewards([]);
    });
  const checkConnection = async () => {
    const s = await get('/api/status');
    setConnection(s.configured);
    if (s.configured) setNews(await get('/api/news'));
  };
  useEffect(() => {
    checkConnection()
      .then(() => {
        if (auth.isSignedIn()) return loadSession();
      })
      .catch((e) => setNotice(message(e)));
  }, []);
  useEffect(() => {
    let current = true;
    if (account && panel === 'الحضور اليومي')
      get(`/api/attendance?date=${day}`)
        .then((a) => {
          if (current) setAttendance(a);
        })
        .catch((e) => {
          if (current) setNotice(message(e));
        });
    return () => {
      current = false;
    };
  }, [account, panel, day]);
  const submit = (path: string, payload: unknown) => async (e: FormEvent) => {
    e.preventDefault();
    await run(async () => {
      await post(path, payload);
      await refresh(account!);
      setForm({});
    }, 'تم الحفظ بنجاح');
  };
  const input = (
    key: string,
    label: string,
    type = 'text',
    required = true,
  ) => (
    <Field label={label}>
      <input
        required={required}
        type={type}
        value={form[key] || ''}
        onChange={(e) => set(key, e.target.value)}
      />
    </Field>
  );
  const centerPick = (
    <Field label="المركز">
      <Pick
        rows={centers}
        value={form.center_id || ''}
        onChange={(v) => {
          setForm((f) => ({
            ...f,
            center_id: v,
            circle_id: '',
            teacher_user_id: '',
          }));
        }}
      />
    </Field>
  );
  const studentPick = (
    <Field label="الطالب">
      <Pick
        rows={students}
        value={form.student_id || ''}
        onChange={(v) => {
          set('student_id', v);
          setReport(null);
        }}
      />
    </Field>
  );
  const saveButton = (
    <button className="primary" disabled={busy}>
      {busy ? 'جارٍ الحفظ…' : 'حفظ'}
    </button>
  );
  const menu = [
    'لوحة المؤشرات',
    ...(staff
      ? [
          'المراكز والفروع',
          'الحلقات',
          'الخطة الأسبوعية',
          'الطلاب',
          'الحضور اليومي',
          'الحفظ والمراجعة',
        ]
      : []),
    'النقاط والجوائز',
    'التقارير',
    ...(admin ? ['المستخدمون والصلاحيات', 'الأخبار والفعاليات'] : []),
  ];
  const navigate = (p: string) => {
    setPanel(p);
    setForm({});
    setReport(null);
    setNotice('');
  };
  return (
    <main dir="rtl">
      <header className="header noPrint">
        <button className="brand" onClick={() => setDashboard(false)}>
          <span className="brandMark">۞</span>
          <div>
            <b>حلقات عاشور بخاري</b>
            <small>منصة إدارة التعليم القرآني</small>
          </div>
        </button>
        <div className="actions">
          {account ? (
            <>
              <button onClick={() => setDashboard(!dashboard)}>
                {dashboard ? 'الموقع العام' : 'لوحة الإدارة'}
              </button>
              <button onClick={logout} disabled={busy}>
                تسجيل الخروج
              </button>
            </>
          ) : (
            <button className="login" onClick={login} disabled={busy}>
              دخول المنصة
            </button>
          )}
        </div>
      </header>
      {notice && (
        <div className="notice noPrint" role="alert">
          {notice}
          <button aria-label="إغلاق التنبيه" onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      )}
      {connection === false && (
        <section className="setup noPrint">
          <strong>المنصة قيد الإعداد</strong>
          <p>
            لم يتم التحقق من اتصال قاعدة البيانات بعد. ستتاح العمليات بعد
            استكمال الربط.
          </p>
          <button onClick={() => run(checkConnection)} disabled={busy}>
            إعادة التحقق من الاتصال
          </button>
        </section>
      )}
      {!dashboard || !account ? (
        <>
          <section className="hero">
            <div className="heroText">
              <span className="eyebrow">
                تعليمٌ متقن • متابعةٌ دقيقة • أثرٌ مستدام
              </span>
              <h1>منصة حلقات عاشور بخاري</h1>
              <h2>إدارة متكاملة للحلقات القرآنية</h2>
              <p>
                إدارة المراكز والحلقات، ومتابعة الحفظ والمراجعة
                والحضور، في مساحة واحدة للمعلم والأسرة والإدارة.
              </p>
              <div className="actions">
                <button
                  className="primary"
                  onClick={account ? () => setDashboard(true) : login}
                  disabled={busy}
                >
                  الدخول إلى المنصة
                </button>
                <a className="secondary" href="#about">
                  عن الحلقات
                </a>
              </div>
            </div>
            <div className="heroArt">
              <div className="arch">
                <b style={{ fontSize: 60 }}>۞</b>
                <strong>خيركم من تعلّم القرآن وعلّمه</strong>
                <span>تعليم • متابعة • إنجاز</span>
              </div>
            </div>
          </section>
          <section id="about" className="section">
            <h2>رحلة متصلة مع كتاب الله</h2>
            <div className="featureGrid">
              <article>
                <h3>للمعلم</h3>
                <p>تسجيل الحضور والحفظ والمراجعة.</p>
              </article>
              <article>
                <h3>للإدارة</h3>
                <p>تنظيم المراكز والحلقات والطلاب وحسابات العاملين.</p>
              </article>
              <article>
                <h3>للأسرة والطالب</h3>
                <p>متابعة السجلات والتقارير ضمن الحساب المصرح له.</p>
              </article>
            </div>
          </section>
          <section className="section">
            <h2>الأخبار والإنجازات</h2>
            {news.length ? (
              news.map((n) => (
                <article className="panel" key={n.id}>
                  <h3>{n.title}</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{n.body}</p>
                </article>
              ))
            ) : (
              <p>ستظهر هنا الأخبار المنشورة من إدارة الحلقات.</p>
            )}
          </section>
          <footer>© منصة حلقات عاشور بخاري</footer>
        </>
      ) : (
        <div className="workspace">
          <aside className="noPrint">
            <div className="user">
              <span>{account.full_name.slice(0, 1)}</span>
              <div>
                <b>{account.full_name}</b>
                <small>{roles[account.role]}</small>
              </div>
            </div>
            {menu.map((p) => (
              <button
                key={p}
                className={panel === p ? 'selected' : ''}
                onClick={() => navigate(p)}
              >
                {p}
              </button>
            ))}
          </aside>
          <section className="dashboardContent">
            <div className="panel noPrint">
              <span className="eyebrow">{roles[account.role]}</span>
              <h1>{panel}</h1>
            </div>
            {panel === 'لوحة المؤشرات' && (
              <>
                <div className="stats">
                  {[
                    [students.length, 'الطلاب المتاحون لحسابك'],
                    [
                      students.filter((s) => s.status === 'active').length,
                      'الطلاب النشطون',
                    ],
                    [circles.length, 'الحلقات المتاحة'],
                    [
                      students.reduce(
                        (a, s) => a + Number(s.points_balance),
                        0,
                      ),
                      'مجموع نقاط الطلاب',
                    ],
                  ].map(([v, label]) => (
                    <article key={label}>
                      <b>{v}</b>
                      <span>{label}</span>
                    </article>
                  ))}
                </div>
                <div className="panel">
                  <p>
                    تعكس المؤشرات نطاق صلاحيات حسابك. افتح التقارير للاطلاع على
                    سجل الطالب خلال فترة محددة.
                  </p>
                </div>
              </>
            )}
            {panel === 'المراكز والفروع' && (
              <>
                <section className="panel">
                  {admin && (
                    <form onSubmit={submit('/api/centers', form)}>
                      {input('name', 'اسم المركز')}
                      {input('location', 'الموقع', 'text', false)}
                      {saveButton}
                    </form>
                  )}
                  <Table
                    heads={['المركز', 'الموقع', 'الحلقات']}
                    rows={centers.map((c) => [
                      c.name,
                      c.location || '—',
                      c.circles_count,
                    ])}
                  />
                </section>
              </>
            )}
            {panel === 'الحلقات' && (
              <section className="panel">
                {manager && (
                  <form onSubmit={submit('/api/circles', form)}>
                    {input('name', 'اسم الحلقة')}
                    {centerPick}
                    <Field label="المعلم">
                      <Pick
                        required={false}
                        rows={users.filter(
                          (u) =>
                            u.role === 'teacher' &&
                            u.center_id === form.center_id &&
                            u.is_active,
                        )}
                        value={form.teacher_user_id || ''}
                        onChange={(v) => set('teacher_user_id', v)}
                        label="بدون معلم حالياً"
                      />
                    </Field>
                    {input('schedule', 'الموعد', 'text', false)}
                    {saveButton}
                  </form>
                )}
                <Table
                  heads={['الحلقة', 'المركز', 'المعلم', 'الموعد']}
                  rows={circles.map((c) => [
                    c.name,
                    c.center_name,
                    c.teacher_name || 'غير معين',
                    c.schedule || '—',
                  ])}
                />
              </section>
            )}
            {panel === 'الخطة الأسبوعية' && (
              <section className="panel">
                <h2>الخطة الأسبوعية</h2>
                <p>يستطيع المعلم تحديث خطة حلقته، وتظهر الخطة المعتمدة مباشرة للإدارة.</p>
                <Table
                  heads={['الحلقة', 'المعلم', 'الخطة الأسبوعية', 'حفظ']}
                  rows={circles.map((c) => [
                    c.name,
                    c.teacher_name || 'غير معين',
                    <textarea
                      aria-label={`الخطة الأسبوعية ${c.name}`}
                      value={form[`plan_${c.id}`] ?? c.schedule ?? ''}
                      onChange={(e) => set(`plan_${c.id}`, e.target.value)}
                    />,
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api.put(`/api/circles/${c.id}`, {
                            schedule: form[`plan_${c.id}`] ?? c.schedule ?? '',
                          });
                          await refresh(account);
                        }, 'تم حفظ الخطة الأسبوعية')
                      }
                    >
                      حفظ
                    </button>,
                  ])}
                />
              </section>
            )}
            {panel === 'الطلاب' && (
              <section className="panel">
                {manager && (
                  <form onSubmit={submit('/api/students', form)}>
                    {input('full_name', 'اسم الطالب')}
                    {centerPick}
                    <Field label="الحلقة">
                      <Pick
                        required={false}
                        rows={circles.filter(
                          (c) => c.center_id === form.center_id,
                        )}
                        value={form.circle_id || ''}
                        onChange={(v) => set('circle_id', v)}
                        label="بدون حلقة"
                      />
                    </Field>
                    {saveButton}
                  </form>
                )}
                <Table
                  heads={['الطالب', 'المركز', 'الحلقة', 'الحالة', 'النقاط']}
                  rows={students.map((s) => [
                    s.full_name,
                    s.center_name,
                    staff ? (
                      <select
                        aria-label={`حلقة ${s.full_name}`}
                        value={s.circle_id || ''}
                        disabled={busy}
                        onChange={(e) =>
                          run(async () => {
                            await api.put(`/api/students/${s.id}`, {
                              circle_id: e.target.value || null,
                            });
                            await refresh(account);
                          }, 'تم نقل الطالب')
                        }
                      >
                        <option value="">بدون حلقة</option>
                        {circles
                          .filter((c) => c.center_id === s.center_id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      s.circle_name || '—'
                    ),
                    staff ? (
                      <select
                        aria-label={`حالة ${s.full_name}`}
                        value={s.status}
                        disabled={busy}
                        onChange={(e) =>
                          run(async () => {
                            await api.put(`/api/students/${s.id}`, {
                              status: e.target.value,
                            });
                            await refresh(account);
                          }, 'تم تحديث الحالة')
                        }
                      >
                        {['active', 'excused', 'suspended'].map((v) => (
                          <option key={v} value={v}>
                            {statuses[v]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      statuses[s.status]
                    ),
                    s.points_balance,
                  ])}
                />
              </section>
            )}
            {panel === 'الحضور اليومي' && (
              <section className="panel">
                <Field label="تاريخ الحضور">
                  <input
                    type="date"
                    required
                    value={day}
                    onChange={(e) => {
                      setDay(e.target.value);
                      setAttendance([]);
                    }}
                  />
                </Field>
                <Table
                  heads={['الطالب', 'الحالة المسجلة', 'تسجيل الحضور']}
                  rows={students
                    .filter((s) => s.status === 'active')
                    .map((s) => [
                      s.full_name,
                      statuses[
                        attendance.find((a) => a.student_id === s.id)?.status
                      ] || 'لم يسجل',
                      <div className="actions">
                        {['present', 'late', 'absent', 'excused'].map((v) => (
                          <button
                            key={v}
                            disabled={busy || !s.circle_id || !day}
                            onClick={() =>
                              run(async () => {
                                await post('/api/attendance', {
                                  student_id: s.id,
                                  status: v,
                                  attendance_date: day,
                                });
                                setAttendance(
                                  await get(`/api/attendance?date=${day}`),
                                );
                              }, 'تم تسجيل الحضور')
                            }
                          >
                            {statuses[v]}
                          </button>
                        ))}
                      </div>,
                    ])}
                />
              </section>
            )}
            {panel === 'الحفظ والمراجعة' && (
              <section className="panel">
                <form
                  onSubmit={submit('/api/memorization', {
                    ...form,
                    record_type: form.record_type || 'new',
                    record_date: form.record_date || today(),
                    surah_no: Number(form.surah_no),
                    from_ayah: Number(form.from_ayah),
                    to_ayah: Number(form.to_ayah),
                    grade: form.grade ? Number(form.grade) : null,
                  })}
                >
                  {studentPick}
                  <Field label="نوع الإنجاز">
                      <select
                        value={form.record_type || 'new'}
                        onChange={(e) => set('record_type', e.target.value)}
                      >
                        <option value="new">حفظ جديد</option>
                        <option value="review">مراجعة</option>
                      </select>
                    </Field>
                  <Field label="السورة">
                    <select
                      required
                      value={form.surah_no || ''}
                      onChange={(e) => {
                        set('surah_no', e.target.value);
                        set('from_ayah', '');
                        set('to_ayah', '');
                      }}
                    >
                      <option value="">اختر السورة</option>
                      {surahNames.map((name, index) => (
                        <option key={name} value={String(index + 1)}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="من الآية">
                    <select
                      required
                      disabled={!form.surah_no}
                      value={form.from_ayah || ''}
                      onChange={(e) => {
                        set('from_ayah', e.target.value);
                        if (Number(form.to_ayah) < Number(e.target.value)) set('to_ayah', '');
                      }}
                    >
                      <option value="">اختر الآية</option>
                      {form.surah_no &&
                        Array.from({ length: surahAyahCounts[Number(form.surah_no) - 1] }, (_, i) => i + 1).map((ayah) => (
                          <option key={ayah} value={String(ayah)}>{ayah}</option>
                        ))}
                    </select>
                  </Field>
                  <Field label="إلى الآية">
                    <select
                      required
                      disabled={!form.surah_no || !form.from_ayah}
                      value={form.to_ayah || ''}
                      onChange={(e) => set('to_ayah', e.target.value)}
                    >
                      <option value="">اختر الآية</option>
                      {form.surah_no && form.from_ayah &&
                        Array.from(
                          { length: surahAyahCounts[Number(form.surah_no) - 1] - Number(form.from_ayah) + 1 },
                          (_, i) => Number(form.from_ayah) + i,
                        ).map((ayah) => (
                          <option key={ayah} value={String(ayah)}>{ayah}</option>
                        ))}
                    </select>
                  </Field>
                  {input('grade', 'الدرجة من 100', 'number', false)}
                  {input('notes', 'ملاحظات', 'text', false)}
                  <Field label="التاريخ">
                    <input
                      type="date"
                      required
                      value={form.record_date || today()}
                      onChange={(e) => set('record_date', e.target.value)}
                    />
                  </Field>
                  {saveButton}
                </form>
                <p>
                  يمكن مراجعة السجلات المحفوظة من قسم التقارير. أرقام الآيات وفق
                  العد الكوفي في مصحف حفص.
                </p>
              </section>
            )}
            {panel === 'النقاط والجوائز' && (
              <>
                <section className="panel">
                  <h2>النقاط</h2>
                  {staff && (
                    <form
                      onSubmit={submit('/api/points', {
                        student_id: form.student_id,
                        points: Number(form.points),
                        reason: form.reason,
                      })}
                    >
                      {studentPick}
                      {input('points', 'النقاط المضافة أو المخصومة', 'number')}
                      {input('reason', 'سبب الحركة')}
                      {saveButton}
                    </form>
                  )}
                  <Table
                    heads={['الطالب', 'الرصيد']}
                    rows={students.map((s) => [s.full_name, s.points_balance])}
                  />
                </section>
                <section className="panel">
                  <h2>الجوائز</h2>
                  {admin && (
                    <form
                      onSubmit={submit('/api/rewards', {
                        name: form.name,
                        points_cost: Number(form.points_cost),
                        stock: Number(form.stock),
                      })}
                    >
                      {input('name', 'اسم الجائزة')}
                      {input('points_cost', 'تكلفة النقاط', 'number')}
                      {input('stock', 'المخزون', 'number')}
                      {saveButton}
                    </form>
                  )}
                  {manager && studentPick}
                  <Table
                    heads={['الجائزة', 'النقاط', 'المخزون', 'التسليم']}
                    rows={rewards.map((r) => [
                      r.name,
                      r.points_cost,
                      r.stock ?? 'غير محدد',
                      manager ? (
                        <button
                          disabled={busy || !form.student_id}
                          onClick={() => {
                            if (
                              window.confirm(
                                `تأكيد تسليم ${r.name} وخصم ${r.points_cost} نقطة؟`,
                              )
                            )
                              run(async () => {
                                await post(`/api/rewards/${r.id}/redeem`, {
                                  student_id: form.student_id,
                                });
                                await refresh(account);
                              }, 'تم تسليم الجائزة وخصم النقاط');
                          }}
                        >
                          تسليم الجائزة
                        </button>
                      ) : (
                        'عن طريق الإدارة'
                      ),
                    ])}
                  />
                </section>
              </>
            )}
            {panel === 'التقارير' && (
              <section className="panel report">
                <form
                  className="noPrint"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      setReport(null);
                      setReport(
                        await get(
                          `/api/reports/student/${form.student_id}?from=${form.from || '2000-01-01'}&to=${form.to || today()}`,
                        ),
                      );
                    });
                  }}
                >
                  {studentPick}
                  {input('from', 'من تاريخ', 'date', false)}
                  {input('to', 'إلى تاريخ', 'date', false)}
                  <button className="primary" disabled={busy}>
                    عرض التقرير
                  </button>
                </form>
                {report && (
                  <>
                    <h2>حلقات عاشور بخاري — تقرير الطالب</h2>
                    <h3>{report.student.full_name}</h3>
                    <p>
                      الفترة: {report.from} — {report.to}
                    </p>
                    <p>الرصيد الحالي: {report.student.points_balance} نقطة</p>
                    <button
                      className="primary noPrint"
                      onClick={() => window.print()}
                    >
                      طباعة / حفظ PDF
                    </button>
                    <h3>الحضور</h3>
                    <Table
                      heads={['التاريخ', 'الحالة']}
                      rows={report.attendance.map((a: Row) => [
                        String(a.attendance_date).slice(0, 10),
                        statuses[a.status],
                      ])}
                    />
                    <h3>الحفظ والمراجعة</h3>
                    <Table
                      heads={[
                        'التاريخ',
                        'النوع',
                        'السورة',
                        'الآيات',
                        'الدرجة',
                        'ملاحظات',
                      ]}
                      rows={report.memorization.map((m: Row) => [
                        String(m.record_date).slice(0, 10),
                        recordTypes[m.record_type],
                        m.surah_no,
                        `${m.from_ayah}–${m.to_ayah}`,
                        m.grade ?? '—',
                        m.notes || '—',
                      ])}
                    />
                    <h3>حركات النقاط</h3>
                    <Table
                      heads={['التاريخ', 'النقاط', 'السبب']}
                      rows={report.points.map((p: Row) => [
                        String(p.created_at).slice(0, 10),
                        p.points,
                        p.reason,
                      ])}
                    />
                  </>
                )}
              </section>
            )}
            {panel === 'المستخدمون والصلاحيات' && admin && (
              <>
                <section className="panel">
                  <h2>إضافة حساب</h2>
                  <form
                    onSubmit={submit('/api/users', {
                      ...form,
                      role: form.role || 'teacher',
                    })}
                  >
                    {input('full_name', 'الاسم')}
                    {input('email', 'البريد الإلكتروني', 'email')}
                    <Field label="الدور">
                      <select
                        value={form.role || 'teacher'}
                        onChange={(e) => set('role', e.target.value)}
                      >
                        {Object.entries(roles)
                          .filter(([k]) => k !== 'system_admin')
                          .map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                      </select>
                    </Field>
                    {centerPick}
                    {saveButton}
                  </form>
                  <Table
                    heads={['الاسم', 'البريد', 'الدور', 'الحالة']}
                    rows={users.map((u) => [
                      u.full_name,
                      u.email,
                      roles[u.role],
                      u.role === 'system_admin' ? (
                        'مدير النظام'
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await api.put(`/api/users/${u.id}`, {
                                is_active: !u.is_active,
                              });
                              await refresh(account);
                            }, 'تم تحديث الحساب')
                          }
                        >
                          {u.is_active ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                        </button>
                      ),
                    ])}
                  />
                </section>
                <section className="panel">
                  <h2>ربط الطالب بحساب الطالب أو ولي أمره</h2>
                  <form
                    onSubmit={submit('/api/account-links', {
                      student_id: form.student_id,
                      user_id: form.user_id,
                    })}
                  >
                    {studentPick}
                    <Field label="الحساب">
                      <Pick
                        rows={users.filter((u) =>
                          ['student', 'guardian'].includes(u.role),
                        )}
                        value={form.user_id || ''}
                        onChange={(v) => set('user_id', v)}
                      />
                    </Field>
                    {saveButton}
                  </form>
                </section>
              </>
            )}
            {panel === 'الأخبار والفعاليات' && admin && (
              <section className="panel">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      await post('/api/news', {
                        title: form.title,
                        body: form.body,
                        kind: form.kind || 'news',
                      });
                      setNews(await get('/api/news'));
                      setForm({});
                    }, 'تم نشر المحتوى');
                  }}
                >
                  {input('title', 'العنوان')}
                  <Field label="التصنيف">
                    <select
                      value={form.kind || 'news'}
                      onChange={(e) => set('kind', e.target.value)}
                    >
                      <option value="news">خبر</option>
                      <option value="event">فعالية</option>
                      <option value="achievement">إنجاز</option>
                    </select>
                  </Field>
                  <Field label="النص">
                    <textarea
                      required
                      value={form.body || ''}
                      onChange={(e) => set('body', e.target.value)}
                    />
                  </Field>
                  <button className="primary" disabled={busy}>
                    نشر
                  </button>
                </form>
                {news.map((n) => (
                  <article key={n.id}>
                    <h3>{n.title}</h3>
                    <p>{n.body}</p>
                  </article>
                ))}
              </section>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
