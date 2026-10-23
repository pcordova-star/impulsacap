import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldAlert, CheckCircle2, AlertTriangle, LogIn } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';
import { auth } from '../firebase';
import { requestLogin } from '../utils/authEvents';

/* Tipos del resumen que entrega GET /api/admin/resumen (server/adminStats.ts) */
interface SeriesPoint { date: string; views: number; visitors: number; signups: number; purchases: number; revenue: number; applications: number }
interface Summary {
  generatedAt: string;
  kpis: {
    revenueTotal: number; revenueThisMonth: number; approvedPayments: number;
    activePlans: number; expiringIn7d: number;
    totalUsers: number; newUsers7d: number; newUsers30d: number;
    totalApplications: number; views7d: number; visitors7d: number;
  };
  funnel30d: { visitors: number; signups: number; purchases: number };
  series30d: SeriesPoint[];
  topPages30d: { page: string; label: string; views: number }[];
  payments: { id: string; email: string; companyName: string; amount: number; status: string; kind: string; date: string | null; serviceStarted: boolean }[];
  activePlans: { uid: string; email: string; companyName: string; expiresAt: string; daysLeft: number; serviceStarted: boolean; freePass?: boolean }[];
  users: { uid: string; email: string; companyName: string; displayName: string; createdAt: string | null; lastSignInAt: string | null; provider: string; hasActivePlan: boolean; applications: number }[];
  fundsTop: { fundName: string; count: number }[];
  system: { lastConvocatoriasSyncAt: string | null; convocatoriasVigentes: number | null; emailConfigured: boolean; mercadoPagoConfigured: boolean; flowConfigured?: boolean; paymentProvider?: string; authListAvailable?: boolean };
}

const clp = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;
const num = (n: number) => n.toLocaleString('es-CL');
const fmtDate = (iso: string | null, withTime = false) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CL', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' }
    : { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Santiago' });
};
const dayLabel = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
};
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : '—');

/* -------------------------------------------------------------------------- */

const Card: React.FC<{ title?: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, subtitle, right, children, className = '' }) => (
  <section className={`rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 min-w-0 ${className}`}>
    {(title || right) && (
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          {title && <h2 className="text-base font-bold text-slate-900">{title}</h2>}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
    )}
    {children}
  </section>
);

const Kpi: React.FC<{ label: string; value: string; detail: string }> = ({ label, value, detail }) => (
  <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 min-w-0">
    <p className="text-sm text-slate-600">{label}</p>
    <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 tabular-nums">{value}</p>
    <p className="text-xs text-slate-500 mt-1">{detail}</p>
  </div>
);

type Metric = 'views' | 'visitors' | 'signups' | 'purchases' | 'revenue';
const METRICS: { key: Metric; label: string; format: (n: number) => string }[] = [
  { key: 'views', label: 'Visitas', format: num },
  { key: 'visitors', label: 'Visitantes', format: num },
  { key: 'signups', label: 'Registros', format: num },
  { key: 'purchases', label: 'Compras', format: num },
  { key: 'revenue', label: 'Ingresos', format: clp }
];

/** Barras de una sola serie para los últimos 30 días, con tooltip al pasar o enfocar. */
const DailyBars: React.FC<{ data: SeriesPoint[]; metric: Metric }> = ({ data, metric }) => {
  const [hover, setHover] = useState<number | null>(null);
  const meta = METRICS.find(m => m.key === metric)!;
  const values = data.map(d => Number(d[metric]) || 0);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm min-h-[1.5rem]">
        <p className="text-slate-600">
          Total 30 días: <strong className="text-slate-900 tabular-nums">{meta.format(total)}</strong>
        </p>
        <p className="text-slate-600" aria-live="polite">
          {h ? (
            <>{dayLabel(h.date)}: <strong className="text-slate-900 tabular-nums">{meta.format(Number(h[metric]) || 0)}</strong></>
          ) : (
            <>Máximo diario: <span className="tabular-nums">{meta.format(Math.max(...values, 0))}</span></>
          )}
        </p>
      </div>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-slate-200" aria-hidden="true" />
        <div className="flex items-end gap-[2px] h-44 border-b border-slate-300" onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => {
            const v = values[i];
            return (
              <button
                key={d.date}
                type="button"
                aria-label={`${dayLabel(d.date)}: ${meta.format(v)}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => setHover(i)}
                className="flex-1 h-full flex items-end cursor-default focus-visible:outline-none group"
              >
                <span
                  className={`w-full rounded-t-[4px] transition-colors ${hover === i ? 'bg-blue-800' : 'bg-blue-600'} group-focus-visible:ring-2 group-focus-visible:ring-blue-400`}
                  style={{ height: v > 0 ? `${Math.max(3, (v / max) * 100)}%` : '0%' }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>{dayLabel(data[0]?.date || '')}</span>
        <span>{dayLabel(data[Math.floor(data.length / 2)]?.date || '')}</span>
        <span>Hoy</span>
      </div>
      {/* Versión en tabla para lectores de pantalla */}
      <table className="sr-only">
        <caption>{meta.label} por día, últimos 30 días</caption>
        <tbody>{data.map((d, i) => <tr key={d.date}><td>{d.date}</td><td>{values[i]}</td></tr>)}</tbody>
      </table>
    </div>
  );
};

/** Barras horizontales de una sola serie (embudo, páginas, fondos). */
const HBars: React.FC<{ rows: { label: string; value: number; note?: string }[]; format?: (n: number) => string }> = ({ rows, format = num }) => {
  const max = Math.max(1, ...rows.map(r => r.value));
  if (rows.length === 0) return <p className="text-sm text-slate-500">Aún no hay datos.</p>;
  return (
    <ul className="space-y-3">
      {rows.map(r => (
        <li key={r.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-700 truncate">{r.label}</span>
            <span className="text-slate-900 font-semibold tabular-nums shrink-0">
              {format(r.value)}{r.note && <span className="text-slate-500 font-normal"> · {r.note}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

const Table: React.FC<{ headers: string[]; children: React.ReactNode; empty?: boolean }> = ({ headers, children, empty }) => (
  <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
    {empty ? (
      <p className="text-sm text-slate-500">Aún no hay datos.</p>
    ) : (
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
            {headers.map(h => <th key={h} className="py-2 pr-4 font-semibold whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    )}
  </div>
);

const Status: React.FC<{ ok: boolean; okText: string; badText: string }> = ({ ok, okText, badText }) => (
  <span className={`inline-flex items-center gap-1.5 ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
    {ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
    {ok ? okText : badText}
  </span>
);

/* -------------------------------------------------------------------------- */

interface Ticket {
  id: string; ticketId: string; createdAt: string; status: 'abierto' | 'resuelto';
  email: string; name?: string; message: string; page?: string; hasPlan?: boolean;
  conversation?: { role: 'user' | 'bot'; text: string }[];
}

interface Intent {
  uid: string; email: string; companyName?: string; price: number; createdAt: string;
  status: 'acceso_anticipado' | 'pagado'; accessUntil?: string; notifiedAt?: string | null; paymentDeadline?: string; paidAt?: string | null;
}

/** Inscritos en acceso anticipado (contrataron mientras el pago en línea no estaba habilitado). */
const EarlyAccessPanel: React.FC = () => {
  const [data, setData] = useState<{ paymentsEnabled: boolean; intents: Intent[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const loadIntents = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/acceso-anticipado');
      const body = await res.json().catch(() => ({}));
      if (res.ok) setData(body);
    } catch { /* sin efecto */ }
  }, []);
  useEffect(() => { loadIntents(); }, [loadIntents]);

  if (!data || data.intents.length === 0) return null;
  const pending = data.intents.filter(i => i.status === 'acceso_anticipado');
  const toNotify = pending.filter(i => !i.notifiedAt);

  const notify = async () => {
    if (!confirm(`Se enviará un correo invitando a contratar el Plan Trimestral a ${toNotify.length} ${toNotify.length === 1 ? 'persona' : 'personas'}. ¿Continuar?`)) return;
    setSending(true);
    setMsg(null);
    try {
      const res = await apiFetch('/api/admin/acceso-anticipado/avisar', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      setMsg(res.ok ? `Invitación enviada a ${body.avisados} ${body.avisados === 1 ? 'persona' : 'personas'}.` : body.error || 'No se pudo enviar el aviso.');
      await loadIntents();
    } finally {
      setSending(false);
    }
  };

  return (
    <Card
      title="Usuarios de la prueba de lanzamiento"
      subtitle={`La prueba gratis ya no existe y su acceso no habilita herramientas. ${pending.length} no han contratado · ${data.intents.length - pending.length} contrataron.`}
      right={toNotify.length > 0 ? (
        <button type="button" onClick={notify} disabled={sending} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60">
          {sending ? 'Enviando…' : `Invitar a contratar (${toNotify.length})`}
        </button>
      ) : undefined}
    >
      {msg && <p className="text-sm text-slate-800 mb-3">{msg}</p>}
      <Table headers={['Usó la prueba', 'Cliente', 'Su precio', 'Estado', 'Invitado el']} empty={data.intents.length === 0}>
        {data.intents.map(i => (
          <tr key={i.uid}>
            <td className="py-2.5 pr-4 whitespace-nowrap text-slate-600">{fmtDate(i.createdAt)}</td>
            <td className="py-2.5 pr-4"><div className="text-slate-900">{i.companyName || '—'}</div><div className="text-xs text-slate-500">{i.email}</div></td>
            <td className="py-2.5 pr-4 tabular-nums">{clp(i.price)}</td>
            <td className="py-2.5 pr-4 whitespace-nowrap">
              {i.status === 'pagado' ? <span className="text-emerald-700 font-semibold">Contrató</span> : i.notifiedAt ? 'Invitado, sin contratar' : 'Sin invitar'}
            </td>
            <td className="py-2.5 pr-4 whitespace-nowrap text-slate-600">{fmtDate(i.notifiedAt || null)}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
};

/** Bandeja de solicitudes de soporte creadas desde el asistente de ayuda. */
const SupportInbox: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'abierto' | 'todos'>('abierto');
  const [busy, setBusy] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/soporte');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudieron cargar las solicitudes.');
      setTickets(body.tickets || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar las solicitudes.');
    }
  }, []);
  useEffect(() => { loadTickets(); }, [loadTickets]);

  const setStatus = async (t: Ticket, status: 'abierto' | 'resuelto') => {
    setBusy(t.id);
    try {
      const res = await apiFetch(`/api/admin/soporte/${t.id}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) setTickets(prev => (prev || []).map(x => (x.id === t.id ? { ...x, status } : x)));
    } finally {
      setBusy(null);
    }
  };

  const open = (tickets || []).filter(t => t.status !== 'resuelto');
  const shown = filter === 'abierto' ? open : (tickets || []);

  return (
    <Card
      title="Soporte"
      subtitle={tickets ? `${open.length} ${open.length === 1 ? 'solicitud abierta' : 'solicitudes abiertas'}` : 'Cargando…'}
      right={
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {(['abierto', 'todos'] as const).map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
              {f === 'abierto' ? 'Abiertas' : 'Todas'}
            </button>
          ))}
        </div>
      }
    >
      {error && <p className="text-sm text-rose-700">{error}</p>}
      {tickets && shown.length === 0 && <p className="text-sm text-slate-500">{filter === 'abierto' ? 'No hay solicitudes abiertas.' : 'Aún no hay solicitudes.'}</p>}
      <ul className="divide-y divide-slate-100">
        {shown.map(t => (
          <li key={t.id} className="py-3 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-mono text-xs text-slate-500">#{t.ticketId}</span>
              <span className="font-semibold text-slate-900 break-all">{t.email}</span>
              <span className="text-xs text-slate-500">{fmtDate(t.createdAt, true)}</span>
              {t.hasPlan && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">Con plan</span>}
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${t.status === 'resuelto' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                {t.status === 'resuelto' ? 'Resuelta' : 'Abierta'}
              </span>
            </div>
            <p className="text-sm text-slate-800 whitespace-pre-line">{t.message}</p>
            {t.conversation && t.conversation.length > 0 && (
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer text-slate-500">Ver conversación con el asistente ({t.conversation.length})</summary>
                <div className="mt-2 space-y-1 pl-3 border-l-2 border-slate-200">
                  {t.conversation.map((m, i) => <p key={i}><strong>{m.role === 'user' ? 'Cliente' : 'Asistente'}:</strong> {m.text}</p>)}
                </div>
              </details>
            )}
            <div className="flex flex-wrap gap-2">
              <a
                href={`mailto:${t.email}?subject=${encodeURIComponent(`Re: Tu consulta #${t.ticketId}`)}&body=${encodeURIComponent(`Hola,\n\n\n\n---\nTu consulta:\n${t.message}`)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
              >
                Responder por correo
              </a>
              <button
                type="button"
                disabled={busy === t.id}
                onClick={() => setStatus(t, t.status === 'resuelto' ? 'abierto' : 'resuelto')}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
              >
                {t.status === 'resuelto' ? 'Reabrir' : 'Marcar como resuelta'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};


/* -------------------------------------------------------------------------- */
/* Vendedores: códigos, descuentos y comisiones                               */

interface SellerRow {
  code: string; name: string; email: string; discountPct: number; commissionPct: number; active: boolean; price: number;
  salesCount: number; revenue: number; commissionPending: number; commissionPaid: number; trialsCount: number;
  commissionPayable?: number; commissionInRetracto?: number; commissionToRecover?: number;
}
interface SellerSale { paymentId: string; code: string; companyName?: string; buyerEmail?: string; amount: number; commission: number; status: string; createdAt: string; paidAt?: string | null }
interface SellersData { appUrl: string; sellers: SellerRow[]; sales: SellerSale[]; limits: { maxDiscountPct: number; maxCommissionPct: number; priceFull: number; priceFirst: number } }

const emptyForm = { code: '', name: '', email: '', discountPct: '50', commissionPct: '20', active: true };

const SellersPanel: React.FC = () => {
  const [data, setData] = useState<SellersData | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmPay, setConfirmPay] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/vendedores');
      const body = await res.json().catch(() => ({}));
      if (res.ok) setData(body);
    } catch { /* sin efecto */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const priceFull = data?.limits.priceFull ?? 39990;
  const d = Number(form.discountPct);
  const c = Number(form.commissionPct);
  const previewPrice = Number.isFinite(d) ? Math.floor((priceFull * (1 - Math.min(90, Math.max(0, d)) / 100)) / 10) * 10 : 0;
  const previewCommission = Number.isFinite(c) ? Math.round(previewPrice * c / 100) : 0;

  const save = async (override?: Partial<typeof emptyForm> & { code: string }) => {
    setBusy(true);
    setMsg(null);
    const payload = override
      ? { ...override }
      : { ...form, discountPct: Number(form.discountPct), commissionPct: Number(form.commissionPct), isNew: !editing };
    try {
      const res = await apiFetch('/api/admin/vendedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, text: body.error || 'No se pudo guardar.' }); return; }
      if (!override) {
        setMsg({ ok: true, text: `Vendedor ${body.code} guardado. Comparte con él su link y el panel ${data?.appUrl || ''}/vendedor.` });
        setForm(emptyForm);
        setEditing(null);
        setShowForm(false);
      }
      await load();
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'No se pudo guardar.' });
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (code: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch(`/api/admin/vendedores/${encodeURIComponent(code)}/pagar`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      setMsg(res.ok ? { ok: true, text: `${body.count} comisiones de ${code} marcadas como pagadas (${clp(body.total || 0)}).` } : { ok: false, text: body.error || 'No se pudo marcar.' });
      await load();
    } finally {
      setBusy(false);
      setConfirmPay(null);
    }
  };

  const startEdit = (s: SellerRow) => {
    setEditing(s.code);
    setForm({ code: s.code, name: s.name, email: s.email, discountPct: String(s.discountPct), commissionPct: String(s.commissionPct), active: s.active });
    setShowForm(true);
    setMsg(null);
  };

  const input = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-blue-500';
  const totalPending = data?.sellers.reduce((a, s) => a + (s.commissionPayable || 0), 0) || 0;

  return (
    <Card
      title="Vendedores"
      subtitle={`Códigos para la primera compra. El descuento reemplaza al 50% de primera compra; la comisión se calcula sobre lo pagado y se puede pagar pasados 10 días (plazo de retracto).${totalPending ? ` Comisiones por pagar: ${clp(totalPending)}.` : ''}`}
      right={!showForm ? (
        <button type="button" onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); setMsg(null); }} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold cursor-pointer">
          Nuevo vendedor
        </button>
      ) : undefined}
    >
      {showForm && (
        <form onSubmit={e => { e.preventDefault(); save(); }} className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <p className="text-sm font-bold text-slate-900">{editing ? `Editar ${editing}` : 'Nuevo vendedor'}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600 space-y-1">Nombre
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={input} />
            </label>
            <label className="text-xs font-semibold text-slate-600 space-y-1">Correo (con este entra a su panel)
              <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={input} />
            </label>
            <label className="text-xs font-semibold text-slate-600 space-y-1">Código
              <input required disabled={Boolean(editing)} value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 20) })} placeholder="JUAN20" className={`${input} font-mono uppercase disabled:bg-slate-100`} />
            </label>
            <label className="text-xs font-semibold text-slate-600 space-y-1">Descuento al cliente (%)
              <input required type="number" min={0} max={data?.limits.maxDiscountPct ?? 90} step="0.5" value={form.discountPct} onChange={e => setForm({ ...form, discountPct: e.target.value })} className={input} />
            </label>
            <label className="text-xs font-semibold text-slate-600 space-y-1">Comisión del vendedor (%)
              <input required type="number" min={0} max={data?.limits.maxCommissionPct ?? 80} step="0.5" value={form.commissionPct} onChange={e => setForm({ ...form, commissionPct: e.target.value })} className={input} />
            </label>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-2 pt-5">
              <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Código activo
            </label>
          </div>
          <p className="text-xs text-slate-600">
            El cliente paga <strong>{clp(previewPrice)}</strong> su primer trimestre y el vendedor gana <strong>{clp(previewCommission)}</strong> por venta.
            {previewPrice > (data?.limits.priceFirst ?? 19990) && <span className="text-amber-700"> Ojo: es más caro que el 50% de primera compra sin código ({clp(data?.limits.priceFirst ?? 19990)}).</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-bold cursor-pointer disabled:opacity-60">{busy ? 'Guardando…' : 'Guardar'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-bold cursor-pointer">Cancelar</button>
          </div>
        </form>
      )}

      {msg && <p role="status" className={`mb-4 text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}

      <Table headers={['Vendedor', 'Código', 'Precio cliente', 'Comisión', 'Ventas', 'Por pagar', 'Pagado', '']} empty={!data || data.sellers.length === 0}>
        {data?.sellers.map(s => (
          <tr key={s.code} className="align-top">
            <td className="py-2.5 pr-4"><div className="text-slate-900">{s.name}</div><div className="text-xs text-slate-500">{s.email}</div></td>
            <td className="py-2.5 pr-4 font-mono font-bold">{s.code}{!s.active && <div className="text-[11px] font-sans font-semibold text-amber-700">Pausado</div>}</td>
            <td className="py-2.5 pr-4 tabular-nums whitespace-nowrap">{clp(s.price)} <span className="text-xs text-slate-500">({s.discountPct}%)</span></td>
            <td className="py-2.5 pr-4 tabular-nums">{s.commissionPct}%</td>
            <td className="py-2.5 pr-4 tabular-nums">{s.salesCount}<div className="text-xs text-slate-500">{clp(s.revenue)}</div></td>
            <td className="py-2.5 pr-4 tabular-nums">
              <div className="font-semibold text-amber-700">{clp(s.commissionPayable || 0)}</div>
              {(s.commissionInRetracto || 0) > 0 && <div className="text-[11px] text-slate-500">+{clp(s.commissionInRetracto || 0)} en retracto</div>}
              {(s.commissionToRecover || 0) > 0 && <div className="text-[11px] text-rose-700">Descontar {clp(s.commissionToRecover || 0)}</div>}
            </td>
            <td className="py-2.5 pr-4 tabular-nums text-emerald-700">{clp(s.commissionPaid)}</td>
            <td className="py-2.5 pr-0">
              <div className="flex flex-wrap gap-1.5 justify-end">
                <button type="button" onClick={() => { try { navigator.clipboard.writeText(`${data.appUrl}/?ref=${s.code}`); setMsg({ ok: true, text: `Link de ${s.code} copiado: ${data.appUrl}/?ref=${s.code}` }); } catch { /* sin portapapeles */ } }} className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold cursor-pointer">Copiar link</button>
                <button type="button" onClick={() => startEdit(s)} className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold cursor-pointer">Editar</button>
                <button type="button" disabled={busy} onClick={() => save({ code: s.code, name: s.name, email: s.email, discountPct: s.discountPct as any, commissionPct: s.commissionPct as any, active: !s.active })} className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold cursor-pointer disabled:opacity-60">{s.active ? 'Pausar' : 'Activar'}</button>
                {(s.commissionPayable || 0) > 0 && (confirmPay === s.code ? (
                  <button type="button" disabled={busy} onClick={() => markPaid(s.code)} className="px-2.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60">Confirmar pago de {clp(s.commissionPayable || 0)}</button>
                ) : (
                  <button type="button" onClick={() => setConfirmPay(s.code)} className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">Marcar pagado</button>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </Table>

      {data && data.sales.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Ventas con código</h3>
          <Table headers={['Fecha', 'Código', 'Cliente', 'Venta', 'Comisión', 'Estado']}>
            {data.sales.slice(0, 50).map(v => (
              <tr key={v.paymentId}>
                <td className="py-2.5 pr-4 whitespace-nowrap text-slate-600">{fmtDate(v.createdAt, true)}</td>
                <td className="py-2.5 pr-4 font-mono">{v.code}</td>
                <td className="py-2.5 pr-4"><div className="text-slate-900">{v.companyName || '—'}</div><div className="text-xs text-slate-500">{v.buyerEmail}</div></td>
                <td className="py-2.5 pr-4 tabular-nums">{clp(v.amount)}</td>
                <td className="py-2.5 pr-4 tabular-nums font-semibold">{clp(v.commission)}</td>
                <td className="py-2.5 pr-4 whitespace-nowrap">{v.status === 'pagada' ? <span className="text-emerald-700">Pagada {fmtDate(v.paidAt || null)}</span>
                  : v.status === 'anulada' ? <span className="text-slate-500">Anulada (devolución)</span>
                  : v.status === 'pagada_anulada' ? <span className="text-rose-700">Devuelta: descontar</span>
                  : Date.now() - new Date(v.createdAt).getTime() < 10 * 864e5 ? <span className="text-slate-500">En retracto hasta {fmtDate(new Date(new Date(v.createdAt).getTime() + 10 * 864e5).toISOString())}</span>
                  : <span className="text-amber-700">Por pagar</span>}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </Card>
  );
};


/** Prueba en vivo de la IA: muestra el error real de Gemini si falla. */
const AiStatus: React.FC = () => {
  const [r, setR] = useState<{ ok: boolean; model: string; key: string; ms: number; status?: number | null; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async () => {
    setBusy(true);
    try {
      const res = await Promise.race([
        apiFetch('/api/admin/diagnostico-ia'),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('La prueba tardó más de 60 segundos: Gemini está lento o saturado.')), 60000))
      ]);
      setR(await res.json());
    } catch (e: any) {
      setR({ ok: false, model: '', key: '', ms: 0, error: e?.message || 'No se pudo probar' });
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { run(); }, [run]);
  return (
    <div className="space-y-1">
      {!r ? <span className="text-slate-500">Probando…</span> : (
        <Status ok={r.ok} okText={`Responde (${r.model}, ${r.ms} ms)`} badText={`No responde${r.status ? ` (error ${r.status})` : ''}`} />
      )}
      {r && !r.ok && (
        <div className="text-xs text-slate-600 space-y-1">
          <p>Clave GEMINI_API_KEY: {r.key}</p>
          {r.error && <p className="font-mono break-words bg-slate-50 border border-slate-200 rounded p-2">{r.error}</p>}
        </div>
      )}
      {r && (
        <button type="button" onClick={run} disabled={busy} className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer disabled:opacity-60">
          {busy ? 'Probando…' : 'Probar de nuevo'}
        </button>
      )}
    </div>
  );
};


/** Consumo y costo estimado de la IA (Gemini). */
const AiUsagePanel: React.FC = () => {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/ia-uso');
      const body = await res.json().catch(() => ({}));
      if (res.ok) setD(body); else setErr(body.error || 'No se pudo cargar.');
    } catch (e: any) { setErr(e?.message || 'No se pudo cargar.'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const usd = (n: number) => `US$${(n || 0).toFixed(n < 1 ? 3 : 2)}`;
  if (err) return <Card title="Consumo de IA"><p className="text-sm text-rose-700">{err}</p></Card>;
  if (!d) return <Card title="Consumo de IA"><p className="text-sm text-slate-500">Cargando…</p></Card>;
  const L = d.limits;
  const pctToday = L.dailyBudgetUsd > 0 ? Math.min(100, (d.today.costUsd / L.dailyBudgetUsd) * 100) : 0;
  const maxDay = Math.max(0.0001, ...d.last14.map((x: any) => x.costUsd));
  return (
    <Card
      title="Consumo de IA (costo estimado)"
      subtitle={`Precio usado: US$${L.priceInPerM} por millón de tokens de entrada y US$${L.priceOutPerM} de salida. Ajusta GEMINI_PRECIO_* si Google cambia sus precios.`}
      right={<button type="button" onClick={load} className="text-xs font-bold text-blue-700 hover:underline cursor-pointer">Actualizar</button>}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Hoy</p>
          <p className="text-xl font-black text-slate-900 tabular-nums">{usd(d.today.costUsd)}</p>
          <p className="text-xs text-slate-500">{d.today.calls} llamadas · tope {usd(L.dailyBudgetUsd)}</p>
          <div className="h-1.5 rounded-full bg-slate-200 mt-2 overflow-hidden"><div className={`h-full ${pctToday >= 80 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${pctToday}%` }} /></div>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Este mes</p>
          <p className="text-xl font-black text-slate-900 tabular-nums">{usd(d.month.costUsd)}</p>
          <p className="text-xs text-slate-500">{d.month.calls} llamadas · {d.month.activeUsers} usuarios</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Costo promedio por usuario (mes)</p>
          <p className="text-xl font-black text-slate-900 tabular-nums">{usd(d.month.activeUsers ? d.month.costUsd / d.month.activeUsers : 0)}</p>
          <p className="text-xs text-slate-500">Tope de IA por plan: {usd(L.maxCostPerPeriodUsd.plan)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Créditos diarios por usuario</p>
          <p className="text-sm font-bold text-slate-900">{L.creditsPerDay.plan} por día con plan · sin plan no hay IA de pago</p>
          <p className="text-xs text-slate-500">Asesor 1 · Sección 2 · Documento 2 · Auditoría 4 · Formulación completa 5</p>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold text-slate-700 mb-2">Últimos 14 días</p>
          {d.last14.length === 0 ? <p className="text-sm text-slate-500">Aún no hay consumo registrado.</p> : (
            <ul className="space-y-1.5">
              {d.last14.map((x: any) => (
                <li key={x.day} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-slate-500 tabular-nums">{x.day.slice(5)}</span>
                  <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full bg-blue-500" style={{ width: `${(x.costUsd / maxDay) * 100}%` }} /></span>
                  <span className="w-20 text-right tabular-nums text-slate-700">{usd(x.costUsd)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-bold text-slate-700 mb-2">Usuarios con más consumo este mes</p>
          {d.topUsers.length === 0 ? <p className="text-sm text-slate-500">Sin datos todavía.</p> : (
            <ul className="divide-y divide-slate-100 text-xs">
              {d.topUsers.map((u: any) => (
                <li key={u.uid} className="py-1.5 flex justify-between gap-2">
                  <span className="truncate text-slate-800">{u.email || u.uid}</span>
                  <span className="tabular-nums text-slate-600 shrink-0">{u.calls} llamadas · <strong>{usd(u.costUsd)}</strong></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
};


/** Probar todos los correos y ejecutar los recordatorios desde el panel. */
/** Pase libre: cuentas con el plan completo sin pagar. */
const FreePassPanel: React.FC = () => {
  const [d, setD] = useState<{ fixedCount: number; items: { id: string; email: string; active: boolean; addedAt: string | null }[] } | null>(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/pase-libre');
      const b = await res.json().catch(() => ({}));
      if (res.ok) setD(b); else setMsg(b.error || 'No se pudo cargar.');
    } catch (e: any) { setMsg(e?.message || 'No se pudo cargar.'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const save = async (mail: string, active: boolean) => {
    setMsg(null);
    const res = await apiFetch('/api/admin/pase-libre', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: mail, active }) });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(b.error || 'No se pudo guardar.'); return; }
    if (active) setEmail('');
    setMsg(active ? `Listo: ${mail} tendrá el plan completo al iniciar sesión.` : `Pase libre quitado a ${mail}.`);
    load();
  };
  return (
    <Card title="Pase libre" subtitle="Cuentas con el Plan Trimestral completo sin pagar. Se activa solo cuando la persona inicia sesión con ese correo (dura 1 año y se renueva).">
      <form className="flex flex-wrap gap-2 mb-3" onSubmit={e => { e.preventDefault(); if (email.trim()) save(email.trim(), true); }}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@empresa.cl" className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-slate-300 text-sm" />
        <button type="submit" className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold cursor-pointer">Dar pase libre</button>
      </form>
      {msg && <p className="text-xs text-slate-700 mb-2">{msg}</p>}
      {d && (
        <>
          <p className="text-xs text-slate-500 mb-2">{d.fixedCount} correos con pase libre fijo (configurados en el código).</p>
          {d.items.length > 0 && (
            <ul className="divide-y divide-slate-100 text-sm">
              {d.items.map(i => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                  <span className={i.active ? 'text-slate-900' : 'text-slate-400 line-through'}>{i.email}</span>
                  <button type="button" onClick={() => save(i.email, !i.active)} className="text-xs font-bold text-blue-700 hover:underline cursor-pointer">{i.active ? 'Quitar' : 'Reactivar'}</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
};

const NEWS_TYPES_ADMIN: [string, string][] = [
  ['apertura', 'Convocatoria abierta'], ['cierre', 'Cierre próximo'], ['resultados', 'Resultados'], ['cambio_bases', 'Cambio en las bases'],
  ['presupuesto', 'Presupuesto'], ['politica', 'Anuncio del gobierno'], ['evento', 'Evento o taller'], ['otro', 'Novedad']
];
type AdminNews = { id: string; title: string; summary: string; audience: string; type: string; importance: number; url: string; sourceName: string; outlet?: string | null; originalTitle: string; publishedAt: string | null; fetchedAt: string; kind: string; aiReviewed: boolean; digestSentAt?: string | null };

const NewsRow: React.FC<{ n: AdminNews; estado: string; onDone: () => void }> = ({ n, estado, onDone }) => {
  const [title, setTitle] = useState(n.title);
  const [summary, setSummary] = useState(n.summary);
  const [audience, setAudience] = useState(n.audience);
  const [type, setType] = useState(n.type);
  const [importance, setImportance] = useState(n.importance || 1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = async (accion?: 'aprobar' | 'descartar' | 'pendiente') => {
    setBusy(true); setErr(null);
    try {
      const res = await apiFetch(`/api/admin/novedades/${n.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, title, summary, audience, type, importance }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || 'No se pudo guardar.');
      onDone();
    } catch (e: any) { setErr(e?.message || 'No se pudo guardar.'); } finally { setBusy(false); }
  };
  const date = n.publishedAt || n.fetchedAt;
  return (
    <li className="py-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span className="font-bold text-slate-700">{n.outlet || n.sourceName}</span>
        <span>· {n.kind}</span>
        {date && <span>· {new Date(date).toLocaleDateString('es-CL')}</span>}
        {!n.aiReviewed && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">sin revisión IA</span>}
        {n.digestSentAt && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">ya enviada en boletín</span>}
      </div>
      <p className="text-xs text-slate-500">Original: <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{n.originalTitle}</a></p>
      <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold" />
      <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} placeholder="Resumen con nuestras palabras" className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
      <div className="flex flex-wrap gap-2">
        <input value={audience} onChange={e => setAudience(e.target.value)} placeholder="Le sirve a…" className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-slate-300 text-xs" />
        <select value={type} onChange={e => setType(e.target.value)} className="px-2 py-2 rounded-lg border border-slate-300 text-xs">
          {NEWS_TYPES_ADMIN.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={importance} onChange={e => setImportance(Number(e.target.value))} className="px-2 py-2 rounded-lg border border-slate-300 text-xs">
          <option value={3}>Importante (actuar ya)</option><option value={2}>Útil</option><option value={1}>Contexto</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {estado !== 'aprobada' && <button type="button" disabled={busy} onClick={() => act('aprobar')} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50">Aprobar y publicar</button>}
        {estado === 'aprobada' && <button type="button" disabled={busy} onClick={() => act()} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer disabled:opacity-50">Guardar cambios</button>}
        {estado !== 'descartada' && estado !== 'descartada_ia' && <button type="button" disabled={busy} onClick={() => act('descartar')} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer disabled:opacity-50">Descartar</button>}
        {(estado === 'descartada' || estado === 'descartada_ia' || estado === 'aprobada') && <button type="button" disabled={busy} onClick={() => act('pendiente')} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer disabled:opacity-50">Volver a pendiente</button>}
      </div>
      {err && <p className="text-xs text-rose-700">{err}</p>}
    </li>
  );
};

const NewsPanel: React.FC = () => {
  const [estado, setEstado] = useState('pendiente');
  const [d, setD] = useState<{ items: AdminNews[]; counts: Record<string, number>; sources: any[]; meta: any; weekKey: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/admin/novedades?estado=${estado}`);
      const b = await res.json().catch(() => ({}));
      if (res.ok) setD(b); else setMsg(b.error || 'No se pudo cargar.');
    } catch (e: any) { setMsg(e?.message || 'No se pudo cargar.'); }
  }, [estado]);
  useEffect(() => { load(); }, [load]);
  const run = async (kind: 'collect' | 'test' | 'send') => {
    if (kind === 'send' && !confirm('¿Enviar el boletín de esta semana a todos los usuarios? Solo incluye las novedades aprobadas.')) return;
    setBusy(kind); setMsg(null);
    try {
      const url = kind === 'collect' ? '/api/admin/novedades/recolectar/ahora' : '/api/admin/novedades/boletin/ahora';
      const body = kind === 'collect' ? undefined : JSON.stringify({ prueba: kind === 'test' });
      const res = await apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, timeoutMs: 280000 } as any);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || 'No se pudo completar.');
      setMsg(kind === 'collect'
        ? `Listo: ${b.fuentesOk} de ${b.fuentes} fuentes respondieron, ${b.nuevas} noticias nuevas, ${b.relevantes} relevantes para revisar.`
        : kind === 'test'
          ? `Te enviamos el boletín de prueba (${b.noticias} novedades, ${b.cierres} cierres próximos).`
          : b.omitido ? `No se envió: ${b.omitido}.` : `Boletín enviado a ${b.enviados} personas (${b.errores} errores).`);
      load();
    } catch (e: any) { setMsg(e?.message || 'No se pudo completar.'); } finally { setBusy(null); }
  };
  const tabs: [string, string][] = [['pendiente', 'Por revisar'], ['aprobada', 'Publicadas'], ['descartada_ia', 'Descartadas por la IA'], ['descartada', 'Descartadas por ti']];
  const lastCollect = d?.meta?.lastCollectAt ? new Date(d.meta.lastCollectAt).toLocaleString('es-CL') : 'nunca';
  const sentThisWeek = d?.meta?.lastDigestWeek && d.meta.lastDigestWeek === d.weekKey;
  return (
    <Card
      title="Novedades y boletín"
      subtitle={`Noticias de fondos que se buscan solas cada día. Tú apruebas lo que se publica; el boletín sale los lunes con lo aprobado. Última búsqueda: ${lastCollect}.${sentThisWeek ? ' El boletín de esta semana ya se envió.' : ''}`}
    >
      <div className="flex flex-wrap gap-2 mb-3">
        <button type="button" disabled={!!busy} onClick={() => run('collect')} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer disabled:opacity-50">{busy === 'collect' ? 'Buscando (puede tardar 1 minuto)…' : 'Buscar novedades ahora'}</button>
        <button type="button" disabled={!!busy} onClick={() => run('test')} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs font-bold cursor-pointer disabled:opacity-50">{busy === 'test' ? 'Enviando…' : 'Enviarme el boletín de prueba'}</button>
        <button type="button" disabled={!!busy} onClick={() => run('send')} className="px-3 py-2 rounded-lg border border-emerald-600 text-emerald-700 text-xs font-bold cursor-pointer disabled:opacity-50">{busy === 'send' ? 'Enviando…' : 'Enviar boletín a todos ahora'}</button>
        <button type="button" onClick={() => setShowSources(v => !v)} className="px-3 py-2 rounded-lg text-xs font-bold text-blue-700 hover:underline cursor-pointer">{showSources ? 'Ocultar fuentes' : 'Ver estado de las fuentes'}</button>
      </div>
      {msg && <p className="text-xs text-slate-700 mb-3">{msg}</p>}
      {showSources && d && (
        <ul className="mb-4 text-xs divide-y divide-slate-100 border border-slate-200 rounded-xl">
          {d.sources.length === 0 && <li className="p-2 text-slate-500">Todavía no se ha hecho ninguna búsqueda.</li>}
          {d.sources.map(s => (
            <li key={s.id} className="p-2 flex flex-wrap justify-between gap-2">
              <span className="font-semibold text-slate-800">{s.name}</span>
              <span className={s.ok ? 'text-emerald-700' : 'text-rose-700'}>{s.ok ? `OK · ${s.lastCount} noticias` : `Falla: ${s.lastError || 'sin detalle'}`}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setEstado(id)} className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${estado === id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'}`}>
            {label}{d?.counts?.[id] !== undefined ? ` (${d.counts[id]})` : ''}
          </button>
        ))}
      </div>
      {d && d.items.length === 0 && <p className="text-sm text-slate-500 py-3">No hay novedades en esta lista.</p>}
      {d && <ul className="divide-y divide-slate-100">{d.items.map(n => <NewsRow key={n.id + estado} n={n} estado={estado} onDone={load} />)}</ul>}
    </Card>
  );
};

const EmailTools: React.FC = () => {
  const [busy, setBusy] = useState<'test' | 'rem' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string; items?: { name: string; sent: boolean; error?: string | null }[] } | null>(null);
  const [log, setLog] = useState<{ events: any[]; welcome: any[]; adminEmail?: string | null } | null>(null);
  const [logErr, setLogErr] = useState<string | null>(null);
  const loadLog = useCallback(async () => {
    setLogErr(null);
    try {
      const res = await apiFetch('/api/admin/correos');
      const b = await res.json().catch(() => ({}));
      if (res.ok) setLog(b); else setLogErr(b.error || 'No se pudo leer el registro de correos.');
    } catch (e: any) { setLogErr(e?.message || 'No se pudo leer el registro de correos.'); }
  }, []);
  useEffect(() => { loadLog(); }, [loadLog]);
  const run = async (kind: 'test' | 'rem') => {
    setBusy(kind);
    setResult(null);
    try {
      const res = await apiFetch(kind === 'test' ? '/api/admin/probar-correos' : '/api/admin/recordatorios/ahora', { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) setResult({ ok: false, text: b.error || 'No se pudo completar.' });
      else if (kind === 'test') setResult({ ok: b.ok, text: b.ok ? `Enviados a ${b.to}. Revisa tu bandeja (y spam): deben llegar ${b.results.length} correos que empiezan con [PRUEBA].` : `Algunos correos no salieron (enviados a ${b.to}):`, items: b.results });
      else setResult({ ok: true, text: `Recordatorios: ${b.revisados} planes revisados · ${b.aviso7d} avisos de 7 días · ${b.avisoVencido} avisos de vencimiento · ${b.errores} errores.` });
    } catch (e: any) {
      setResult({ ok: false, text: e?.message || 'No se pudo completar.' });
    } finally {
      setBusy(null);
      loadLog();
    }
  };
  const fmt = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' }); };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy !== null} onClick={() => run('test')} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer disabled:opacity-60">
          {busy === 'test' ? 'Enviando…' : 'Enviarme todos los correos de prueba'}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => run('rem')} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-60">
          {busy === 'rem' ? 'Revisando…' : 'Enviar recordatorios ahora'}
        </button>
      </div>
      {result && (
        <div className={`text-xs ${result.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
          <p>{result.text}</p>
          {result.items && (
            <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
              {result.items.map(i => <li key={i.name}>{i.sent ? '✓' : '✗'} {i.name}{!i.sent && i.error ? <span className="block font-mono text-[11px] text-rose-800">{i.error}</span> : null}</li>)}
            </ul>
          )}
        </div>
      )}
      <p className="text-[11px] text-slate-500">Los recordatorios salen solos cada día a las 9:00 (7 días antes de vencer y el día que vence).</p>
      <details className="text-xs" open={Boolean(log?.events?.some((e: any) => !e.ok))}>
        <summary className="cursor-pointer font-semibold text-slate-700">Últimos correos enviados {log ? `(${log.events.length})` : ''}</summary>
        {logErr && <p className="text-rose-700 mt-1">{logErr}</p>}
        {log && log.events.length === 0 && <p className="text-slate-500 mt-1">Aún no hay envíos registrados (el registro empezó con esta versión).</p>}
        {log && log.events.length > 0 && (
          <ul className="mt-1 space-y-1 max-h-72 overflow-auto">
            {log.events.map((e: any, i: number) => (
              <li key={i} className={e.ok ? 'text-slate-700' : 'text-rose-700'}>
                {e.ok ? '✓' : '✗'} {fmt(e.at)} · {e.subject} · {e.to}
                {!e.ok && e.error && <span className="block font-mono text-[11px]">{e.error}</span>}
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={loadLog} className="mt-1 text-xs font-semibold text-blue-700 hover:underline cursor-pointer">Actualizar registro</button>
      </details>
    </div>
  );
};

export const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<Summary | null>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: 'login' | 'forbidden' | 'other'; message: string; email?: string | null } | null>(null);
  const [metric, setMetric] = useState<Metric>('views');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (auth.authStateReady) await auth.authStateReady();
      if (!auth.currentUser) {
        setError({ kind: 'login', message: 'Inicia sesión con tu cuenta de administrador.' });
        return;
      }
      const res = await apiFetch('/api/admin/resumen');
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setError({ kind: 'forbidden', message: body.error || 'Sin acceso.', email: body.email });
      } else if (!res.ok) {
        setError({ kind: 'other', message: body.error || 'No se pudo cargar el panel.' });
      } else {
        setData(body as Summary);
      }
    } catch (err: any) {
      setError({ kind: 'other', message: err?.message || 'No se pudo cargar el panel.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const funnelRows = useMemo(() => {
    if (!data) return [];
    const f = data.funnel30d;
    return [
      { label: 'Visitantes', value: f.visitors },
      { label: 'Se registraron', value: f.signups, note: pct(f.signups, f.visitors) },
      { label: 'Compraron el plan', value: f.purchases, note: pct(f.purchases, f.signups) }
    ];
  }, [data]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-slate-400 mx-auto" />
        <h1 className="text-2xl font-black text-slate-900">Panel de administración</h1>
        <p className="text-slate-600">{error.message}</p>
        {error.kind === 'forbidden' && (
          <p className="text-sm text-slate-500">
            {error.email ? <>Entraste como <strong>{error.email}</strong>. </> : null}
            Para habilitarla, agrega ese correo al secreto <code className="px-1 rounded bg-slate-100">ADMIN_DASHBOARD_EMAILS</code> en AI Studio y vuelve a publicar.
          </p>
        )}
        {error.kind === 'login' ? (
          <button
            type="button"
            onClick={() => requestLogin({ mode: 'login', message: 'Inicia sesión con tu cuenta de administrador.', onSuccess: load })}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm cursor-pointer"
          >
            <LogIn className="w-4 h-4" /> Iniciar sesión
          </button>
        ) : (
          <button type="button" onClick={load} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 font-bold text-sm cursor-pointer">
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        )}
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="py-6 space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-200 rounded-2xl" />)}</div>
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    );
  }
  if (!data) return null;
  const k = data.kpis;

  return (
    <div className="py-4 sm:py-6 space-y-5 min-w-0">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Panel de administración</h1>
          <p className="text-sm text-slate-500">Actualizado {fmtDate(data.generatedAt, true)}</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </header>

      <Card title="Estado del sistema">
        <ul className="grid gap-3 sm:grid-cols-2 text-sm">
          <li className="space-y-0.5">
            <p className="text-slate-500">Monitor de convocatorias</p>
            <Status
              ok={Boolean(data.system.lastConvocatoriasSyncAt && Date.now() - new Date(data.system.lastConvocatoriasSyncAt).getTime() < 36 * 36e5)}
              okText={`Sincronizado ${fmtDate(data.system.lastConvocatoriasSyncAt, true)} · ${data.system.convocatoriasVigentes ?? '—'} vigentes`}
              badText={data.system.lastConvocatoriasSyncAt ? `Última sincronización ${fmtDate(data.system.lastConvocatoriasSyncAt, true)}` : 'Sin sincronizaciones registradas'}
            />
          </li>
          <li className="space-y-0.5">
            <p className="text-slate-500">Correos (Resend)</p>
            <Status ok={data.system.emailConfigured} okText="Configurado" badText="Falta RESEND_API_KEY" />
            <EmailTools />
          </li>
          <li className="space-y-0.5">
            <p className="text-slate-500">Pasarela de pago activa</p>
            <p className="font-bold text-slate-900">{data.system.paymentProvider === 'flow' ? 'Flow' : 'Mercado Pago'}</p>
          </li>
          <li className="space-y-0.5">
            <p className="text-slate-500">Flow</p>
            <Status ok={Boolean(data.system.flowConfigured)} okText="Configurado" badText="Faltan FLOW_API_KEY y FLOW_SECRET_KEY" />
          </li>
          <li className="space-y-0.5">
            <p className="text-slate-500">Mercado Pago (respaldo)</p>
            <Status ok={data.system.mercadoPagoConfigured} okText="Configurado" badText="Falta MP_ACCESS_TOKEN" />
          </li>
          <li className="space-y-0.5">
            <p className="text-slate-500">IA (Gemini)</p>
            <AiStatus />
          </li>
          <li className="space-y-0.5">
            <p className="text-slate-500">Permiso de cuentas (Firebase Authentication)</p>
            <Status ok={data.system.authListAvailable !== false} okText="Con permiso" badText="Sin permiso: los correos usan el perfil guardado" />
          </li>
          <li className="space-y-0.5">
            <p className="text-slate-500">Base de datos</p>
            <Status ok okText="Conectada" badText="" />
          </li>
        </ul>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Ingresos totales" value={clp(k.revenueTotal)} detail={`${clp(k.revenueThisMonth)} este mes · ${num(k.approvedPayments)} pagos`} />
        <Kpi label="Planes activos" value={num(k.activePlans)} detail={k.expiringIn7d > 0 ? `${k.expiringIn7d} vencen en 7 días` : 'Ninguno vence esta semana'} />
        <Kpi label="Usuarios registrados" value={num(k.totalUsers)} detail={`+${num(k.newUsers7d)} en 7 días · +${num(k.newUsers30d)} en 30`} />
        <Kpi label="Visitas, 7 días" value={num(k.views7d)} detail={`${num(k.visitors7d)} visitantes (únicos por día)`} />
      </div>

      <Card
        title="Últimos 30 días"
        right={
          <div role="tablist" aria-label="Métrica" className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            {METRICS.map(m => (
              <button
                key={m.key}
                role="tab"
                aria-selected={metric === m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${metric === m.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      >
        <DailyBars data={data.series30d} metric={metric} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Embudo de conversión" subtitle="Últimos 30 días. El porcentaje es respecto del paso anterior.">
          <HBars rows={funnelRows} />
        </Card>
        <Card title="Secciones más vistas" subtitle="Últimos 30 días">
          <HBars rows={data.topPages30d.map(p => ({ label: p.label, value: p.views }))} />
        </Card>
      </div>

      <Card title="Pagos recientes" subtitle="Últimos 50, aprobados y rechazados">
        <Table headers={['Fecha', 'Cliente', 'Monto', 'Tipo', 'Estado', 'Uso iniciado', 'ID Mercado Pago']} empty={data.payments.length === 0}>
          {data.payments.map(p => (
            <tr key={p.id} className="align-top">
              <td className="py-2.5 pr-4 whitespace-nowrap text-slate-600">{fmtDate(p.date, true)}</td>
              <td className="py-2.5 pr-4"><div className="text-slate-900">{p.companyName || '—'}</div><div className="text-xs text-slate-500">{p.email}</div></td>
              <td className="py-2.5 pr-4 tabular-nums font-semibold">{clp(p.amount)}</td>
              <td className="py-2.5 pr-4 whitespace-nowrap">{p.kind}</td>
              <td className="py-2.5 pr-4 whitespace-nowrap">
                {p.status === 'approved' ? <Status ok okText="Aprobado" badText="" /> : <Status ok={false} okText="" badText={p.status === 'rechazado_validacion' ? 'Rechazado (validación)' : p.status} />}
              </td>
              <td className="py-2.5 pr-4 whitespace-nowrap text-slate-600">{p.status === 'approved' ? (p.serviceStarted ? 'Sí' : 'No, puede retractarse') : '—'}</td>
              <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">{p.id}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Planes activos" subtitle="Ordenados por vencimiento">
          <Table headers={['Cliente', 'Vence', 'Días', 'Uso iniciado']} empty={data.activePlans.length === 0}>
            {data.activePlans.map(p => (
              <tr key={p.uid}>
                <td className="py-2.5 pr-4"><div className="text-slate-900">{p.companyName || '—'}</div><div className="text-xs text-slate-500">{p.email}</div></td>
                <td className="py-2.5 pr-4 whitespace-nowrap">{fmtDate(p.expiresAt)}</td>
                <td className={`py-2.5 pr-4 tabular-nums ${p.daysLeft <= 7 ? 'text-amber-700 font-semibold' : ''}`}>{p.daysLeft}</td>
                <td className="py-2.5 pr-4">{p.freePass ? <span className="px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-800 text-xs font-bold">Pase libre</span> : p.serviceStarted ? 'Sí' : 'No'}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Postulaciones por fondo" subtitle={`${num(k.totalApplications)} postulaciones creadas en total`}>
          <HBars rows={data.fundsTop.map(f => ({ label: f.fundName, value: f.count }))} />
        </Card>
      </div>

      <Card title="Usuarios recientes" subtitle="Últimos 100 registros">
        <Table headers={['Registro', 'Usuario', 'Ingreso', 'Último acceso', 'Plan', 'Postulaciones']} empty={data.users.length === 0}>
          {(showAllUsers ? data.users : data.users.slice(0, 15)).map(u => (
            <tr key={u.uid}>
              <td className="py-2.5 pr-4 whitespace-nowrap text-slate-600">{fmtDate(u.createdAt)}</td>
              <td className="py-2.5 pr-4"><div className="text-slate-900">{u.companyName || u.displayName || '—'}</div><div className="text-xs text-slate-500">{u.email}</div></td>
              <td className="py-2.5 pr-4">{u.provider}</td>
              <td className="py-2.5 pr-4 whitespace-nowrap text-slate-600">{fmtDate(u.lastSignInAt)}</td>
              <td className="py-2.5 pr-4">{u.hasActivePlan ? <span className="text-emerald-700 font-semibold">Activo</span> : <span className="text-slate-500">Sin plan</span>}</td>
              <td className="py-2.5 pr-4 tabular-nums">{u.applications}</td>
            </tr>
          ))}
        </Table>
        {data.users.length > 15 && (
          <button type="button" onClick={() => setShowAllUsers(v => !v)} className="mt-3 text-sm font-semibold text-blue-700 hover:underline cursor-pointer">
            {showAllUsers ? 'Ver menos' : `Ver los ${data.users.length} usuarios`}
          </button>
        )}
      </Card>

      <NewsPanel />

      <AiUsagePanel />

      <FreePassPanel />
      <SellersPanel />

      <EarlyAccessPanel />

      <SupportInbox />

    </div>
  );
};
