import type { Firestore } from 'firebase-admin/firestore';
import type { Auth, UserRecord } from 'firebase-admin/auth';

/**
 * Resumen para el panel de administración (/admin).
 * Lee con Admin SDK: usuarios de Firebase Auth, users, entitlements, payments, applications,
 * stats_daily (visitas sin cookies) y meta/convocatoriasSync.
 * Pensado para el volumen actual (cientos/miles de documentos); si crece mucho, conviene
 * precalcular agregados.
 */

export const TRACKED_PAGES = [
  'inicio',
  'convocatorias',
  'fondos',
  'mis-postulaciones',
  'postulacion',
  'mi-empresa',
  'pago',
  'terminos',
  'privacidad',
  'otra'
] as const;
export type TrackedPage = (typeof TRACKED_PAGES)[number];

const PAGE_LABELS: Record<string, string> = {
  inicio: 'Inicio',
  convocatorias: 'Convocatorias',
  fondos: 'Catálogo de fondos',
  'mis-postulaciones': 'Mis postulaciones',
  postulacion: 'Postulación (espacio de trabajo)',
  'mi-empresa': 'Mi empresa',
  pago: 'Resultado del pago',
  terminos: 'Términos y Condiciones',
  privacidad: 'Política de Privacidad',
  otra: 'Otras'
};

export function chileDayKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

function lastNDayKeys(n: number, now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(chileDayKey(new Date(now.getTime() - i * 864e5)));
  }
  // Evita duplicados por cambio de horario
  return Array.from(new Set(keys));
}

function toIso(v: any): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  return null;
}

export async function buildAdminSummary(
  db: Firestore,
  auth: Auth,
  opts: { emailConfigured: boolean; mercadoPagoConfigured: boolean }
) {
  const now = new Date();
  const days30 = lastNDayKeys(30, now);
  const days7 = new Set(days30.slice(-7));
  const days30Set = new Set(days30);
  const monthKey = chileDayKey(now).slice(0, 7);

  // 1. Usuarios de Firebase Auth (si la cuenta de servicio no tiene permiso de Authentication,
  //    se usan los perfiles users/{uid}: correo y fecha de creación del documento)
  let authUsers: UserRecord[] = [];
  let authListAvailable = true;
  try {
    let pageToken: string | undefined;
    do {
      const page = await auth.listUsers(1000, pageToken);
      authUsers.push(...page.users);
      pageToken = page.pageToken;
    } while (pageToken && authUsers.length < 20000);
  } catch (e: any) {
    authListAvailable = false;
    authUsers = [];
    console.warn('[admin] listUsers sin permiso; se usan los perfiles de Firestore:', e?.code || e?.message);
  }

  const [usersSnap, entSnap, paySnap, appsSnap, statsSnap, syncDoc] = await Promise.all([
    db.collection('users').get(),
    db.collection('entitlements').get(),
    db.collection('payments').get(),
    db.collection('applications').select('ownerId', 'fundName', 'fundId').get(),
    db.collection('stats_daily').where('date', '>=', days30[0]).get(),
    db.collection('meta').doc('convocatoriasSync').get()
  ]);

  if (!authListAvailable) {
    authUsers = usersSnap.docs.map(d => {
      const x = d.data();
      const created = d.createTime ? d.createTime.toDate().toUTCString() : undefined;
      return {
        uid: d.id,
        email: x.email || '',
        displayName: x.displayName || '',
        metadata: { creationTime: created, lastSignInTime: undefined },
        providerData: []
      } as unknown as UserRecord;
    });
  }

  const profileByUid = new Map<string, { companyName: string; displayName: string }>();
  usersSnap.docs.forEach(d => {
    const x = d.data();
    profileByUid.set(d.id, { companyName: x.companyName || '', displayName: x.displayName || '' });
  });
  const emailByUid = new Map<string, string>();
  authUsers.forEach(u => emailByUid.set(u.uid, u.email || ''));

  // 2. Planes
  const activePlans: any[] = [];
  const activeUids = new Set<string>();
  entSnap.docs.forEach(d => {
    const e = d.data();
    const exp = e.expiresAt ? new Date(e.expiresAt) : null;
    // Solo planes pagados: el acceso temporal de la prueba de lanzamiento no cuenta
    if (e.status === 'active' && !e.provisional && exp && !isNaN(exp.getTime()) && exp.getTime() > now.getTime()) {
      activeUids.add(d.id);
      activePlans.push({
        uid: d.id,
        email: emailByUid.get(d.id) || '',
        companyName: profileByUid.get(d.id)?.companyName || '',
        expiresAt: exp.toISOString(),
        daysLeft: Math.ceil((exp.getTime() - now.getTime()) / 864e5),
        serviceStarted: Boolean(e.lastPaymentId && e.serviceStartedForPaymentId === String(e.lastPaymentId)),
        freePass: e.freePass === true
      });
    }
  });
  activePlans.sort((a, b) => a.daysLeft - b.daysLeft);

  // 3. Pagos
  const payments = paySnap.docs.map(d => {
    const p = d.data();
    const date = toIso(p.approvedAt) || toIso(p.rejectedAt) || toIso(p.createdAt) || (d.createTime ? d.createTime.toDate().toISOString() : null);
    const amount = Number(p.amount) || 0;
    return {
      id: d.id,
      uid: p.uid || '',
      email: emailByUid.get(p.uid) || '',
      companyName: profileByUid.get(p.uid)?.companyName || '',
      amount,
      status: p.status || 'desconocido',
      kind: p.sellerCode ? `Primera compra · código ${p.sellerCode}` : amount === 19990 ? 'Primera compra' : amount === 39990 ? 'Renovación' : 'Otro monto',
      date,
      day: date ? chileDayKey(new Date(date)) : null,
      serviceStarted: Boolean(p.serviceStartedAt)
    };
  });
  payments.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const approved = payments.filter(p => p.status === 'approved');
  const revenueTotal = approved.reduce((s, p) => s + p.amount, 0);
  const revenueThisMonth = approved.filter(p => p.day && p.day.startsWith(monthKey)).reduce((s, p) => s + p.amount, 0);

  // 4. Postulaciones
  const appsByOwner = new Map<string, number>();
  const appsByFund = new Map<string, number>();
  const appsByDay = new Map<string, number>();
  appsSnap.docs.forEach(d => {
    const a = d.data();
    if (a.ownerId) appsByOwner.set(a.ownerId, (appsByOwner.get(a.ownerId) || 0) + 1);
    const fund = a.fundName || a.fundId || 'Sin nombre';
    appsByFund.set(fund, (appsByFund.get(fund) || 0) + 1);
    if (d.createTime) {
      const k = chileDayKey(d.createTime.toDate());
      appsByDay.set(k, (appsByDay.get(k) || 0) + 1);
    }
  });
  const fundsTop = Array.from(appsByFund.entries())
    .map(([fundName, count]) => ({ fundName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 5. Registros por día
  const signupsByDay = new Map<string, number>();
  authUsers.forEach(u => {
    const created = u.metadata.creationTime ? new Date(u.metadata.creationTime) : null;
    if (created && !isNaN(created.getTime())) {
      const k = chileDayKey(created);
      signupsByDay.set(k, (signupsByDay.get(k) || 0) + 1);
    }
  });

  // 6. Visitas (stats_daily)
  const statsByDay = new Map<string, any>();
  statsSnap.docs.forEach(d => statsByDay.set(d.id, d.data()));
  const pagesTotals = new Map<string, number>();
  days30.forEach(k => {
    const pages = statsByDay.get(k)?.pages || {};
    Object.entries(pages).forEach(([page, n]) => pagesTotals.set(page, (pagesTotals.get(page) || 0) + (Number(n) || 0)));
  });

  const purchasesByDay = new Map<string, { count: number; revenue: number }>();
  approved.forEach(p => {
    if (!p.day) return;
    const cur = purchasesByDay.get(p.day) || { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += p.amount;
    purchasesByDay.set(p.day, cur);
  });

  const series30d = days30.map(date => ({
    date,
    views: Number(statsByDay.get(date)?.views) || 0,
    visitors: Number(statsByDay.get(date)?.visitors) || 0,
    signups: signupsByDay.get(date) || 0,
    purchases: purchasesByDay.get(date)?.count || 0,
    revenue: purchasesByDay.get(date)?.revenue || 0,
    applications: appsByDay.get(date) || 0
  }));
  const sum = (key: keyof (typeof series30d)[number], set?: Set<string>) =>
    series30d.filter(d => !set || set.has(d.date)).reduce((s, d) => s + (Number(d[key]) || 0), 0);

  // 7. Usuarios recientes
  const users = authUsers
    .map(u => ({
      uid: u.uid,
      email: u.email || '',
      companyName: profileByUid.get(u.uid)?.companyName || '',
      displayName: profileByUid.get(u.uid)?.displayName || u.displayName || '',
      createdAt: u.metadata.creationTime ? new Date(u.metadata.creationTime).toISOString() : null,
      lastSignInAt: u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).toISOString() : null,
      provider: !authListAvailable ? '—' : u.providerData.some(p => p.providerId === 'google.com') ? 'Google' : 'Correo',
      hasActivePlan: activeUids.has(u.uid),
      applications: appsByOwner.get(u.uid) || 0
    }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 100);

  const sync = syncDoc.exists ? syncDoc.data() : null;

  return {
    generatedAt: now.toISOString(),
    kpis: {
      revenueTotal,
      revenueThisMonth,
      approvedPayments: approved.length,
      activePlans: activePlans.length,
      expiringIn7d: activePlans.filter(p => p.daysLeft <= 7).length,
      totalUsers: authUsers.length,
      newUsers7d: sum('signups', days7),
      newUsers30d: sum('signups', days30Set),
      totalApplications: appsSnap.size,
      views7d: sum('views', days7),
      visitors7d: sum('visitors', days7)
    },
    funnel30d: {
      visitors: sum('visitors'),
      signups: sum('signups'),
      purchases: sum('purchases')
    },
    series30d,
    topPages30d: Array.from(pagesTotals.entries())
      .map(([page, views]) => ({ page, label: PAGE_LABELS[page] || page, views }))
      .sort((a, b) => b.views - a.views),
    payments: payments.slice(0, 50).map(({ day, ...p }) => p),
    activePlans,
    users,
    fundsTop,
    system: {
      lastConvocatoriasSyncAt: sync?.lastSyncAt || null,
      convocatoriasVigentes: typeof sync?.totalVigentes === 'number' ? sync.totalVigentes : null,
      emailConfigured: opts.emailConfigured,
      mercadoPagoConfigured: opts.mercadoPagoConfigured,
      authListAvailable
    }
  };
}

export type AdminSummary = Awaited<ReturnType<typeof buildAdminSummary>>;
