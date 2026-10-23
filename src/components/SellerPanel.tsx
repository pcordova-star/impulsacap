import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, LogIn, Copy, Check, Tag, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';
import { auth } from '../firebase';
import { requestLogin } from '../utils/authEvents';

interface CodeRow {
  code: string; active: boolean; discountPct: number; commissionPct: number; price: number; link: string;
  salesCount: number; revenue: number; commissionPending: number; commissionPaid: number; trialsCount: number;
}
interface PanelData {
  name: string;
  email: string;
  codes: CodeRow[];
  totals: { salesCount: number; revenue: number; commissionPending: number; commissionPaid: number; trialsCount: number; commissionInRetracto?: number };
  sales: { date: string; code: string; client: string; amount: number; commission: number; status: string; paidAt: string | null }[];
  trials: { date: string; code: string; client: string; until: string | null }[];
  referredPending?: number;
}

const clp = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;
const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Santiago' });
};

const CopyButton: React.FC<{ text: string; label: string }> = ({ text, label }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* sin portapapeles */ }
      }}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer"
    >
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {done ? 'Copiado' : label}
    </button>
  );
};

const Kpi: React.FC<{ label: string; value: string; detail?: string }> = ({ label, value, detail }) => (
  <div className="rounded-2xl bg-white border border-slate-200 p-4">
    <p className="text-xs font-semibold text-slate-500">{label}</p>
    <p className="text-2xl font-black text-slate-900 tabular-nums mt-1">{value}</p>
    {detail && <p className="text-xs text-slate-500 mt-1">{detail}</p>}
  </div>
);

/** Panel del vendedor: /vendedor */
export const SellerPanel: React.FC = () => {
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: 'login' | 'other'; message: string; email?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (auth.authStateReady) await auth.authStateReady();
      if (!auth.currentUser) {
        setError({ kind: 'login', message: 'Inicia sesión con el correo que registraste como vendedor.' });
        return;
      }
      const res = await apiFetch('/api/vendedor/panel');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError({ kind: 'other', message: body.error || 'No se pudo cargar tu panel.', email: body.email });
      else setData(body as PanelData);
    } catch (err: any) {
      setError({ kind: 'other', message: err?.message || 'No se pudo cargar tu panel.' });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-slate-400 mx-auto" />
        <h1 className="text-2xl font-black text-slate-900">Panel de vendedor</h1>
        <p className="text-slate-600">{error.message}</p>
        {error.email && (
          <p className="text-sm text-slate-500">
            Entraste como <strong>{error.email}</strong>. Si tu código está registrado con otro correo, entra con ese o escríbenos a contacto@impulsacap.cl.
          </p>
        )}
        {error.kind === 'login' ? (
          <button
            type="button"
            onClick={() => requestLogin({ mode: 'login', message: 'Inicia sesión con el correo que registraste como vendedor.', onSuccess: load })}
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
        <div className="h-8 w-56 bg-slate-200 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-200 rounded-2xl" />)}</div>
        <div className="h-48 bg-slate-200 rounded-2xl" />
      </div>
    );
  }
  if (!data) return null;
  const t = data.totals;

  return (
    <div className="py-4 sm:py-6 space-y-5 min-w-0 max-w-5xl mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Hola, {data.name.split(/\s+/)[0]}</h1>
          <p className="text-sm text-slate-500">Tu panel de vendedor ImpulsaCap</p>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Comisión por pagar" value={clp(t.commissionPending)} detail={(t.commissionInRetracto || 0) > 0 ? `${clp(t.commissionInRetracto || 0)} aún en plazo de retracto (10 días)` : undefined} />
        <Kpi label="Comisión pagada" value={clp(t.commissionPaid)} />
        <Kpi label="Ventas" value={String(t.salesCount)} detail={`${clp(t.revenue)} vendidos (IVA incluido)`} />
        <Kpi label="Registrados con tu código" value={String(data.referredPending || 0)} detail="Aún no compran: vale la pena hacerles seguimiento" />
      </div>

      {data.codes.map(c => (
        <section key={c.code} className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-bold text-sm">
              <Tag className="w-4 h-4" /> {c.code}
            </span>
            {!c.active && <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">Código pausado</span>}
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div><dt className="text-xs text-slate-500">Precio para tu cliente</dt><dd className="font-bold text-slate-900">{clp(c.price)} <span className="font-normal text-slate-500">({c.discountPct}% dcto. sobre $39.990)</span></dd></div>
            <div><dt className="text-xs text-slate-500">Tu comisión</dt><dd className="font-bold text-slate-900">{c.commissionPct}% <span className="font-normal text-slate-500">= {clp(Math.round(c.price * c.commissionPct / 100))} por venta</span></dd></div>
            <div><dt className="text-xs text-slate-500">Aplica a</dt><dd className="text-slate-700">La primera compra de cada cliente</dd></div>
          </dl>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">Tu link para compartir</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs break-all">{c.link}</code>
              <CopyButton text={c.link} label="Copiar link" />
            </div>
            <p className="text-xs text-slate-500">Quien entre con tu link queda con tu código. También puede escribir <strong className="font-mono">{c.code}</strong> en "¿Tienes un código de vendedor?" al contratar.</p>
          </div>
        </section>
      ))}

      <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
        <h2 className="text-base font-bold text-slate-900 mb-4">Ventas</h2>
        {data.sales.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay ventas con tu código.</p>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  {['Fecha', 'Cliente', 'Venta', 'Comisión', 'Estado'].map(h => <th key={h} className="py-2 pr-4 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.sales.map((s, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-slate-600">{fmtDate(s.date)}</td>
                    <td className="py-2.5 pr-4 text-slate-900">{s.client || '—'}{data.codes.length > 1 && <span className="ml-1 text-xs text-slate-400">({s.code})</span>}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{clp(s.amount)}</td>
                    <td className="py-2.5 pr-4 tabular-nums font-semibold">{clp(s.commission)}</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      {s.status === 'pagada'
                        ? <span className="text-emerald-700 font-semibold">Pagada {fmtDate(s.paidAt)}</span>
                        : s.status === 'anulada' || s.status === 'pagada_anulada'
                        ? <span className="text-slate-500 font-semibold">Anulada (devolución)</span>
                        : <span className="text-amber-700 font-semibold">Por pagar</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>


      <p className="text-xs text-slate-500">
        La comisión se calcula sobre el monto pagado (IVA incluido), se registra cuando se aprueba el pago y se paga pasados 10 días (plazo de retracto del cliente). Si el cliente pide devolución, la comisión se anula. ¿Dudas sobre tus pagos? Escribe a contacto@impulsacap.cl.
      </p>
    </div>
  );
};
