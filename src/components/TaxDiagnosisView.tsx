import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ShieldAlert,
  Building2,
  Users,
  Briefcase,
  ChevronDown,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  Sparkles
} from 'lucide-react';
import type { TaxDiagnosis, FundCheck, DiagnosisAlert } from '../utils/taxDiagnosis';
import { formatRut } from '../utils/rutValidator';

const clp = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;
const clpShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000).toLocaleString('es-CL')} mil`;
  return clp(n);
};
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const periodLong = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

/* -------------------------------------------------------------------------- */

const Stat: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="rounded-2xl bg-white border border-slate-200 p-4 min-w-0">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 leading-tight">{value}</p>
    {note && <p className="text-[11px] text-slate-500 mt-1 leading-snug">{note}</p>}
  </div>
);

const VERDICT_STYLE = {
  cumple: { icon: CheckCircle2, label: 'Cumple', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', iconCls: 'text-emerald-600' },
  revisar: { icon: AlertTriangle, label: 'Revisar', chip: 'bg-amber-50 text-amber-800 border-amber-200', iconCls: 'text-amber-600' },
  no_cumple: { icon: XCircle, label: 'No cumple', chip: 'bg-slate-100 text-slate-600 border-slate-200', iconCls: 'text-slate-400' }
} as const;

const FundRow: React.FC<{ f: FundCheck }> = ({ f }) => {
  const st = VERDICT_STYLE[f.verdict];
  const Icon = st.icon;
  return (
    <li className="py-3 flex gap-3">
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${st.iconCls}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-bold text-slate-900">{f.name}</p>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${st.chip}`}>{st.label}</span>
        </div>
        <p className="text-[13px] text-slate-600 mt-0.5 leading-relaxed">{f.reasons[0]}</p>
        {f.reasons.length > 1 && (
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{f.reasons.slice(1).join('. ')}.</p>
        )}
      </div>
    </li>
  );
};

const ALERT_STYLE: Record<DiagnosisAlert['level'], { icon: React.ElementType; cls: string; iconCls: string }> = {
  critico: { icon: ShieldAlert, cls: 'bg-rose-50 border-rose-200', iconCls: 'text-rose-600' },
  atencion: { icon: AlertTriangle, cls: 'bg-amber-50 border-amber-200', iconCls: 'text-amber-600' },
  ok: { icon: CheckCircle2, cls: 'bg-emerald-50 border-emerald-200', iconCls: 'text-emerald-600' },
  info: { icon: Info, cls: 'bg-slate-50 border-slate-200', iconCls: 'text-slate-500' }
};

/** Barras mensuales (una serie) con lectura del mes al pasar o tocar. */
const MonthlyChart: React.FC<{ data: TaxDiagnosis['sales']['monthly'] }> = ({ data }) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map(d => d.revenue));
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600 min-h-[1.25rem]" aria-live="polite">
        {h
          ? h.pending
            ? <>{periodLong(h.period)}: aún en plazo para declarar</>
            : !h.declared
              ? <>{periodLong(h.period)}: <strong className="text-rose-700">sin declaración</strong></>
              : <>{periodLong(h.period)}: <strong className="text-slate-900">{clp(h.revenue)}</strong></>
          : <>Mes con más ventas: <strong className="text-slate-900">{clp(max === 1 ? 0 : max)}</strong></>}
      </p>
      <div className="flex items-end gap-[2px] h-36 border-b border-slate-300" onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <button
            key={d.period}
            type="button"
            aria-label={`${periodLong(d.period)}: ${d.pending ? 'en plazo' : d.declared ? clp(d.revenue) : 'sin declaración'}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onClick={() => setHover(i)}
            className="flex-1 h-full flex items-end cursor-default focus-visible:outline-none group"
          >
            {d.revenue > 0 ? (
              <span
                className={`w-full rounded-t-[4px] ${hover === i ? 'bg-blue-800' : 'bg-blue-600'} group-focus-visible:ring-2 group-focus-visible:ring-blue-400`}
                style={{ height: `${Math.max(4, (d.revenue / max) * 100)}%` }}
              />
            ) : (
              <span className={`w-full h-1 rounded-full ${d.pending ? 'bg-slate-200' : !d.declared ? 'bg-rose-400' : hover === i ? 'bg-slate-400' : 'bg-slate-200'}`} />
            )}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
};

/** Ingresos anuales del F22 (pocas barras: valor rotulado en cada una). */
const AnnualChart: React.FC<{ data: { year: number; income: number }[] }> = ({ data }) => {
  const max = Math.max(1, ...data.map(d => d.income));
  return (
    <div className="flex items-end gap-3 h-44 border-b border-slate-300 pt-6">
      {data.map(d => (
        <div key={d.year} className="flex-1 h-full flex flex-col justify-end items-center gap-1 min-w-0">
          <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">{clpShort(d.income)}</span>
          <span className="w-full max-w-[56px] rounded-t-[4px] bg-blue-600" style={{ height: `${Math.max(2, (d.income / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
};

/* -------------------------------------------------------------------------- */

interface Props {
  diagnosis: TaxDiagnosis;
  isSample?: boolean;
  onPrimaryAction?: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  correctionForm?: React.ReactNode;
}

export const TaxDiagnosisView: React.FC<Props> = ({ diagnosis: d, isSample, onPrimaryAction, primaryLabel, primaryDisabled, correctionForm }) => {
  const [showNotEligible, setShowNotEligible] = useState(false);
  const eligible = d.funds.filter(f => f.verdict === 'cumple');
  const review = d.funds.filter(f => f.verdict === 'revisar');
  const notEligible = d.funds.filter(f => f.verdict === 'no_cumple');
  const s = d.sales;

  const headline = useMemo(() => {
    if (eligible.length === 0) return 'Con tu carpeta no cumples todavía los requisitos básicos de los fondos de nuestro catálogo';
    return `Con tu carpeta cumples los requisitos básicos de ${eligible.length} ${eligible.length === 1 ? 'fondo' : 'fondos'}`;
  }, [eligible.length]);

  const sizeNote = s.last12Total > 0
    ? `${Math.round(s.last12UF).toLocaleString('es-CL')} UF en 12 meses (UF ${s.ufIsEstimate ? 'aprox.' : 'del día'} ${clp(s.ufValue)})`
    : 'Según la Ley 20.416, por ventas anuales en UF';

  return (
    <div className="space-y-5">
      {isSample && (
        <p className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-900">
          Este es un <strong>ejemplo con una empresa ficticia</strong>. Sube tu carpeta para ver el diagnóstico de tu empresa.
        </p>
      )}

      {/* Encabezado de la empresa */}
      <header className="space-y-1">
        {d.generatedAt && <p className="text-xs text-slate-500">Carpeta generada el {d.generatedAt.split(' ')[0]}</p>}
        <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight break-words">{d.company.name || 'Tu empresa'}</h3>
        <p className="text-sm text-slate-600">
          RUT {d.company.rut ? formatRut(d.company.rut) : 'sin dato'}{d.company.entityType ? `, ${d.company.entityType.toLowerCase()}` : ''}{d.company.region ? `, Región ${d.company.region}` : ''}
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Antigüedad" value={d.company.ageText} note={d.company.startDate ? `Inicio de actividades: ${d.company.startDate}` : undefined} />
        <Stat label="Ventas últimos 12 meses" value={clp(s.last12Total)} note={s.windowLabel} />
        <Stat label="Tamaño de empresa" value={s.sizeLabel} note={sizeNote} />
        <Stat
          label="Declaraciones de IVA (F29)"
          value={`${d.compliance.f29Declared} de ${d.compliance.f29Expected}`}
          note={d.compliance.f29Missing.length > 0 ? `${d.compliance.f29Missing.length} sin declarar` : 'Todas declaradas'}
        />
      </div>

      {/* Resultado principal: fondos */}
      <section className="rounded-2xl border-2 border-blue-600/20 bg-gradient-to-b from-blue-50/70 to-white p-5 sm:p-6 space-y-3">
        <div className="space-y-1">
          <h4 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">{headline}</h4>
          <p className="text-sm text-slate-600">
            {review.length > 0 ? `Además, ${review.length} ${review.length === 1 ? 'fondo necesita' : 'fondos necesitan'} un dato que la carpeta no muestra. ` : ''}
            Comparamos tus datos con los requisitos de tipo de empresa, ventas y antigüedad de cada fondo.
          </p>
        </div>
        <ul className="divide-y divide-slate-200">
          {[...eligible, ...review].map(f => <FundRow key={f.fundId} f={f} />)}
        </ul>
        {notEligible.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowNotEligible(v => !v)}
              aria-expanded={showNotEligible}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showNotEligible ? 'rotate-180' : ''}`} />
              {showNotEligible ? 'Ocultar' : 'Ver'} los {notEligible.length} fondos donde no cumples y por qué
            </button>
            {showNotEligible && <ul className="divide-y divide-slate-200 mt-1">{notEligible.map(f => <FundRow key={f.fundId} f={f} />)}</ul>}
          </div>
        )}
        <p className="text-xs text-slate-500 leading-relaxed">
          Es una revisión de requisitos básicos; cada convocatoria tiene condiciones adicionales en sus bases.
        </p>
      </section>

      {/* Ventas */}
      <div className="grid gap-4 lg:grid-cols-5">
        <section className="lg:col-span-3 rounded-2xl bg-white border border-slate-200 p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-base font-bold text-slate-900">Ventas mes a mes</h4>
            {s.changePct !== null && (
              <span className={`inline-flex items-center gap-1 text-sm font-semibold ${s.changePct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {s.changePct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {s.changePct > 0 ? '+' : ''}{s.changePct.toLocaleString('es-CL')}% frente a los 12 meses anteriores
              </span>
            )}
          </div>
          <MonthlyChart data={s.monthly} />
          <p className="text-xs text-slate-500">
            Base imponible declarada en cada F29. Hubo ventas en {s.last12MonthsWithSales} de los últimos 12 meses.
          </p>
        </section>
        <section className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 p-5 space-y-3 min-w-0">
          <h4 className="text-base font-bold text-slate-900">Ingresos por año</h4>
          {s.annual.length > 0 ? (
            <>
              <AnnualChart data={s.annual} />
              <div className="flex gap-3 text-[11px] text-slate-500">
                {s.annual.map(a => <span key={a.year} className="flex-1 text-center">{a.year}</span>)}
              </div>
              <p className="text-xs text-slate-500">Ingresos del giro declarados en tu renta (F22).</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">La carpeta no incluye declaraciones de renta (F22).</p>
          )}
        </section>
      </div>

      {/* Cumplimiento */}
      <section className="space-y-2">
        <h4 className="text-base font-bold text-slate-900">Antes de postular</h4>
        <ul className="space-y-2">
          {d.alerts.map(a => {
            const st = ALERT_STYLE[a.level];
            const Icon = st.icon;
            return (
              <li key={a.title} className={`rounded-xl border p-3.5 flex gap-3 ${st.cls}`}>
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${st.iconCls}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{a.title}</p>
                  <p className="text-[13px] text-slate-700 leading-relaxed">{a.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Ficha */}
      <section className="rounded-2xl bg-white border border-slate-200 p-5 grid gap-5 md:grid-cols-2">
        <div className="space-y-3 min-w-0">
          <h4 className="text-base font-bold text-slate-900 flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-500" />Ficha de la empresa</h4>
          <dl className="text-sm space-y-2">
            {[
              ['Régimen tributario', d.company.taxRegime],
              ['Categoría', d.company.taxCategory],
              ['Domicilio', d.company.address],
              ['Remuneraciones', d.employees ? `${clp(d.employees.salariesPaid)} pagados en ${d.employees.year}` : 'No registra en los F22 de la carpeta']
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="text-slate-900 break-words">{v}</dd>
              </div>
            ))}
          </dl>
          {d.company.activities.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" />Actividades económicas</p>
              <ul className="space-y-1 text-sm text-slate-900">
                {d.company.activities.map(a => (
                  <li key={a.code}><span className="tabular-nums text-slate-500">{a.code}</span> {a.description.toLowerCase().replace(/^\w/, c => c.toUpperCase())}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="space-y-3 min-w-0">
          <h4 className="text-base font-bold text-slate-900 flex items-center gap-2"><Users className="w-4 h-4 text-slate-500" />Socios y representantes</h4>
          {d.company.partners.length > 0 && (
            <ul className="space-y-2">
              {d.company.partners.map(p => (
                <li key={p.rut} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-slate-900 truncate">{p.name}</span>
                    <span className="font-semibold tabular-nums text-slate-900 shrink-0">{p.participationCapitalPct ?? '—'}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, p.participationCapitalPct || 0)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {d.company.legalRepresentatives.length > 0 && (
            <p className="text-sm text-slate-700">
              <span className="text-xs text-slate-500 block">Representante legal</span>
              {d.company.legalRepresentatives.map(r => r.name).join(', ')}
            </p>
          )}
          {d.company.partners.length === 0 && d.company.legalRepresentatives.length === 0 && (
            <p className="text-sm text-slate-500">La carpeta no incluye socios ni representantes.</p>
          )}
        </div>
      </section>

      {correctionForm && (
        <details className="rounded-2xl bg-slate-50 border border-slate-200 p-4 group">
          <summary className="text-sm font-semibold text-slate-700 cursor-pointer list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
            ¿Algún dato no corresponde? Corrígelo antes de guardar
          </summary>
          <div className="mt-3">{correctionForm}</div>
        </details>
      )}

      {onPrimaryAction && (
        <div className="sticky bottom-0 -mx-5 sm:-mx-7 px-5 sm:px-7 py-3 bg-white/95 backdrop-blur border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 shrink-0" />
            El archivo no se guarda; solo los datos que confirmes.
          </p>
          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={primaryDisabled}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-70"
          >
            <Sparkles className="w-4 h-4" />
            {primaryLabel || 'Guardar en mi perfil'}
          </button>
        </div>
      )}
    </div>
  );
};
