import { Convocatoria } from '../types/convocatoria';
import { ChileanFund, CompanyProfile } from '../types/funds';

/**
 * Calcula los días restantes de una convocatoria a partir de su fecha de cierre
 * usando SIEMPRE la fecha actual real (Date.now()), sin fechas fijas.
 */
export function calculateDaysRemaining(cierre: string | null | undefined): number | null {
  if (!cierre) return null;
  // Parse closing date at end of day (23:59:59)
  const closeTime = new Date(`${cierre}T23:59:59`).getTime();
  if (isNaN(closeTime)) return null;

  const now = Date.now();
  const diffTime = closeTime - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : null;
}

/**
 * Calcula el estado dinámico (Abierta / Cerrada / Próxima / Por confirmar)
 * a partir de la fecha actual y las fechas de apertura y cierre.
 */
export function calculateCallStatus(
  apertura: string | null | undefined,
  cierre: string | null | undefined,
  permanente: boolean = false
): 'Abierta' | 'Cerrada' | 'Próxima' | 'Por confirmar' {
  const todayStr = new Date().toISOString().slice(0, 10);

  if (cierre && cierre < todayStr) {
    return 'Cerrada';
  }

  if (apertura && apertura > todayStr) {
    return 'Próxima';
  }

  if (permanente || (cierre && cierre >= todayStr) || (apertura && apertura <= todayStr && !cierre)) {
    return 'Abierta';
  }

  return 'Por confirmar';
}

/**
 * Relaciona automáticamente una convocatoria con los fondos de CHILEAN_FUNDS
 * por nombre del programa (ej.: "Semilla Inicia", "Semilla Expande", "Crea y Valida", "Súmate a Innovar").
 */
export function matchConvocatoriaToFundId(titulo: string, url?: string): string | null {
  const text = `${titulo || ''} ${url || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (text.includes('semilla inicia')) return 'corfo_semilla_inicia';
  if (text.includes('semilla expande')) return 'corfo_semilla_expande';
  if (text.includes('crea y valida')) return 'corfo_crea_valida';
  if (text.includes('sumate a innovar')) return 'corfo_sumate_innovar';
  if (text.includes('startup chile') || text.includes('start-up chile') || text.includes('ignite') || text.includes('build')) return 'startup_chile_ignite';
  if (text.includes('semilla emprende') || text.includes('capital semilla')) return 'sercotec_semilla_emprende';
  if (text.includes('abeja emprende') || text.includes('capital abeja')) return 'sercotec_abeja_emprende';
  if (text.includes('crece') && (text.includes('sercotec') || text.includes('desarrollo de negocios'))) return 'sercotec_crece';
  if (text.includes('fondef') || text.includes('idea i+d') || text.includes('idea id')) return 'anid_fondef_idea';
  if (text.includes('fia') || text.includes('innovacion agro')) return 'fia_innovacion_agro';

  return null;
}

/**
 * Enriquece una convocatoria con estado y días calculados en tiempo real
 */
export function enrichConvocatoria(raw: any): Convocatoria {
  const permanente = Boolean(raw.permanente || (!raw.cierre && raw.estado_corfo?.toLowerCase() === 'abiertas'));
  const callStatus = calculateCallStatus(raw.apertura, raw.cierre, permanente);
  const diasRestantes = calculateDaysRemaining(raw.cierre);
  const fundId = raw.fundId || matchConvocatoriaToFundId(raw.titulo, raw.url);

  // Vigencia calculada: si cierre es posterior o igual a hoy, o permanente abierta
  const todayStr = new Date().toISOString().slice(0, 10);
  const isVigente = raw.cierre ? raw.cierre >= todayStr : Boolean(permanente || raw.vigente);

  return {
    id: raw.id || (raw.url ? raw.url.replace(/\/+$/, '').split('/').pop() : `conv_${Date.now()}`),
    titulo: raw.titulo || 'Convocatoria CORFO',
    alcance: raw.alcance || 'Todo Chile',
    apertura: raw.apertura || null,
    cierre: raw.cierre || null,
    tope_aprox: raw.tope_aprox || raw.topeAprox || null,
    perfil: raw.perfil || [],
    etapa: raw.etapa || [],
    necesidad: raw.necesidad || [],
    venta: raw.venta || [],
    url: raw.url || 'https://www.corfo.gob.cl',
    fuente: raw.fuente || 'CORFO',
    vigente: isVigente,
    permanente,
    firstSeenAt: raw.firstSeenAt || new Date().toISOString(),
    lastSeenAt: raw.lastSeenAt || new Date().toISOString(),
    fundId,
    resumen: raw.resumen || raw.beneficioResumen || raw.beneficio || null,
    quienes_pueden_postular: raw.quienes_pueden_postular || raw.quienesPuedenPostular || null,
    beneficio: raw.beneficio || raw.beneficioResumen || null,
    estado_corfo: raw.estado_corfo || (isVigente ? 'abiertas' : 'cerradas'),
    diasRestantes,
    callStatus
  };
}

/**
 * Actualiza la lista de fondos CHILEAN_FUNDS con los datos dinámicos de las convocatorias vigentes.
 * "Cuando exista una convocatoria vigente para un fondo, su callStatus y closeDate se toman de ahí; si no, queda 'por_confirmar'."
 */
export function updateFundsWithLiveConvocatorias(
  funds: ChileanFund[],
  convocatorias: Convocatoria[]
): ChileanFund[] {
  return funds.map(fund => {
    // Buscar convocatoria vigente para este fondo
    const matchingCall = convocatorias.find(c => c.fundId === fund.id && c.vigente);

    if (matchingCall) {
      const status = matchingCall.callStatus === 'Abierta' ? 'abierta'
        : matchingCall.callStatus === 'Próxima' ? 'proxima'
        : matchingCall.callStatus === 'Cerrada' ? 'cerrada'
        : 'por_confirmar';

      return {
        ...fund,
        callStatus: status as any,
        closeDate: matchingCall.cierre,
        status: matchingCall.callStatus === 'Abierta' ? 'Abierto' : 'Próxima Convocatoria'
      };
    }

    // Si no existe convocatoria vigente oficial, queda "por_confirmar" y closeDate null
    return {
      ...fund,
      callStatus: 'por_confirmar',
      closeDate: null
    };
  });
}

/**
 * Filtra convocatorias según perfil de usuario (región, ventas, tipo de empresa)
 */
export function filterConvocatoriasForProfile(
  convocatorias: Convocatoria[],
  profile: Partial<CompanyProfile>
): Convocatoria[] {
  return convocatorias.filter(conv => {
    if (!conv.vigente) return false;

    // 1. Filtro por región / alcance
    if (profile.region) {
      const regionNorm = profile.region.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const alcanceNorm = (conv.alcance || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isNational = alcanceNorm.includes('todo chile') || alcanceNorm.includes('nacional') || alcanceNorm === '';
      const matchesRegion = alcanceNorm.includes(regionNorm) || regionNorm.includes(alcanceNorm);
      if (!isNational && !matchesRegion) {
        return false;
      }
    }

    // 2. Filtro por perfil (persona natural vs empresa jurídica)
    if (profile.companyType) {
      const rawPerfil = Array.isArray(conv.perfil) ? conv.perfil : (conv.perfil ? [conv.perfil] : []);
      if (rawPerfil.length > 0) {
        const isPersona = profile.companyType === 'persona_natural' || profile.companyType === 'sin_iniciar';
        const targetTag = isPersona ? 'persona' : 'empresa';
        const matchesPerfil = rawPerfil.some(p => String(p).toLowerCase().includes(targetTag));
        if (!matchesPerfil) {
          return false;
        }
      }
    }

    // 3. Filtro por tramo de ventas
    if (profile.salesBracket) {
      const rawVenta = Array.isArray(conv.venta) ? conv.venta : (conv.venta ? [conv.venta] : []);
      if (rawVenta.length > 0) {
        const ventaTags = rawVenta.map(v => String(v).toLowerCase());
        const isSinVentas = profile.salesBracket === 'sin_ventas';
        if (isSinVentas) {
          const allowsSinVentas = ventaTags.some(t => t.includes('sin-ventas') || t.includes('sin ventas') || t.includes('micro'));
          if (!allowsSinVentas) return false;
        } else if (profile.salesBracket === 'grande_mayor_100000uf') {
          const allowsGrande = ventaTags.some(t => t.includes('gran') || t.includes('mayor-a-100'));
          if (!allowsGrande) return false;
        }
      }
    }

    return true;
  });
}
