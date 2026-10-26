/**
 * Calce de fondos con reglas claras (sin IA): filtra por requisitos excluyentes de las bases
 * (tipo de postulante, tramo de ventas, etapa, exclusivo mujeres) y ordena por afinidad con el proyecto.
 * Lo usan el diagnóstico (servidor y respaldo en el navegador) para que la IA solo elija entre fondos
 * que de verdad corresponden, y no termine recomendando siempre el mismo.
 */
import type { ChileanFund, SalesBracket, TRLStage, CompanyType } from '../types/funds';

export interface MatchAnswers {
  salesBracket?: SalesBracket | string;
  trlStage?: TRLStage | string;
  companyType?: CompanyType | string;
  isFemaleLed?: boolean;
  region?: string;
  projectSummary?: string;
}

export interface RankedFund {
  fund: ChileanFund;
  score: number;
  reasons: string[];
  open: boolean;
}

const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Ventas declaradas → tramos que cubren (p. ej. "menos de $60M" también es microempresa). */
function salesBracketsFor(b: string): string[] {
  switch (b) {
    case 'sin_ventas': return ['sin_ventas'];
    case 'menor_60m': return ['menor_60m', 'micro_200_a_2400uf'];
    case 'micro_200_a_2400uf': return ['micro_200_a_2400uf', 'menor_60m'];
    case 'pequena_2400_a_25000uf': return ['pequena_2400_a_25000uf', 'micro_200_a_2400uf'];
    case 'mediana_25000_a_100000uf': return ['mediana_25000_a_100000uf'];
    case 'grande_mayor_100000uf': return ['grande_mayor_100000uf'];
    default: return [];
  }
}

const SALES_LABEL: Record<string, string> = {
  sin_ventas: 'sin ventas',
  menor_60m: 'ventas menores a $60M',
  micro_200_a_2400uf: 'microempresa',
  pequena_2400_a_25000uf: 'pequeña empresa',
  mediana_25000_a_100000uf: 'mediana empresa',
  grande_mayor_100000uf: 'gran empresa'
};
const TRL_LABEL: Record<string, string> = {
  idea_concepto: 'idea',
  prototipo_lab: 'prototipo',
  mvp_validado: 'prototipo validado',
  primeras_ventas: 'ya vendes',
  escalamiento_global: 'escalamiento'
};

const ALMACEN_RE = /almacen|minimarket|botiller|panader|carnicer|rotiser|bazar|negocio de barrio|kiosco/;

const KEYWORDS: { re: RegExp; funds: string[]; reason: string }[] = [
  { re: /agro|agricol|campo|cultivo|riego|fruta|vino|vinedo|ganad|leche|apicul|miel|semilla|forestal|alimento|hortaliz|invernadero/, funds: ['fia_innovacion_agro'], reason: 'Tu proyecto es del sector agroalimentario, foco de FIA.' },
  { re: /investigaci|cientific|universidad|laboratorio|patente|i\+d|biotec|molecul|ensayo/, funds: ['anid_fondef_idea', 'corfo_crea_valida'], reason: 'Tiene un componente de investigación y desarrollo.' },
  { re: /software|app|aplicaci|plataforma|saas|inteligencia artificial|\bia\b|machine|digital|tecnolog|startup|marketplace|internet|iot|sensor|robot/, funds: ['startup_chile_build', 'startup_chile_ignite', 'corfo_semilla_inicia', 'corfo_semilla_expande', 'corfo_crea_valida'], reason: 'Es un emprendimiento tecnológico con potencial de escalar.' },
  { re: /export|internacional|global|latam|extranjer/, funds: ['startup_chile_build', 'startup_chile_ignite', 'corfo_semilla_expande'], reason: 'Apunta a mercados fuera de Chile.' },
  { re: /prototipo|desarroll|validar|nuevo producto|innovaci/, funds: ['corfo_crea_valida', 'corfo_semilla_inicia'], reason: 'Busca desarrollar y validar una solución nueva.' },
  { re: /tienda|almacen|negocio|local|peluquer|restauran|cafe|panader|taller|artesan|emprendimiento|comercio|servicio/, funds: ['sercotec_semilla_emprende', 'sercotec_abeja_emprende', 'sercotec_crece'], reason: 'Es un negocio tradicional, el foco de los fondos SERCOTEC.' },
  { re: /crecer|ampliar|maquinaria|equipamiento|aumentar ventas|nuevo local|expandir/, funds: ['sercotec_crece', 'corfo_semilla_expande'], reason: 'Busca crecer un negocio que ya vende.' },
  { re: /proveedor|cliente grande|gran empresa|asesor|consultor|experto|innovar en/, funds: ['corfo_sumate_innovar'], reason: 'Quiere innovar con apoyo de expertos externos.' },
  { re: ALMACEN_RE, funds: ['sercotec_digitaliza_almacen'], reason: 'Es un almacén o negocio de barrio, justo para quienes es este fondo.' },
  { re: /prototipo|desarroll|validar|nuevo producto|nuevo proceso|innovaci|region/, funds: ['corfo_innova_region'], reason: 'Busca desarrollar y validar algo nuevo en su región.' },
  { re: /export|internacional|escalar|expandir|nuevos mercados|extranjer/, funds: ['corfo_consolida_expande', 'startup_chile_growth'], reason: 'Quiere escalar una solución que ya funciona a más mercados.' },
  { re: /software|app|plataforma|saas|tecnolog|startup|levantar capital|inversionista/, funds: ['startup_chile_growth'], reason: 'Es una startup tecnológica que ya vende y quiere crecer.' },
];

const INNOVATION_RE = /innov|tecnolog|nuevo|software|app|plataforma|prototipo|patente|i\+d|desarroll|digital|inteligencia|sensor|automatiz|sostenib/;

function eligibleType(fund: ChileanFund, companyType: string): boolean {
  if (!companyType) return true;
  const types = (fund.beneficiaryTypes || []) as string[];
  if (types.includes(companyType)) return true;
  // Persona sin inicio de actividades puede postular a fondos para personas naturales (se formaliza si gana)
  if (companyType === 'sin_iniciar') return types.includes('persona_natural');
  return false;
}

export function isFemaleOnly(fund: ChileanFund): boolean {
  return fund.id === 'sercotec_abeja_emprende' || /mujer/.test(norm(fund.name));
}

/** Requisitos excluyentes. Devuelve los motivos por los que NO calza (vacío = calza). */
export function hardBlockers(fund: ChileanFund, a: MatchAnswers): string[] {
  const out: string[] = [];
  if (!eligibleType(fund, String(a.companyType || ''))) out.push('tipo de postulante');
  const sb = salesBracketsFor(String(a.salesBracket || ''));
  if (sb.length && fund.salesBracketsEligible?.length && !sb.some(b => (fund.salesBracketsEligible as string[]).includes(b))) out.push('tramo de ventas');
  if (a.trlStage && fund.trlEligible?.length && !(fund.trlEligible as string[]).includes(String(a.trlStage))) out.push('etapa del proyecto');
  if (isFemaleOnly(fund) && a.isFemaleLed === false) out.push('exclusivo para mujeres');
  return out;
}

export function rankCatalogFunds(funds: ChileanFund[], a: MatchAnswers, openFundIds: Set<string> = new Set()): { eligible: RankedFund[]; near: RankedFund[] } {
  const text = norm(a.projectSummary || '');
  const innovative = INNOVATION_RE.test(text);
  const eligible: RankedFund[] = [];
  const near: RankedFund[] = [];

  for (const fund of funds) {
    if (!fund.evaluationCriteria || !fund.trlEligible) continue; // solo fondos (no documentos)
    const blockers = hardBlockers(fund, a);
    const reasons: string[] = [];
    let score = 60;

    const sb = String(a.salesBracket || '');
    if (sb) reasons.push(`Tus ventas (${SALES_LABEL[sb] || sb}) están dentro del tramo que aceptan las bases.`);
    if (a.trlStage) reasons.push(`Tu etapa (${TRL_LABEL[String(a.trlStage)] || a.trlStage}) es la que financia este fondo.`);

    for (const k of KEYWORDS) {
      if (k.re.test(text) && k.funds.includes(fund.id)) {
        score += 12;
        if (!reasons.includes(k.reason)) reasons.unshift(k.reason);
      }
    }
    // Fondos sectoriales: solo suben si el proyecto es de ese sector
    const SECTORAL: Record<string, RegExp> = {
      fia_innovacion_agro: KEYWORDS[0].re,
      anid_fondef_idea: KEYWORDS[1].re,
      sercotec_digitaliza_almacen: ALMACEN_RE
    };
    if (SECTORAL[fund.id] && !SECTORAL[fund.id].test(text)) score -= 20;
    // Un almacén calza más con el fondo hecho para almacenes que con uno general
    if (fund.id === 'sercotec_digitaliza_almacen' && ALMACEN_RE.test(text)) score += 10;
    if (fund.requiresInnovation && !innovative) score -= 12;
    if (!fund.requiresInnovation && !innovative) score += 6;
    if (isFemaleOnly(fund) && a.isFemaleLed) { score += 15; reasons.unshift('Es un fondo exclusivo para mujeres emprendedoras.'); }
    else if (a.isFemaleLed && fund.femaleBonusPct) { score += 4; reasons.push(`Suma ${fund.femaleBonusPct}% adicional por liderazgo femenino.`); }

    const open = openFundIds.has(fund.id) || fund.callStatus === 'abierta';
    if (open) { score += 15; reasons.push('Tiene una convocatoria abierta ahora.'); }

    const ranked = { fund, score: Math.max(1, Math.min(98, score)), reasons: reasons.slice(0, 3), open };
    if (blockers.length === 0) eligible.push(ranked);
    else if (blockers.length === 1) near.push({ ...ranked, score: Math.max(1, ranked.score - 30), reasons: [`No cumples hoy un requisito: ${blockers[0]}.`, ...ranked.reasons].slice(0, 3) });
  }
  eligible.sort((x, y) => y.score - x.score || (y.fund.maxSubsidyCLP || 0) - (x.fund.maxSubsidyCLP || 0));
  near.sort((x, y) => y.score - x.score);
  return { eligible, near };
}

/** Convocatorias abiertas del monitor que calzan con la región y el perfil (las regionales solo si es tu región). */
export function rankLiveCalls(calls: any[], a: MatchAnswers, eligibleFundIds: string[]): { call: any; score: number }[] {
  const region = norm(a.region || '');
  const text = norm(a.projectSummary || '');
  const words = new Set(text.split(/[^a-z0-9]+/).filter(w => w.length > 4));
  const isPersona = a.companyType === 'persona_natural' || a.companyType === 'sin_iniciar';
  const out: { call: any; score: number }[] = [];
  for (const c of calls) {
    if (!c || c.vigente === false) continue;
    const title = norm(`${c.titulo || ''} ${c.resumen || ''}`);
    // Instrumentos que no son para postular una empresa (entidades, administradoras, garantías, créditos, leyes)
    if (/patrocinador|administradora|garantia|credito|cobertura|ley de incentivo|articulo|solicitud previa|becas/.test(title)) continue;
    const alc = norm(c.alcance || '');
    const national = !alc || alc.includes('todo chile') || alc.includes('nacional');
    if (!national) {
      if (!region) continue; // sin región conocida no se recomiendan convocatorias regionales
      if (!alc.includes(region) && !region.includes(alc)) continue;
    }
    const perfil = (Array.isArray(c.perfil) ? c.perfil : c.perfil ? [c.perfil] : []).map((p: any) => norm(p));
    if (perfil.length && a.companyType && !perfil.some((p: string) => p.includes(isPersona ? 'persona' : 'empresa'))) continue;

    let score = national ? 40 : 55;
    if (c.fundId && eligibleFundIds.includes(c.fundId)) score += 30;
    let hits = 0;
    words.forEach(w => { if (title.includes(w)) hits++; });
    score += Math.min(25, hits * 8);
    if (/bienes publicos|difusion tecnologica|red tecnologica|areas de manejo/.test(title)) score -= 15; // instrumentos colectivos
    // Nacionales sin relación con el proyecto no se muestran (solo ruido)
    if (national && score < 48) continue;
    out.push({ call: c, score });
  }
  return out.sort((x, y) => y.score - x.score);
}
