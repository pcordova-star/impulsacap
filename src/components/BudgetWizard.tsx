import React, { useMemo, useState } from 'react';
import { Calculator, CheckCircle2, AlertTriangle, ChevronDown, Info, Wand2, ExternalLink } from 'lucide-react';

/**
 * Paso 8 del formulador: presupuesto guiado para alguien sin experiencia.
 * 1) Qué es cada concepto, con un ejemplo en pesos del fondo elegido.
 * 2) Calculadora: costo total → subsidio y aporte, y reparto sugerido por cuenta.
 * 3) Cada cuenta explicada (qué va, qué no va, ejemplo) con campos en pesos.
 * 4) Revisión con instrucciones concretas y ajuste automático.
 */

export type BudgetField = 'corfoContributionCLP' | 'companyPecuniaryCLP' | 'item' | 'justification';
export interface BudgetAccountData { corfoContributionCLP: number; companyPecuniaryCLP: number; item: string; justification: string }

interface AccountGuide {
  key: string;
  account: string;
  plainName: string;
  share: number; // reparto sugerido del total
  whatGoes: string[];
  whatNot: string[];
  example: string;
  itemPlaceholder: string;
  justificationPlaceholder: string;
}

export const BUDGET_GUIDES: AccountGuide[] = [
  {
    key: 'rh',
    account: 'Recursos Humanos Críticos',
    plainName: 'Personas que trabajan en el proyecto',
    share: 0.5,
    whatGoes: ['Sueldos u honorarios del equipo que trabaja en el proyecto', 'Contrataciones nuevas para el proyecto (desarrollador, técnico, vendedor)', 'Solo la parte del tiempo dedicada al proyecto (por ejemplo, media jornada)'],
    whatNot: ['Sueldos de personas que no trabajan en el proyecto', 'Bonos o gastos personales'],
    example: 'Un desarrollador a media jornada por 12 meses: $600.000 × 12 = $7.200.000',
    itemPlaceholder: 'Ej: Desarrollador full stack, media jornada, 12 meses',
    justificationPlaceholder: 'Ej: Construirá la plataforma y sus pruebas con clientes piloto'
  },
  {
    key: 'operaciones',
    account: 'Gastos de Operación',
    plainName: 'Materiales, insumos y servicios para ejecutarlo',
    share: 0.3,
    whatGoes: ['Materiales, insumos y prototipos', 'Software, servidores o servicios en la nube', 'Arriendo de equipos, pruebas en terreno, viajes del proyecto', 'Difusión y marketing del producto'],
    whatNot: ['Pago de deudas o créditos', 'Gastos habituales de la empresa que no son del proyecto'],
    example: 'Servidores en la nube por 12 meses ($80.000 al mes = $960.000) y materiales de prototipo ($1.500.000)',
    itemPlaceholder: 'Ej: Servicios cloud, materiales de prototipo y viajes a clientes piloto',
    justificationPlaceholder: 'Ej: Necesarios para construir y probar el prototipo con usuarios reales'
  },
  {
    key: 'consultoria',
    account: 'Asistencia Técnica y Consultoría',
    plainName: 'Expertos y servicios externos',
    share: 0.15,
    whatGoes: ['Asesorías especializadas', 'Laboratorios, ensayos y certificaciones', 'Diseño o desarrollo encargado a una empresa externa'],
    whatNot: ['Servicios de socios o familiares directos (las bases suelen prohibirlo)'],
    example: 'Certificación de calidad ($1.200.000) y diseño de marca ($800.000)',
    itemPlaceholder: 'Ej: Certificación sanitaria y asesoría legal de propiedad intelectual',
    justificationPlaceholder: 'Ej: El equipo no tiene esta especialidad y la certificación es requisito para vender'
  },
  {
    key: 'administracion',
    account: 'Gastos de Administración y Garantías',
    plainName: 'Gestión del proyecto y garantías',
    share: 0.05,
    whatGoes: ['Contabilidad para rendir los gastos', 'Costo de la póliza o boleta de garantía (si pides anticipo)', 'Gastos bancarios del proyecto'],
    whatNot: ['Arriendo de oficina u otros gastos generales, salvo que las bases los permitan'],
    example: 'Contador para rendiciones ($50.000 al mes por 12 meses = $600.000)',
    itemPlaceholder: 'Ej: Servicio contable para rendiciones y póliza de garantía',
    justificationPlaceholder: 'Ej: Rendir correctamente al organismo y garantizar el anticipo'
  }
];

const clp = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;
const parseClp = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;
const round10k = (n: number) => Math.round(n / 10000) * 10000;

const MoneyInput: React.FC<{ id: string; value: number; onChange: (n: number) => void; tone: 'cyan' | 'emerald'; placeholder?: string }> = ({ id, value, onChange, tone, placeholder }) => (
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
    <input
      id={id}
      inputMode="numeric"
      value={value ? value.toLocaleString('es-CL') : ''}
      onChange={e => onChange(parseClp(e.target.value))}
      placeholder={placeholder || '0'}
      className={`w-full bg-slate-900 border border-slate-700 font-mono text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none placeholder:text-slate-600 ${tone === 'cyan' ? 'text-cyan-300 focus:border-cyan-500' : 'text-emerald-300 focus:border-emerald-500'}`}
    />
  </div>
);

export const BudgetWizard: React.FC<{
  agency: string;
  fundName: string;
  basesUrl?: string | null;
  maxSubsidyCLP: number;
  maxPct: number;
  accounts: Record<string, BudgetAccountData>;
  onChange: (key: string, field: BudgetField, value: any) => void;
}> = ({ agency, fundName, basesUrl, maxSubsidyCLP, maxPct, accounts, onChange }) => {
  const [totalInput, setTotalInput] = useState<number>(0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showConcepts, setShowConcepts] = useState(true);

  const totals = useMemo(() => {
    const sub = Object.values(accounts).reduce((a, c) => a + (c.corfoContributionCLP || 0), 0);
    const emp = Object.values(accounts).reduce((a, c) => a + (c.companyPecuniaryCLP || 0), 0);
    const total = sub + emp;
    return { sub, emp, total, pct: total > 0 ? (sub / total) * 100 : 0 };
  }, [accounts]);

  const hasMax = maxSubsidyCLP > 0;
  const subExceeded = hasMax && totals.sub > maxSubsidyCLP;
  const pctExceeded = totals.total > 0 && totals.pct > maxPct + 0.05;
  const valid = totals.sub > 0 && !subExceeded && !pctExceeded;
  const missingTexts = BUDGET_GUIDES.filter(g => {
    const a = accounts[g.key];
    return a && (a.corfoContributionCLP || a.companyPecuniaryCLP) && (!a.item?.trim() || !a.justification?.trim());
  });

  // Ejemplo con los números del fondo
  const exampleTotal = hasMax ? Math.max(1000000, round10k(maxSubsidyCLP / (maxPct / 100))) : 20000000;
  const exampleSub = Math.min(hasMax ? maxSubsidyCLP : Infinity, round10k(exampleTotal * maxPct / 100));

  // Calculadora: con el costo total, cuánto pone el fondo y cuánto tu empresa
  const calcSub = Math.min(hasMax ? maxSubsidyCLP : Infinity, Math.floor((totalInput * maxPct) / 100 / 10000) * 10000);
  const calcEmp = Math.max(0, totalInput - calcSub);

  const applyDistribution = () => {
    let subLeft = calcSub;
    let empLeft = calcEmp;
    BUDGET_GUIDES.forEach((g, i) => {
      const last = i === BUDGET_GUIDES.length - 1;
      const s = last ? subLeft : round10k(calcSub * g.share);
      const e = last ? empLeft : round10k(calcEmp * g.share);
      subLeft -= s;
      empLeft -= e;
      onChange(g.key, 'corfoContributionCLP', Math.max(0, s));
      onChange(g.key, 'companyPecuniaryCLP', Math.max(0, e));
    });
    setOpenKey(BUDGET_GUIDES[0].key);
    setTimeout(() => document.getElementById('budget-accounts')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  // Ajuste automático: sube el aporte de la empresa (y si hace falta baja el subsidio) para cumplir las bases
  const autoFix = () => {
    const targetSub = hasMax ? Math.min(totals.sub, maxSubsidyCLP) : totals.sub;
    const neededTotal = Math.ceil(targetSub / (maxPct / 100));
    const neededEmp = Math.max(totals.emp, neededTotal - targetSub);
    const subFactor = totals.sub > 0 ? targetSub / totals.sub : 0;
    const extraEmp = neededEmp - totals.emp;
    let extraLeft = extraEmp;
    BUDGET_GUIDES.forEach((g, i) => {
      const a = accounts[g.key];
      if (!a) return;
      const last = i === BUDGET_GUIDES.length - 1;
      const newSub = Math.floor((a.corfoContributionCLP || 0) * subFactor / 1000) * 1000;
      const add = last ? extraLeft : Math.ceil(extraEmp * g.share / 1000) * 1000;
      extraLeft -= add;
      onChange(g.key, 'corfoContributionCLP', newSub);
      onChange(g.key, 'companyPecuniaryCLP', (a.companyPecuniaryCLP || 0) + Math.max(0, add));
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Cómo funciona */}
      <section className="rounded-2xl bg-slate-950/80 border border-slate-800 overflow-hidden">
        <button type="button" onClick={() => setShowConcepts(v => !v)} className="w-full p-4 flex items-center justify-between gap-3 text-left cursor-pointer">
          <span className="flex items-center gap-2 text-sm font-bold text-white">
            <Info className="w-4 h-4 text-cyan-400" /> ¿Cómo funciona el presupuesto? (lee esto primero)
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showConcepts ? 'rotate-180' : ''}`} />
        </button>
        {showConcepts && (
          <div className="px-4 pb-4 space-y-3 text-xs text-slate-300 leading-relaxed">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800"><p className="font-bold text-white">Costo total del proyecto</p><p>Todo lo que gastarás para ejecutarlo durante el proyecto.</p></div>
              <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/30"><p className="font-bold text-cyan-300">Subsidio (lo que pone {agency})</p><p>No se devuelve. Puede ser hasta el {maxPct}% del total{hasMax ? <>, con un máximo de {clp(maxSubsidyCLP)}</> : <> (confirma el porcentaje y el monto máximo en las bases)</>}.</p></div>
              <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30"><p className="font-bold text-emerald-300">Aporte de tu empresa</p><p>El resto, en dinero de tu empresa ("aporte pecuniario").</p></div>
            </div>
            <p className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-100">
              <strong>Ejemplo:</strong> si tu proyecto cuesta {clp(exampleTotal)}, {agency} puede poner hasta {clp(exampleSub)} y tu empresa pone {clp(exampleTotal - exampleSub)}.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Escribe todo <strong>sin IVA</strong> (valor neto). Si tu empresa recupera el IVA, el fondo no lo paga.</li>
              <li>El gasto se divide en 4 <strong>cuentas</strong> (tipos de gasto). Más abajo te explicamos qué va en cada una.</li>
              <li>Los nombres de las cuentas y los porcentajes exactos pueden variar según la convocatoria: confírmalos en las bases.{basesUrl ? <> <a href={basesUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline inline-flex items-center gap-0.5">Ver bases <ExternalLink className="w-3 h-3" /></a></> : null}</li>
            </ul>
          </div>
        )}
      </section>

      {/* 2. Calculadora */}
      <section className="rounded-2xl bg-gradient-to-br from-cyan-950/60 to-slate-950 border border-cyan-500/30 p-4 sm:p-5 space-y-3">
        <p className="text-sm font-bold text-white flex items-center gap-2"><Calculator className="w-4 h-4 text-cyan-400" /> Paso 1: ¿Cuánto costará tu proyecto en total?</p>
        <p className="text-xs text-slate-300">Suma aproximada de todo lo que necesitas (sin IVA). Si no lo sabes exacto, parte con una estimación: después ajustas cada cuenta.</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
          <div>
            <label htmlFor="budget-total" className="text-[11px] font-semibold text-slate-300 block mb-1">Costo total estimado del proyecto</label>
            <MoneyInput id="budget-total" value={totalInput} onChange={setTotalInput} tone="cyan" placeholder={exampleTotal.toLocaleString('es-CL')} />
          </div>
          <button
            type="button"
            disabled={totalInput <= 0}
            onClick={applyDistribution}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 justify-center"
          >
            <Wand2 className="w-4 h-4" /> Repartir en las cuentas
          </button>
        </div>
        {totalInput > 0 && (
          <p className="text-xs text-slate-200">
            Con ese total, {agency} puede poner <strong className="text-cyan-300">{clp(calcSub)}</strong> y tu empresa <strong className="text-emerald-300">{clp(calcEmp)}</strong>.
            {hasMax && calcSub >= maxSubsidyCLP && <> Llegaste al máximo del fondo: si el proyecto cuesta más, la diferencia la pone tu empresa.</>}
            {' '}Al repartir, sugerimos: personas 50%, operación 30%, expertos externos 15% y administración 5%. Luego cambia los montos según tu caso.
          </p>
        )}
      </section>

      {/* 3. Cuentas */}
      <section id="budget-accounts" className="scroll-mt-40 space-y-3">
        <p className="text-sm font-bold text-white">Paso 2: revisa cada tipo de gasto</p>
        <p className="text-xs text-slate-400">Abre cada cuenta, revisa los montos y escribe en qué gastarás y por qué. Si no tendrás gastos en una cuenta, déjala en $0.</p>
        {BUDGET_GUIDES.map((g, i) => {
          const a = accounts[g.key] || { corfoContributionCLP: 0, companyPecuniaryCLP: 0, item: '', justification: '' };
          const sum = (a.corfoContributionCLP || 0) + (a.companyPecuniaryCLP || 0);
          const open = openKey === g.key;
          const textsOk = sum === 0 || (a.item?.trim() && a.justification?.trim());
          return (
            <div key={g.key} className={`rounded-2xl border transition-colors ${open ? 'bg-slate-950 border-cyan-500/40' : 'bg-slate-950/70 border-slate-800'}`}>
              <button type="button" onClick={() => setOpenKey(open ? null : g.key)} className="w-full p-4 flex items-center justify-between gap-3 text-left cursor-pointer" aria-expanded={open}>
                <span className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cuenta {i + 1} · {g.account}</span>
                  <span className="block text-sm font-bold text-white">{g.plainName}</span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono text-slate-300">{clp(sum)}</span>
                  {sum > 0 && (textsOk ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />)}
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {open && (
                <div className="px-4 pb-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 text-xs">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <p className="font-bold text-emerald-300 mb-1">Qué va aquí</p>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-200">{g.whatGoes.map(x => <li key={x}>{x}</li>)}</ul>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <p className="font-bold text-rose-300 mb-1">Qué NO va</p>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-200">{g.whatNot.map(x => <li key={x}>{x}</li>)}</ul>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400"><strong className="text-slate-300">Ejemplo:</strong> {g.example}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`b-${g.key}-sub`} className="text-[11px] font-semibold text-cyan-300 block mb-1">Lo que pides a {agency}</label>
                      <MoneyInput id={`b-${g.key}-sub`} value={a.corfoContributionCLP} onChange={n => onChange(g.key, 'corfoContributionCLP', n)} tone="cyan" />
                    </div>
                    <div>
                      <label htmlFor={`b-${g.key}-emp`} className="text-[11px] font-semibold text-emerald-300 block mb-1">Lo que pone tu empresa</label>
                      <MoneyInput id={`b-${g.key}-emp`} value={a.companyPecuniaryCLP} onChange={n => onChange(g.key, 'companyPecuniaryCLP', n)} tone="emerald" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`b-${g.key}-item`} className="text-[11px] font-semibold text-slate-300 block mb-1">¿En qué lo gastarás?</label>
                      <input id={`b-${g.key}-item`} value={a.item} onChange={e => onChange(g.key, 'item', e.target.value)} placeholder={g.itemPlaceholder} className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500 placeholder:text-slate-600" />
                    </div>
                    <div>
                      <label htmlFor={`b-${g.key}-just`} className="text-[11px] font-semibold text-slate-300 block mb-1">¿Por qué lo necesita el proyecto?</label>
                      <input id={`b-${g.key}-just`} value={a.justification} onChange={e => onChange(g.key, 'justification', e.target.value)} placeholder={g.justificationPlaceholder} className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500 placeholder:text-slate-600" />
                    </div>
                  </div>
                  {i < BUDGET_GUIDES.length - 1 && (
                    <button type="button" onClick={() => setOpenKey(BUDGET_GUIDES[i + 1].key)} className="text-xs font-bold text-cyan-300 hover:text-cyan-200 cursor-pointer">
                      Siguiente: {BUDGET_GUIDES[i + 1].plainName} →
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* 4. Revisión */}
      <section className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${subExceeded || pctExceeded ? 'bg-rose-500/10 border-rose-500/40' : valid ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950/70 border-slate-800'}`}>
        <p className="text-sm font-bold text-white">Paso 3: revisión</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><p className="text-slate-400">Pides a {agency}</p><p className={`font-mono font-bold ${subExceeded ? 'text-rose-300' : 'text-cyan-300'}`}>{clp(totals.sub)}</p><p className="text-[10px] text-slate-500">{hasMax ? `Máximo ${clp(maxSubsidyCLP)}` : "Máximo según bases"}</p></div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><p className="text-slate-400">Pone tu empresa</p><p className="font-mono font-bold text-emerald-300">{clp(totals.emp)}</p></div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><p className="text-slate-400">Costo total</p><p className="font-mono font-bold text-white">{clp(totals.total)}</p></div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><p className="text-slate-400">Parte del fondo</p><p className={`font-mono font-bold ${pctExceeded ? 'text-rose-300' : 'text-amber-300'}`}>{totals.pct.toFixed(1)}%</p><p className="text-[10px] text-slate-500">Máximo {maxPct}%</p></div>
        </div>
        <div className="text-xs leading-relaxed space-y-1.5">
          {totals.total === 0 && <p className="text-slate-300">Empieza por el Paso 1: escribe el costo total y presiona "Repartir en las cuentas".</p>}
          {subExceeded && <p className="text-rose-200">Pides {clp(totals.sub - maxSubsidyCLP)} más de lo que entrega el fondo. Baja lo que pides a {agency} en alguna cuenta.</p>}
          {pctExceeded && !subExceeded && (
            <p className="text-rose-200">
              El fondo puede poner como máximo el {maxPct}% del total. Para pedir {clp(totals.sub)}, tu empresa debe poner al menos {clp(Math.ceil(totals.sub / (maxPct / 100)) - totals.sub)} (hoy pone {clp(totals.emp)}).
            </p>
          )}
          {(subExceeded || pctExceeded) && (
            <button type="button" onClick={autoFix} className="mt-1 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
              <Wand2 className="w-4 h-4" /> Ajustar automáticamente
            </button>
          )}
          {valid && <p className="text-emerald-200">Tu presupuesto cumple los topes de {fundName}: el fondo pone el {totals.pct.toFixed(1)}% y tu empresa {clp(totals.emp)}.</p>}
          {missingTexts.length > 0 && (
            <p className="text-amber-200">Falta explicar en qué gastarás y por qué en: {missingTexts.map(g => g.plainName.toLowerCase()).join(', ')}. Los evaluadores revisan que cada gasto se justifique.</p>
          )}
        </div>
      </section>
    </div>
  );
};
