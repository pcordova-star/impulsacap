import { ChileanFund } from '../types/funds';

export const CHILEAN_FUNDS: ChileanFund[] = [
  {
    id: 'corfo_semilla_inicia',
    name: 'CORFO Semilla Inicia',
    agency: 'CORFO',
    category: 'Capital Semilla',
    badge: 'Hasta $15M CLP • Sin ventas previas',
    maxSubsidyCLP: 15000000,
    subsidyFormatted: '$15.000.000 CLP',
    maxCoFinancePct: 75,
    femaleBonusPct: 10, // Hasta 85% para empresas de mujeres
    beneficiaryTypes: ['persona_natural', 'spa', 'srl', 'eirl'],
    salesRequirement: 'Sin ventas o facturación neta menor a $60.000.000 CLP en los 12 meses previos.',
    salesBracketsEligible: ['sin_ventas', 'menor_60m'],
    trlRange: 'TRL 2 a TRL 4 (Fase de prototipado y validación técnica)',
    trlEligible: ['idea_concepto', 'prototipo_lab', 'mvp_validado'],
    requiresInnovation: true,
    requiresCommercialValidation: false,
    status: 'Ventanilla Abierta',
    callSchedule: 'Convocatorias bianuales (Marzo/Abril y Agosto/Septiembre) + Apertura regional continua',
    summary: 'Subsidio no reembolsable para apoyar emprendimientos innovadores con potencial de alcance nacional y global, desde la fase de idea/prototipo hasta la validación comercial y primeras ventas.',
    description: 'Semilla Inicia de Corfo cofinancia actividades para validar comercial y técnicamente una solución innovadora diferenciada, desarrollar prototipos funcionales, prospección de clientes y formalización.',
    evaluationCriteria: [
      {
        name: 'Propuesta de Valor y Nivel de Innovación',
        weight: 40,
        description: 'Grado de novedad de la solución frente a lo que ya existe en el mercado chileno o regional, y magnitud del dolor o problema que resuelve.'
      },
      {
        name: 'Escalabilidad del Modelo y Mercado',
        weight: 30,
        description: 'Capacidad de crecer a tasas exponenciales, tamaño de mercado direccionable (TAM/SAM) y viabilidad comercial del modelo de monetización.'
      },
      {
        name: 'Capacidad del Equipo Emprendedor',
        weight: 30,
        description: 'Experiencia técnica y comercial del equipo fundador, complementariedad, dedicación horaria y capacidad de ejecución demostrada.'
      }
    ],
    eligibleExpenses: [
      'Recursos humanos dedicados al desarrollo del proyecto (honorarios o sueldos brutos).',
      'Desarrollo de prototipos, software MVP, pruebas de laboratorio y certificaciones técnicas.',
      'Gastos de prospección comercial, marketing digital, validación con clientes piloto y branding.',
      'Asesorías técnicas, mentorías de la red Corfo y trámites de propiedad intelectual (INAPI).',
      'Arrendamiento de infraestructura o equipos esenciales para la ejecución del proyecto.'
    ],
    ineligibleExpenses: [
      'Inversiones en instrumentos financieros o pago de deudas y multas.',
      'Compra de inmuebles o terrenos.',
      'Pago de IVA (el IVA debe ser asumido íntegramente por el postulante).',
      'Gastos corrientes no atribuibles al proyecto o realizados antes de la fecha de inicio oficial.'
    ],
    requiredDocuments: [
      'Cédula de Identidad de postulantes / Personería Legal.',
      'Certificado de Estatuto Actualizado (Registro de Empresas y Sociedades - Tu Empresa en un Día).',
      'Carpeta Tributaria Electrónica SII para Acreditar Rentas / Fondos Concursables (últimos 12 meses).',
      'Certificado de Deuda Tributaria TGR al día.',
      'Formulario de Postulación Técnica y Presupuestaria oficial.'
    ],
    corfoAccountsBudget: [
      { account: 'Recursos Humanos', description: 'Personal contratado o a honorarios para el desarrollo del producto/servicio.', maxPct: 60 },
      { account: 'Gastos de Operación', description: 'Insumos, software SaaS, servicios en la nube (AWS/GCP), mentorías, prospección comercial.', maxPct: 70 },
      { account: 'Gastos de Inversión', description: 'Equipamiento y maquinaria indispensable para prototipado (límite según bases).', maxPct: 30 },
      { account: 'Gastos de Administración', description: 'Costos indirectos y servicios contables/legales atribuibles.', maxPct: 10 }
    ]
  },
  {
    id: 'corfo_semilla_expande',
    name: 'CORFO Semilla Expande',
    agency: 'CORFO',
    category: 'Crecimiento y Escalamiento',
    badge: 'Hasta $45M CLP en 2 Fases • Con ventas iniciales',
    maxSubsidyCLP: 45000000,
    subsidyFormatted: '$45.000.000 CLP ($25M Fase 1 + $20M Fase 2)',
    maxCoFinancePct: 75,
    femaleBonusPct: 10,
    beneficiaryTypes: ['spa', 'srl', 'eirl', 'sa'],
    salesRequirement: 'Ventas de la solución entre $100.000 y $60.000.000 CLP durante los 12 meses anteriores a la postulación.',
    salesBracketsEligible: ['menor_60m', 'micro_200_a_2400uf'],
    trlRange: 'TRL 6 a TRL 8 (MVP ya validado con primeras transacciones comerciales)',
    trlEligible: ['mvp_validado', 'primeras_ventas'],
    requiresInnovation: true,
    requiresCommercialValidation: true,
    status: 'Abierto',
    callSchedule: 'Convocatorias nacionales anuales (Abril - Mayo y Octubre)',
    summary: 'Para emprendimientos innovadores que ya cuenten con primeras ventas y busquen despegar comercialmente a nivel nacional y acelerar su expansión hacia mercados extranjeros.',
    description: 'Etapa 1 entrega hasta $25.000.000 CLP (75% cofinanciamiento o hasta 85% para empresas de mujeres) y tras validar crecimiento en ventas, permite acceder a Etapa 2 por hasta $20.000.000 CLP adicionales.',
    evaluationCriteria: [
      {
        name: 'Tracción Comercial y Potencial de Escalamiento',
        weight: 40,
        description: 'Ventas demostradas de la innovación, pipeline de clientes, estrategia de crecimiento B2B o B2C y escalabilidad internacional.'
      },
      {
        name: 'Grado de Novedad y Barreras de Entrada',
        weight: 30,
        description: 'Diferenciación frente a competidores directos e indirectos, ventajas competitivas sostenibles y defensibilidad del modelo.'
      },
      {
        name: 'Equipo de Ejecución y Plan Operativo',
        weight: 30,
        description: 'Habilidades comerciales y técnicas del equipo fundador, metodología de prospección y coherencia del presupuesto.'
      }
    ],
    eligibleExpenses: [
      'Estrategia de ventas, marketing de performance, captación y onboarding de clientes.',
      'Mejoras técnicas del producto basadas en feedback de usuarios reales.',
      'Contratación de ejecutivos comerciales, desarrolladores y especialistas de producto.',
      'Participación en ferias internacionales de negocios y misiones de prospección comercial.',
      'Certificaciones de seguridad, homologaciones de producto y empaquetamiento comercial.'
    ],
    ineligibleExpenses: [
      'Adquisición de vehículos de transporte general.',
      'Pago de dividendos a socios o retiro de utilidades.',
      'Deudas previas o intereses bancarios.',
      'Impuestos recuperables (IVA).'
    ],
    requiredDocuments: [
      'Carpeta Tributaria Electrónica SII con registro de facturación de los últimos 24 meses.',
      'Certificado de Registro de Empresas y Sociedades (Vigencia y Estatuto).',
      'Facturas de venta electrónicas o boletas que acrediten las ventas mínimas exigidas.',
      'Certificado de Deuda Tributaria TGR sin morosidades.',
      'Pitch Deck en video (máximo 3 minutos según especificaciones de Corfo).'
    ],
    corfoAccountsBudget: [
      { account: 'Recursos Humanos', description: 'Equipo comercial, desarrollo y operaciones.', maxPct: 50 },
      { account: 'Gastos de Operación', description: 'Campaña de marketing, ventas, SaaS, prospección nacional/internacional.', maxPct: 70 },
      { account: 'Gastos de Inversión', description: 'Herramientas y equipamiento productivo indispensable.', maxPct: 20 },
      { account: 'Gastos de Administración', description: 'Gestión contable y rendición de cuentas.', maxPct: 10 }
    ]
  },
  {
    id: 'corfo_crea_valida',
    name: 'CORFO Crea y Valida I+D+i',
    agency: 'CORFO',
    category: 'I+D+i y Tecnológico',
    badge: 'Hasta $180M CLP • I+D Empresarial y Prototipos',
    maxSubsidyCLP: 180000000,
    subsidyFormatted: 'Hasta $180.000.000 CLP (Proyectos colaborativos) / $100M Individual',
    maxCoFinancePct: 70, // 40% a 70% según tamaño empresa (micro/pequeña hasta 70%)
    femaleBonusPct: 10,
    beneficiaryTypes: ['spa', 'srl', 'sa', 'eirl'],
    salesRequirement: 'Personas jurídicas con al menos 18 a 24 meses de inicio de actividades con ventas demostradas en 1ª categoría.',
    salesBracketsEligible: ['micro_200_a_2400uf', 'pequena_2400_a_25000uf', 'mediana_25000_a_100000uf', 'grande_mayor_100000uf'],
    trlRange: 'TRL 3 a TRL 7 (De hipótesis tecnológica a prototipo validado en entorno real)',
    trlEligible: ['prototipo_lab', 'mvp_validado', 'primeras_ventas'],
    requiresInnovation: true,
    requiresCommercialValidation: false,
    status: 'Ventanilla Abierta',
    callSchedule: 'Llamados temáticos (Sostenibilidad, Hidrógeno Verde, IA) y Ventanilla Abierta I+D',
    summary: 'Subsidio para apoyar proyectos de I+D+i que resuelvan un desafío tecnológico o productivo de alta incertidumbre, mediante el desarrollo o validación de nuevos productos, procesos o servicios.',
    description: 'Permite a las empresas financiar el desarrollo experimental, pruebas en entornos simulados o reales, contratación de entidades colaboradoras (universidades o centros de I+D) y empaquetamiento tecnológico.',
    evaluationCriteria: [
      {
        name: 'Mérito Innovador y Desafío Tecnológico (I+D)',
        weight: 40,
        description: 'Grado de incertidumbre científica/tecnológica, novedad respecto al estado del arte internacional y metodología experimental.'
      },
      {
        name: 'Modelo de Negocio e Impacto Económico/Ambiental',
        weight: 30,
        description: 'Potencial de retorno de la inversión, mercado objetivo, impacto en productividad y sostenibilidad.'
      },
      {
        name: 'Capacidades de I+D del Postulante y Entidades Colaboradoras',
        weight: 30,
        description: 'Infraestructura, investigadores calificados, plan de trabajo e hitos de validación técnica.'
      }
    ],
    eligibleExpenses: [
      'Investigadores, ingenieros y personal técnico con dedicación al proyecto.',
      'Servicios de I+D contratados a Universidades, Centros Tecnológicos o laboratorios certificados.',
      'Materiales, reactivos químicos, componentes de hardware y prototipado.',
      'Ensayos de campo, validación en condiciones reales y licenciamiento previo.',
      'Protección de propiedad intelectual (patentes de invención INAPI / PCT).'
    ],
    ineligibleExpenses: [
      'Costos de producción industrial a gran escala una vez validado el prototipo.',
      'Gastos corrientes no científicos de la empresa.',
      'Impuestos recuperables (IVA).'
    ],
    requiredDocuments: [
      'Carpeta Tributaria Electrónica SII (últimos 24 meses).',
      'Certificado de Estatuto Actualizado y personería vigente del representante legal.',
      'Carta de Manifestación de Interés / Patrocinio de entidades asociadas (si aplica colaborativo).',
      'Certificado de no tener deudas tributarias ni previsionales.',
      'Memoria Técnica de I+D y Estado del Arte.'
    ],
    corfoAccountsBudget: [
      { account: 'Recursos Humanos I+D', description: 'Investigadores, ingenieros y desarrolladores principales.', maxPct: 50 },
      { account: 'Gastos de Operación y Ensayos', description: 'Ensayos de laboratorio, insumos, pruebas de estrés y software científico.', maxPct: 60 },
      { account: 'Gastos de Inversión Tecnológica', description: 'Instrumental científico o equipamiento especializado de testeo.', maxPct: 40 },
      { account: 'Entidades Expertas Contratadas', description: 'Servicios de I+D con universidades o centros tecnológicos.', maxPct: 40 }
    ]
  },
  {
    id: 'corfo_sumate_innovar',
    name: 'CORFO Súmate a Innovar',
    agency: 'CORFO',
    category: 'I+D+i y Tecnológico',
    badge: 'Hasta $15M CLP • Resolución rápida de desafíos',
    maxSubsidyCLP: 15000000,
    subsidyFormatted: '$15.000.000 CLP (Hasta 80% cofinanciamiento)',
    maxCoFinancePct: 80,
    femaleBonusPct: 10,
    beneficiaryTypes: ['spa', 'srl', 'sa', 'eirl'],
    salesRequirement: 'Empresas con al menos 1 año de inicio de actividades y ventas en el último año.',
    salesBracketsEligible: ['micro_200_a_2400uf', 'pequena_2400_a_25000uf', 'mediana_25000_a_100000uf'],
    trlRange: 'TRL 3 a TRL 6 (Desarrollo rápido de soluciones o prototipos a desafíos internos)',
    trlEligible: ['prototipo_lab', 'mvp_validado'],
    requiresInnovation: true,
    requiresCommercialValidation: false,
    status: 'Próxima Convocatoria',
    callSchedule: 'Llamados regulares con foco en reactivación sostenible y economía circular',
    summary: 'Para empresas que necesiten resolver un problema o desafío productivo mediante la vinculación con entidades expertas o desarrollo de una solución innovadora ágil.',
    description: 'Financia hasta el 80% del proyecto con un tope de $15M CLP en un plazo de ejecución de hasta 6 meses. Es el fondo ideal para pymes que dan su primer paso en innovación tecnológica.',
    evaluationCriteria: [
      {
        name: 'Relevancia del Desafío y Solución Propuesta',
        weight: 45,
        description: 'Claridad en la definición del cuello de botella productivo y potencial de la solución para resolverlo.'
      },
      {
        name: 'Capacidad Técnica y Entidad Colaboradora',
        weight: 30,
        description: 'Idoneidad de la entidad contratada o del equipo técnico a cargo.'
      },
      {
        name: 'Impacto en la Empresa y Eficiencia',
        weight: 25,
        description: 'Mejora proyectada en márgenes, costos, tiempos o reducción de huella ambiental.'
      }
    ],
    eligibleExpenses: [
      'Contratación de entidades expertas (universidades, consultores de ingeniería, software houses).',
      'Prototipado ágil y pruebas piloto en faena o planta.',
      'Materiales e insumos específicos para la solución.',
      'Rendición de cuentas y gestión del proyecto.'
    ],
    ineligibleExpenses: [
      'Maquinaria estándar de mercado no vinculada al prototipo.',
      'Gastos operacionales comunes de la empresa.',
      'Impuestos (IVA).'
    ],
    requiredDocuments: [
      'Carpeta Tributaria SII últimos 12 meses.',
      'Estatutos de la sociedad vigentes.',
      'Cotización y propuesta técnica de la entidad colaboradora (si aplica).'
    ],
    corfoAccountsBudget: [
      { account: 'Entidad Experta / Servicios Técnicos', description: 'Consultoría especializada de ingeniería o software.', maxPct: 70 },
      { account: 'Gastos de Operación y Materiales', description: 'Insumos y desarrollo directo.', maxPct: 40 },
      { account: 'Recursos Humanos', description: 'Coordinador de proyecto interno de la empresa.', maxPct: 30 }
    ]
  },
  {
    id: 'startup_chile_ignite',
    name: 'Start-Up Chile (Ignite & Build)',
    agency: 'START-UP CHILE',
    category: 'Crecimiento y Escalamiento',
    badge: 'Hasta $25M CLP (Ignite) / $10M (Build) • Equity-Free',
    maxSubsidyCLP: 25000000,
    subsidyFormatted: '$25.000.000 CLP (Ignite) / $10.000.000 CLP (Build)',
    maxCoFinancePct: 80,
    femaleBonusPct: 10,
    beneficiaryTypes: ['persona_natural', 'spa', 'srl'],
    salesRequirement: 'Startups tecnológicas sin ventas o con tracción temprana (< 3 años de antigüedad).',
    salesBracketsEligible: ['sin_ventas', 'menor_60m', 'micro_200_a_2400uf'],
    trlRange: 'TRL 3 a TRL 7 (Producto digital o de base tecnológica con proyección global)',
    trlEligible: ['idea_concepto', 'prototipo_lab', 'mvp_validado', 'primeras_ventas'],
    requiresInnovation: true,
    requiresCommercialValidation: false,
    status: 'Abierto',
    callSchedule: '2 batches anuales (Mayo y Noviembre) para startups internacionales y chilenas',
    summary: 'La aceleradora pública #1 de América Latina. Otorga financiamiento libre de participación accionaria (equity-free), visa de trabajo para fundadores y red global de inversionistas (VCs).',
    description: 'Build está enfocado en etapas tempranas/prototipo (hasta $10M) e Ignite en startups con producto validado buscando acelerar tracción (hasta $25M con opción a extensión de $25M adicionales en Growth).',
    evaluationCriteria: [
      {
        name: 'Global Scalability & Market Size',
        weight: 35,
        description: 'Capacidad de expandirse rápidamente en América Latina, EE.UU. o Europa; tamaño de mercado global billonario.'
      },
      {
        name: 'Technological Differentiation & Moat',
        weight: 35,
        description: 'Algoritmos propietarios, software defensible, efectos de red o innovación en producto que prevenga copias fáciles.'
      },
      {
        name: 'Founding Team Execution Power',
        weight: 30,
        description: 'Habilidades técnicas, dedicación full-time de los fundadores, resiliencia y experiencia en el sector.'
      }
    ],
    eligibleExpenses: [
      'Sueldos de fundadores y equipo clave de desarrollo / ventas.',
      'Servidores, infraestructura de nube, herramientas SaaS de IA y analítica.',
      'Adquisición de usuarios, prospección comercial internacional, viajes de negocios.',
      'Gastos legales para estructuración en Chile o Delaware (Flip).'
    ],
    ineligibleExpenses: [
      'Compra de vehículos, oficinas o bienes raíces.',
      'Inversiones pasivas.'
    ],
    requiredDocuments: [
      'Video Pitch en inglés o español de 90 segundos del equipo fundador.',
      'Perfil de LinkedIn de fundadores.',
      'Cédula de identidad o Pasaporte.',
      'Documento de constitución societaria (si ya está constituida).'
    ],
    corfoAccountsBudget: [
      { account: 'Recursos Humanos Clave', description: 'Dedicación full time de fundadores e ingenieros.', maxPct: 70 },
      { account: 'Gastos de Operación y Crecimiento', description: 'Cloud, marketing digital, eventos y ventas.', maxPct: 60 }
    ]
  },
  {
    id: 'sercotec_semilla_emprende',
    name: 'SERCOTEC Capital Semilla Emprende',
    agency: 'SERCOTEC',
    category: 'Capital Semilla',
    badge: 'Hasta $3.5M CLP • Personas sin inicio de actividades',
    maxSubsidyCLP: 3500000,
    subsidyFormatted: '$3.500.000 CLP (No reembolsable)',
    maxCoFinancePct: 95, // Postulante aporta solo el 5% o 3% en efectivo + IVA
    beneficiaryTypes: ['persona_natural', 'sin_iniciar'],
    salesRequirement: 'Exclusivo para personas naturales sin inicio de actividades en primera categoría ante el SII.',
    salesBracketsEligible: ['sin_ventas'],
    trlRange: 'TRL 1 a TRL 3 (Idea de negocio o emprendimiento informal)',
    trlEligible: ['idea_concepto', 'prototipo_lab'],
    requiresInnovation: false,
    requiresCommercialValidation: false,
    status: 'Próxima Convocatoria',
    callSchedule: 'Convocatorias anuales entre Marzo y Mayo por región',
    summary: 'Subsidio no reembolsable del Estado para personas que quieran formalizar un nuevo negocio. Financia plan de inversiones (máquinas) y acciones de gestión empresarial.',
    description: 'Destinado a emprendedores que desean crear una empresa legal en Chile. Permite destinar hasta $3.300.000 a inversiones (equipos, habilitación) y entre $200.000 y $500.000 a capacitación, marketing y formalización.',
    evaluationCriteria: [
      {
        name: 'Modelo de Negocio Canvas SERCOTEC',
        weight: 50,
        description: 'Claridad en propuesta de valor, clientes, canales y estructura de costos.'
      },
      {
        name: 'Viabilidad Técnica y Comercial',
        weight: 30,
        description: 'Conocimiento del rubro por parte del emprendedor y factibilidad de ventas.'
      },
      {
        name: 'Presentación en Video Pitch (90 seg)',
        weight: 20,
        description: 'Capacidad de comunicación, claridad del mensaje y convencimiento de la oportunidad.'
      }
    ],
    eligibleExpenses: [
      'Compra de maquinaria, herramientas productivas y mobiliario de trabajo.',
      'Habilitación de local comercial o taller de producción.',
      'Gastos de formalización (notaría, registro de marca en INAPI, obtención de patente municipal).',
      'Campañas de publicidad, letreros, folletería, sitio web y redes sociales.',
      'Capacitación técnica y asesoría contable.'
    ],
    ineligibleExpenses: [
      'Pago de arriendos habitacionales particulares.',
      'Financiamiento de deudas o créditos previos.',
      'El IVA de las compras (lo paga directamente el emprendedor).'
    ],
    requiredDocuments: [
      'Cédula de Identidad chilena vigente.',
      'Certificado de no poseer deudas laborales ni previsionales.',
      'Test de Emprendimiento SERCOTEC aprobado en plataforma web.',
      'Video Pitch de 90 segundos en formato vertical u horizontal.'
    ],
    corfoAccountsBudget: [
      { account: 'Inversiones en Activos', description: 'Equipamiento, herramientas y habilitación física.', maxPct: 90 },
      { account: 'Gestión Empresarial', description: 'Marketing, asesorías, capacitación y formalización.', maxPct: 30 }
    ]
  },
  {
    id: 'sercotec_abeja_emprende',
    name: 'SERCOTEC Capital Abeja Emprende',
    agency: 'SERCOTEC',
    category: 'Capital Semilla',
    badge: 'Hasta $3.5M CLP • Exclusivo Mujeres Emprendedoras',
    maxSubsidyCLP: 3500000,
    subsidyFormatted: '$3.500.000 CLP (100% fondo no reembolsable)',
    maxCoFinancePct: 97,
    femaleBonusPct: 10,
    beneficiaryTypes: ['persona_natural', 'sin_iniciar'],
    salesRequirement: 'Exclusivo para mujeres mayores de 18 años sin inicio de actividades en 1ª categoría ante el SII.',
    salesBracketsEligible: ['sin_ventas'],
    trlRange: 'TRL 1 a TRL 3 (Idea de negocio de liderada por mujer)',
    trlEligible: ['idea_concepto', 'prototipo_lab'],
    requiresInnovation: false,
    requiresCommercialValidation: false,
    status: 'Próxima Convocatoria',
    callSchedule: 'Llamados anuales en el primer semestre de cada año',
    summary: 'Fondo concursable exclusivo para mujeres que buscan liderar y formalizar un negocio propio en cualquier rubro productivo o de servicios.',
    description: 'Promueve la autonomía económica femenina cofinanciando la compra de activos fijos, insumos, formalización ante SII y marketing para el despegue comercial del emprendimiento.',
    evaluationCriteria: [
      {
        name: 'Plan de Negocio Canvas y Coherencia',
        weight: 50,
        description: 'Estructuración de ingresos, propuesta de valor para la clientela y factibilidad.'
      },
      {
        name: 'Motivación y Capacidad Emprendedora',
        weight: 30,
        description: 'Compromiso de la postulante, conocimiento del oficio y sostenibilidad en el tiempo.'
      },
      {
        name: 'Pitch de Presentación',
        weight: 20,
        description: 'Claridad en la exposición oral del problema y la solución comercial.'
      }
    ],
    eligibleExpenses: [
      'Herramientas y maquinaria de trabajo.',
      'Materia prima e insumos iniciales para producción.',
      'Diseño de imagen corporativa, packaging, marketing y redes.',
      'Gastos de inicio de actividades y patente comercial.'
    ],
    ineligibleExpenses: [
      'Pago de arriendos residenciales.',
      'Deudas previas.',
      'Pago de IVA.'
    ],
    requiredDocuments: [
      'Cédula de Identidad chilena vigente.',
      'Aprobación del test en línea de SERCOTEC.',
      'Video Pitch de 90 segundos.'
    ],
    corfoAccountsBudget: [
      { account: 'Activos Fijos e Infraestructura', description: 'Maquinaria y habilitación.', maxPct: 90 },
      { account: 'Acciones de Gestión', description: 'Capacitación, marketing, formalización.', maxPct: 30 }
    ]
  },
  {
    id: 'sercotec_crece',
    name: 'SERCOTEC Crece (Fondo de Desarrollo de Negocios)',
    agency: 'SERCOTEC',
    category: 'Crecimiento y Escalamiento',
    badge: 'Hasta $5M CLP • Micro y Pequeñas Empresas con Ventas',
    maxSubsidyCLP: 5000000,
    subsidyFormatted: '$5.000.000 CLP',
    maxCoFinancePct: 90,
    beneficiaryTypes: ['spa', 'srl', 'eirl', 'sa', 'persona_natural'],
    salesRequirement: 'Empresas con inicio de actividades en 1ª categoría y ventas netas anuales entre 200 y 25.000 UF.',
    salesBracketsEligible: ['micro_200_a_2400uf', 'pequena_2400_a_25000uf'],
    trlRange: 'TRL 7 a TRL 9 (Empresas operativas buscando modernización o nuevos canales)',
    trlEligible: ['primeras_ventas', 'escalamiento_global'],
    requiresInnovation: false,
    requiresCommercialValidation: true,
    status: 'Abierto',
    callSchedule: 'Convocatorias anuales entre Mayo y Julio a través de direcciones regionales Sercotec',
    summary: 'Subsidio no reembolsable destinado a potenciar el crecimiento, consolidación y acceso a nuevos mercados de micro y pequeñas empresas chilenas formalizadas.',
    description: 'Permite financiar inversiones en nuevos activos productivos, digitalización, software de gestión ERP, certificaciones sanitarias/ISO y marketing para consolidar la empresa.',
    evaluationCriteria: [
      {
        name: 'Potencial de Crecimiento y Aumento de Ventas',
        weight: 45,
        description: 'Capacidad de la empresa de generar nuevos ingresos y empleos a partir del proyecto de inversión.'
      },
      {
        name: 'Solidez Financiera y Trayectoria de la Pyme',
        weight: 35,
        description: 'Historial de facturación regular reflejado en los F29 del SII y cumplimiento tributario.'
      },
      {
        name: 'Coherencia del Plan de Inversión',
        weight: 20,
        description: 'Justificación clara de cada máquina o acción solicitada en el presupuesto.'
      }
    ],
    eligibleExpenses: [
      'Adquisición de maquinaria de mayor capacidad productiva o modernización tecnológica.',
      'Sistemas de gestión de inventario, software de punto de venta e e-commerce.',
      'Habilitación de infraestructura de locales comerciales o plantas.',
      'Contratación de asesorías en eficiencia energética, certificaciones o diseño de nuevos productos.',
      'Capital de trabajo e insumos vinculados al plan de crecimiento (hasta cierto %).'
    ],
    ineligibleExpenses: [
      'Gastos de representación, multas o intereses.',
      'IVA de las facturas de compra.',
      'Pago de arriendos o sueldos normales de la empresa.'
    ],
    requiredDocuments: [
      'Carpeta Tributaria Electrónica para Solicitar Créditos emitida por el SII con ventas entre 200 y 25.000 UF.',
      'Certificado de Vigencia de la Persona Jurídica y Estatuto Actualizado.',
      'Certificado de Deuda Tributaria TGR.',
      'Certificado de Antecedentes Laborales y Previsionales F30.',
      'Plan de Trabajo y Cotizaciones de respaldo de las maquinarias a adquirir.'
    ],
    corfoAccountsBudget: [
      { account: 'Inversiones en Activos y Equipos', description: 'Maquinarias, obras de infraestructura y tecnología.', maxPct: 80 },
      { account: 'Gestión Empresarial y Marketing', description: 'Campañas publicitarias, asesorías y desarrollo de canales.', maxPct: 30 }
    ]
  },
  {
    id: 'anid_fondef_idea',
    name: 'ANID Fondef IDeA I+D',
    agency: 'ANID',
    category: 'I+D+i y Tecnológico',
    badge: 'Hasta $200M CLP • Ciencia Aplicada & Transferencia Tecnológica',
    maxSubsidyCLP: 200000000,
    subsidyFormatted: 'Hasta $200.000.000 CLP',
    maxCoFinancePct: 80,
    beneficiaryTypes: ['spa', 'srl', 'sa'],
    salesRequirement: 'Empresas asociadas a universidades o centros de investigación, con o sin ventas previas.',
    salesBracketsEligible: ['sin_ventas', 'menor_60m', 'micro_200_a_2400uf', 'pequena_2400_a_25000uf', 'mediana_25000_a_100000uf', 'grande_mayor_100000uf'],
    trlRange: 'TRL 2 a TRL 4 (Hipótesis científica a prueba de concepto validada en laboratorio)',
    trlEligible: ['idea_concepto', 'prototipo_lab'],
    requiresInnovation: true,
    requiresCommercialValidation: false,
    status: 'Próxima Convocatoria',
    callSchedule: 'Convocatoria anual (Octubre a Enero) del Ministerio de Ciencia, Tecnología, Conocimiento e Innovación',
    summary: 'Para proyectos de investigación científica y tecnológica con potencial de aplicación comercial que cuenten con una empresa contraparte interesada en la transferencia.',
    description: 'El fondo busca transformar descubrimientos científicos en soluciones tecnológicas viables con la participación activa de empresas interesadas en licenciar o adoptar los desarrollos.',
    evaluationCriteria: [
      {
        name: 'Calidad Científica y Tecnológica',
        weight: 40,
        description: 'Rigor metodológico, formulación de la hipótesis y novedad respecto al estado del arte internacional.'
      },
      {
        name: 'Potencial de Transferencia Tecnológica y Negocio',
        weight: 35,
        description: 'Estrategia de propiedad intelectual, rol de la empresa asociada y modelo de explotación comercial.'
      },
      {
        name: 'Capacidad del Equipo de Investigación',
        weight: 25,
        description: 'Publicaciones previas, patentes y trayectoria del director del proyecto y de la contraparte empresarial.'
      }
    ],
    eligibleExpenses: [
      'Honorarios de investigadores principales, postdoctorados y técnicos de laboratorio.',
      'Equipamiento científico especializado.',
      'Reactivos, materiales y suministros de laboratorio.',
      'Ensayos analíticos y publicaciones.',
      'Protección de propiedad intelectual.'
    ],
    ineligibleExpenses: [
      'Gastos comerciales ajenos a la investigación.',
      'Costos indirectos que superen el tope reglamentario.'
    ],
    requiredDocuments: [
      'Carta de Compromiso de la Empresa Beneficiaria Asociada.',
      'Memoria de I+D y Estado del Arte.',
      'Currículum Vitae estandarizado de los investigadores.',
      'Presupuesto analítico y justificación de gastos.'
    ],
    corfoAccountsBudget: [
      { account: 'Personal de I+D', description: 'Investigadores y personal de apoyo.', maxPct: 60 },
      { account: 'Equipamiento', description: 'Instrumental de laboratorio.', maxPct: 30 },
      { account: 'Operación y Materiales', description: 'Reactivos, suministros y servicios analíticos.', maxPct: 40 }
    ]
  },
  {
    id: 'fia_innovacion_agro',
    name: 'FIA - Proyectos de Innovación Agroalimentaria',
    agency: 'FIA',
    category: 'Innovación Agro / Sostenible',
    badge: 'Hasta $100M CLP • Foco Agro, Agua y Cambio Climático',
    maxSubsidyCLP: 100000000,
    subsidyFormatted: 'Hasta $100.000.000 CLP (Hasta 70% cofinanciamiento)',
    maxCoFinancePct: 70,
    femaleBonusPct: 10,
    beneficiaryTypes: ['spa', 'srl', 'sa', 'eirl', 'persona_natural'],
    salesRequirement: 'Productores, agricultores o empresas del sector silvoagroalimentario y de la cadena de valor.',
    salesBracketsEligible: ['micro_200_a_2400uf', 'pequena_2400_a_25000uf', 'mediana_25000_a_100000uf'],
    trlRange: 'TRL 4 a TRL 7 (Validación agronómica y tecnológica en campo)',
    trlEligible: ['prototipo_lab', 'mvp_validado', 'primeras_ventas'],
    requiresInnovation: true,
    requiresCommercialValidation: false,
    status: 'Ventanilla Abierta',
    callSchedule: 'Llamados anuales del Ministerio de Agricultura (Mayo a Julio)',
    summary: 'Financia soluciones innovadoras ante los desafíos del sector silvoagroalimentario: eficiencia en el uso de agua, adaptación al cambio climático y agroecología.',
    description: 'Apoya el desarrollo de nuevos cultivos, bioinsumos, robótica agrícola, sensores de humedad y tecnologías para transformar la productividad en el campo chileno.',
    evaluationCriteria: [
      {
        name: 'Impacto Agronómico y Sostenibilidad Hídrica',
        weight: 40,
        description: 'Capacidad de reducir consumo de agua o agroquímicos y generar resiliencia climática.'
      },
      {
        name: 'Grado de Innovación en el Sector',
        weight: 35,
        description: 'Diferenciación frente a prácticas agrícolas tradicionales.'
      },
      {
        name: 'Viabilidad de Difusión y Adopción en Productores',
        weight: 25,
        description: 'Plan de transferencia técnica y adopción masiva por pequeños y medianos agricultores.'
      }
    ],
    eligibleExpenses: [
      'Ensayos en predios piloto y campos experimentales.',
      'Sensores IoT, sistemas de telemetría de riego y sondas de suelo.',
      'Especialistas en agronomía, biotecnología y fitopatología.',
      'Talleres de difusión técnica y días de campo con agricultores.'
    ],
    ineligibleExpenses: [
      'Compra de predios o terrenos agrícolas.',
      'Sistemas de riego tradicionales sin componente innovador.'
    ],
    requiredDocuments: [
      'Acreditación de dominio o arriendo a largo plazo del predio de ensayo.',
      'Carpeta Tributaria SII de la empresa agropecuaria.',
      'Certificado de vigencia de la sociedad.'
    ],
    corfoAccountsBudget: [
      { account: 'Recursos Humanos y Asesores de Campo', description: 'Agrónomos y personal de monitoreo.', maxPct: 50 },
      { account: 'Gastos de Operación y Ensayos', description: 'Insumos biológicos, análisis de laboratorio y software.', maxPct: 60 },
      { account: 'Equipamiento Piloto', description: 'Sensores y tecnología instalada en predio.', maxPct: 30 }
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
      '1. Usar el generador de Cartas de INKI para crear la plantilla personalizada.',
      '2. Presentar la carta a 2 o 3 clientes prospecto, directores de innovación o gremios.',
      '3. La carta debe incluir: logo de la empresa firmante, declaración explícita del dolor que sufren, interés en pilotear la solución y firma del tomador de decisión (con cargo y contacto verificable).',
      '4. Subir la carta escaneada en formato PDF.'
    ],
    criticalTip: 'Las cartas firmadas por empresas reales suman hasta 0.8 puntos adicionales en la rúbrica de tracción de CORFO y Start-Up Chile.'
  }
];
