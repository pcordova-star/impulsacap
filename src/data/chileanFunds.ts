import { ChileanFund } from '../types/funds';

/**
 * Catálogo de fondos. Montos, requisitos, criterios y cuentas tomados de las bases oficiales
 * (revisadas el 21-10-2026; ver src/data/fundStandards.ts para fuentes y reglas completas).
 */
export const CHILEAN_FUNDS: ChileanFund[] = [
  {
    id: 'corfo_semilla_inicia',
    name: 'CORFO Semilla Inicia',
    agency: 'CORFO',
    category: 'Capital Semilla',
    badge: 'Hasta $15M • Sin ventas • Personas o empresas de hasta 18 meses',
    maxSubsidyCLP: 15000000,
    subsidyFormatted: '$15.000.000 CLP ($17.000.000 si lo lidera una mujer)',
    maxCoFinancePct: 75,
    femaleBonusPct: 10,
    beneficiaryTypes: ['sin_iniciar', 'persona_natural', 'spa', 'srl', 'eirl', 'sa'],
    salesRequirement: 'Personas naturales mayores de 18 años, o empresas con máximo 18 meses de inicio de actividades y sin ventas.',
    salesBracketsEligible: ['sin_ventas'],
    trlRange: 'Idea con plan de implementación rápida hasta producto mínimo viable',
    trlEligible: ['idea_concepto', 'prototipo_lab', 'mvp_validado'],
    requiresInnovation: true,
    requiresCommercialValidation: false,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-21',
    callSchedule: 'Convocatorias regionales (en 2026 abrieron entre enero y junio según la región)',
    summary: 'Subsidio para emprendimientos innovadores en etapa temprana, con potencial de alcance nacional e internacional, para validar técnica y comercialmente y lograr las primeras ventas.',
    description: 'Cofinancia mentoría, definición del modelo de negocio, validación técnica y comercial, producto mínimo viable, marketing y estrategia de sostenibilidad. Se ejecuta con una Entidad Patrocinadora en hasta 10 meses.',
    evaluationCriteria: [
      { name: 'Innovación: relevancia del problema u oportunidad', weight: 15, description: 'Qué tan relevante es el problema u oportunidad que aborda el emprendimiento.' },
      { name: 'Innovación: propuesta de valor', weight: 25, description: 'Grado de innovación de la solución y su valor frente a la competencia.' },
      { name: 'Escalabilidad: modelo de negocio', weight: 5, description: 'Claridad y viabilidad del modelo de negocio.' },
      { name: 'Escalabilidad: mercado', weight: 10, description: 'Tamaño y conocimiento del mercado y la competencia.' },
      { name: 'Escalabilidad: plan de validación', weight: 10, description: 'Actividades y resultados esperados para validar técnica y comercialmente.' },
      { name: 'Escalabilidad: sostenibilidad', weight: 5, description: 'Estrategia para que el emprendimiento se sostenga.' },
      { name: 'Equipo: capacidad', weight: 20, description: 'Experiencia y competencias del equipo para ejecutar el proyecto.' },
      { name: 'Equipo: compromiso', weight: 10, description: 'Dedicación horaria y compromiso del equipo.' }
    ],
    eligibleExpenses: [
      'Mentoría, definición del modelo de negocio, validación técnica y comercial (actividades obligatorias).',
      'Equipo del proyecto (socios: hasta $700.000 mensuales cada uno, máximo 2).',
      'Producto mínimo viable, marketing, ventas y empaquetamiento comercial.',
      'Equipos críticos (Gastos de Inversión: máximo 20% del subsidio).',
      'Protección de propiedad intelectual y garantías (hasta 3% del subsidio).'
    ],
    ineligibleExpenses: [
      'Compra de inmuebles o vehículos y la mayoría de las construcciones.',
      'Publicaciones académicas y capacitaciones sin relación con el proyecto.',
      'IVA (lo asume el beneficiario).',
      'Bebidas alcohólicas, regalos y gastos similares.'
    ],
    requiredDocuments: [
      'Formulario de postulación en línea de Corfo.',
      'Video de máximo 40 segundos sobre el producto y su innovación.',
      'Si es empresa: transcripción del objeto social de los estatutos.'
    ],
    corfoAccountsBudget: [
      { account: 'Recursos Humanos', description: 'Equipo del proyecto; socios hasta $700.000 al mes (máx. 2).' },
      { account: 'Gastos de Operación', description: 'Mentoría, validación, producto mínimo viable, marketing, propiedad intelectual.' },
      { account: 'Gastos de Inversión', description: 'Equipos críticos.', maxPct: 20 },
      { account: 'Gastos de Administración', description: 'Gestión y garantías (garantías hasta 3% del subsidio).' }
    ]
  },
  {
    id: 'corfo_semilla_expande',
    name: 'CORFO Semilla Expande',
    agency: 'CORFO',
    category: 'Crecimiento y Escalamiento',
    badge: 'Hasta $25M • Empresas de hasta 36 meses con primeras ventas',
    maxSubsidyCLP: 25000000,
    subsidyFormatted: '$25.000.000 CLP ($28.333.334 si lo lidera una mujer)',
    maxCoFinancePct: 75,
    femaleBonusPct: 10,
    beneficiaryTypes: ['spa', 'srl', 'eirl', 'sa'],
    salesRequirement: 'Empresa con hasta 36 meses de inicio de actividades, ventas del producto de al menos $100.000 y ventas totales de hasta $80.000.000 en 12 meses.',
    salesBracketsEligible: ['menor_60m', 'micro_200_a_2400uf'],
    trlRange: 'Producto validado con primeras ventas, listo para escalar',
    trlEligible: ['mvp_validado', 'primeras_ventas'],
    requiresInnovation: true,
    requiresCommercialValidation: true,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-21',
    callSchedule: 'Convocatoria nacional (2026: enero a febrero) y convocatorias regionales',
    summary: 'Subsidio para emprendimientos innovadores con primeras ventas que buscan escalar su negocio.',
    description: 'Cofinancia mentoría o aceleración (obligatoria), prospección comercial, marketing, certificaciones, propiedad intelectual y equipo de trabajo. Algunas regiones incluyen una segunda etapa de hasta $20.000.000.',
    evaluationCriteria: [
      { name: 'Innovación', weight: 40, description: 'Relevancia del problema y grado de innovación de la propuesta de valor frente a la competencia.' },
      { name: 'Escalabilidad', weight: 30, description: 'Mercado, modelo de negocio, tracción y plan para escalar.' },
      { name: 'Equipo', weight: 30, description: 'Capacidad, experiencia y compromiso del equipo.' }
    ],
    eligibleExpenses: [
      'Mentoría, incubación o aceleración (obligatoria).',
      'Prospección comercial, marketing y difusión.',
      'Certificaciones y propiedad intelectual.',
      'Equipo de trabajo (socios: hasta $700.000 mensuales, máximo 2) y arriendos críticos.',
      'Activos (máximo 20% del subsidio).'
    ],
    ineligibleExpenses: [
      'Compra de inmuebles o vehículos.',
      'Remuneración de socios preexistentes con cargo al subsidio (solo con aportes).',
      'IVA.'
    ],
    requiredDocuments: [
      'Formulario de postulación en línea (sin adjuntos externos).',
      'Video de máximo 40 segundos (requisito de admisibilidad).',
      'Resolución del Sello 40 horas, si corresponde.'
    ],
    corfoAccountsBudget: [
      { account: 'Recursos Humanos', description: 'Equipo del proyecto.' },
      { account: 'Gastos de Operación', description: 'Mentoría, marketing, prospección, certificaciones.' },
      { account: 'Gastos de Inversión', description: 'Activos.', maxPct: 20 },
      { account: 'Gastos de Administración', description: 'Gestión y garantías.' }
    ]
  },
  {
    id: 'corfo_crea_valida',
    name: 'CORFO Crea y Valida',
    agency: 'CORFO',
    category: 'I+D+i y Tecnológico',
    badge: 'Hasta $180M ($220M colaborativo) • Empresas de 24+ meses con ventas',
    maxSubsidyCLP: 180000000,
    subsidyFormatted: 'Hasta $180.000.000 (individual) / $220.000.000 (colaborativo)',
    maxCoFinancePct: 80,
    femaleBonusPct: 10,
    beneficiaryTypes: ['spa', 'srl', 'eirl', 'sa'],
    salesRequirement: 'Empresa con al menos 24 meses de inicio de actividades en primera categoría y ventas en los últimos 24 meses.',
    salesBracketsEligible: ['menor_60m', 'micro_200_a_2400uf', 'pequena_2400_a_25000uf', 'mediana_25000_a_100000uf', 'grande_mayor_100000uf'],
    trlRange: 'Desde prototipo (etapa CREA) hasta validación a escala productiva o comercial (etapa VALIDA)',
    trlEligible: ['prototipo_lab', 'mvp_validado', 'primeras_ventas'],
    requiresInnovation: true,
    requiresCommercialValidation: false,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-21',
    callSchedule: 'Fase 1 (perfil obligatorio) y fase 2 (postulación); en 2026 hubo convocatorias nacionales y regionales',
    summary: 'Cofinancia proyectos de I+D que desarrollan nuevos o mejorados productos, procesos o servicios, desde prototipo hasta validación técnica y comercial a escala.',
    description: 'Dos etapas obligatorias: CREA (desarrollo desde prototipo) y VALIDA (validación a escala productiva o comercial). Modalidad individual o colaborativa (con entidades de I+D que reciben al menos 30% del costo). El % de subsidio depende del tamaño: 80% micro y pequeña, 60% mediana, 40% grande.',
    evaluationCriteria: [
      { name: 'Problema: diagnóstico', weight: 10, description: 'Claridad y respaldo del problema, desafío u oportunidad.' },
      { name: 'Mercado objetivo', weight: 10, description: 'Definición y tamaño del mercado objetivo o potencial.' },
      { name: 'Solución: metodología', weight: 20, description: 'Calidad y coherencia de la metodología para desarrollar y validar la solución.' },
      { name: 'Solución: grado de novedad y diferenciación', weight: 10, description: 'Novedad frente al estado del arte y la competencia.' },
      { name: 'Solución: actividades de I+D', weight: 10, description: 'Peso de la I+D en el costo total (30% o más = nota 5).' },
      { name: 'Introducción al mercado: impacto', weight: 10, description: 'Impacto económico o productivo esperado.' },
      { name: 'Introducción al mercado: escalabilidad', weight: 10, description: 'Potencial de escalar y llegar al mercado.' },
      { name: 'Capacidades de beneficiario, asociados y entidades', weight: 20, description: 'Capacidades técnicas y de gestión del equipo y las entidades participantes.' }
    ],
    eligibleExpenses: [
      'Actividades de I+D, integración tecnológica, prototipado y validación.',
      'Equipos, materiales e insumos (inversión máximo 30% del subsidio).',
      'Entidades colaboradoras de I+D, certificaciones y propiedad intelectual.',
      'Escalamiento, validación comercial, marketing y softlanding.',
      'Formulación externa (micro y pequeñas, hasta $2.500.000) y costos de garantías.'
    ],
    ineligibleExpenses: [
      'Inmuebles.',
      'Gastos de administración sobre 10% del subsidio.',
      'Subcontratación por parte de las entidades colaboradoras.',
      'IVA recuperable.'
    ],
    requiredDocuments: [
      'Perfil de proyecto (fase 1, obligatorio).',
      'Formulario de postulación completo con presupuesto (fase 2).',
      'Transcripción del objeto social.',
      'Acreditación de ventas de los últimos 24 meses.',
      'Si es colaborativo: antecedentes de las entidades colaboradoras.'
    ],
    corfoAccountsBudget: [
      { account: 'Recursos Humanos', description: 'Equipo de trabajo del proyecto.' },
      { account: 'Gastos de Operación', description: 'I+D, prototipos, entidades colaboradoras, validación y escalamiento.' },
      { account: 'Gastos de Inversión', description: 'Equipos y activos.', maxPct: 30 },
      { account: 'Gastos de Administración', description: 'Gestión y garantías.', maxPct: 10 }
    ]
  },
  {
    id: 'corfo_sumate_innovar',
    name: 'CORFO Súmate a Innovar',
    agency: 'CORFO',
    category: 'I+D+i y Tecnológico',
    badge: 'Hasta $10M • Innovar con una universidad o centro tecnológico',
    maxSubsidyCLP: 10000000,
    subsidyFormatted: '$10.000.000 CLP ($11.250.000 si lo lidera una mujer)',
    maxCoFinancePct: 80,
    femaleBonusPct: 10,
    beneficiaryTypes: ['persona_natural', 'spa', 'srl', 'eirl', 'sa'],
    salesRequirement: 'Persona natural o empresa con al menos 24 meses de inicio de actividades en primera categoría y ventas en los últimos 24 meses.',
    salesBracketsEligible: ['menor_60m', 'micro_200_a_2400uf', 'pequena_2400_a_25000uf', 'mediana_25000_a_100000uf', 'grande_mayor_100000uf'],
    trlRange: 'Empresas en operación que quieren resolver un problema de productividad o competitividad',
    trlEligible: ['mvp_validado', 'primeras_ventas', 'escalamiento_global'],
    requiresInnovation: true,
    requiresCommercialValidation: false,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-21',
    callSchedule: 'Convocatorias regionales y temáticas (2026: varias regiones, mujeres, economía circular)',
    summary: 'Para empresas que nunca han innovado: financia contratar a una universidad, centro de investigación o empresa tecnológica para resolver un problema de productividad o competitividad.',
    description: 'Solo financia la contratación de 1 o 2 entidades colaboradoras (cuenta Gastos de Operación). Hasta 80% micro y pequeña, 70% mediana, 40% grande. Duración de hasta 6 meses.',
    evaluationCriteria: [
      { name: 'Problema: diagnóstico', weight: 15, description: 'Claridad y respaldo del problema o desafío de la empresa.' },
      { name: 'Problema: potencial', weight: 10, description: 'Potencial de la oportunidad si se resuelve el problema.' },
      { name: 'Solución: metodología', weight: 20, description: 'Servicios, plan de trabajo y presupuesto con la entidad colaboradora.' },
      { name: 'Solución: impacto', weight: 15, description: 'Efecto esperado en productividad o competitividad.' },
      { name: 'Solución: novedad y diferenciación', weight: 15, description: 'Qué tan nueva es la solución para la empresa y su mercado.' },
      { name: 'Capacidades del beneficiario', weight: 5, description: 'Capacidad de la empresa para implementar los resultados.' },
      { name: 'Capacidades de la entidad colaboradora', weight: 20, description: 'Experiencia, infraestructura y equipo de I+D de la entidad colaboradora.' }
    ],
    eligibleExpenses: [
      'Contratación de 1 o 2 entidades colaboradoras para resolver el desafío.',
      'Costos financieros de garantías y anticipos.',
      'Viajes nacionales justificados.'
    ],
    ineligibleExpenses: [
      'Equipos.',
      'Software comercial estándar.',
      'Consultoría de negocios estándar.',
      'Certificaciones y capacitación organizacional.'
    ],
    requiredDocuments: [
      'Formulario en línea con planillas y anexos.',
      'Transcripción del objeto social.',
      'Antecedentes y currículum del equipo de la entidad colaboradora.'
    ],
    corfoAccountsBudget: [
      { account: 'Gastos de Operación', description: 'Contratación de las entidades colaboradoras, garantías y viajes.' }
    ]
  },
  {
    id: 'startup_chile_build',
    name: 'Start-Up Chile Build',
    agency: 'START-UP CHILE',
    category: 'Capital Semilla',
    badge: '$15M • Pre-aceleración tecnológica • 90% de cofinanciamiento',
    maxSubsidyCLP: 15000000,
    subsidyFormatted: '$15.000.000 CLP',
    maxCoFinancePct: 90,
    beneficiaryTypes: ['sin_iniciar', 'persona_natural', 'spa', 'srl', 'eirl', 'sa'],
    salesRequirement: 'Emprendimientos de base tecnológica en etapa temprana (idea validada a prototipo).',
    salesBracketsEligible: ['sin_ventas', 'menor_60m'],
    trlRange: 'Idea validada hasta prototipo inicial',
    trlEligible: ['idea_concepto', 'prototipo_lab'],
    requiresInnovation: true,
    requiresCommercialValidation: false,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-21',
    callSchedule: 'Dos generaciones al año (revisa startupchile.org)',
    summary: 'Programa de pre-aceleración de 4 meses para startups tecnológicas en etapa temprana, con $15.000.000 sin cesión de participación.',
    description: 'Corfo cubre 90% del costo y el equipo 10%. Al menos 50% de las startups seleccionadas son lideradas por mujeres. Se puede extender y pasar a Ignite.',
    evaluationCriteria: [
      { name: 'Base tecnológica', weight: 25, description: 'La tecnología es el centro de la solución (ponderación referencial).' },
      { name: 'Innovación', weight: 25, description: 'Novedad frente a lo existente (ponderación referencial).' },
      { name: 'Escalabilidad', weight: 25, description: 'Potencial de crecer a nivel global desde Chile (ponderación referencial).' },
      { name: 'Impacto', weight: 25, description: 'Impacto en Chile y en el mercado (ponderación referencial).' }
    ],
    eligibleExpenses: ['Equipo, desarrollo de producto, validación y actividades del programa.'],
    ineligibleExpenses: ['Pago de deudas y gastos personales.'],
    requiredDocuments: ['Postulación en línea en startupchile.org.'],
    corfoAccountsBudget: [
      { account: 'Recursos Humanos', description: 'Equipo fundador y contrataciones.' },
      { account: 'Gastos de Operación', description: 'Producto, validación y mercado.' },
      { account: 'Gastos de Administración', description: 'Gestión y rendiciones.' }
    ]
  },
  {
    id: 'startup_chile_ignite',
    name: 'Start-Up Chile Ignite',
    agency: 'START-UP CHILE',
    category: 'Crecimiento y Escalamiento',
    badge: '$30M • Aceleración tecnológica • 80% (90% mujeres)',
    maxSubsidyCLP: 30000000,
    subsidyFormatted: '$30.000.000 CLP (extensión posible de $20.000.000)',
    maxCoFinancePct: 80,
    femaleBonusPct: 10,
    beneficiaryTypes: ['sin_iniciar', 'persona_natural', 'spa', 'srl', 'eirl', 'sa'],
    salesRequirement: 'Startups de base tecnológica con producto funcional y validación temprana, buscando product-market fit.',
    salesBracketsEligible: ['sin_ventas', 'menor_60m', 'micro_200_a_2400uf'],
    trlRange: 'Producto mínimo viable con validación temprana',
    trlEligible: ['mvp_validado', 'primeras_ventas'],
    requiresInnovation: true,
    requiresCommercialValidation: true,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-21',
    callSchedule: 'Dos generaciones al año (revisa startupchile.org)',
    summary: 'Aceleración de 4 meses (ejecución del subsidio en 6) para startups tecnológicas con producto funcional, con $30.000.000 sin cesión de participación.',
    description: 'Corfo cubre 80% del costo (90% si la líder es mujer). Incluye aceleración, mentorías, espacio de trabajo, red de contactos y visa para fundadores extranjeros.',
    evaluationCriteria: [
      { name: 'Base tecnológica', weight: 25, description: 'La tecnología es el centro de la solución (ponderación referencial).' },
      { name: 'Innovación', weight: 25, description: 'Novedad y ventaja frente a la competencia (ponderación referencial).' },
      { name: 'Escalabilidad', weight: 25, description: 'Tracción y potencial de crecimiento global (ponderación referencial).' },
      { name: 'Impacto', weight: 25, description: 'Impacto en el ecosistema chileno (ponderación referencial).' }
    ],
    eligibleExpenses: ['Equipo, desarrollo de producto, adquisición de clientes, viajes del programa y propiedad intelectual.'],
    ineligibleExpenses: ['Pago de deudas y gastos personales.'],
    requiredDocuments: ['Postulación en línea en startupchile.org.'],
    corfoAccountsBudget: [
      { account: 'Recursos Humanos', description: 'Equipo fundador y contrataciones.' },
      { account: 'Gastos de Operación', description: 'Producto, mercado y tracción.' },
      { account: 'Gastos de Administración', description: 'Gestión y rendiciones.' }
    ]
  },
  {
    id: 'sercotec_semilla_emprende',
    name: 'SERCOTEC Capital Semilla Emprende',
    agency: 'SERCOTEC',
    category: 'Capital Semilla',
    badge: '$3,5M • Para quienes aún no tienen inicio de actividades',
    maxSubsidyCLP: 3500000,
    subsidyFormatted: '$3.500.000 CLP netos',
    maxCoFinancePct: 97,
    beneficiaryTypes: ['sin_iniciar'],
    salesRequirement: 'Personas naturales mayores de 18 años sin inicio de actividades en primera categoría.',
    salesBracketsEligible: ['sin_ventas'],
    trlRange: 'Idea de negocio o emprendimiento informal por formalizar',
    trlEligible: ['idea_concepto', 'prototipo_lab', 'mvp_validado'],
    requiresInnovation: false,
    requiresCommercialValidation: false,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-21',
    callSchedule: 'Convocatorias regionales anuales (2026: abril a mayo)',
    summary: 'Subsidio para personas que quieren iniciar un negocio: financia asesorías, capacitación, marketing, máquinas, equipos y capital de trabajo.',
    description: 'Entre $200.000 y $500.000 para gestión empresarial y hasta $3.300.000 en inversiones. Aporte del 3% en efectivo. Proceso: test de preselección, formulario de modelo de negocio, video pitch de 90 segundos, visita a terreno y comité regional.',
    evaluationCriteria: [
      { name: 'Potencial del proyecto', weight: 20, description: 'Proyección del negocio (comité regional).' },
      { name: 'Fundamentación de la oportunidad de negocio', weight: 20, description: 'Evidencia de que hay clientes y una necesidad real.' },
      { name: 'Coherencia y factibilidad técnica', weight: 20, description: 'Que el negocio y las inversiones sean coherentes y realizables.' },
      { name: 'Orientación al desarrollo sostenible', weight: 10, description: 'Aporte a la economía sostenible.' },
      { name: 'Coherencia entre la orientación sostenible y las inversiones', weight: 30, description: 'Que las inversiones apoyen la sustentabilidad declarada.' }
    ],
    eligibleExpenses: [
      'Acciones de gestión empresarial: asesorías, capacitación, marketing y formalización ($200.000 a $500.000).',
      'Activos fijos e intangibles.',
      'Habilitación de infraestructura (hasta 30% si arriendas).',
      'Capital de trabajo (máximo 40% de las inversiones; mercadería máximo 20%).'
    ],
    ineligibleExpenses: [
      'IVA y otros impuestos recuperables.',
      'Bienes raíces, vehículos con permiso de circulación.',
      'Remuneraciones propias, de socios o familiares.',
      'Consumos básicos (agua, luz, gas, teléfono) y pago de deudas.'
    ],
    requiredDocuments: [
      'Test de preselección en sercotec.cl.',
      'Formulario de modelo de negocio (10 ámbitos).',
      'Estructura de costos.',
      'Video pitch de hasta 90 segundos.'
    ],
    corfoAccountsBudget: [
      { account: 'Acciones de Gestión Empresarial', description: 'Asesorías, capacitación, marketing y formalización ($200.000 a $500.000).' },
      { account: 'Inversiones', description: 'Activos, habilitación de infraestructura y capital de trabajo (hasta $3.300.000).' }
    ]
  },
  {
    id: 'sercotec_modo_empleo',
    name: 'SERCOTEC Capital Semilla Modo Empleo',
    agency: 'SERCOTEC',
    category: 'Capital Semilla',
    badge: '$3M • Para personas sin trabajo que quieren emprender',
    maxSubsidyCLP: 3000000,
    subsidyFormatted: '$3.000.000 CLP netos',
    maxCoFinancePct: 97,
    beneficiaryTypes: ['sin_iniciar'],
    salesRequirement: 'Personas naturales mayores de 18 años, sin inicio de actividades en primera categoría y sin cotizaciones previsionales en los 6 meses anteriores a la convocatoria. Prioriza jóvenes de 18 a 29 años, mujeres de 30 a 54 y personas de 55 años o más.',
    salesBracketsEligible: ['sin_ventas'],
    trlRange: 'Idea de negocio o emprendimiento informal por formalizar',
    trlEligible: ['idea_concepto', 'prototipo_lab', 'mvp_validado'],
    requiresInnovation: false,
    requiresCommercialValidation: false,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-28',
    callSchedule: 'Convocatoria nacional por región (2026: 25 de agosto al 8 de septiembre)',
    summary: 'Subsidio para personas sin trabajo que quieren crear su propio negocio formal: financia asesorías, capacitación, marketing, equipos, habilitación y capital de trabajo.',
    description: 'Entre $200.000 y $500.000 para gestión empresarial y hasta $2.800.000 en inversiones. Aporte del 3% en efectivo. Mismo proceso que Capital Semilla: test de preselección, formulario de modelo de negocio, video pitch de 90 segundos, visita a terreno y comité regional.',
    evaluationCriteria: [
      { name: 'Fundamentación de la oportunidad de negocio', weight: 40, description: 'Que conozcas tu negocio y la necesidad de tus clientes (comité regional).' },
      { name: 'Potencial del proyecto de negocio', weight: 30, description: 'Proyección del negocio (comité regional).' },
      { name: 'Coherencia y factibilidad técnica', weight: 30, description: 'Que el negocio y las inversiones sean coherentes y realizables.' }
    ],
    eligibleExpenses: [
      'Acciones de gestión empresarial: asesorías, capacitación, marketing y formalización ($200.000 a $500.000).',
      'Activos fijos e intangibles.',
      'Habilitación de infraestructura (hasta 30% si arriendas).',
      'Capital de trabajo (máximo 40% de las inversiones; mercadería máximo 20%).'
    ],
    ineligibleExpenses: [
      'IVA y otros impuestos recuperables.',
      'Bienes raíces y vehículos con permiso de circulación.',
      'Compras a ti mismo, tu pareja, socios o hijos.',
      'Consumos básicos (agua, luz, gas, teléfono), deudas e intereses.',
      'Pago a consultores por preparar la postulación.'
    ],
    requiredDocuments: [
      'Test de preselección en sercotec.cl.',
      'Formulario de modelo de negocio (10 ámbitos).',
      'Estructura de costos.',
      'Video pitch de hasta 90 segundos.',
      'Certificado de cotizaciones previsionales (sin cotizaciones en los últimos 6 meses).'
    ],
    corfoAccountsBudget: [
      { account: 'Acciones de Gestión Empresarial', description: 'Asesorías, capacitación, marketing y formalización ($200.000 a $500.000).' },
      { account: 'Inversiones', description: 'Activos, habilitación de infraestructura y capital de trabajo (hasta $2.800.000).' }
    ]
  },
  {
    id: 'sercotec_abeja_emprende',
    name: 'SERCOTEC Capital Abeja Emprende',
    agency: 'SERCOTEC',
    category: 'Capital Semilla',
    badge: '$3,5M • Exclusivo para mujeres sin inicio de actividades',
    maxSubsidyCLP: 3500000,
    subsidyFormatted: '$3.500.000 CLP netos',
    maxCoFinancePct: 97,
    beneficiaryTypes: ['sin_iniciar'],
    salesRequirement: 'Mujeres mayores de 18 años sin inicio de actividades en primera categoría.',
    salesBracketsEligible: ['sin_ventas'],
    trlRange: 'Idea de negocio o emprendimiento informal por formalizar',
    trlEligible: ['idea_concepto', 'prototipo_lab', 'mvp_validado'],
    requiresInnovation: false,
    requiresCommercialValidation: false,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-21',
    callSchedule: 'Convocatorias regionales anuales (2026: mayo a junio)',
    summary: 'Subsidio exclusivo para mujeres que quieren iniciar un negocio, con las mismas condiciones que Capital Semilla Emprende.',
    description: 'Entre $200.000 y $500.000 para gestión empresarial y hasta $3.300.000 en inversiones. Aporte del 3%. El comité regional prioriza comunas definidas y participantes de programas de SernamEG.',
    evaluationCriteria: [
      { name: 'Potencial del proyecto', weight: 20, description: 'Proyección del negocio.' },
      { name: 'Fundamentación de la oportunidad', weight: 15, description: 'Evidencia de clientes y necesidad.' },
      { name: 'Coherencia y factibilidad técnica', weight: 20, description: 'Negocio e inversiones coherentes y realizables.' },
      { name: 'Viabilidad económica', weight: 15, description: 'Que el negocio pueda sostenerse (visita a terreno).' },
      { name: 'Estado de desarrollo', weight: 15, description: 'Avance del modelo de negocio (visita a terreno).' },
      { name: 'Capacidades de la emprendedora', weight: 15, description: 'Experiencia y capacitación (visita a terreno).' }
    ],
    eligibleExpenses: [
      'Acciones de gestión empresarial ($200.000 a $500.000).',
      'Activos fijos e intangibles.',
      'Habilitación de infraestructura (hasta 30% si arriendas).',
      'Capital de trabajo (máximo 40% de las inversiones).'
    ],
    ineligibleExpenses: [
      'IVA, bienes raíces, vehículos con permiso de circulación.',
      'Remuneraciones propias o de familiares.',
      'Consumos básicos y pago de deudas.'
    ],
    requiredDocuments: [
      'Test de preselección en sercotec.cl.',
      'Formulario de modelo de negocio (10 ámbitos).',
      'Estructura de costos.',
      'Video pitch de hasta 90 segundos.'
    ],
    corfoAccountsBudget: [
      { account: 'Acciones de Gestión Empresarial', description: 'Asesorías, capacitación, marketing y formalización.' },
      { account: 'Inversiones', description: 'Activos, habilitación y capital de trabajo.' }
    ]
  },
  {
    id: 'sercotec_crece',
    name: 'SERCOTEC Crece',
    agency: 'SERCOTEC',
    category: 'Crecimiento y Escalamiento',
    badge: '$5M • Micro y pequeñas empresas con ventas de 200 a 25.000 UF',
    maxSubsidyCLP: 5000000,
    subsidyFormatted: '$5.000.000 CLP netos',
    maxCoFinancePct: 87,
    beneficiaryTypes: ['persona_natural', 'spa', 'srl', 'eirl', 'sa'],
    salesRequirement: 'Empresas con inicio de actividades en primera categoría y ventas netas anuales entre 200 UF y 25.000 UF.',
    salesBracketsEligible: ['menor_60m', 'micro_200_a_2400uf', 'pequena_2400_a_25000uf'],
    trlRange: 'Negocio en marcha que quiere crecer',
    trlEligible: ['primeras_ventas', 'escalamiento_global'],
    requiresInnovation: false,
    requiresCommercialValidation: true,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-21',
    callSchedule: 'Convocatorias regionales y sectoriales (2026: abril a junio)',
    summary: 'Subsidio para que micro y pequeñas empresas crezcan: asesorías, capacitación, marketing, equipos, habilitación y capital de trabajo.',
    description: 'Hasta $1.000.000 para gestión empresarial y el resto en inversiones. Aporte del 15% del subsidio. Proceso: test, formulario, video de 90 segundos, visita a terreno y comité regional.',
    evaluationCriteria: [
      { name: 'Potencial del proyecto de negocio', weight: 40, description: 'Cuánto puede crecer el negocio con el proyecto (comité regional).' },
      { name: 'Fundamentación de la oportunidad de negocio', weight: 20, description: 'Evidencia de la oportunidad y los clientes.' },
      { name: 'Coherencia y factibilidad del proyecto', weight: 20, description: 'Que las inversiones respondan al objetivo y sean realizables.' },
      { name: 'Productos con proceso de manufactura', weight: 20, description: 'Valor agregado en la producción.' }
    ],
    eligibleExpenses: [
      'Gestión empresarial: asesorías, capacitación, marketing (hasta $1.000.000).',
      'Activos fijos e intangibles, habilitación de infraestructura.',
      'Capital de trabajo: contrataciones y arriendos nuevos, materias primas.'
    ],
    ineligibleExpenses: [
      'IVA, bienes raíces, vehículos con patente.',
      'Pago a consultores por la postulación.',
      'Consumos básicos y deudas.'
    ],
    requiredDocuments: [
      'Test de preselección.',
      'Formulario de proyecto de negocio y estructura de costos.',
      'Video pitch de hasta 90 segundos.',
      'Carpeta Tributaria para Solicitar Créditos (con los F29).'
    ],
    corfoAccountsBudget: [
      { account: 'Acciones de Gestión Empresarial', description: 'Asesorías, capacitación y marketing (hasta $1.000.000).' },
      { account: 'Inversiones', description: 'Activos, habilitación y capital de trabajo.' }
    ]
  },
  {
    id: 'anid_fondef_idea',
    name: 'ANID Fondef IDeA I+D',
    agency: 'ANID',
    category: 'I+D+i y Tecnológico',
    badge: 'Hasta $227,7M • Tu empresa participa asociada a una universidad',
    maxSubsidyCLP: 227700000,
    subsidyFormatted: 'Hasta $227.700.000 CLP (24 meses)',
    maxCoFinancePct: 69,
    beneficiaryTypes: ['spa', 'srl', 'eirl', 'sa'],
    salesRequirement: 'Postula una universidad o centro de I+D sin fines de lucro; las empresas participan como entidades asociadas que aportan al menos 15% del subsidio.',
    salesBracketsEligible: ['sin_ventas', 'menor_60m', 'micro_200_a_2400uf', 'pequena_2400_a_25000uf', 'mediana_25000_a_100000uf', 'grande_mayor_100000uf'],
    trlRange: 'Resultados previos de I+D (TRL 2 cumplido) hacia una solución validada',
    trlEligible: ['idea_concepto', 'prototipo_lab', 'mvp_validado', 'primeras_ventas', 'escalamiento_global'],
    requiresInnovation: true,
    requiresCommercialValidation: false,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-21',
    callSchedule: 'Concurso anual (la convocatoria 2026 cerró en septiembre de 2025)',
    summary: 'Financia proyectos de investigación aplicada de universidades y centros de I+D, con empresas asociadas que aportan y aprovechan los resultados.',
    description: 'La institución beneficiaria aporta al menos 30% y las asociadas al menos 15% del subsidio. Tu empresa no recibe el subsidio, pero participa en el proyecto y en la transferencia de resultados.',
    evaluationCriteria: [
      { name: 'Capítulo 1: relevancia del problema, oportunidad y solución', weight: 50, description: 'Problema, solidez de la solución y TRL, mercado objetivo, impactos, mapa de ruta, estado del arte y resultados previos.' },
      { name: 'Capítulo 2: plan de trabajo, resultados esperados y capacidades', weight: 50, description: 'Objetivos, metodología, hitos con indicadores, colaboración, propiedad intelectual, coherencia de presupuesto y Gantt, y experiencia del equipo.' }
    ],
    eligibleExpenses: [
      'Personal (honorarios, remuneraciones, pago adicional hasta $600.000 mensuales).',
      'Equipamiento e infraestructura (infraestructura hasta 20%).',
      'Gastos de operación: insumos, software, difusión, propiedad intelectual, viajes.',
      'Gastos de administración indirectos (hasta 15% del subsidio).'
    ],
    ineligibleExpenses: [
      'Pagos a entidades asociadas o colaboradoras.',
      'Finiquitos, vacaciones, indemnizaciones y becas.'
    ],
    requiredDocuments: [
      'Formulario oficial (capítulos 1 y 2) y planilla de costos.',
      'Cartas de compromiso de beneficiarias y asociadas.',
      'Presentación en PDF y currículum del equipo en el Portal del Investigador.'
    ],
    corfoAccountsBudget: [
      { account: 'Gastos en personal', description: 'Equipo de investigación.' },
      { account: 'Equipamiento e infraestructura', description: 'Equipos y adecuaciones (infraestructura máx. 20%).' },
      { account: 'Gastos de operación', description: 'Insumos, software, difusión, PI y viajes.' },
      { account: 'Gastos de administración indirectos', description: 'Costos indirectos de la institución.', maxPct: 15 }
    ]
  },
  {
    id: 'fia_innovacion_agro',
    name: 'FIA Proyectos de Innovación de Interés Privado',
    agency: 'FIA',
    category: 'Innovación Agro / Sostenible',
    badge: 'Hasta $50M • Mipymes del agro con prueba de concepto (TRL 3 a 5)',
    maxSubsidyCLP: 50000000,
    subsidyFormatted: 'Hasta $50.000.000 CLP',
    maxCoFinancePct: 80,
    beneficiaryTypes: ['spa', 'srl', 'eirl', 'sa'],
    salesRequirement: 'Empresas del sector silvoagropecuario o agroalimentario con ventas de hasta 50.000 UF e inicio de actividades en primera categoría.',
    salesBracketsEligible: ['menor_60m', 'micro_200_a_2400uf', 'pequena_2400_a_25000uf', 'mediana_25000_a_100000uf'],
    trlRange: 'Prueba de concepto validada (TRL 3) hacia validación en entorno relevante (TRL 5)',
    trlEligible: ['prototipo_lab', 'mvp_validado', 'primeras_ventas', 'escalamiento_global'],
    requiresInnovation: true,
    requiresCommercialValidation: false,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-21',
    callSchedule: 'Convocatoria nacional anual (2026: mayo a junio)',
    summary: 'Cofinancia el desarrollo y la validación temprana de tecnologías para el sector silvoagropecuario y agroalimentario.',
    description: 'FIA aporta hasta 80% del costo (máximo $50.000.000) y la contraparte al menos 20%. Debe responder a un lineamiento: recursos hídricos, sanidad, recursos forestales o mercados agroalimentarios. Incluye un pitch de 5 minutos en la admisión.',
    evaluationCriteria: [
      { name: 'Problema u oportunidad', weight: 7.5, description: 'Pertinencia y relevancia para el sector (evaluación individual).' },
      { name: 'Mérito científico-tecnológico', weight: 15, description: 'Coherencia solución-problema, novedad e incertidumbre tecnológica (evaluación individual).' },
      { name: 'Calidad científico-técnica', weight: 12.5, description: 'Objetivos, metodología, diseño experimental y avance de TRL (evaluación individual).' },
      { name: 'Diferenciación competitiva', weight: 5, description: 'Potencial de aplicación productiva y proyección (evaluación individual).' },
      { name: 'Capacidades del equipo', weight: 5, description: 'Experiencia en I+D y capacidad de gestión (evaluación individual).' },
      { name: 'Costos', weight: 5, description: 'Pertinencia del aporte FIA y de la contraparte (evaluación individual).' },
      { name: 'Mérito innovador estratégico', weight: 20, description: 'Novedad a nivel nacional e incertidumbre tecnológica (comité estratégico).' },
      { name: 'Potencial de impacto competitivo', weight: 20, description: 'Fortalecimiento del sector y nuevas oportunidades (comité estratégico).' },
      { name: 'Pertinencia del financiamiento público', weight: 10, description: 'Por qué se justifica apoyo público en esta etapa (comité estratégico).' }
    ],
    eligibleExpenses: [
      'Recursos humanos (personal de planta con topes anuales).',
      'Equipamiento e infraestructura menor.',
      'Materiales, insumos, viáticos, difusión y gastos generales.',
      'Servicios de terceros (hasta 70% del aporte FIA).',
      'Imprevistos (hasta 5% del aporte FIA).'
    ],
    ineligibleExpenses: [
      'Inmuebles y bienes de capital no determinantes.',
      'Deudas, acciones, multas, depreciación de vehículos.',
      'IVA recuperable.'
    ],
    requiredDocuments: [
      'Formulario de postulación y memoria de cálculo FIA.',
      'Certificado de vigencia y Carpeta Tributaria para solicitar crédito.',
      'Declaración jurada de ventas, cartas de compromiso, currículum, evidencia de TRL y presentación del pitch.'
    ],
    corfoAccountsBudget: [
      { account: 'Recursos humanos', description: 'Equipo técnico.' },
      { account: 'Equipamiento e infraestructura menor', description: 'Equipos menores y habilitación.' },
      { account: 'Materiales, viáticos y difusión', description: 'Operación del proyecto.' },
      { account: 'Servicios de terceros', description: 'Laboratorios y desarrollos externos.', maxPct: 70 },
      { account: 'Imprevistos', description: 'Con autorización previa.', maxPct: 5 }
    ]
  }
  ,{
    id: 'corfo_innova_region',
    name: 'CORFO Innova Región',
    agency: 'CORFO',
    category: 'I+D+i y Tecnológico',
    badge: 'Hasta $60M • Empresas de 18+ meses con ventas • Convocatorias por región',
    maxSubsidyCLP: 60000000,
    subsidyFormatted: 'Hasta $60.000.000 ($67.500.000 si es liderada por mujeres)',
    maxCoFinancePct: 80,
    femaleBonusPct: 10,
    beneficiaryTypes: ['persona_natural', 'spa', 'srl', 'eirl', 'sa'],
    salesRequirement: 'Al menos 18 meses de inicio de actividades en primera categoría (vigente) y ventas dentro de los 18 meses anteriores a postular.',
    salesBracketsEligible: ['menor_60m', 'micro_200_a_2400uf', 'pequena_2400_a_25000uf', 'mediana_25000_a_100000uf', 'grande_mayor_100000uf'],
    trlRange: 'Desde prototipo (sobre TRL 3, con prueba de concepto) hasta validación técnica a escala o validación comercial',
    trlEligible: ['prototipo_lab', 'mvp_validado', 'primeras_ventas'],
    requiresInnovation: true,
    requiresCommercialValidation: false,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-25',
    callSchedule: 'Cada región abre su propia convocatoria, con focos temáticos propios (en 2026 abrieron, entre otras, Antofagasta, Valparaíso, Araucanía y Arica)',
    summary: 'Cofinancia el desarrollo de productos o procesos nuevos o mejorados en tu región, desde el prototipo hasta la validación técnica o comercial.',
    description: 'Lo abre cada Comité de Desarrollo Productivo Regional o dirección regional de Corfo, con focos temáticos que cambian por región. Corfo cubre hasta 80% (micro y pequeña), 60% (mediana) o 40% (grande), con un tope de $60.000.000. La empresa debe tener domicilio tributario en la región (o un asociado que lo tenga) y la solución debe haber superado la prueba de concepto (TRL 3).',
    evaluationCriteria: [
      { name: 'Problema: diagnóstico', weight: 5, description: 'Claridad y respaldo del problema, desafío u oportunidad.' },
      { name: 'Mercado objetivo', weight: 5, description: 'A quién va dirigida la solución y cuánto vale la oportunidad.' },
      { name: 'Solución: metodología', weight: 20, description: 'Calidad y coherencia del plan para desarrollar y validar la solución.' },
      { name: 'Solución: grado de novedad y diferenciación', weight: 20, description: 'Qué tiene de nuevo frente a lo que existe y a la competencia.' },
      { name: 'Introducción al mercado: impacto', weight: 15, description: 'Impacto económico o productivo esperado para la empresa y la región.' },
      { name: 'Introducción al mercado: escalabilidad', weight: 10, description: 'Potencial de crecer y llegar a más mercados.' },
      { name: 'Capacidades de beneficiario, asociados y entidades', weight: 10, description: 'Capacidades técnicas y de gestión de los participantes.' },
      { name: 'Equipo de trabajo', weight: 15, description: 'Experiencia y dedicación del equipo del proyecto.' }
    ],
    eligibleExpenses: [
      'Equipo del proyecto (sueldos u honorarios por el tiempo dedicado).',
      'Prototipado, validación técnica y comercial, equipos, materiales y entidades colaboradoras.',
      'Protección de propiedad intelectual, certificaciones y estrategia de marketing.',
      'Formulación externa del proyecto (micro y pequeñas, hasta $2.000.000) y costo de garantías.'
    ],
    ineligibleExpenses: [
      'Inversión sobre 30% del subsidio y administración sobre 10% del subsidio.',
      'Inmuebles.',
      'IVA recuperable.'
    ],
    requiredDocuments: [
      'Formulario de postulación en línea con sus planillas y anexos.',
      'Presupuesto y plan de trabajo.',
      'Información del Sello 40 horas (si corresponde).'
    ],
    corfoAccountsBudget: [
      { account: 'Recursos Humanos', description: 'Equipo de trabajo del proyecto.' },
      { account: 'Gastos de Operación', description: 'Desarrollo, validación y entidades colaboradoras (hasta 40% del subsidio).', maxPct: 40 },
      { account: 'Gastos de Inversión', description: 'Equipos y activos.', maxPct: 30 },
      { account: 'Gastos de Administración', description: 'Gestión y garantías.', maxPct: 10 }
    ]
  },
  {
    id: 'corfo_consolida_expande',
    name: 'CORFO Consolida y Expande Innovación',
    agency: 'CORFO',
    category: 'Crecimiento y Escalamiento',
    badge: 'Hasta $150M • Escalar una innovación ya validada • Empresas de 18+ meses con ventas',
    maxSubsidyCLP: 150000000,
    subsidyFormatted: 'Hasta $150.000.000',
    maxCoFinancePct: 60,
    femaleBonusPct: 10,
    beneficiaryTypes: ['persona_natural', 'spa', 'srl', 'eirl', 'sa'],
    salesRequirement: 'Al menos 18 meses de inicio de actividades en primera categoría (vigente) y ventas dentro de los 18 meses anteriores a postular.',
    salesBracketsEligible: ['menor_60m', 'micro_200_a_2400uf', 'pequena_2400_a_25000uf', 'mediana_25000_a_100000uf', 'grande_mayor_100000uf'],
    trlRange: 'Innovación ya validada técnica o comercialmente, lista para escalar',
    trlEligible: ['primeras_ventas', 'escalamiento_global'],
    requiresInnovation: true,
    requiresCommercialValidation: true,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-25',
    callSchedule: 'Convocatoria nacional (en 2026 abrió en junio; se espera otra antes de fin de año)',
    summary: 'Cofinancia el escalamiento nacional o internacional de un producto, servicio o proceso innovador que ya fue validado y que requirió I+D.',
    description: 'Es el paso siguiente a Crea y Valida: no es para desarrollar, sino para escalar comercial o productivamente y validar o empaquetar la solución en los mercados de destino. Corfo cubre hasta 60% (micro y pequeña), 50% (mediana) o 40% (grande), con tope de $150.000.000, y 10% adicional si la empresa es liderada por mujeres. Se postula con un plan de negocios y tiene un hito de continuidad al mes 3.',
    evaluationCriteria: [
      { name: 'Problema u oportunidad', weight: 30, description: 'Diagnóstico de la oportunidad de escalar en los mercados de destino.' },
      { name: 'Solución, plan de negocios y capacidades', weight: 70, description: 'Metodología, novedad, plan de negocios (estrategia y escalabilidad) y capacidades del equipo y asociados. Revisa la ponderación detallada en las bases técnicas de la convocatoria.' }
    ],
    eligibleExpenses: [
      'Equipo del proyecto.',
      'Escalamiento comercial y productivo, validación y empaquetamiento técnico en mercados de destino.',
      'Marketing, certificaciones, propiedad intelectual y aterrizaje en otros mercados.'
    ],
    ineligibleExpenses: [
      'Desarrollo de un producto que todavía no ha sido validado.',
      'Inmuebles.',
      'IVA recuperable.'
    ],
    requiredDocuments: [
      'Formulario en la plataforma de postulación.',
      'Presentación de la solución con cuadro comparativo frente a alternativas existentes.',
      'Planilla de presupuesto y plan de trabajo.',
      'Plan de negocios actualizado.',
      'Currículum del equipo técnico.'
    ],
    corfoAccountsBudget: [
      { account: 'Recursos Humanos', description: 'Equipo del proyecto.' },
      { account: 'Gastos de Operación', description: 'Escalamiento, validación en mercados de destino y marketing.' },
      { account: 'Gastos de Inversión', description: 'Equipos para escalar (revisa el tope en las bases).' },
      { account: 'Gastos de Administración', description: 'Gestión y garantías.' }
    ]
  },
  {
    id: 'startup_chile_growth',
    name: 'Start-Up Chile Growth',
    agency: 'START-UP CHILE',
    category: 'Crecimiento y Escalamiento',
    badge: '$75M • Startups tecnológicas con ventas de $80M a $800M • 50% (60% mujeres)',
    maxSubsidyCLP: 75000000,
    subsidyFormatted: 'Hasta $75.000.000 CLP',
    maxCoFinancePct: 50,
    femaleBonusPct: 10,
    beneficiaryTypes: ['spa', 'srl', 'eirl', 'sa'],
    salesRequirement: 'Ventas netas de $80.000.000 a $800.000.000 en los 12 meses anteriores a la apertura, y empresa chilena con al menos 24 meses de actividad ante el SII.',
    salesBracketsEligible: ['micro_200_a_2400uf', 'pequena_2400_a_25000uf'],
    trlRange: 'Startup con ventas en crecimiento que busca expandirse y levantar capital',
    trlEligible: ['primeras_ventas', 'escalamiento_global'],
    requiresInnovation: true,
    requiresCommercialValidation: true,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-25',
    callSchedule: 'Junto con Build e Ignite en cada generación (revisa startupchile.org)',
    summary: 'Aceleración para startups tecnológicas que ya venden y quieren crecer desde Chile: hasta $75.000.000 sin ceder participación.',
    description: 'Corfo cubre 50% del costo (60% si la líder del equipo es mujer); el resto lo aporta la empresa en dinero. Incluye mentorías, preparación para levantar capital, redes comerciales y apoyo en gestión del equipo. El líder del equipo trabaja a tiempo completo desde Chile.',
    evaluationCriteria: [
      { name: 'Equipo', weight: 25, description: 'Capacidad y dedicación del equipo fundador (ponderación referencial).' },
      { name: 'Tracción y crecimiento', weight: 35, description: 'Ventas, clientes y ritmo de crecimiento (ponderación referencial).' },
      { name: 'Escalabilidad global', weight: 20, description: 'Potencial de expansión internacional desde Chile (ponderación referencial).' },
      { name: 'Impacto en Chile', weight: 20, description: 'Empleo de calidad y aporte al ecosistema (ponderación referencial).' }
    ],
    eligibleExpenses: ['Contrataciones, expansión comercial, desarrollo de producto, viajes y propiedad intelectual.'],
    ineligibleExpenses: ['Pago de deudas y gastos personales.'],
    requiredDocuments: ['Postulación en línea en startupchile.org.', 'Acreditación de ventas de los últimos 12 meses.'],
    corfoAccountsBudget: [
      { account: 'Recursos Humanos', description: 'Equipo y nuevas contrataciones.' },
      { account: 'Gastos de Operación', description: 'Expansión comercial, producto y levantamiento de capital.' },
      { account: 'Gastos de Administración', description: 'Gestión y rendiciones.' }
    ]
  },
  {
    id: 'sercotec_digitaliza_almacen',
    name: 'SERCOTEC Digitaliza tu Almacén',
    agency: 'SERCOTEC',
    category: 'Crecimiento y Escalamiento',
    badge: 'Hasta $3M • Almacenes y negocios de barrio • Ventas hasta 5.000 UF',
    maxSubsidyCLP: 3000000,
    subsidyFormatted: 'Hasta $3.000.000 CLP netos',
    maxCoFinancePct: 83,
    beneficiaryTypes: ['persona_natural', 'spa', 'srl', 'eirl', 'sa'],
    salesRequirement: 'Almacenes y negocios de barrio con inicio de actividades en primera categoría, más de 12 meses funcionando y ventas netas anuales de hasta 5.000 UF.',
    salesBracketsEligible: ['menor_60m', 'micro_200_a_2400uf', 'pequena_2400_a_25000uf'],
    trlRange: 'Almacén funcionando que quiere modernizarse',
    trlEligible: ['primeras_ventas'],
    requiresInnovation: false,
    requiresCommercialValidation: true,
    status: 'Próxima Convocatoria',
    callStatus: 'por_confirmar',
    closeDate: null,
    lastVerified: '2026-10-25',
    callSchedule: 'Convocatorias regionales a comienzos de año (en 2026, enero y febrero)',
    summary: 'Subsidio para modernizar almacenes de barrio: caja y sistema de ventas, control de inventario, balanzas, vitrinas, iluminación y gestión.',
    description: 'Para almaceneros, minimarkets, panaderías, carnicerías, rotiserías, botillerías y bazares que atienden al consumidor final en su barrio. Sercotec financia hasta $3.000.000 netos: entre $200.000 y $500.000 en gestión empresarial y entre $2.500.000 y $2.800.000 en inversiones. El aporte del negocio lo fija cada región (máximo 20% del subsidio) y el IVA lo pagas tú. Se pide hacer el curso virtual "Almacenes de Chile".',
    evaluationCriteria: [
      { name: 'Evaluación técnica en terreno', weight: 40, description: 'Antes, el formulario pasa por admisibilidad y recibe nota para un ranking. Luego se visita el almacén para revisar el negocio y la coherencia del plan.' },
      { name: 'Comité de Evaluación Regional', weight: 60, description: 'El comité regional decide la lista de seleccionados.' }
    ],
    eligibleExpenses: [
      'Tecnología: sistema de punto de venta (POS), control digital de inventario, caja registradora moderna.',
      'Equipamiento: vitrinas, balanzas digitales, cortadoras, iluminación LED, generador eléctrico.',
      'Gestión: asesoría, capacitación y marketing para atraer clientes (entre $200.000 y $500.000).'
    ],
    ineligibleExpenses: [
      'IVA (lo pagas tú).',
      'Pago de deudas.',
      'Compras a ti mismo o a familiares.'
    ],
    requiredDocuments: [
      'Formulario de postulación en sercotec.cl.',
      'Inicio de actividades en el SII y RUT.',
      'F29 o Carpeta Tributaria (o autorización en Mi SII).',
      'Inscripción en el curso virtual "Almacenes de Chile".'
    ],
    corfoAccountsBudget: [
      { account: 'Acciones de Gestión Empresarial', description: 'Asesoría, capacitación y marketing ($200.000 a $500.000).' },
      { account: 'Inversiones', description: 'Tecnología y equipamiento ($2.500.000 a $2.800.000).' }
    ]
  }
];

export const REQUIRED_DOCUMENTS_GUIDE = [
  {
    id: 'f29_sii',
    name: 'Carpeta Tributaria Electrónica SII (F29 y F22)',
    issuer: 'Servicio de Impuestos Internos (sii.cl)',
    frequency: 'Últimos 12 a 24 meses',
    purpose: 'Acreditar nivel de ventas netas, antigüedad de inicio de actividades y régimen tributario (1ª categoría).',
    stepByStep: [
      '1. Ingresar a sii.cl con RUT y Clave Tributaria de la empresa o ClaveÚnica del Representante Legal.',
      '2. Ir a "Servicios Online" > "Situación Tributaria" > "Carpeta Tributaria Electrónica".',
      '3. Seleccionar la opción "Para Solicitar Créditos / Fondos Públicos".',
      '4. Seleccionar periodo: "Últimos 24 meses" y generar en PDF con código verificador vigente.',
      '5. Descargar el archivo PDF firmado digitalmente por el SII.'
    ],
    criticalTip: 'Asegúrate de que no existan F29 "No Declarados" en el período, ya que causará descalificación automática en el examen de admisibilidad.'
  },
  {
    id: 'estatuto_res',
    name: 'Certificado de Estatuto Actualizado y Vigencia',
    issuer: 'Registro de Empresas y Sociedades (Tu Empresa en un Día) o Conservador de Bienes Raíces (CBR)',
    frequency: 'Emitido con menos de 30 a 60 días de antigüedad',
    purpose: 'Verificar la existencia legal de la empresa, su objeto social y quién detenta la representación legal y facultades de administración.',
    stepByStep: [
      '1. Si la empresa fue creada en el régimen simplificado: ingresar a registrodeempresasysociedades.cl (Tu Empresa en un Día).',
      '2. Seleccionar "Certificados" > "Certificado de Estatuto Actualizado" y "Certificado de Vigencia".',
      '3. Ingresar RUT de la empresa y descargar de inmediato (es 100% gratuito con código QR de verificación).',
      '4. Si es del régimen tradicional: solicitar Copia con Vigencia en el Conservador de Bienes Raíces respectivo.'
    ],
    criticalTip: 'El Objeto Social de los estatutos DEBE permitir la realización de las actividades del proyecto (ej: desarrollo de software, asesorías, comercialización, etc.).'
  },
  {
    id: 'deuda_tgr',
    name: 'Certificado de Deuda Tributaria (TGR)',
    issuer: 'Tesorería General de la República (tgr.cl)',
    frequency: 'Emitido al momento de la postulación',
    purpose: 'Demostrar que la empresa o el postulante no registra deudas tributarias morosas con el Fisco de Chile.',
    stepByStep: [
      '1. Ingresar a tgr.cl con ClaveÚnica o Clave Tributaria.',
      '2. En el menú superior seleccionar "Certificados y Comprobantes".',
      '3. Escoger "Certificado de Deudas" o "Certificado de No Deuda".',
      '4. Descargar el comprobante que indique expresamente "No registra deudas tributarias morosas".'
    ],
    criticalTip: 'Si tienes un convenio de pago activo en TGR, asegúrate de adjuntar el comprobante de convenio vigente al día.'
  },
  {
    id: 'previsional_f30',
    name: 'Certificado de Antecedentes Laborales y Previsionales (F30)',
    issuer: 'Dirección del Trabajo (dt.gob.cl / Previred)',
    frequency: 'Últimos 30 días',
    purpose: 'Acreditar que la empresa no mantiene deudas previsionales impagas ni multas laborales pendientes con sus trabajadores.',
    stepByStep: [
      '1. Ingresar al portal MiDT (dt.gob.cl) con ClaveÚnica del representante legal.',
      '2. Acceder al perfil de la persona jurídica (empleador).',
      '3. Ir a "Certificados" > "Certificado de Antecedentes Laborales y Previsionales (F30)".',
      '4. Descargar el certificado oficial con firma electrónica avanzada.'
    ],
    criticalTip: 'Tanto CORFO como SERCOTEC descalifican automáticamente a empresas con multas laborales o deudas de cotizaciones previsionales vigentes.'
  },
  {
    id: 'carta_interes_loi',
    name: 'Carta de Manifestación de Interés / Validación Comercial (LOI)',
    issuer: 'Clientes piloto, empresas del rubro o asociaciones gremiales',
    frequency: 'Ad hoc para la postulación',
    purpose: 'Acreditar que existe tracción, demanda de mercado real y disposición a probar o comprar la solución innovadora.',
    stepByStep: [
      '1. Usar el generador de Cartas de ImpulsaCap para crear la plantilla personalizada.',
      '2. Presentar la carta a 2 o 3 clientes prospecto, directores de innovación o gremios.',
      '3. La carta debe incluir: logo de la empresa firmante, declaración explícita del dolor que sufren, interés en pilotear la solución y firma del tomador de decisión (con cargo y contacto verificable).',
      '4. Subir la carta escaneada en formato PDF.'
    ],
    criticalTip: 'Las cartas firmadas por empresas reales suman hasta 0.8 puntos adicionales en la rúbrica de tracción de CORFO y Start-Up Chile.'
  }
];
