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
function downloadCsv(filename:string, rows:(string|number|null|undefined)[][]) {
  const csv='\uFEFF'+rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}
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
  const [competitions, setCompetitions] = useState<Row[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [memorization, setMemorization] = useState<Row[]>([]);
  const [day, setDay] = useState(today());
  const [report, setReport] = useState<any>(null);
  const [dailyProgress, setDailyProgress] = useState<Row[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<Row[]>([]);
  const [libraryItems, setLibraryItems] = useState<Row[]>([]);
  const [centerReport, setCenterReport] = useState<any>(null);
  const [rankings, setRankings] = useState<any>(null);
  const [struggles, setStruggles] = useState<Row[]>([]);
  const [publicStats, setPublicStats] = useState<any>(null);
  const [myDay, setMyDay] = useState<Row[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<any>(null);
  const [quranProgress, setQuranProgress] = useState<any>(null);
  const [mushafPages, setMushafPages] = useState<{ from?: number; to?: number }>({});
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
    if (isStaff) setCompetitions(await get('/api/competitions'));
    if (isStaff) setMemorization(await get('/api/memorization'));
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
    if (s.configured) {
      const [n,ps]=await Promise.all([get('/api/news'),get('/api/public-stats')]);
      setNews(n); setPublicStats(ps);
    }
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
  useEffect(() => {
    let active = true;
    const surah = Number(form.surah_no);
    const from = Number(form.from_ayah);
    const to = Number(form.to_ayah);
    if (!surah || !from) {
      setMushafPages({});
      return () => { active = false; };
    }
    const loadPage = async (ayah: number) => {
      const response = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/quran-uthmani`);
      if (!response.ok) throw new Error('تعذر تحديد صفحة المصحف');
      const result = await response.json();
      return Number(result?.data?.page);
    };
    Promise.all([loadPage(from), loadPage(to || from)])
      .then(([fromPage, toPage]) => {
        if (active) setMushafPages({ from: fromPage, to: toPage });
      })
      .catch(() => {
        if (active) setMushafPages({});
      });
    return () => { active = false; };
  }, [form.surah_no, form.from_ayah, form.to_ayah]);
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
          ...(account?.role === 'teacher' ? ['حلقتي اليوم'] : []),
          'المراكز والفروع',
          'الحلقات',
          'الخطة الأسبوعية',
          'الطلاب',
          'الحضور اليومي',
          'الحفظ والمراجعة',
          'المسابقات',
          'المكتبة',
        ]
      : account?.role === 'student' ? ['الحضور اليومي'] : []),
    ...(account?.role === 'student' ? ['وردي اليوم','رحلتي مع القرآن'] : []),
    ...(account?.role === 'guardian' ? ['متابعة الأبناء'] : []),
    'النقاط والجوائز',
    'مركز التقارير',
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
          {publicStats&&<section className="stats"><article><b>{publicStats.students}</b><span>طالب نشط</span></article><article><b>{publicStats.circles}</b><span>حلقة</span></article><article><b>{publicStats.centers}</b><span>مركز</span></article><article><b>{publicStats.records}</b><span>سجل إنجاز</span></article></section>}
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
              <div className="actions"><button type="button" onClick={() => navigate('لوحة المؤشرات')}>← رجوع</button><span className="eyebrow">{roles[account.role]}</span></div>
              <h1>{panel}</h1>
              {panel === 'مركز التقارير' && <p>التقارير تنشأ آليًا بحسب صلاحية المستخدم، والأصل أسبوعي مع إمكان تغيير الفترة إلى شهري أو ربع سنوي أو نصف سنوي أو سنوي.</p>}
              {panel === 'المكتبة' && <p>مكتبة البرامج والدروس المرتبطة بالمصادر الخارجية مثل YouTube دون تحميل ملفات الفيديو على المنصة.</p>}
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
                {staff && <div className="panel"><h2>يحتاجون تدخلك اليوم</h2><button disabled={busy} onClick={()=>run(async()=>setStruggles(await get('/api/struggles')))}>تحديث قائمة المتابعة</button><Table heads={['الطالب','الحلقة','الغياب خلال 14 يومًا','متوسط الأداء']} rows={struggles.map(s=>[s.full_name,s.circle_name||'—',s.absences,s.avg_grade])}/></div>}
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
            {panel === 'حلقتي اليوم' && (
              <section className="panel">
                <h2>حلقتي اليوم</h2>
                <p>متابعة سريعة للحضور والمراجعة والحفظ الجديد والدرجة اليومية من 100.</p>
                <button className="primary" disabled={busy} onClick={()=>run(async()=>setDailyProgress(await get(`/api/daily-progress?date=${today()}`)))}>تحديث بيانات اليوم</button>
                <Table heads={['الطالب','الحضور /30','المراجعة /40','الحفظ الجديد /30','المجموع /100']} rows={dailyProgress.map(r=>[r.full_name,r.attendance_score ?? 'مستأذن',r.review_score,r.new_score,r.total_score ?? 'مستبعد'])}/>
              </section>
            )}
            {panel === 'الخطة الأسبوعية' && (
              <section className="panel">
                <h2>الخطة الأسبوعية</h2>
                <p>حدد إجمالي المستهدف الأسبوعي، وتقوم المنصة بتوزيعه تلقائيًا على السبت إلى الخميس مع الاحتفاظ بالخطة السابقة.</p>
                <form onSubmit={(e)=>{e.preventDefault();run(async()=>{await post('/api/weekly-plans',{student_id:form.student_id,week_start:form.week_start||today(),review_total:Number(form.review_total||0),new_total:Number(form.new_total||0),goals:form.goals||''});setWeeklyPlans(await get(`/api/weekly-plans?week_start=${form.week_start||today()}`))},'تم اعتماد الخطة الأسبوعية')}}>
                  {studentPick}{input('week_start','بداية الأسبوع (السبت)','date')}{input('review_total','إجمالي المراجعة','number')}{input('new_total','إجمالي الحفظ الجديد','number')}{input('goals','أهداف وملاحظات','text',false)}{saveButton}
                </form>
                <button disabled={busy} onClick={()=>run(async()=>setWeeklyPlans(await get(`/api/weekly-plans?week_start=${form.week_start||today()}`)))}>عرض الخطة</button>
                <Table heads={['الطالب','اليوم','المراجعة','الحفظ الجديد','الأهداف']} rows={weeklyPlans.map(p=>[p.full_name,p.day_name,p.review_target,p.new_target,p.goals||'—'])}/>
              </section>
            )}
            {panel === 'الطلاب' && (
              <section className="panel">
                {staff && (
                  <form onSubmit={submit('/api/students', form)}>
                    {input('full_name', 'اسم الطالب')}
                    {input('national_id', 'رقم الهوية', 'text')}
                    {input('phone', 'رقم الجوال', 'tel')}
                    {input('birth_date', 'تاريخ الميلاد', 'date', false)}
                    {input('grade_level', 'المرحلة أو المستوى', 'text', false)}
                    {account?.role !== 'teacher' && centerPick}
                    <Field label="الحلقة">
                      <Pick
                        required={false}
                        rows={account?.role === 'teacher' ? circles : circles.filter(
                          (c) => c.center_id === form.center_id,
                        )}
                        value={form.circle_id || (account?.role === 'teacher' ? circles[0]?.id || '' : '')}
                        onChange={(v) => set('circle_id', v)}
                        label="بدون حلقة"
                      />
                    </Field>
                    {saveButton}
                  </form>
                )}
                {staff && form.edit_student_id && <form onSubmit={(e)=>{e.preventDefault();run(async()=>{await api.put(`/api/students/${form.edit_student_id}`,{full_name:form.edit_full_name,phone:form.edit_phone,national_id:form.edit_national_id,birth_date:form.edit_birth_date||null,grade_level:form.edit_grade_level||'',status:form.edit_status});await refresh(account);setForm({})},'تم تحديث ملف الطالب')}}>
                  <h3>تعديل ملف الطالب</h3>
                  {input('edit_full_name','اسم الطالب')}{input('edit_national_id','رقم الهوية/الوثيقة')}{input('edit_phone','رقم الجوال','tel')}{input('edit_birth_date','تاريخ الميلاد','date',false)}{input('edit_grade_level','المرحلة أو المستوى','text',false)}
                  <Field label="الحالة"><select value={form.edit_status||'active'} onChange={(e)=>set('edit_status',e.target.value)}>{['active','excused','suspended'].map(v=><option key={v} value={v}>{statuses[v]}</option>)}</select></Field>{saveButton}
                </form>}
                <Table
                  heads={['الطالب','الهوية/الوثيقة','الجوال','المركز','الحلقة','الحالة','النقاط','الملف']}
                  rows={students.map((s) => [
                    s.full_name,
                    s.national_id || '—',
                    s.phone || '—',
                    s.center_name,
                    staff ? (
                      <select
                        aria-label={`حلقة ${s.full_name}`}
                        value={s.circle_id || ''}
                        disabled={busy || account?.role === 'teacher'}
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
                    staff ? <button onClick={()=>setForm({edit_student_id:s.id,edit_full_name:s.full_name||'',edit_national_id:s.national_id||'',edit_phone:s.phone||'',edit_birth_date:s.birth_date?String(s.birth_date).slice(0,10):'',edit_grade_level:s.grade_level||'',edit_status:s.status||'active'})}>تعديل البيانات</button> : '—',
                  ])}
                />
              </section>
            )}
            {panel === 'الحضور اليومي' && (
              <section className="panel">
                <h2>الحضور والانصراف</h2>
                <Field label="تاريخ الحضور">
                  <input type="date" required value={account?.role === 'student' ? today() : day} disabled={account?.role === 'student'} onChange={(e)=>{setDay(e.target.value);setAttendance([])}} />
                </Field>
                <Table
                  heads={['الطالب','الحالة','الحضور','الانصراف','الإجراءات']}
                  rows={students.filter((s)=>s.status==='active').map((s)=>{
                    const a=attendance.find((x)=>x.student_id===s.id);
                    return [
                      s.full_name,
                      statuses[a?.status]||'لم يسجل',
                      a?.check_in_at ? new Date(a.check_in_at).toLocaleTimeString('ar-SA',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit'}) : '—',
                      a?.check_out_at ? new Date(a.check_out_at).toLocaleTimeString('ar-SA',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit'}) : '—',
                      <div className="actions">
                        <button disabled={busy||!s.circle_id} onClick={()=>run(async()=>{await post('/api/attendance',{student_id:s.id,attendance_date:day,action:'check_in'});setAttendance(await get(`/api/attendance?date=${day}`))},'تم تسجيل الحضور')}>حضور</button>
                        <button disabled={busy||!a?.check_in_at} onClick={()=>run(async()=>{await post('/api/attendance',{student_id:s.id,attendance_date:day,action:'check_out'});setAttendance(await get(`/api/attendance?date=${day}`))},'تم تسجيل الانصراف')}>انصراف</button>
                        {staff && ['present','late','absent','excused'].map((v)=><button key={v} disabled={busy||!s.circle_id} onClick={()=>run(async()=>{await post('/api/attendance',{student_id:s.id,status:v,attendance_date:day});setAttendance(await get(`/api/attendance?date=${day}`))},'تم تحديث الحالة')}>{statuses[v]}</button>)}
                      </div>
                    ];
                  })}
                />
                {staff && <><h3>اعتماد اليوم</h3><div className="actions">
                  {circles.map((h)=><button key={h.id} disabled={busy} onClick={()=>run(async()=>{await post('/api/attendance/approve',{circle_id:h.id,approval_date:day})},`تم اعتماد حضور ${h.name} ليوم ${day}`)}>اعتماد {h.name}</button>)}
                </div></>}
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
                  {mushafPages.from && (
                    <div className="notice" style={{ margin: '8px 0' }}>
                      صفحة مصحف المدينة: {mushafPages.from}
                      {mushafPages.to && mushafPages.to !== mushafPages.from
                        ? ` — ${mushafPages.to}`
                        : ''}
                      {mushafPages.to && mushafPages.from
                        ? ` • عدد الصفحات: ${mushafPages.to - mushafPages.from + 1}`
                        : ''}
                    </div>
                  )}
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
                <h3>السجلات السابقة</h3>
                <Table heads={['الطالب','النوع','السورة','الآيات','الدرجة','تعديل']} rows={memorization.map((m)=>[
                  students.find((s)=>s.id===m.student_id)?.full_name || '—', recordTypes[m.record_type], surahNames[Number(m.surah_no)-1] || '—', `${m.from_ayah}–${m.to_ayah}`, m.grade ?? '—',
                  <button onClick={()=>setForm({student_id:m.student_id,record_id:m.id,record_type:m.record_type,surah_no:String(m.surah_no),from_ayah:String(m.from_ayah),to_ayah:String(m.to_ayah),grade:m.grade==null?'':String(m.grade),notes:m.notes||'',record_date:String(m.record_date).slice(0,10)})}>تعديل</button>
                ])}/>
                {form.record_id && <button className="primary" disabled={busy} onClick={()=>run(async()=>{await api.put(`/api/memorization/${form.record_id}`,{record_type:form.record_type,surah_no:Number(form.surah_no),from_ayah:Number(form.from_ayah),to_ayah:Number(form.to_ayah),grade:form.grade?Number(form.grade):null,notes:form.notes||'',record_date:form.record_date||today()});setMemorization(await get('/api/memorization'));setForm({})},'تم تعديل السجل')}>حفظ التعديل</button>}
                <p>أرقام الآيات وفق العد الكوفي في مصحف حفص.</p>
              </section>
            )}
            {panel === 'المسابقات' && (
              <section className="panel">
                <h2>المسابقات</h2>
                {manager && (
                  <form onSubmit={submit('/api/competitions', {
                    title: form.competition_title,
                    start_date: form.competition_start,
                    end_date: form.competition_end,
                    center_id: form.center_id || undefined,
                  })}>
                    {admin && centerPick}
                    {input('competition_title','اسم المسابقة')}
                    {input('competition_start','تاريخ البداية','date')}
                    {input('competition_end','تاريخ النهاية','date')}
                    {saveButton}
                  </form>
                )}
                <Table heads={['المسابقة','البداية','النهاية','الحالة','إدخال نتيجة']} rows={competitions.map((x)=>[
                  x.title,x.start_date,x.end_date,x.status,
                  staff ? <button onClick={()=>setForm(f=>({...f,competition_id:x.id}))}>اختيار</button> : '—'
                ])}/>
                {staff && form.competition_id && (
                  <form onSubmit={submit(`/api/competitions/${form.competition_id}/score`, {
                    student_id: form.student_id,
                    score: Number(form.competition_score),
                    notes: form.competition_notes || null,
                  })}>
                    <h3>إدخال نتيجة الطالب</h3>
                    {studentPick}
                    {input('competition_score','الدرجة من 100','number')}
                    {input('competition_notes','ملاحظات','text',false)}
                    {saveButton}
                  </form>
                )}
              </section>
            )}
            {panel === 'وردي اليوم' && (
              <section className="panel">
                <h2>وردي اليوم</h2><button disabled={busy} onClick={()=>run(async()=>setMyDay(await get(`/api/my-day?date=${today()}`)))}>عرض ورد اليوم</button>
                {myDay.map(x=><article className="panel" key={x.id}><h3>{x.full_name}</h3><p>المراجعة: {x.actual_review||0} من {x.review_target||0} — الدرجة {x.review_score}/40</p><p>الحفظ الجديد: {x.actual_new||0} من {x.new_target||0} — الدرجة {x.new_score}/30</p><p>الحضور: {x.attendance_score??'مستبعد'}/30</p><h3>المجموع: {x.total_score??'مستبعد'} / 100</h3></article>)}
              </section>
            )}
            {panel === 'رحلتي مع القرآن' && (
              <section className="panel">
                <h2>رحلتي مع القرآن</h2>
                <button disabled={busy||!students[0]} onClick={()=>run(async()=>setQuranProgress(await get(`/api/quran-progress?student_id=${students[0].id}`)))}>عرض سجل الإنجاز</button>
                {quranProgress&&<><h3>{quranProgress.student.full_name}</h3><div className="progressMap">{surahNames.map((name,i)=>{const rec=quranProgress.records.filter((r:Row)=>Number(r.surah_no)===i+1);const saved=rec.some((r:Row)=>r.record_type==='new');const reviewed=rec.some((r:Row)=>r.record_type==='review');const weak=rec.some((r:Row)=>Number(r.grade)<70);const state=weak?'يحتاج تثبيت':reviewed?'قيد المراجعة':saved?'محفوظ':'لم يبدأ';return <article key={name} className={`quranState ${state==='محفوظ'?'done':state==='يحتاج تثبيت'?'weak':state==='قيد المراجعة'?'review':''}`}><b>{name}</b><small>{state}</small></article>})}</div><h3>سجل الإنجاز</h3><Table heads={['التاريخ','النوع','السورة','الآيات','الدرجة']} rows={quranProgress.records.slice().reverse().map((r:Row)=>[String(r.record_date).slice(0,10),recordTypes[r.record_type],surahNames[Number(r.surah_no)-1],`${r.from_ayah}–${r.to_ayah}`,r.grade??'—'])}/></>}
              </section>
            )}
            {panel === 'متابعة الأبناء' && (
              <section className="panel">
                <h2>متابعة الأبناء</h2><p>ملخص تلقائي للحضور ومستوى الحفظ والمراجعة.</p>
                <Field label="دورية التقرير"><select value={form.guardian_frequency||'weekly'} onChange={e=>set('guardian_frequency',e.target.value)}><option value="weekly">أسبوعي</option><option value="monthly">شهري</option><option value="quarterly">ربع سنوي</option><option value="half_yearly">نصف سنوي</option><option value="yearly">سنوي</option></select></Field>
                <button disabled={busy} onClick={()=>run(async()=>{await post('/api/guardian-preferences',{frequency:form.guardian_frequency||'weekly'})},'تم حفظ دورية التقرير')}>حفظ الدورية</button>
                <button disabled={busy} onClick={()=>run(async()=>setWeeklySummary(await get('/api/weekly-summary'))}>عرض التقرير الأسبوعي</button>
                {weeklySummary&&<><p>الفترة: {weeklySummary.from} — {weeklySummary.to}</p><Table heads={['الطالب','أيام الحضور','الغياب','متوسط الأداء']} rows={weeklySummary.students.map((x:Row)=>[x.full_name,x.attended,x.absent,x.memorization_average])}/></>}
              </section>
            )}
            {panel === 'النقاط والجوائز' && (
              <>
                <section className="panel">
                  <h2>الترتيب والتحفيز</h2>
                  <button disabled={busy} onClick={()=>run(async()=>setRankings(await get('/api/rankings')))}>تحديث الترتيب</button>
                  {rankings&&<><h3>أفضل 10 على مستوى نطاقك</h3><Table heads={['الترتيب','الطالب','الحلقة','الدرجة']} rows={rankings.top_center.map((r:Row,i:number)=>[i+1,r.full_name,r.circle_name||'—',r.score])}/><h3>أفضل 3 في كل حلقة</h3>{rankings.top_by_circle.map((group:Row[],i:number)=><Table key={i} heads={['الطالب','الحلقة','الدرجة']} rows={group.map(r=>[r.full_name,r.circle_name||'—',r.score])}/>)}</>}
                </section>
              </>)} 
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
            {panel === 'المكتبة' && (
              <section className="panel">
                <h2>المكتبة</h2>
                <p>البرامج والسلاسل والدروس مرتبطة بالمصدر الخارجي دون تخزين الفيديو داخل المنصة.</p>
                {['system_admin','center_manager','supervisor'].includes(account.role) && <form onSubmit={(e)=>{e.preventDefault();run(async()=>{await post('/api/library',{section_name:form.library_section,title:form.library_title,teacher_name:form.library_teacher||'',description:form.library_description||'',youtube_url:form.library_url,sort_order:Number(form.library_order||0)});setLibraryItems(await get('/api/library'));setForm({})},'تمت إضافة الدرس')}}>
                  {input('library_section','البرنامج / السلسلة')}{input('library_title','عنوان الدرس')}{input('library_teacher','المدرس','text',false)}{input('library_url','رابط YouTube','url')}{input('library_order','ترتيب الدرس','number',false)}{input('library_description','وصف مختصر','text',false)}{saveButton}
                </form>}
                <button disabled={busy} onClick={()=>run(async()=>setLibraryItems(await get('/api/library')))}>عرض المكتبة</button>
                <div className="featureGrid">{libraryItems.map(x=><article key={x.id}><small>{x.section_name}</small><h3>{x.title}</h3><p>{x.teacher_name||''}</p><p>{x.description||''}</p><a className="secondary" href={x.youtube_url} target="_blank" rel="noreferrer">فتح الدرس</a></article>)}</div>
              </section>
            )}
            {panel === 'مركز التقارير' && (
              <section className="panel report">
                <h2>مركز التقارير</h2>
                <div className="actions noPrint">
                  {['system_admin','center_manager','supervisor'].includes(account.role) && <button onClick={()=>run(async()=>setCenterReport(await get(`/api/reports/center?from=${form.from||'2000-01-01'}&to=${form.to||today()}${admin&&form.center_id?`&center_id=${form.center_id}`:''}`)))}>تقرير المركز</button>}
                  <button onClick={()=>window.print()}>طباعة / حفظ PDF</button>
                  {centerReport&&<button onClick={()=>downloadCsv('center-report.csv',[
                    ['الفترة','الطلاب النشطون','الحلقات','الحضور','الغياب','آيات الحفظ الجديد','آيات المراجعة'],
                    [`${centerReport.from} — ${centerReport.to}`,centerReport.students,centerReport.circles,centerReport.attendance?.present||0,centerReport.attendance?.absent||0,centerReport.memorization?.new_ayahs||0,centerReport.memorization?.review_ayahs||0]
                  ])}>تصدير Excel / CSV</button>}
                </div>
                <form className="noPrint">{admin&&centerPick}{input('from','من تاريخ','date',false)}{input('to','إلى تاريخ','date',false)}</form>
                {centerReport&&<><div className="stats"><article><b>{centerReport.students}</b><span>الطلاب النشطون</span></article><article><b>{centerReport.circles}</b><span>الحلقات</span></article><article><b>{centerReport.attendance?.present||0}</b><span>حضور</span></article><article><b>{centerReport.attendance?.absent||0}</b><span>غياب</span></article></div><Table heads={['الفترة','آيات الحفظ الجديد','آيات المراجعة']} rows={[[`${centerReport.from} — ${centerReport.to}`,centerReport.memorization?.new_ayahs||0,centerReport.memorization?.review_ayahs||0]]}/></>}
              </section>
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
                    <button className="primary noPrint" onClick={()=>downloadCsv(`student-${report.student.full_name}.csv`,[
                      ['التاريخ','النوع','السورة','من آية','إلى آية','الدرجة','الملاحظات'],
                      ...report.memorization.map((m:Row)=>[String(m.record_date).slice(0,10),recordTypes[m.record_type],surahNames[Number(m.surah_no)-1]||'',m.from_ayah,m.to_ayah,m.grade??'',m.notes||''])
                    ])}>تصدير Excel / CSV</button>
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
                        surahNames[Number(m.surah_no) - 1] || '—',
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
            {panel === 'الأخبار والفعاليات' && ['system_admin','center_manager','supervisor'].includes(account.role) && (
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
                    <h3>{n.title}</h3><p>{n.body}</p>
                    <button onClick={()=>setForm({news_id:n.id,title:n.title,body:n.body,kind:n.kind||'news'})}>تعديل</button>
                  </article>
                ))}
                {form.news_id&&<button className="primary" disabled={busy} onClick={()=>run(async()=>{await api.put(`/api/news/${form.news_id}`,{title:form.title,body:form.body,kind:form.kind||'news',status:'published'});setNews(await get('/api/news'));setForm({})},'تم تحديث الخبر')}>حفظ تعديل الخبر</button>}
              </section>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
