import { ChileanFund } from '../types/funds';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import type { GrantMatchResult } from './grantMatcher';

export const SECTORES = [
  'agro', 'pesca_acuicultura', 'alimentos_bebidas', 'comercio', 'servicios', 'manufactura', 'construccion',
  'turismo_gastronomia', 'salud', 'tecnologia_software', 'energia_medioambiente', 'mineria', 'educacion',
  'creativo_cultural', 'transporte_logistica', 'otro',
] as const;
export const ETAPAS = ['idea', 'en_marcha_sin_formalizar', 'formalizada_sin_ventas', 'con_ventas', 'desconocida'] as const;
export const OBJETIVOS = [
  'maquinaria_equipamiento', 'infraestructura', 'capital_trabajo', 'formalizarse', 'digitalizacion',
  'innovacion_producto', 'desarrollo_tecnologico', 'investigacion_id', 'resolver_problema_productivo',
  'contratar_expertos', 'exportar_internacionalizar', 'escalar_crecer',
] as const;
export const INNOVACION = ['ninguna', 'incremental', 'tecnologica', 'cientifica'] as const;

export interface CaseFeatures {
  esValido: boolean;
  rubro: string;
  sector: (typeof SECTORES)[number];
  etapa: (typeof ETAPAS)[number];
  ventasAnualesCLP: number | null;
  objetivos: (typeof OBJETIVOS)[number][];
  nivelInnovacion: (typeof INNOVACION)[number];
  vinculoUniversidad: boolean;
  liderazgoFemenino: boolean | null;
  region: string | null;
}

const UF_REFERENCIA_CLP = 39000; // solo si el servidor no entrega la UF del día

function tramoUF(ventasCLP: number | null, uf: number): 'sin_ventas' | 'bajo_200' | '200_2400' | '2400_25000' | '25000_100000' | 'mayor_100000' | null {
  if (ventasCLP === null) return null;
  if (ventasCLP <= 0) return 'sin_ventas';
  const v = ventasCLP / uf;
  if (v < 200) return 'bajo_200';
  if (v < 2400) return '200_2400';
  if (v < 25000) return '2400_25000';
  if (v < 100000) return '25000_100000';
  return 'mayor_100000';
}

interface Scored { fund: ChileanFund; score: number; reasons: string[]; blockers: string[]; }

export function recommendFromFeatures(f: CaseFeatures, opts: { ufCLP?: number | null } = {}): GrantMatchResult {
  if (!f.esValido) {
    return {
      isValidProject: false,
      noMatchReason: 'Para postular a fondos públicos necesitas al menos una idea de negocio, un producto o servicio a desarrollar, o una empresa en marcha.',
      guidanceTitle: 'Cuéntanos a qué te dedicas o qué quieres emprender',
      guidanceSteps: ['1. ¿A qué se dedica (o se dedicará) tu negocio?', '2. ¿Ya vendes o estás partiendo?', '3. ¿Qué quieres financiar?'],
      suggestedPrompts: [
        'Soy pescador artesanal en Chiloé y quiero comprar un motor para mi bote.',
        'Tengo una clínica dental con ventas y necesito equipamiento nuevo.',
        'Estamos desarrollando una app sin ventas todavía y tenemos un prototipo.',
      ],
    };
  }

  const uf = opts.ufCLP || UF_REFERENCIA_CLP;
  const tramo = tramoUF(f.ventasAnualesCLP, uf);
  const obj = new Set(f.objetivos);
  const innov = f.nivelInnovacion;
  const techOrScience = innov === 'tecnologica' || innov === 'cientifica';
  const innovative = innov !== 'ninguna';
  const conVentas = f.etapa === 'con_ventas';
  const sinFormalizar = f.etapa === 'idea' || f.etapa === 'en_marcha_sin_formalizar';
  const agro = f.sector === 'agro' || (f.sector === 'alimentos_bebidas' && /agr|cultiv|frut|hort|lech|apic|vin/i.test(f.rubro));
  const equipar = obj.has('maquinaria_equipamiento') || obj.has('infraestructura') || obj.has('capital_trabajo') || obj.has('digitalizacion');
  const quiereID = obj.has('desarrollo_tecnologico') || obj.has('investigacion_id');
  const exporta = obj.has('exportar_internacionalizar');
  const mujer = f.liderazgoFemenino === true;

  const results: Scored[] = CHILEAN_FUNDS.map((fd) => ({ fund: fd, score: 0, reasons: [], blockers: [] }));
  const get = (id: string) => results.find((r) => r.fund.id === id)!;
  const add = (id: string, pts: number, reason?: string) => { const r = get(id); if (!r) return; r.score += pts; if (reason && pts > 0) r.reasons.push(reason); };
  const block = (id: string, why: string) => { const r = get(id); if (r) r.blockers.push(why); };

  if (sinFormalizar) {
    if (mujer) add('sercotec_abeja_emprende', 70, 'eres mujer y aún no inicias actividades en 1ª categoría');
    else add('sercotec_semilla_emprende', 60, 'aún no inicias actividades en 1ª categoría');
    if (!mujer) add('sercotec_semilla_emprende', obj.has('formalizarse') || equipar ? 15 : 0, 'quieres formalizarte o equiparte para partir');
    // Alternativa para quien está sin trabajo (sin cotizaciones en 6 meses): mismo formulario, $3.000.000
    add('sercotec_modo_empleo', 40, 'aún no inicias actividades en 1ª categoría; si estás sin trabajo (sin cotizaciones en los últimos 6 meses), este fondo es para ti');
  } else {
    block('sercotec_modo_empleo', 'es solo para personas sin inicio de actividades y sin trabajo en los últimos 6 meses');
    block('sercotec_semilla_emprende', 'es solo para personas sin inicio de actividades');
    block('sercotec_abeja_emprende', 'es solo para mujeres sin inicio de actividades');
  }
  if (!mujer) block('sercotec_abeja_emprende', 'es exclusivo para mujeres');

  if (conVentas) {
    add('sercotec_crece', 45, 'tu negocio ya está en marcha con ventas');
    if (equipar) add('sercotec_crece', 30, 'quieres invertir en equipamiento, infraestructura o capital de trabajo');
    if (techOrScience) add('sercotec_crece', -20);
    if (tramo && tramo !== '200_2400' && tramo !== '2400_25000') block('sercotec_crece', 'pide ventas anuales entre 200 y 25.000 UF');
  } else {
    block('sercotec_crece', 'pide ventas demostradas (200 a 25.000 UF al año)');
  }

  if (innovative && obj.has('innovacion_producto')) add('corfo_semilla_inicia', 10);
  if (techOrScience || (innovative && obj.has('innovacion_producto'))) {
    if (!conVentas || tramo === 'sin_ventas' || tramo === 'bajo_200') add('corfo_semilla_inicia', 65, 'propones una solución innovadora y aún no tienes ventas relevantes');
    if (conVentas && (tramo === null || tramo === 'bajo_200' || tramo === '200_2400')) add('corfo_semilla_expande', 65, 'tu solución innovadora ya tiene primeras ventas');
    if (obj.has('escalar_crecer')) add('corfo_semilla_expande', 15, 'buscas escalar');
  } else {
    block('corfo_semilla_inicia', 'exige una solución innovadora con potencial de crecimiento');
    block('corfo_semilla_expande', 'exige una solución innovadora con primeras ventas');
  }

  if (quiereID && techOrScience) {
    if (conVentas) add('corfo_crea_valida', 70, 'quieres desarrollar y validar tecnología y tu empresa tiene ventas');
    else block('corfo_crea_valida', 'pide una empresa con ventas e inicio de actividades');
  }
  if (innov === 'cientifica' || f.vinculoUniversidad) {
    const pts = innov === 'cientifica' && f.vinculoUniversidad ? 85 : obj.has('investigacion_id') || innov === 'cientifica' ? 60 : 30;
    add('anid_fondef_idea', pts, 'tu proyecto tiene base científica y vínculo con una universidad o centro de investigación');
  }
  if (conVentas && (obj.has('resolver_problema_productivo') || obj.has('contratar_expertos'))) {
    add('corfo_sumate_innovar', 60, 'tienes ventas y quieres resolver un problema productivo con apoyo experto');
  }
  if (techOrScience && (exporta || obj.has('escalar_crecer')) && f.sector === 'tecnologia_software') {
    add('startup_chile_ignite', 55, 'eres una startup tecnológica con proyección internacional');
  }
  if (agro) {
    if (innovative) add('fia_innovacion_agro', techOrScience ? 80 : 70, 'innovas en el sector agroalimentario');
    else add('fia_innovacion_agro', 20, 'eres del sector agroalimentario');
  }

  const beforeBlock = results.map((r) => ({ r, score: r.score }));
  for (const r of results) { if (r.blockers.length) r.score = Math.min(r.score, 10); }

  const ranked = results.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
  const winner = ranked[0];

  const blockedBest = beforeBlock.filter((x) => x.r.blockers.length && x.score >= 40).sort((a, b) => b.score - a.score)[0];
  if ((!winner || winner.score < 40) && blockedBest && f.etapa !== 'desconocida') {
    return {
      isValidProject: false,
      noMatchReason: `Por tu perfil, el fondo más cercano sería ${blockedBest.r.fund.name}, pero ${blockedBest.r.blockers[0]}. Revisa "Convocatorias" por llamados regionales o sectoriales que puedan calzar.`,
      guidanceTitle: 'Otras opciones',
      guidanceSteps: ['1. Revisa las convocatorias abiertas de tu región en la sección Convocatorias.', '2. Si tus datos cambian (ventas, inicio de actividades), vuelve a buscar.'],
      suggestedPrompts: [],
    } as GrantMatchResult;
  }

  if (!winner || winner.score < 40) {
    return {
      isValidProject: false,
      noMatchReason: `Entendimos que tu negocio es de ${f.rubro}. Para recomendarte bien necesitamos un par de datos más.`,
      guidanceTitle: 'Responde esto y vuelve a buscar',
      guidanceSteps: [
        f.etapa === 'desconocida' ? '• ¿Ya tienes inicio de actividades y ventas, o estás partiendo?' : '',
        f.objetivos.length === 0 ? '• ¿Qué quieres financiar? (equipos, infraestructura, un producto nuevo, I+D, exportar…)' : '',
        !innovative ? '• ¿Tu proyecto tiene algo nuevo o tecnológico, o es un negocio tradicional que quiere crecer?' : '',
      ].filter(Boolean),
      suggestedPrompts: [],
      followUp: buildFollowUp(f),
    } as GrantMatchResult;
  }

  const pct = (s: number) => Math.max(30, Math.min(95, Math.round(s)));
  const notas: string[] = [];
  if (agro && !innovative) notas.push('Si eres pequeño productor agrícola, revisa también INDAP, el instrumento habitual para la agricultura familiar.');
  if (f.sector === 'pesca_acuicultura') notas.push('Para pesca artesanal existen además llamados regionales (Corfo, Sercotec o el Gobierno Regional); revisa "Convocatorias".');

  return {
    isValidProject: true,
    wowHeadline: `Para ${f.rubro}, el fondo que mejor calza es ${winner.fund.name}.`,
    primaryFund: {
      fundId: winner.fund.id,
      fundName: winner.fund.name,
      agency: winner.fund.agency,
      subsidyFormatted: winner.fund.subsidyFormatted,
      maxSubsidyCLP: winner.fund.maxSubsidyCLP,
      coFinancePct: winner.fund.maxCoFinancePct,
      whenToApply: winner.fund.callSchedule,
      status: winner.fund.status,
      matchScore: pct(winner.score),
      whyYouQualify: `Calza porque ${winner.reasons.join(', ')}. ${winner.fund.salesRequirement}${notas.length ? ' ' + notas.join(' ') : ''}`,
      femaleBonusEligible: mujer && (winner.fund.femaleBonusPct || 0) > 0,
      femaleBonusText: mujer && (winner.fund.femaleBonusPct || 0) > 0 ? `+${winner.fund.femaleBonusPct}% por liderazgo femenino` : undefined,
    },
    secondaryFunds: ranked.slice(1).filter((r) => r.score >= 40).slice(0, 2).map((r) => ({
      fundId: r.fund.id, fundName: r.fund.name, agency: r.fund.agency, subsidyFormatted: r.fund.subsidyFormatted,
      whenToApply: r.fund.callSchedule, status: r.fund.status, matchScore: pct(r.score),
    })),
    followUp: buildFollowUp(f),
  } as GrantMatchResult;
}

function buildFollowUp(f: CaseFeatures): GrantMatchResult['followUp'] {
  if (f.etapa === 'desconocida') {
    return {
      question: '¿En qué etapa está tu negocio?',
      options: [
        { label: 'Es una idea / aún no inicio actividades', append: 'Aún no tengo inicio de actividades en el SII.' },
        { label: 'Tengo inicio de actividades, sin ventas', append: 'Tengo inicio de actividades pero sin ventas todavía.' },
        { label: 'Ya vendo', append: 'Ya tengo ventas anuales con inicio de actividades.' },
      ],
    };
  }
  if (f.objetivos.length === 0) {
    return {
      question: '¿Qué quieres financiar?',
      options: [
        { label: 'Equipos o infraestructura', append: 'Quiero financiar maquinaria, equipos o infraestructura.' },
        { label: 'Un producto o servicio nuevo', append: 'Quiero desarrollar un producto o servicio nuevo e innovador.' },
        { label: 'Investigación y desarrollo', append: 'Quiero hacer investigación y desarrollo tecnológico.' },
        { label: 'Exportar', append: 'Quiero exportar.' },
      ],
    };
  }
  return undefined;
}
