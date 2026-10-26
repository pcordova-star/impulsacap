import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { Convocatoria } from '../types/convocatoria';
import { CompanyProfile } from '../types/funds';
import { calculateDaysRemaining, filterConvocatoriasForProfile } from './convocatorias';

export interface GrantMatchResult {
  isValidProject: boolean;
  wowHeadline?: string;
  noMatchReason?: string;
  guidanceTitle?: string;
  guidanceSteps?: string[];
  suggestedPrompts?: string[];
  primaryFund?: {
    fundId: string;
    fundName: string;
    agency: string;
    subsidyFormatted: string;
    maxSubsidyCLP: number;
    coFinancePct: number;
    whenToApply: string;
    status: string;
    matchScore: number;
    whyYouQualify: string;
    femaleBonusEligible?: boolean;
    femaleBonusText?: string;
  };
  secondaryFunds?: Array<{
    fundId: string;
    fundName: string;
    agency: string;
    subsidyFormatted: string;
    whenToApply: string;
    status: string;
    matchScore: number;
  }>;
  liveRegionalCallMatch?: any;
  inferredProfile?: any;
  actionCallout?: string;
  analizadoCon?: string;
  caso?: any;
  followUp?: { question: string; options: { label: string; append: string }[] };
}

export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isNonActivityQuery(query: string): boolean {
  const norm = normalizeText(query);
  if (!norm || norm.length < 4) return true;

  const nonActivityPhrases = [
    'no hago nada',
    'no tengo nada',
    'no tengo proyecto',
    'no tengo idea',
    'no tengo empresa',
    'no tengo negocio',
    'no se que hacer',
    'no se',
    'nose',
    'nada',
    'nada de nada',
    'nada aun',
    'nada todavia',
    'sin proyecto',
    'sin actividad',
    'sin empresa',
    'sin idea',
    'ningun proyecto',
    'ninguna cosa',
    'no realizo nada',
    'no realizo ninguna actividad',
    'no desarrollo nada',
    'no tengo ningun proyecto',
    'solo mirando',
    'solo probando',
    'ninguno',
    'ninguna',
    'hola',
    'test',
    'prueba',
    'asdf',
    'qwerty',
    'nada por ahora',
    'no tengo nada pensado',
    'no se me ocurre nada',
    'no hago nada todavia',
    'no hago nada aun',
    'yo no hago nada',
    'no hago nada actualmente',
  ];

  if (nonActivityPhrases.some((p) => norm === p)) return true;

  if (
    norm.includes('no hago nada') ||
    norm.includes('no tengo nada') ||
    norm.includes('no tengo proyecto') ||
    norm.includes('no tengo idea') ||
    norm.includes('no tengo empresa') ||
    norm.includes('no tengo negocio') ||
    norm.includes('sin proyecto') ||
    norm.includes('sin actividad') ||
    norm.includes('no realizo ninguna actividad') ||
    norm.includes('nada de nada')
  ) {
    return true;
  }

  const words = norm.split(' ').filter((w) => w.length > 1);
  if (words.length <= 1) {
    const singleWordAllowed = [
      'panaderia',
      'startup',
      'software',
      'taller',
      'almacen',
      'agricultura',
      'biotecnologia',
      'turismo',
    ];
    if (!singleWordAllowed.some((kw) => norm.includes(kw))) {
      return true;
    }
  }

  return false;
}

export function evaluateChileanGrantMatch(
  query: string, 
  targetFundHint?: string,
  liveConvocatorias?: Convocatoria[],
  profile?: Partial<CompanyProfile>
): GrantMatchResult {
  const norm = normalizeText(query);

  if (isNonActivityQuery(query)) {
    return {
      isValidProject: false,
      noMatchReason: `Indicaste "${query.trim()}". Para postular a fondos públicos concursables de CORFO o SERCOTEC, las bases estatales exigen como requisito excluyente contar con al menos una idea de negocio, un producto/servicio a desarrollar o una empresa formalizada. Actualmente no es posible postular sin una actividad o proyecto definido.`,
      guidanceTitle: '¿Qué necesitas para postular con éxito a un fondo público?',
      guidanceSteps: [
        '1. Si no tienes empresa pero tienes una idea: Define qué problema resuelves y para quién (para fondos iniciales como SERCOTEC Capital Semilla o SERCOTEC Abeja si eres mujer).',
        '2. Si tienes un negocio tradicional en marcha: Formalízate en el SII en 1ª Categoría con ventas para postular a SERCOTEC Crece (hasta $5M para maquinaria).',
        '3. Si estás creando innovación tecnológica o software: Diseña un prototipo inicial o MVP para postular a CORFO Semilla Inicia o Start-Up Chile Build.',
      ],
      suggestedPrompts: [
        'Tengo una panadería artesanal en Valdivia y necesito comprar un horno industrial y vitrinas.',
        'Queremos desarrollar una plataforma SaaS con IA para optimizar la logística de última milla.',
        'Empresa agrícola en O\'Higgins que busca implementar sensores IoT para riego tecnificado.',
      ],
    };
  }

  // Indicadores por palabra completa o comienzo de palabra (no por subcadena).
  const words = norm.split(' ');
  const has = (...terms: string[]) =>
    terms.some((t) =>
      t.includes(' ') ? ` ${norm} `.includes(` ${t}`) : t.endsWith('$') ? words.includes(t.slice(0, -1)) : words.some((w) => w.startsWith(t)),
    );

  const isFemale = has('mujer', 'emprendedora', 'femenin', 'abeja', 'jefa de hogar', 'socias');

  const isAgro = has(
    'agro', 'agricol', 'agricult', 'campesin', 'predio', 'parcela', 'fundo$', 'chacra', 'huerto', 'hortaliz', 'invernadero',
    'cultivo', 'cultivamos', 'siembr', 'sembr', 'cosecha', 'plantacion', 'papa$', 'papas$', 'trigo', 'maiz', 'arandano',
    'frut', 'cerez', 'palta', 'uva$', 'uvas$', 'vino$', 'vinos$', 'vina$', 'vinedo', 'vitivinicola', 'olivo', 'nogal', 'berries',
    'ganad', 'bovino', 'ovino', 'lecher', 'leche$', 'queso', 'apicult', 'apicol', 'miel$', 'riego', 'sequia', 'hidric', 'suelo$', 'suelos$',
    'campo$', 'tractor', 'forraje', 'semillero',
  );

  const isScienceRD = has(
    'universidad', 'investigacion', 'cientif', 'paper', 'tesis', 'fondef', 'anid$', 'biotec', 'biotech', 'farmaceut', 'clinico',
    'patente', 'molecul', 'quimic', 'laboratorio', 'i+d', 'i d$', 'bioplast', 'biomaterial',
  );

  const isTraditional = has(
    'panaderia', 'pan$', 'pasteleria', 'taller', 'mecanic', 'almacen', 'minimarket', 'botilleria', 'carniceria', 'verduleria',
    'comercio', 'ferreteria', 'peluqueria', 'barberia', 'estetica', 'restaurant', 'comida', 'cafeteria', 'confeccion', 'ropa$',
    'textil', 'imprenta', 'construccion', 'contratista', 'transporte', 'flete', 'camion', 'muebleria', 'muebles', 'carpinteria',
    'turismo', 'hotel', 'hostal', 'cabana', 'veterinaria', 'petshop', 'gimnasio', 'bazar', 'libreria', 'maquinaria', 'equipamiento',
    'horno', 'local$', 'tienda',
  );

  const isTechStartup = has(
    'software', 'saas', 'ia$', 'inteligencia artificial', 'app$', 'apps$', 'aplicacion', 'plataforma', 'algoritmo', 'marketplace',
    'digital', 'fintech', 'edtech', 'healthtech', 'agtech', 'iot$', 'startup', 'tecnologic', 'api$', 'disruptiv', 'hardware', 'machine learning',
  );

  const isGlobalScalable = has('global', 'internacional', 'latam', 'escalar al mundo', 'eeuu', 'exportar', 'exportacion', 'aceleradora', 'startup chile', 'capital de riesgo', 'vc$');

  const isProcessChallenge = has('sumate a innovar', 'desafio', 'cuello de botella', 'resolver problema', 'consultoria', 'asesoria experta', 'entidad experta', 'optimizar proceso', 'asesoria');

  const isStartingOrNoSales = has('sin ventas', 'desde cero', 'idea$', 'empezar', 'abrir', 'nuevo negocio', 'persona natural', 'sin inicio', 'prototipo', 'mvp$', 'recien', 'no tenemos ventas', 'sin facturacion');

  const hasSalesOrEstablished = !isStartingOrNoSales && (
    has('ventas', 'facturacion', 'facturo', 'factura', 'millones', 'uf$', 'f29', 'clientes', 'anos de operacion', 'empresa formalizada', 'primera categoria') ||
    (has('pyme') && !isTechStartup)
  );

  // Sin ninguna señal no se recomienda al azar: se piden más datos.
  const anySignal = isAgro || isScienceRD || isTraditional || isTechStartup || isGlobalScalable || isProcessChallenge || isFemale;
  if (!anySignal && !targetFundHint) {
    return {
      isValidProject: false,
      noMatchReason: 'Con lo que escribiste no podemos saber a qué fondo corresponde tu caso. Cuéntanos tu rubro, si ya tienes ventas y qué quieres financiar.',
      guidanceTitle: 'Agrega estos datos para recomendarte bien',
      guidanceSteps: [
        '1. ¿A qué se dedica tu negocio? (ej: agricultura, comercio, software, turismo)',
        '2. ¿Ya vendes o estás partiendo? (si vendes, cuánto aproximado al año)',
        '3. ¿Qué quieres financiar? (maquinaria, un prototipo, riego, exportar, etc.)',
      ],
      suggestedPrompts: [
        'Soy agricultor en Osorno, cultivo papas, vendo unos $30 millones al año y quiero tecnificar el riego.',
        'Tengo una panadería en Temuco con ventas y necesito comprar un horno industrial.',
        'Estamos desarrollando una app sin ventas todavía y tenemos un prototipo.',
      ],
    };
  }

  // Score each fund from CHILEAN_FUNDS
  const fundScores: Array<{ fund: any; score: number; reason: string }> = [];

  for (const fund of CHILEAN_FUNDS) {
    let score = 50;
    let reason = '';

    if (targetFundHint && fund.id === targetFundHint) {
      score += 55;
    }

    switch (fund.id) {
      case 'sercotec_crece': {
        if (isTraditional) score += 55;
        if (isAgro && hasSalesOrEstablished) score += 30;
        if (hasSalesOrEstablished) score += 35;
        if (norm.includes('crece') || norm.includes('maquinaria') || norm.includes('pyme') || norm.includes('horno') || norm.includes('vitrina')) score += 25;
        if (isTechStartup) score -= 45;
        if (isStartingOrNoSales && !hasSalesOrEstablished && !isTraditional) score -= 35;
        reason = 'Tu actividad corresponde a una micro o pequeña empresa comercial o de servicios. SERCOTEC Crece financia hasta $5.000.000 no reembolsables para compra de maquinaria, equipamiento e infraestructura sin exigir mérito de innovación disruptiva.';
        break;
      }

      case 'sercotec_semilla_emprende': {
        if (isTraditional && (isStartingOrNoSales || !hasSalesOrEstablished)) score += 45;
        if (isStartingOrNoSales) score += 30;
        if (norm.includes('capital semilla') || norm.includes('sercotec') || norm.includes('emprende')) score += 25;
        if (hasSalesOrEstablished && !isStartingOrNoSales) score -= 45;
        if (isTechStartup) score -= 30;
        if (isFemale) score -= 15;
        reason = 'Tu propuesta corresponde a un nuevo negocio o taller a formalizar desde cero ante el SII. SERCOTEC Capital Semilla financia hasta $3.500.000 no reembolsables con un aporte de solo el 5% en efectivo.';
        break;
      }

      case 'sercotec_abeja_emprende': {
        if (!isFemale) {
          score -= 60;
        } else {
          score += 65;
          if (isTraditional || isStartingOrNoSales) score += 25;
          if (norm.includes('abeja')) score += 40;
          if (hasSalesOrEstablished && !isStartingOrNoSales) score -= 25;
        }
        reason = 'Fondo exclusivo para mujeres emprendedoras que buscan formalizar un negocio propio ante el SII. Financia hasta $3.500.000 no reembolsables cubriendo hasta el 97% del costo total.';
        break;
      }

      case 'fia_innovacion_agro': {
        if (isAgro) score += 65;
        if (norm.includes('fia') || norm.includes('alimento') || norm.includes('riego') || norm.includes('campo')) score += 30;
        if (!isAgro && isTraditional) score -= 30;
        if (!isAgro && isTechStartup) score -= 20;
        reason = 'Tu proyecto es del sector agroalimentario. FIA cofinancia proyectos de innovación agraria (no compra de insumos o maquinaria corriente). Si eres pequeño productor, revisa también los programas de INDAP, que es el instrumento habitual para la agricultura familiar campesina.';
        break;
      }

      case 'anid_fondef_idea': {
        if (isScienceRD) score += 60;
        if (norm.includes('anid') || norm.includes('fondef') || norm.includes('universidad')) score += 35;
        if (isTraditional) score -= 50;
        reason = 'Tu propuesta involucra investigación científica y vinculación universitaria. ANID Fondef financia hasta $200.000.000 para pruebas de concepto científicas y transferencia tecnológica.';
        break;
      }

      case 'corfo_crea_valida': {
        if (isScienceRD) score += 65;
        if (isTechStartup && norm.includes('prototipo')) score += 35;
        if (norm.includes('crea y valida') || norm.includes('i+d') || norm.includes('laboratorio') || norm.includes('bioplast')) score += 35;
        if (hasSalesOrEstablished) score += 20;
        if (isTraditional && !isScienceRD) score -= 40;
        reason = 'Tu proyecto involucra I+D empresarial y desarrollo de prototipos tecnológicos de alto desafío técnico. Corfo subsidia hasta $180.000.000 para validación en entorno real.';
        break;
      }

      case 'corfo_sumate_innovar': {
        if (isProcessChallenge) score += 55;
        if (hasSalesOrEstablished && norm.includes('desafio')) score += 35;
        if (norm.includes('sumate') || norm.includes('innovar')) score += 30;
        if (isStartingOrNoSales && !hasSalesOrEstablished) score -= 30;
        reason = 'Ideal para empresas con ventas que buscan resolver un desafío productivo o incorporar tecnología mediante la contratación de entidades expertas (subsidio de hasta $15M).';
        break;
      }

      case 'startup_chile_ignite': {
        if (isGlobalScalable) score += 55;
        if (isTechStartup) score += 35;
        if (norm.includes('startup chile') || norm.includes('ignite') || norm.includes('build')) score += 40;
        if (isTraditional) score -= 55;
        if (isAgro && !isTechStartup) score -= 40;
        reason = 'Tu startup tiene potencial de escalamiento internacional. Start-Up Chile otorga hasta $25.000.000 equity-free, red de inversionistas globales y aceleración.';
        break;
      }

      case 'corfo_semilla_expande': {
        if (isTechStartup && hasSalesOrEstablished) score += 65;
        if (norm.includes('expande') || norm.includes('escalar') || norm.includes('expansion') || norm.includes('expandirse') || norm.includes('colombia') || norm.includes('mexico') || norm.includes('extranjero')) score += 35;
        if (isStartingOrNoSales && !hasSalesOrEstablished) score -= 45;
        if (isTraditional) score -= 50;
        if (isScienceRD && !isTechStartup) score -= 35;
        if (isAgro && !isTechStartup) score -= 40;
        reason = 'Tu empresa innovadora ya cuenta con primeras ventas validadas. Corfo Semilla Expande cofinancia hasta $45.000.000 en dos fases para despegue comercial nacional e internacional.';
        break;
      }

      case 'corfo_innova_region': {
        if ((isTechStartup || isScienceRD || isProcessChallenge) && hasSalesOrEstablished) score += 45;
        if (norm.includes('innova region') || norm.includes('innova región') || norm.includes('prototipo')) score += 25;
        if (isStartingOrNoSales && !hasSalesOrEstablished) score -= 50;
        if (isTraditional && !isProcessChallenge) score -= 35;
        reason = 'Tu empresa ya vende y quiere desarrollar un producto o proceso nuevo. Corfo Innova Región cofinancia hasta $60.000.000 (80% si eres micro o pequeña) para pasar del prototipo a la validación, con focos propios de cada región.';
        break;
      }

      case 'corfo_consolida_expande': {
        if (hasSalesOrEstablished && (isGlobalScalable || norm.includes('expandir') || norm.includes('escalar') || norm.includes('exportar') || norm.includes('extranjero'))) score += 45;
        if (norm.includes('consolida')) score += 30;
        if (isStartingOrNoSales && !hasSalesOrEstablished) score -= 60;
        if (isTraditional) score -= 40;
        reason = 'Tu innovación ya está validada y quieres escalarla en Chile o afuera. Corfo Consolida y Expande cofinancia hasta $150.000.000 para el escalamiento comercial o productivo.';
        break;
      }

      case 'startup_chile_growth': {
        if (isTechStartup && hasSalesOrEstablished) score += 40;
        if (isGlobalScalable) score += 25;
        if (norm.includes('growth') || norm.includes('levantar capital') || norm.includes('inversionistas')) score += 25;
        if (isStartingOrNoSales && !hasSalesOrEstablished) score -= 60;
        if (isTraditional) score -= 55;
        reason = 'Tu startup tecnológica ya vende y quiere crecer rápido. Start-Up Chile Growth entrega hasta $75.000.000 sin ceder acciones a empresas con ventas de $80M a $800M al año.';
        break;
      }

      case 'sercotec_digitaliza_almacen': {
        const almacen = /almacen|minimarket|botiller|panader|carnicer|rotiser|bazar|negocio de barrio|kiosco/.test(norm);
        if (almacen) score += 80; else score -= 45;
        if (almacen && hasSalesOrEstablished) score += 15;
        reason = 'Tienes un almacén o negocio de barrio. Sercotec Digitaliza tu Almacén financia hasta $3.000.000 para caja y sistema de ventas, control de inventario, vitrinas, balanzas e iluminación.';
        break;
      }

      case 'corfo_semilla_inicia': {
        if (isTechStartup && (isStartingOrNoSales || !hasSalesOrEstablished)) score += 50;
        if (norm.includes('semilla inicia') || (norm.includes('inicia') && isTechStartup)) score += 35;
        if (hasSalesOrEstablished && !isStartingOrNoSales) score -= 25;
        if (isTraditional) score -= 50;
        if (isAgro && !isTechStartup) score -= 40;
        reason = 'Tu proyecto plantea una solución innovadora diferenciada con potencial de escalamiento. Corfo Semilla Inicia entrega hasta $15.000.000 no reembolsables para validar técnica y comercialmente tu prototipo.';
        break;
      }

      default:
        break;
    }

    fundScores.push({ fund, score, reason });
  }

  fundScores.sort((a, b) => b.score - a.score);

  const winner = fundScores[0];
  const second = fundScores[1];
  const third = fundScores[2];

  const toPct = (sc: number) => Math.max(20, Math.min(95, Math.round(sc * 0.6)));
  const primaryMatchScore = toPct(winner.score);
  const secondaryScore1 = toPct(second.score);
  const secondaryScore2 = toPct(third.score);

  const effectiveProfile: Partial<CompanyProfile> = {
    region: profile?.region,
    salesBracket: profile?.salesBracket || (hasSalesOrEstablished ? 'micro_200_a_2400uf' : 'sin_ventas'),
    companyType: profile?.companyType || 'spa',
    isFemaleLed: profile?.isFemaleLed ?? isFemale,
  };

  let liveRegionalCallMatch: any = undefined;
  if (Array.isArray(liveConvocatorias) && liveConvocatorias.length > 0) {
    // Filtrar convocatorias vigentes por región, perfil y tramo de ventas
    const profileFiltered = filterConvocatoriasForProfile(liveConvocatorias, effectiveProfile);
    
    // Buscar si hay convocatoria oficial vigente para el fondo ganador
    const directFundCall = profileFiltered.find(c => c.fundId === winner.fund.id && c.vigente);
    const candidateCall = directFundCall || profileFiltered.find(c => c.vigente);

    if (candidateCall) {
      liveRegionalCallMatch = {
        id: candidateCall.id,
        titulo: candidateCall.titulo,
        alcance: candidateCall.alcance,
        cierre: candidateCall.cierre,
        topeAprox: candidateCall.tope_aprox,
        url: candidateCall.url,
        vigente: candidateCall.vigente,
        diasRestantes: calculateDaysRemaining(candidateCall.cierre),
        beneficioResumen: candidateCall.resumen || candidateCall.beneficio,
      };

      if (directFundCall) {
        winner.fund = {
          ...winner.fund,
          callStatus: (directFundCall.callStatus === 'Abierta' ? 'abierta' : directFundCall.callStatus === 'Próxima' ? 'proxima' : 'por_confirmar') as any,
          closeDate: directFundCall.cierre,
          status: directFundCall.cierre ? `Abierto (Cierra: ${directFundCall.cierre})` : 'Abierto',
          callSchedule: directFundCall.cierre ? `Cierra el ${directFundCall.cierre}` : 'Ventanilla permanente abierta'
        };
      }
    }
  }

  const femaleBonusEligible = isFemale && (winner.fund.agency === 'CORFO' || winner.fund.agency === 'SERCOTEC');
  const femaleBonusText = winner.fund.id === 'sercotec_abeja_emprende'
    ? 'Fondo Exclusivo para Mujeres'
    : femaleBonusEligible
      ? '+10% Bonificación Género CORFO/SERCOTEC'
      : undefined;

  return {
    isValidProject: true,
    wowHeadline: `¡Calificas directamente para ${winner.fund.name}!`,
    primaryFund: {
      fundId: winner.fund.id,
      fundName: winner.fund.name,
      agency: winner.fund.agency,
      subsidyFormatted: winner.fund.subsidyFormatted,
      maxSubsidyCLP: winner.fund.maxSubsidyCLP,
      coFinancePct: winner.fund.maxCoFinancePct,
      whenToApply: winner.fund.callSchedule,
      status: winner.fund.status,
      matchScore: primaryMatchScore,
      whyYouQualify: winner.reason,
      femaleBonusEligible,
      femaleBonusText,
    },
    secondaryFunds: [
      {
        fundId: second.fund.id,
        fundName: second.fund.name,
        agency: second.fund.agency,
        subsidyFormatted: second.fund.subsidyFormatted,
        whenToApply: second.fund.callSchedule,
        status: second.fund.status,
        matchScore: secondaryScore1,
      },
      {
        fundId: third.fund.id,
        fundName: third.fund.name,
        agency: third.fund.agency,
        subsidyFormatted: third.fund.subsidyFormatted,
        whenToApply: third.fund.callSchedule,
        status: third.fund.status,
        matchScore: secondaryScore2,
      },
    ].filter((_, i) => [second, third][i].score > 55),
    liveRegionalCallMatch,
    inferredProfile: {
      companyName: isTraditional ? 'Mi Empresa Tradicional SpA' : isTechStartup ? 'Mi Startup SpA' : 'Mi Empresa SpA',
      companyType: 'spa',
      monthsActive: hasSalesOrEstablished ? 24 : 0,
      salesBracket: hasSalesOrEstablished ? 'micro_200_a_2400uf' : 'sin_ventas',
      sector: isAgro ? 'Agrícola y Alimentos' : isScienceRD ? 'I+D y Biotecnología' : isTraditional ? 'Comercio y Servicios Tradicionales' : 'Tecnología y Software',
      isFemaleLed: isFemale,
      trlStage: hasSalesOrEstablished ? 'primeras_ventas' : 'idea_concepto',
      innovationLevel: isTechStartup || isScienceRD ? 'disruptiva' : 'incremental',
      projectSummary: query.trim(),
    },
    actionCallout: `Tu proyecto califica para las bases de ${winner.fund.agency}. El siguiente paso es registrar tu empresa para formular la propuesta técnica.`,
  };
}
