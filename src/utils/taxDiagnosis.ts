import type { CarpetaTributaria, CtePerson, CteActivity } from './carpetaTributaria';
import type { ChileanFund, CompanyType, SalesBracket } from '../types/funds';

/**
 * Diagnóstico tributario a partir de la Carpeta Tributaria (solo con lo que el documento dice).
 * Lo calcula el servidor y lo muestra SiiUploaderModal antes de que el usuario pague.
 */

export type AlertLevel = 'critico' | 'atencion' | 'ok' | 'info';
export type FundVerdict = 'cumple' | 'no_cumple' | 'revisar';

export interface DiagnosisAlert {
  level: AlertLevel;
  title: string;
  detail: string;
}

export interface FundCheck {
  fundId: string;
  name: string;
  agency: string;
  verdict: FundVerdict;
  reasons: string[];
}

export interface TaxDiagnosis {
  generatedAt: string | null;
  carpetaKind: string;
  company: {
    name: string;
    rut: string;
    entityType: string | null;
    companyType: CompanyType | '';
    startDate: string | null;
    ageMonths: number | null;
    ageText: string;
    taxCategory: string | null;
    taxRegime: string | null;
    firstCategory: boolean;
    activities: CteActivity[];
    address: string | null;
    region: string | null;
    legalRepresentatives: CtePerson[];
    partners: CtePerson[];
  };
  sales: {
    monthly: { period: string; label: string; revenue: number; declared: boolean; pending: boolean }[];
    windowLabel: string;
    last12Total: number;
    last12MonthsWithSales: number;
    previous12Total: number | null;
    changePct: number | null;
    annual: { year: number; income: number }[];
    ufValue: number;
    ufIsEstimate: boolean;
    last12UF: number;
    sizeLabel: string;
    salesBracket: SalesBracket;
  };
  compliance: {
    f29Expected: number;
    f29Declared: number;
    f29Missing: string[];
    f29Late: string[];
    f29Pending: string | null;
    f22Late: number[];
    observations: string[];
  };
  employees: { year: number; salariesPaid: number } | null;
  alerts: DiagnosisAlert[];
  funds: FundCheck[];
}

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

export const REGION_NAMES: Record<string, string> = {
  '1': 'Tarapacá', '2': 'Antofagasta', '3': 'Atacama', '4': 'Coquimbo', '5': 'Valparaíso',
  '6': "O'Higgins", '7': 'Maule', '8': 'Biobío', '9': 'La Araucanía', '10': 'Los Lagos',
  '11': 'Aysén', '12': 'Magallanes', '13': 'Metropolitana', '14': 'Los Ríos',
  '15': 'Arica y Parinacota', '16': 'Ñuble'
};

const clp = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;
const periodLabel = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};
const periodShort = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  return `${MONTH_SHORT[m - 1]} ${String(y).slice(2)}`;
};

function parseDMY(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

function addMonths(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Vencimiento del F29 de un período: día 20 del mes siguiente (contribuyentes con facturación electrónica). */
function f29DueDate(period: string): Date {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m, 20, 23, 59);
}

export function companyTypeFromEntity(entity: string | null): CompanyType | '' {
  const e = (entity || '').toUpperCase();
  if (/POR ACCIONES/.test(e)) return 'spa';
  if (/INDIVIDUAL DE RESPONSABILIDAD LIMITADA/.test(e)) return 'eirl';
  if (/RESPONSABILIDAD LIMITADA|LIMITADA/.test(e)) return 'srl';
  if (/ANONIMA|ANÓNIMA/.test(e)) return 'sa';
  if (/PERSONA NATURAL/.test(e)) return 'persona_natural';
  return '';
}

const COMPANY_TYPE_LABEL: Record<string, string> = {
  spa: 'sociedad por acciones (SpA)',
  srl: 'sociedad de responsabilidad limitada',
  eirl: 'EIRL',
  sa: 'sociedad anónima',
  persona_natural: 'persona natural',
  sin_iniciar: 'persona sin inicio de actividades'
};

export function salesBracketFor(annualCLP: number, ufValue: number): SalesBracket {
  if (annualCLP <= 0) return 'sin_ventas';
  if (annualCLP < 60_000_000) return 'menor_60m';
  const uf = annualCLP / ufValue;
  if (uf < 2400) return 'micro_200_a_2400uf';
  if (uf < 25000) return 'pequena_2400_a_25000uf';
  if (uf < 100000) return 'mediana_25000_a_100000uf';
  return 'grande_mayor_100000uf';
}

/** Tamaño según Ley 20.416 (ventas anuales en UF). */
function sizeLabelFor(annualCLP: number, ufValue: number): string {
  if (annualCLP <= 0) return 'Sin ventas en los últimos 12 meses';
  const uf = annualCLP / ufValue;
  if (uf <= 2400) return 'Microempresa';
  if (uf <= 25000) return 'Pequeña empresa';
  if (uf <= 100000) return 'Mediana empresa';
  return 'Gran empresa';
}

function ageText(months: number | null): string {
  if (months === null) return 'Sin dato';
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} ${y === 1 ? 'año' : 'años'}`);
  if (m > 0 || y === 0) parts.push(`${m} ${m === 1 ? 'mes' : 'meses'}`);
  return parts.join(' y ');
}

/* -------------------------------------------------------------------------- */
/* Requisitos por fondo                                                        */
/* -------------------------------------------------------------------------- */

interface Ctx {
  companyType: CompanyType | '';
  ageMonths: number | null;
  last12: number;
  last12UF: number;
  previous12: number | null;
  bracket: SalesBracket;
  firstCategory: boolean;
  activityCodes: string[];
}

type Check = { verdict: FundVerdict; reason: string };

function specificChecks(fund: ChileanFund, c: Ctx): Check[] {
  const out: Check[] = [];
  const age = c.ageMonths;
  switch (fund.id) {
    // Requisitos según las bases oficiales (ver src/data/fundStandards.ts)
    case 'corfo_semilla_inicia':
      if (age !== null) out.push(age <= 18
        ? { verdict: 'cumple', reason: `Antigüedad de ${ageText(age)} (máximo 18 meses para empresas)` }
        : { verdict: 'no_cumple', reason: `Antigüedad de ${ageText(age)}; las empresas pueden tener máximo 18 meses de inicio de actividades` });
      out.push(c.last12 <= 0
        ? { verdict: 'cumple', reason: 'Sin ventas registradas (las empresas deben postular sin ventas)' }
        : { verdict: 'no_cumple', reason: `Registras ventas por ${clp(c.last12)}; las empresas deben postular sin ventas` });
      break;
    case 'corfo_semilla_expande':
      if (age !== null) out.push(age <= 36
        ? { verdict: 'cumple', reason: `Antigüedad de ${ageText(age)} (máximo 36 meses)` }
        : { verdict: 'no_cumple', reason: `Antigüedad de ${ageText(age)}; pide máximo 36 meses` });
      out.push(c.last12 >= 100_000 && c.last12 <= 80_000_000
        ? { verdict: 'cumple', reason: `Ventas de 12 meses (${clp(c.last12)}) entre $100.000 y $80.000.000` }
        : { verdict: 'no_cumple', reason: `Pide ventas de 12 meses entre $100.000 y $80.000.000; tienes ${clp(c.last12)}` });
      break;
    case 'corfo_crea_valida':
      if (age !== null) out.push(age >= 24
        ? { verdict: 'cumple', reason: `Antigüedad de ${ageText(age)} (pide al menos 24 meses)` }
        : { verdict: 'no_cumple', reason: `Antigüedad de ${ageText(age)}; pide al menos 24 meses` });
      out.push(c.last12 > 0 || (c.previous12 || 0) > 0
        ? { verdict: 'cumple', reason: 'Registra ventas en los últimos 24 meses' }
        : { verdict: 'no_cumple', reason: 'Pide ventas en los últimos 24 meses' });
      if (!c.firstCategory) out.push({ verdict: 'revisar', reason: 'Pide inicio de actividades en primera categoría vigente' });
      break;
    case 'corfo_sumate_innovar':
      if (age !== null) out.push(age >= 24
        ? { verdict: 'cumple', reason: `Antigüedad de ${ageText(age)} (pide al menos 24 meses)` }
        : { verdict: 'no_cumple', reason: `Antigüedad de ${ageText(age)}; pide al menos 24 meses` });
      out.push(c.last12 > 0 || (c.previous12 || 0) > 0
        ? { verdict: 'cumple', reason: 'Registra ventas en los últimos 24 meses' }
        : { verdict: 'no_cumple', reason: 'Pide ventas en los últimos 24 meses' });
      out.push({ verdict: 'revisar', reason: 'Debes contratar 1 o 2 entidades colaboradoras (universidad o centro tecnológico)' });
      break;
    case 'startup_chile_build':
    case 'startup_chile_ignite':
      if (age !== null) out.push(age < 36
        ? { verdict: 'cumple', reason: `Antigüedad de ${ageText(age)}: empresa joven` }
        : { verdict: 'revisar', reason: `Antigüedad de ${ageText(age)}; Start-Up Chile apunta a startups jóvenes, revisa la antigüedad máxima en las bases` });
      out.push({ verdict: 'revisar', reason: 'Debe ser un emprendimiento de base tecnológica con potencial global' });
      break;
    case 'sercotec_semilla_emprende':
    case 'sercotec_abeja_emprende':
      out.push(c.firstCategory
        ? { verdict: 'no_cumple', reason: 'Es solo para personas sin inicio de actividades en primera categoría, y ya lo tienes' }
        : { verdict: 'revisar', reason: 'Tu carpeta no muestra primera categoría: confirma que no tienes inicio de actividades en esa categoría' });
      break;
    case 'sercotec_crece':
      out.push(c.last12UF >= 200 && c.last12UF <= 25000
        ? { verdict: 'cumple', reason: `Ventas de 12 meses de ${Math.round(c.last12UF).toLocaleString('es-CL')} UF (pide entre 200 y 25.000 UF)` }
        : { verdict: 'no_cumple', reason: `Pide ventas anuales entre 200 y 25.000 UF; tienes ${Math.round(c.last12UF).toLocaleString('es-CL')} UF en 12 meses` });
      if (!c.firstCategory) out.push({ verdict: 'no_cumple', reason: 'Pide inicio de actividades en primera categoría' });
      break;
    case 'anid_fondef_idea':
      out.push({ verdict: 'revisar', reason: 'Postula una universidad o centro de I+D; tu empresa participa como asociada y aporta' });
      break;
    case 'fia_innovacion_agro': {
      out.push(c.last12UF <= 50000
        ? { verdict: 'cumple', reason: `Ventas de ${Math.round(c.last12UF).toLocaleString('es-CL')} UF (máximo 50.000 UF)` }
        : { verdict: 'no_cumple', reason: 'Es para micro, pequeñas y medianas empresas (hasta 50.000 UF de ventas)' });
      const agro = c.activityCodes.some(code => /^(01|02|03|10|11)/.test(code));
      out.push(agro
        ? { verdict: 'cumple', reason: 'Tu giro está en el sector silvoagropecuario o alimentario' }
        : { verdict: 'revisar', reason: 'Está dirigido al sector silvoagroalimentario; tus actividades son de otro rubro (puedes postular con una empresa asociada del sector)' });
      break;
    }
  }
  return out;
}

function evaluateFund(fund: ChileanFund, c: Ctx): FundCheck {
  // Primero los requisitos propios del fondo (ventas, antigüedad), que son los que más explican el resultado
  const checks: Check[] = specificChecks(fund, c);
  if (checks.length === 0 && !fund.salesBracketsEligible.includes(c.bracket)) {
    checks.push({ verdict: 'no_cumple', reason: `Tu nivel de ventas no está en el rango del fondo: ${fund.salesRequirement}` });
  }
  if (c.companyType) {
    checks.push(fund.beneficiaryTypes.includes(c.companyType)
      ? { verdict: 'cumple', reason: `Admite ${COMPANY_TYPE_LABEL[c.companyType] || c.companyType}` }
      : { verdict: 'no_cumple', reason: `No admite ${COMPANY_TYPE_LABEL[c.companyType] || c.companyType}` });
  }

  const verdict: FundVerdict = checks.some(ch => ch.verdict === 'no_cumple')
    ? 'no_cumple'
    : checks.some(ch => ch.verdict === 'revisar') ? 'revisar' : 'cumple';
  // Primero las razones que explican el veredicto
  const reasons = [
    ...checks.filter(ch => ch.verdict === verdict),
    ...checks.filter(ch => ch.verdict !== verdict)
  ].map(ch => ch.reason);
  return { fundId: fund.id, name: fund.name, agency: fund.agency, verdict, reasons };
}

/* -------------------------------------------------------------------------- */

export function buildTaxDiagnosis(
  cte: CarpetaTributaria,
  funds: ChileanFund[],
  opts: { ufValue: number; ufIsEstimate: boolean; now?: Date }
): TaxDiagnosis {
  const ref = parseDMY(cte.generatedAt) || opts.now || new Date();
  const start = parseDMY(cte.startDate);
  const ageMonths = start
    ? Math.max(0, (ref.getFullYear() - start.getFullYear()) * 12 + (ref.getMonth() - start.getMonth()) - (ref.getDate() < start.getDate() ? 1 : 0))
    : null;

  // F29: períodos del más antiguo al más reciente
  const f29 = [...cte.f29].sort((a, b) => a.period.localeCompare(b.period));
  const byPeriod = new Map(f29.map(m => [m.period, m]));
  const latest = f29.length ? f29[f29.length - 1].period : null;
  // El último período puede no haber vencido aún a la fecha de la carpeta
  const pending = latest && !byPeriod.get(latest)!.declared && ref <= f29DueDate(latest) ? latest : null;
  const lastClosed = latest ? (pending ? addMonths(latest, -1) : latest) : null;

  const windowPeriods = (end: string | null, n: number) => {
    if (!end) return [] as string[];
    const out: string[] = [];
    for (let i = n - 1; i >= 0; i--) out.push(addMonths(end, -i));
    return out;
  };
  const last12Periods = windowPeriods(lastClosed, 12);
  const prev12Periods = lastClosed ? windowPeriods(addMonths(lastClosed, -12), 12) : [];
  const sumRev = (ps: string[]) => ps.reduce((s, p) => s + (byPeriod.get(p)?.revenue || 0), 0);
  const last12Total = sumRev(last12Periods);
  const prevCovered = prev12Periods.length === 12 && prev12Periods.every(p => byPeriod.has(p));
  const previous12Total = prevCovered ? sumRev(prev12Periods) : null;
  const changePct = previous12Total && previous12Total > 0 ? Math.round(((last12Total - previous12Total) / previous12Total) * 1000) / 10 : null;

  const closedCount = f29.filter(m => m.period !== pending).length;
  const chartPeriods = windowPeriods(lastClosed, Math.min(24, closedCount)).filter(p => byPeriod.has(p));
  if (pending) chartPeriods.push(pending);
  const monthly = chartPeriods.map(p => {
    const m = byPeriod.get(p);
    return { period: p, label: periodShort(p), revenue: m?.revenue || 0, declared: Boolean(m?.declared), pending: p === pending };
  });

  const ufValue = opts.ufValue;
  const last12UF = last12Total / ufValue;
  const bracket = salesBracketFor(last12Total, ufValue);

  // Cumplimiento
  const expected = f29.filter(m => m.period !== pending);
  const f29Missing = expected.filter(m => !m.declared).map(m => m.period);
  const f29Late = expected
    .filter(m => m.declared && m.presentationDate)
    .filter(m => {
      const d = parseDMY(m.presentationDate!);
      return d ? d > f29DueDate(m.period) : false;
    })
    .map(m => m.period);
  const f22Late = cte.f22.filter(y => y.lateCharges > 0).map(y => y.taxYear).sort((a, b) => b - a);

  const latestWithSalaries = [...cte.f22].sort((a, b) => b.taxYear - a.taxYear).find(y => (y.salariesPaid || 0) > 0);
  const regionCode = cte.f22.find(y => y.regionCode)?.regionCode || null;
  const companyType = companyTypeFromEntity(cte.entityType);
  const firstCategory = /primera/i.test(cte.taxCategory || '') || cte.activities.some(a => /primera/i.test(a.category));

  // Alertas
  const alerts: DiagnosisAlert[] = [];
  if (cte.observations.length > 0) {
    alerts.push({ level: 'critico', title: 'Tienes anotaciones vigentes en el SII', detail: `La carpeta registra ${cte.observations.length} anotación(es). Muchos fondos exigen no tener observaciones tributarias: revísalas con tu contador antes de postular.` });
  }
  if (f29Missing.length > 0) {
    alerts.push({ level: 'critico', title: `Faltan ${f29Missing.length} declaraciones F29`, detail: `No aparecen declarados: ${f29Missing.map(periodLabel).join(', ')}. La mayoría de los fondos pide estar al día con el SII.` });
  }
  if (f29Late.length > 0) {
    alerts.push({ level: 'atencion', title: `${f29Late.length} F29 presentados fuera de plazo`, detail: `Presentados después del día 20 del mes siguiente: ${f29Late.slice(-6).map(periodLabel).join(', ')}${f29Late.length > 6 ? ' y otros' : ''}. Hoy están declarados, pero conviene mantener las declaraciones al día.` });
  }
  if (f22Late.length > 0) {
    alerts.push({ level: 'atencion', title: `Renta (F22) declarada con recargos en ${f22Late.length} ${f22Late.length === 1 ? 'año' : 'años'}`, detail: `Años tributarios ${f22Late.join(', ')} con intereses y multas por declaración fuera de plazo. Ya están presentados.` });
  }
  if (last12Periods.length > 0 && last12Total === 0) {
    alerts.push({ level: 'atencion', title: 'Sin ventas en los últimos 12 meses', detail: 'Los fondos para empresas en crecimiento piden ventas recientes. Los de etapa inicial, como Semilla Inicia, sí aceptan empresas sin ventas.' });
  }
  if (pending) {
    alerts.push({ level: 'info', title: `El F29 de ${periodLabel(pending)} aún está en plazo`, detail: 'A la fecha de la carpeta todavía no vencía, así que no lo contamos como faltante.' });
  }
  if (cte.observations.length === 0 && f29Missing.length === 0) {
    alerts.push({ level: 'ok', title: 'Sin anotaciones vigentes ni F29 pendientes', detail: `Revisamos ${expected.length} meses de declaraciones de IVA y no hay períodos sin declarar.` });
  }

  const ctx: Ctx = {
    companyType,
    ageMonths,
    last12: last12Total,
    last12UF,
    previous12: previous12Total,
    bracket,
    firstCategory,
    activityCodes: cte.activities.map(a => a.code)
  };
  const order: Record<FundVerdict, number> = { cumple: 0, revisar: 1, no_cumple: 2 };
  const fundChecks = funds.map(f => evaluateFund(f, ctx)).sort((a, b) => order[a.verdict] - order[b.verdict]);

  return {
    generatedAt: cte.generatedAt,
    carpetaKind: cte.kind,
    company: {
      name: cte.companyName,
      rut: cte.rut,
      entityType: cte.entityType,
      companyType,
      startDate: cte.startDate,
      ageMonths,
      ageText: ageText(ageMonths),
      taxCategory: cte.taxCategory,
      taxRegime: cte.taxRegime,
      firstCategory,
      activities: cte.activities,
      address: cte.address,
      region: regionCode ? REGION_NAMES[String(Number(regionCode))] || null : null,
      legalRepresentatives: cte.legalRepresentatives,
      partners: cte.partners
    },
    sales: {
      monthly,
      windowLabel: last12Periods.length ? `${periodLabel(last12Periods[0])} a ${periodLabel(last12Periods[last12Periods.length - 1])}` : '',
      last12Total,
      last12MonthsWithSales: last12Periods.filter(p => (byPeriod.get(p)?.revenue || 0) > 0).length,
      previous12Total,
      changePct,
      annual: cte.f22
        .filter(y => y.grossIncome !== null)
        .map(y => ({ year: y.taxYear - 1, income: y.grossIncome as number }))
        .sort((a, b) => a.year - b.year),
      ufValue,
      ufIsEstimate: opts.ufIsEstimate,
      last12UF,
      sizeLabel: sizeLabelFor(last12Total, ufValue),
      salesBracket: bracket
    },
    compliance: {
      f29Expected: expected.length,
      f29Declared: expected.filter(m => m.declared).length,
      f29Missing,
      f29Late,
      f29Pending: pending,
      f22Late,
      observations: cte.observations
    },
    employees: latestWithSalaries ? { year: latestWithSalaries.taxYear - 1, salariesPaid: latestWithSalaries.salariesPaid as number } : null,
    alerts,
    funds: fundChecks
  };
}
