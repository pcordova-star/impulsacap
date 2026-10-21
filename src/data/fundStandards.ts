/**
 * Estándar por fondo, tomado de las bases oficiales de cada concurso.
 * Cada fondo define: requisitos para postular, documentos, secciones del formulario oficial,
 * cómo se evalúa (escala y nota de corte), aportes, garantías, portal y cuentas del presupuesto.
 * La hoja de ruta, el formulador, el presupuesto y la auditoría se arman a partir de esto.
 *
 * Fuentes revisadas el 21-10-2026 (ver `bases` en cada fondo). Las bases de cada convocatoria mandan:
 * algunas regiones cambian montos, focos o criterios.
 */
import type { ChileanFund, CompanyProfile, FundRules, FundFamily, FormBlock, FundBudgetAccount, FundRequirement, CompanyType } from '../types/funds';

const VERIFIED = '2026-10-21';
const UF_REF = 39500; // referencia para convertir UF ↔ pesos cuando no hay UF del día

// ---------------------------------------------------------------------------
// Cuentas de presupuesto por tipo de fondo (nombres oficiales de cada institución)
// ---------------------------------------------------------------------------
const CORFO_RRHH = (extra: string[] = []): FundBudgetAccount => ({
  key: 'rh',
  account: 'Recursos Humanos',
  plainName: 'Personas que trabajan en el proyecto',
  share: 0.45,
  whatGoes: ['Sueldos u honorarios del equipo del proyecto (solo la parte del tiempo dedicada)', 'Contrataciones nuevas para el proyecto', ...extra],
  whatNot: ['Personas que no trabajan en el proyecto', 'Bonos, finiquitos o gastos personales'],
  example: 'Un desarrollador a media jornada por 10 meses: $600.000 × 10 = $6.000.000',
  itemPlaceholder: 'Ej: Desarrollador full stack, media jornada, 10 meses',
  justificationPlaceholder: 'Ej: Construirá el producto mínimo viable y sus pruebas con clientes'
});

const BUDGETS: Record<string, FundBudgetAccount[]> = {
  corfo_emprendimiento: [
    CORFO_RRHH(['Socios: máximo $700.000 al mes cada uno y hasta 2 socios (los socios que ya trabajaban, solo con aporte propio)']),
    {
      key: 'operaciones', account: 'Gastos de Operación', plainName: 'Validación, mentorías, producto y ventas', share: 0.4,
      whatGoes: ['Mentoría (obligatoria) y actividades de validación técnica y comercial', 'Producto mínimo viable, prototipos, pruebas y certificaciones', 'Marketing, prospección comercial, empaque y marca', 'Protección de propiedad intelectual'],
      whatNot: ['Compra de inmuebles o vehículos', 'Gastos anteriores al inicio del proyecto', 'IVA (lo pagas tú)'],
      example: 'Mentoría y aceleración ($2.000.000), prototipo ($2.500.000) y campaña digital de validación ($800.000)',
      itemPlaceholder: 'Ej: Prototipo funcional, pruebas con 10 clientes piloto y campaña de prospección',
      justificationPlaceholder: 'Ej: Permite validar técnica y comercialmente la solución y lograr primeras ventas'
    },
    {
      key: 'inversion', account: 'Gastos de Inversión', plainName: 'Equipos indispensables', share: 0.1, cap: 'Máximo 20% del subsidio',
      whatGoes: ['Equipos o activos críticos para el proyecto'],
      whatNot: ['Bienes raíces, vehículos, construcción'],
      example: 'Equipo de laboratorio portátil ($1.500.000)',
      itemPlaceholder: 'Ej: Impresora 3D para prototipos',
      justificationPlaceholder: 'Ej: Sin este equipo no se pueden fabricar los prototipos de validación'
    },
    {
      key: 'administracion', account: 'Gastos de Administración', plainName: 'Gestión del proyecto y garantías', share: 0.05,
      whatGoes: ['Contabilidad para rendir los gastos', 'Costo de garantías (hasta 3% del subsidio)'],
      whatNot: ['Gastos generales de la empresa no ligados al proyecto'],
      example: 'Contador para rendiciones ($50.000 × 10 meses = $500.000)',
      itemPlaceholder: 'Ej: Servicio contable para rendiciones',
      justificationPlaceholder: 'Ej: Rendir correctamente cada gasto ante Corfo'
    }
  ],
  corfo_crea_valida: [
    CORFO_RRHH(['Personal de las etapas CREA (prototipo) y VALIDA (validación a escala)']),
    {
      key: 'operaciones', account: 'Gastos de Operación', plainName: 'I+D, prototipos, entidades colaboradoras y validación', share: 0.4,
      whatGoes: ['Actividades de I+D e integración tecnológica', 'Entidades colaboradoras (obligatorias en la modalidad colaborativa: al menos 30% del costo total)', 'Materiales, insumos, pruebas, certificaciones y propiedad intelectual', 'Escalamiento, validación comercial y marketing', 'Formulación externa del proyecto (micro y pequeñas: hasta $2.500.000)'],
      whatNot: ['Inmuebles', 'Gastos no ligados al proyecto', 'IVA recuperable'],
      example: 'Contrato de I+D con universidad ($40.000.000) y pruebas piloto a escala ($15.000.000)',
      itemPlaceholder: 'Ej: Desarrollo de prototipo industrial con centro tecnológico',
      justificationPlaceholder: 'Ej: Necesario para pasar de prototipo de laboratorio a validación en planta'
    },
    {
      key: 'inversion', account: 'Gastos de Inversión', plainName: 'Equipos para el desarrollo', share: 0.1, cap: 'Máximo 30% del subsidio',
      whatGoes: ['Equipos y activos necesarios para el desarrollo y la validación'],
      whatNot: ['Bienes raíces y vehículos'],
      example: 'Equipo de medición para validación ($8.000.000)',
      itemPlaceholder: 'Ej: Sensores y equipos de prueba',
      justificationPlaceholder: 'Ej: Indispensables para medir el desempeño del prototipo'
    },
    {
      key: 'administracion', account: 'Gastos de Administración', plainName: 'Gestión del proyecto y garantías', share: 0.05, cap: 'Máximo 10% del subsidio',
      whatGoes: ['Gestión y control financiero del proyecto', 'Costo de garantías (fiel cumplimiento mínimo 30 UF) y del anticipo'],
      whatNot: ['Gastos generales no atribuibles al proyecto'],
      example: 'Póliza de garantía y contabilidad de rendiciones ($2.000.000)',
      itemPlaceholder: 'Ej: Póliza de fiel cumplimiento y contabilidad',
      justificationPlaceholder: 'Ej: Exigido por las bases para recibir el subsidio'
    }
  ],
  corfo_sumate: [
    {
      key: 'operaciones', account: 'Gastos de Operación', plainName: 'Contratación de la entidad colaboradora', share: 0.95,
      whatGoes: ['Servicios de 1 o 2 entidades colaboradoras (universidad, centro tecnológico o empresa de servicios tecnológicos) que resuelven tu desafío', 'Costo de la garantía de fiel cumplimiento y del anticipo', 'Viajes y viáticos nacionales justificados'],
      whatNot: ['Equipos', 'Software estándar', 'Consultoría de negocios estándar', 'Certificaciones y capacitación de la organización'],
      example: 'Desarrollo de un prototipo con un centro tecnológico ($11.000.000)',
      itemPlaceholder: 'Ej: Servicio de I+D de la Universidad X para rediseñar el proceso',
      justificationPlaceholder: 'Ej: La empresa no tiene capacidades de I+D para resolver este problema'
    },
    {
      key: 'administracion', account: 'Garantías y viajes', plainName: 'Garantía y traslados del proyecto', share: 0.05,
      whatGoes: ['Póliza o boleta de fiel cumplimiento (mínimo 5% de lo transferido)', 'Viajes nacionales necesarios'],
      whatNot: ['Gastos no ligados al proyecto'],
      example: 'Póliza de garantía ($150.000)',
      itemPlaceholder: 'Ej: Póliza de fiel cumplimiento',
      justificationPlaceholder: 'Ej: Exigida por las bases'
    }
  ],
  startup_chile: [
    CORFO_RRHH(['Equipo fundador y contrataciones del programa']),
    {
      key: 'operaciones', account: 'Gastos de Operación', plainName: 'Producto, mercado y tracción', share: 0.45,
      whatGoes: ['Desarrollo de producto y servicios tecnológicos', 'Marketing, ventas y validación con clientes', 'Viajes del programa y propiedad intelectual'],
      whatNot: ['Pago de deudas', 'Gastos personales'],
      example: 'Desarrollo de producto ($10.000.000) y adquisición de clientes ($6.000.000)',
      itemPlaceholder: 'Ej: Desarrollo de la versión 2 de la plataforma',
      justificationPlaceholder: 'Ej: Necesaria para alcanzar product-market fit'
    },
    {
      key: 'administracion', account: 'Gastos de Administración', plainName: 'Gestión y rendiciones', share: 0.1,
      whatGoes: ['Contabilidad y gestión del subsidio'],
      whatNot: ['Gastos no atribuibles al programa'],
      example: 'Contabilidad de rendiciones ($600.000)',
      itemPlaceholder: 'Ej: Servicio contable',
      justificationPlaceholder: 'Ej: Rendir el subsidio correctamente'
    }
  ],
  sercotec_emprende: [
    {
      key: 'gestion', account: 'Acciones de Gestión Empresarial', plainName: 'Asesorías, capacitación, marketing y formalización', share: 0.1, cap: 'Entre $200.000 y $500.000 del subsidio',
      whatGoes: ['Asistencia técnica y asesoría en gestión', 'Capacitación', 'Marketing: ferias, promoción, publicidad y marketing digital', 'Gastos de formalización (constituir la empresa)'],
      whatNot: ['Pago a consultores por preparar la postulación', 'Tu propia remuneración o la de familiares'],
      example: 'Diseño de marca y redes sociales ($300.000) y curso de manipulación de alimentos ($150.000)',
      itemPlaceholder: 'Ej: Diseño de logo y campaña en redes sociales',
      justificationPlaceholder: 'Ej: Para que los clientes conozcan el negocio desde el inicio'
    },
    {
      key: 'activos', account: 'Inversiones: Activos', plainName: 'Máquinas, equipos, muebles y software', share: 0.55,
      whatGoes: ['Activos fijos (máquinas, herramientas, equipos, muebles)', 'Activos intangibles (software, registro de marca)'],
      whatNot: ['Vehículos que requieran permiso de circulación', 'Bienes raíces', 'Compras a ti mismo o a familiares'],
      example: 'Horno industrial ($1.800.000) y amasadora ($700.000)',
      itemPlaceholder: 'Ej: Horno industrial y amasadora',
      justificationPlaceholder: 'Ej: Permiten producir 200 unidades diarias'
    },
    {
      key: 'habilitacion', account: 'Inversiones: Habilitación de infraestructura', plainName: 'Arreglos del lugar donde funcionará', share: 0.15, cap: '100% si eres dueño o usufructuario; hasta 30% si arriendas',
      whatGoes: ['Reparaciones y adecuaciones del local o taller'],
      whatNot: ['Construcción de inmuebles nuevos'],
      example: 'Instalación eléctrica y revestimiento del taller ($500.000)',
      itemPlaceholder: 'Ej: Instalación eléctrica trifásica del taller',
      justificationPlaceholder: 'Ej: Necesaria para conectar las máquinas de forma segura'
    },
    {
      key: 'capital_trabajo', account: 'Inversiones: Capital de trabajo', plainName: 'Materias primas, mercadería, arriendos y contrataciones nuevas', share: 0.2, cap: 'Máximo 40% de las inversiones; mercadería máximo 20% del subsidio de inversiones',
      whatGoes: ['Materias primas y materiales', 'Mercadería', 'Nuevos arriendos y nuevas contrataciones (posteriores al contrato)'],
      whatNot: ['Consumos básicos (agua, luz, gas, teléfono)', 'Pago de deudas'],
      example: 'Harina y envases para los primeros 2 meses ($600.000)',
      itemPlaceholder: 'Ej: Materias primas para el primer mes de producción',
      justificationPlaceholder: 'Ej: Permite partir produciendo apenas se instalen los equipos'
    }
  ],
  sercotec_crece: [
    {
      key: 'gestion', account: 'Acciones de Gestión Empresarial', plainName: 'Asesorías, capacitación y marketing', share: 0.15, cap: 'Máximo $1.000.000 del subsidio',
      whatGoes: ['Asistencia técnica y asesoría en gestión', 'Capacitación', 'Marketing: ferias, promoción y difusión, misiones y pasantías'],
      whatNot: ['Pago a consultores por preparar la postulación'],
      example: 'Asesoría en costos ($500.000) y campaña de difusión ($400.000)',
      itemPlaceholder: 'Ej: Asesoría para estandarizar procesos',
      justificationPlaceholder: 'Ej: Mejora la productividad para atender más clientes'
    },
    {
      key: 'activos', account: 'Inversiones: Activos', plainName: 'Máquinas, equipos y software', share: 0.55,
      whatGoes: ['Activos fijos e intangibles'],
      whatNot: ['Vehículos con permiso de circulación', 'Bienes raíces'],
      example: 'Máquina envasadora ($2.500.000)',
      itemPlaceholder: 'Ej: Máquina envasadora semiautomática',
      justificationPlaceholder: 'Ej: Triplica la capacidad de envasado'
    },
    {
      key: 'habilitacion', account: 'Inversiones: Habilitación de infraestructura', plainName: 'Mejoras del local', share: 0.1,
      whatGoes: ['Adecuaciones del local donde opera la empresa'],
      whatNot: ['Construcción de inmuebles'],
      example: 'Habilitación de sala de proceso ($500.000)',
      itemPlaceholder: 'Ej: Habilitación de sala de proceso',
      justificationPlaceholder: 'Ej: Requisito sanitario para producir'
    },
    {
      key: 'capital_trabajo', account: 'Inversiones: Capital de trabajo', plainName: 'Materias primas, arriendos y contrataciones nuevas', share: 0.2,
      whatGoes: ['Nuevas contrataciones', 'Nuevos arriendos', 'Materias primas y materiales'],
      whatNot: ['Consumos básicos', 'Pago de deudas'],
      example: 'Materias primas para el aumento de producción ($800.000)',
      itemPlaceholder: 'Ej: Insumos para el nuevo volumen de producción',
      justificationPlaceholder: 'Ej: Necesarios para cumplir los nuevos pedidos'
    }
  ],
  anid: [
    {
      key: 'personal', account: 'Gastos en personal', plainName: 'Investigadores y equipo del proyecto', share: 0.5,
      whatGoes: ['Honorarios y remuneraciones del equipo', 'Pago adicional a personal que ya trabaja en la institución (hasta $600.000 al mes)', 'Tesistas y ayudantes'],
      whatNot: ['Finiquitos, vacaciones e indemnizaciones', 'Becas', 'Pagos a entidades asociadas'],
      example: 'Investigador a media jornada por 24 meses ($1.200.000 × 24 = $28.800.000)',
      itemPlaceholder: 'Ej: Investigador postdoctoral, 24 meses',
      justificationPlaceholder: 'Ej: Ejecutará los ensayos del objetivo 2'
    },
    {
      key: 'equipamiento', account: 'Equipamiento e infraestructura', plainName: 'Equipos y adecuaciones', share: 0.15, cap: 'Infraestructura y mobiliario: máximo 20% de los recursos ANID',
      whatGoes: ['Equipos necesarios para la investigación', 'Infraestructura y mobiliario'],
      whatNot: ['Equipos sin relación con los objetivos'],
      example: 'Equipo de laboratorio ($20.000.000)',
      itemPlaceholder: 'Ej: Espectrofotómetro',
      justificationPlaceholder: 'Ej: Necesario para medir los resultados del prototipo'
    },
    {
      key: 'operacion', account: 'Gastos de operación', plainName: 'Insumos, software, difusión, PI y viajes', share: 0.25,
      whatGoes: ['Insumos y materiales', 'Software, capacitación y difusión', 'Propiedad intelectual', 'Viajes y arriendos'],
      whatNot: ['Pagos a asociadas o colaboradoras'],
      example: 'Reactivos ($10.000.000) y solicitud de patente ($5.000.000)',
      itemPlaceholder: 'Ej: Reactivos y materiales de laboratorio',
      justificationPlaceholder: 'Ej: Insumos para los ensayos de validación'
    },
    {
      key: 'administracion', account: 'Gastos de administración indirectos', plainName: 'Costos indirectos de la institución', share: 0.1, cap: 'Máximo 15% del subsidio de cada beneficiaria',
      whatGoes: ['Costos indirectos de la institución beneficiaria', 'Garantía o caución'],
      whatNot: ['Gastos de las empresas asociadas'],
      example: 'Overhead institucional (10% del subsidio)',
      itemPlaceholder: 'Ej: Gastos indirectos de la universidad',
      justificationPlaceholder: 'Ej: Administración del proyecto por la universidad'
    }
  ],
  fia: [
    {
      key: 'rh', account: 'Recursos humanos', plainName: 'Equipo técnico del proyecto', share: 0.35,
      whatGoes: ['Personal incremental para el proyecto', 'Personal de planta: hasta $1.500.000 al año (dedicación ≤20%) o $3.000.000 al año (>20%)'],
      whatNot: ['Licencias médicas, finiquitos'],
      example: 'Técnico agrícola a jornada completa por 15 meses',
      itemPlaceholder: 'Ej: Ingeniero agrónomo, 15 meses',
      justificationPlaceholder: 'Ej: Conducirá los ensayos en campo'
    },
    {
      key: 'equipos', account: 'Equipamiento e infraestructura menor', plainName: 'Equipos menores y habilitación', share: 0.15,
      whatGoes: ['Equipos menores', 'Habilitación menor o arriendo de terreno'],
      whatNot: ['Bienes de capital no determinantes', 'Inmuebles'],
      example: 'Sensores de humedad y estación meteorológica ($4.000.000)',
      itemPlaceholder: 'Ej: Sensores de humedad de suelo',
      justificationPlaceholder: 'Ej: Para medir el efecto del riego en los ensayos'
    },
    {
      key: 'operacion', account: 'Materiales, viáticos y difusión', plainName: 'Insumos, traslados y difusión', share: 0.2,
      whatGoes: ['Materiales e insumos', 'Viáticos y movilización', 'Difusión y capacitación', 'Gastos generales'],
      whatNot: ['Bebidas alcohólicas, propinas, multas'],
      example: 'Insumos para ensayos ($3.000.000) y día de campo ($800.000)',
      itemPlaceholder: 'Ej: Insumos para 3 parcelas de ensayo',
      justificationPlaceholder: 'Ej: Necesarios para validar el prototipo en condiciones reales'
    },
    {
      key: 'terceros', account: 'Servicios de terceros', plainName: 'Laboratorios, asesorías y desarrollos externos', share: 0.25, cap: 'Máximo 70% del aporte FIA (incluye hasta $1.500.000 para formular la propuesta)',
      whatGoes: ['Análisis de laboratorio, desarrollos encargados y asesorías especializadas'],
      whatNot: ['Servicios no ligados al proyecto'],
      example: 'Análisis de laboratorio ($5.000.000)',
      itemPlaceholder: 'Ej: Análisis de calidad de fruta en laboratorio acreditado',
      justificationPlaceholder: 'Ej: Verifica los parámetros técnicos que exige la validación TRL 5'
    },
    {
      key: 'imprevistos', account: 'Imprevistos', plainName: 'Imprevistos', share: 0.05, cap: 'Máximo 5% del aporte FIA, con autorización previa',
      whatGoes: ['Gastos no previstos, autorizados por FIA'],
      whatNot: ['Gastos no justificados'],
      example: 'Reserva para imprevistos ($1.000.000)',
      itemPlaceholder: 'Ej: Reserva para imprevistos',
      justificationPlaceholder: 'Ej: Cubrir variaciones de precio de insumos'
    }
  ],
  monitor: [
    CORFO_RRHH(),
    {
      key: 'operaciones', account: 'Gastos de Operación', plainName: 'Materiales, insumos y servicios', share: 0.35,
      whatGoes: ['Materiales, insumos y servicios del proyecto'], whatNot: ['Gastos no ligados al proyecto', 'IVA recuperable'],
      example: 'Materiales y servicios ($3.000.000)', itemPlaceholder: 'Ej: Materiales del proyecto', justificationPlaceholder: 'Ej: Necesarios para ejecutar las actividades'
    },
    {
      key: 'inversion', account: 'Gastos de Inversión', plainName: 'Equipos', share: 0.15,
      whatGoes: ['Equipos necesarios (revisa el tope en las bases)'], whatNot: ['Bienes raíces'],
      example: 'Equipo ($1.500.000)', itemPlaceholder: 'Ej: Equipo necesario', justificationPlaceholder: 'Ej: Indispensable para el proyecto'
    },
    {
      key: 'administracion', account: 'Gastos de Administración', plainName: 'Gestión y garantías', share: 0.05,
      whatGoes: ['Contabilidad y garantías'], whatNot: ['Gastos generales no atribuibles'],
      example: 'Contabilidad ($400.000)', itemPlaceholder: 'Ej: Contabilidad', justificationPlaceholder: 'Ej: Rendir los gastos'
    }
  ]
};

// ---------------------------------------------------------------------------
// Nombre de cada bloque del formulador según el formulario oficial de cada familia
// ---------------------------------------------------------------------------
export const FAMILY_BLOCKS: Record<FundFamily, Record<FormBlock, { title: string; hint: string }>> = {
  corfo_emprendimiento: {
    title_pitch: { title: 'Título y guion del video (40 s)', hint: 'Corfo pide un video de máximo 40 segundos: qué es tu producto, qué problema resuelve y por qué es innovador frente a la competencia.' },
    problem: { title: 'Innovación: relevancia del problema', hint: 'Se evalúa con 15%: qué problema u oportunidad abordas, a quién afecta y cuánto le cuesta.' },
    solution: { title: 'Innovación: propuesta de valor', hint: 'Se evalúa con 25%: qué hace tu solución, qué tiene de nuevo y en qué es mejor que lo que existe.' },
    market: { title: 'Escalabilidad: mercado y competencia', hint: 'Se evalúa con 10%: tamaño del mercado, clientes objetivo y competidores.' },
    model: { title: 'Escalabilidad: modelo de negocio y sostenibilidad', hint: 'Modelo de negocio (5%) y sostenibilidad del emprendimiento (5%).' },
    workplan: { title: 'Plan de validación', hint: 'Se evalúa con 10%: actividades para validar técnica y comercialmente, y resultados esperados (primeras ventas).' },
    team: { title: 'Capacidades: equipo y dedicación', hint: 'Capacidad del equipo (20%) y compromiso (10%): roles, experiencia y horas semanales.' },
    budget: { title: 'Presupuesto', hint: 'Cuentas Corfo: Recursos Humanos, Operación, Inversión (máx. 20% del subsidio) y Administración.' }
  },
  corfo_innovacion: {
    title_pitch: { title: 'Resumen y objetivos', hint: 'Resumen del proyecto, objetivo general y objetivos específicos medibles.' },
    problem: { title: 'Problema, desafío u oportunidad', hint: 'Diagnóstico: el problema productivo o de competitividad, con datos.' },
    solution: { title: 'Propuesta de solución', hint: 'Metodología, grado de novedad y diferenciación, y actividades de I+D.' },
    market: { title: 'Mercado objetivo o potencial', hint: 'A quién beneficia la solución y cuánto vale la oportunidad.' },
    model: { title: 'Impacto y escalabilidad', hint: 'Qué cambia en la empresa o el mercado si el proyecto resulta, y cómo se escala.' },
    workplan: { title: 'Metodología y plan de trabajo', hint: 'Etapas, actividades, hitos y resultados verificables.' },
    team: { title: 'Participantes y capacidades', hint: 'Empresa, entidades colaboradoras (universidad o centro tecnológico) y equipo.' },
    budget: { title: 'Presupuesto', hint: 'Cuentas y topes según las bases del instrumento.' }
  },
  startup_chile: {
    title_pitch: { title: 'Pitch del proyecto', hint: 'En pocas líneas: qué construyen, para quién y por qué ahora.' },
    problem: { title: 'Problema', hint: 'El problema global que resuelven y su tamaño.' },
    solution: { title: 'Solución y base tecnológica', hint: 'La tecnología, su grado de innovación y la ventaja frente a la competencia.' },
    market: { title: 'Mercado y escalabilidad global', hint: 'Mercado objetivo, potencial global y estrategia de expansión desde Chile.' },
    model: { title: 'Modelo de negocio y tracción', hint: 'Cómo ganan dinero, usuarios, ventas o pilotos a la fecha.' },
    workplan: { title: 'Plan para el programa', hint: 'Qué lograrán durante los meses del programa, con métricas.' },
    team: { title: 'Equipo fundador', hint: 'Fundadores, roles, dedicación y experiencia relevante.' },
    budget: { title: 'Presupuesto', hint: 'Uso del subsidio y aporte del equipo.' }
  },
  sercotec: {
    title_pitch: { title: 'Guion del video pitch (90 s)', hint: 'Video de máximo 90 segundos, en español: quién eres, el problema y tus clientes, tu solución y qué te diferencia.' },
    problem: { title: 'Clientes y su necesidad', hint: 'Ámbito "Clientes" del formulario: quiénes compran y qué necesidad tienen.' },
    solution: { title: 'Oferta de valor y elemento diferenciador', hint: 'Qué ofreces, por qué te van a preferir y cómo aportas a la sustentabilidad.' },
    market: { title: 'Canales y relación con los clientes', hint: 'Cómo llegas a tus clientes, cómo los atiendes y fidelizas.' },
    model: { title: 'Ingresos, costos y recursos clave', hint: 'Cómo ganas dinero, tus costos principales y los recursos que necesitas.' },
    workplan: { title: 'Actividades y alianzas clave', hint: 'Lo que harás para que el negocio funcione y con quién te vas a aliar.' },
    team: { title: 'Tu experiencia y capacidades', hint: 'Lo que sabes hacer y tu experiencia en el rubro (se revisa en la visita a terreno).' },
    budget: { title: 'Estructura de costos', hint: 'Acciones de gestión empresarial e inversiones, con los topes de las bases.' }
  },
  anid: {
    title_pitch: { title: 'Resumen ejecutivo', hint: 'Título, resumen y palabras clave del proyecto.' },
    problem: { title: 'Cap. 1: relevancia del problema y oportunidad', hint: 'Claridad y pertinencia del problema, con evidencia.' },
    solution: { title: 'Cap. 1: solución, estado del arte y TRL', hint: 'Solidez de la solución, resultados previos (TRL 2 cumplido) y estado del arte.' },
    market: { title: 'Cap. 1: mercado objetivo e impactos', hint: 'Quién usará el resultado y qué impacto económico o social tendrá.' },
    model: { title: 'Cap. 1: mapa de ruta y transferencia', hint: 'Cómo llegará el resultado al mercado o a la sociedad, con las entidades asociadas.' },
    workplan: { title: 'Cap. 2: objetivos, metodología e hitos', hint: 'Objetivos, metodología, resultados e hitos con indicadores verificables, y carta Gantt.' },
    team: { title: 'Cap. 2: equipo y colaboración', hint: 'Experiencia del equipo, rol de las asociadas y colaboradoras, formación de capacidades.' },
    budget: { title: 'Presupuesto', hint: 'Coherencia entre presupuesto, metodología y Gantt.' }
  },
  fia: {
    title_pitch: { title: 'Resumen y pitch (5 min)', hint: 'FIA pide un pitch virtual de hasta 5 minutos en la admisión técnica.' },
    problem: { title: 'Problema u oportunidad', hint: 'Pertinencia y relevancia para el sector silvoagropecuario o agroalimentario.' },
    solution: { title: 'Mérito científico-tecnológico', hint: 'Coherencia solución-problema, grado de novedad e incertidumbre tecnológica.' },
    market: { title: 'Diferenciación competitiva', hint: 'Potencial de aplicación productiva y proyección de desarrollo.' },
    model: { title: 'Apropiación y proyección', hint: 'Cómo el postulante o los asociados aprovecharán los resultados.' },
    workplan: { title: 'Calidad científico-técnica', hint: 'Objetivos, metodología y diseño experimental, y avance de TRL 3 a TRL 5.' },
    team: { title: 'Capacidades del equipo', hint: 'Experiencia en I+D y capacidad de gestión del equipo y los asociados.' },
    budget: { title: 'Costos (aporte FIA y contraparte)', hint: 'Pertinencia del aporte FIA y del aporte de la contraparte.' }
  },
  monitor: {
    title_pitch: { title: 'Título y resumen', hint: 'Revisa en las bases si piden video o pitch.' },
    problem: { title: 'Problema u oportunidad', hint: 'El problema que abordas y a quién afecta.' },
    solution: { title: 'Solución', hint: 'Qué harás y qué tiene de nuevo.' },
    market: { title: 'Mercado y beneficiarios', hint: 'A quién beneficia.' },
    model: { title: 'Modelo de negocio o sostenibilidad', hint: 'Cómo se sostiene en el tiempo.' },
    workplan: { title: 'Plan de trabajo', hint: 'Actividades, plazos y resultados.' },
    team: { title: 'Equipo', hint: 'Quiénes ejecutan y su experiencia.' },
    budget: { title: 'Presupuesto', hint: 'Cuentas y topes según las bases.' }
  }
};

// ---------------------------------------------------------------------------
// Requisitos reutilizables
// ---------------------------------------------------------------------------
const req = {
  rut: (): FundRequirement => ({ id: 'rut', label: 'RUT válido del postulante', check: { kind: 'rut' } }),
  noDebts: (): FundRequirement => ({ id: 'sin_deudas', label: 'Sin deudas laborales, previsionales ni tributarias morosas', detail: 'Se revisa con el certificado F30-1 de la Dirección del Trabajo y el certificado de deuda de la Tesorería (TGR).' }),
  pensionRegistry: (): FundRequirement => ({ id: 'pension', label: 'No estar en el Registro Nacional de Deudores de Pensiones de Alimentos' })
};

// ---------------------------------------------------------------------------
// Reglas por fondo (desde sus bases)
// ---------------------------------------------------------------------------
export const FUND_RULES: Record<string, FundRules> = {
  corfo_semilla_inicia: {
    family: 'corfo_emprendimiento',
    bases: { title: 'Bases Semilla Inicia (Res. Exenta N°1498 de 2025 de Corfo)', url: 'https://www.fomentolosrios.gob.cl/wp-content/uploads/2026/01/Resolucion-Electronica-Exenta-N%C2%B01498-de-2025-de-Corfo-Modifica-Bases-Semilla-Inicia-y-Aprueba-su-nuevo-texto.pdf', verifiedAt: VERIFIED, note: 'Se abre por región (Comités de Desarrollo Productivo Regional) con focos territoriales propios.' },
    requirements: [
      { id: 'tipo', label: 'Persona natural mayor de 18 años residente en Chile, o empresa constituida en Chile', check: { kind: 'companyType', allowed: ['sin_iniciar', 'persona_natural', 'spa', 'srl', 'eirl', 'sa'] } },
      { id: 'antiguedad', label: 'Si postulas como empresa: máximo 18 meses desde el inicio de actividades', check: { kind: 'age', maxMonths: 18 } },
      { id: 'sin_ventas', label: 'Si postulas como empresa: sin ventas hasta el mes anterior a la convocatoria', check: { kind: 'sales', noSales: true } },
      { id: 'innovacion', label: 'Emprendimiento innovador, con potencial de alcance nacional e internacional', detail: 'Debes tener al menos una idea de producto o servicio y un plan para lograr primeras ventas durante el proyecto.' },
      { id: 'region', label: 'Ejecutar el proyecto en la región de la convocatoria', detail: 'Cada región abre su propio concurso y puede tener focos temáticos.' }
    ],
    applicationDocs: [
      { id: 'formulario', label: 'Formulario de postulación en línea (Corfo)', link: 'formulator' },
      { id: 'video', label: 'Video de máximo 40 segundos', detail: 'Producto o servicio y su innovación frente a la competencia. Solo se revisan los primeros 40 segundos; el enlace debe ser público.', link: 'pitch' },
      { id: 'objeto_social', label: 'Si es empresa: transcripción del objeto social de los estatutos' }
    ],
    formalizationDocs: ['Contrato con la Entidad Patrocinadora (dentro de 15 días hábiles)', 'Si es empresa: acreditar que no tiene ventas', 'Si es persona: acreditar edad y residencia', 'Antecedentes de empresa liderada por mujeres (si corresponde)'],
    formSections: [
      { title: 'Solución: innovación, diferenciación y estado de desarrollo', blocks: ['problem', 'solution'], evaluates: 'Innovación 40%' },
      { title: 'Escalabilidad: modelo de negocio, mercado y competencia', blocks: ['market', 'model'], evaluates: 'Escalabilidad 30%' },
      { title: 'Plan de validación', blocks: ['workplan'], evaluates: 'Plan de validación 10%' },
      { title: 'Capacidades: equipo y horas semanales', blocks: ['team'], evaluates: 'Equipo 30%' },
      { title: 'Video de 40 segundos', blocks: ['title_pitch'] },
      { title: 'Presupuesto', blocks: ['budget'] }
    ],
    pitch: { label: 'Video de 40 segundos', seconds: 40, content: 'Qué es tu producto o servicio, qué problema resuelve y por qué es innovador frente a la competencia.' },
    evaluation: {
      scale: '1,00 a 5,00', passMark: null, target: 4.0,
      rule: 'No hay nota de corte: los proyectos se ordenan por nota y se adjudican hasta agotar el presupuesto regional. Apunta a 4,0 o más.',
    },
    coFinance: { text: 'Corfo cofinancia hasta 75% del costo total, con tope de $15.000.000. Tú aportas al menos 25% (en dinero o valorizado).', femalePct: 85, femaleMaxCLP: 17000000 },
    partners: 'Entidad Patrocinadora obligatoria si ganas (Corfo le paga su servicio; a ti no te cobra). No se necesita para postular.',
    guarantee: { required: false, text: 'Las garantías las entrega la Entidad Patrocinadora, no tú.' },
    portal: { name: 'Portal de postulación de Corfo', url: 'https://www.corfo.cl' },
    duration: 'Hasta 10 meses (prórroga de hasta 2 meses).',
    budget: BUDGETS.corfo_emprendimiento,
    notes: ['Las actividades obligatorias son: mentoría, modelo de negocio, validación técnica y comercial, y estrategia de sostenibilidad.']
  },

  corfo_semilla_expande: {
    family: 'corfo_emprendimiento',
    bases: { title: 'Semilla Expande 2026: preguntas frecuentes de la convocatoria nacional y bases técnicas regionales', url: 'https://saowcsblobassets.blob.core.windows.net/assets/CONV/26EXP-1/Preguntas%20frecuentes%20Semilla%20Expande%20v_2.pdf', verifiedAt: VERIFIED, note: 'Algunas regiones agregan una segunda etapa de hasta $20.000.000.' },
    requirements: [
      { id: 'tipo', label: 'Empresa (persona jurídica) constituida en Chile', detail: 'Las personas naturales no pueden postular.', check: { kind: 'companyType', allowed: ['spa', 'srl', 'eirl', 'sa'] } },
      { id: 'antiguedad', label: 'Máximo 36 meses desde el inicio de actividades', check: { kind: 'age', maxMonths: 36 } },
      { id: 'ventas_min', label: 'Ventas facturadas del producto postulado de al menos $100.000 netos en los últimos 12 meses', check: { kind: 'sales', minCLP: 100000 } },
      { id: 'ventas_max', label: 'Ventas totales de la empresa de hasta $80.000.000 en el mismo período', check: { kind: 'sales', maxCLP: 80000000 } },
      { id: 'innovacion', label: 'Producto o servicio innovador con potencial de escalar' }
    ],
    applicationDocs: [
      { id: 'formulario', label: 'Formulario de postulación en línea (Corfo), sin adjuntos', link: 'formulator' },
      { id: 'video', label: 'Video de máximo 40 segundos (requisito de admisibilidad)', detail: 'Debe verse y escucharse bien; enlace público o con contraseña indicada.', link: 'pitch' },
      { id: 'sello', label: 'Resolución del Sello 40 horas (solo si lo tienes, da 5% de bonificación)' }
    ],
    formalizationDocs: ['Contrato con la Entidad Patrocinadora', 'Acreditación de ventas con documentos del SII', 'Antecedentes de empresa liderada por mujeres (si corresponde)'],
    formSections: [
      { title: 'Innovación: problema y propuesta de valor', blocks: ['problem', 'solution'], evaluates: 'Innovación 40%' },
      { title: 'Escalabilidad: mercado, modelo de negocio y plan', blocks: ['market', 'model', 'workplan'], evaluates: 'Escalabilidad 30%' },
      { title: 'Equipo', blocks: ['team'], evaluates: 'Equipo 30%' },
      { title: 'Video de 40 segundos', blocks: ['title_pitch'] },
      { title: 'Presupuesto', blocks: ['budget'] }
    ],
    pitch: { label: 'Video de 40 segundos', seconds: 40, content: 'Tu producto o servicio, el problema que resuelve y la innovación comparada con la competencia.' },
    evaluation: { scale: '1 a 5', passMark: null, target: 4.0, rule: 'No hay nota de corte publicada: se adjudica por ranking. Apunta a 4,0 o más. Bonificación de 5% con Sello 40 horas.' },
    coFinance: { text: 'Corfo cofinancia hasta 75% del costo total, con tope de $25.000.000. Tú aportas al menos 25%.', femalePct: 85, femaleMaxCLP: 28333334 },
    partners: 'Entidad Patrocinadora obligatoria si ganas (no se necesita para postular). Mentoría o aceleración obligatoria.',
    guarantee: { required: false, text: 'Las garantías las gestiona la Entidad Patrocinadora.' },
    portal: { name: 'Portal de postulación de Corfo', url: 'https://www.corfo.cl' },
    duration: 'Según la convocatoria (hasta 12 meses en la primera etapa).',
    budget: BUDGETS.corfo_emprendimiento
  },

  corfo_crea_valida: {
    family: 'corfo_innovacion',
    bases: { title: 'Bases técnicas Crea y Valida (Res. E N°388, Corfo InnovaChile)', url: 'https://www.fomentoantofagasta.gob.cl/wp-content/uploads/2026/08/Resolucion-E-N%C2%B0388-Bases-tecnicas-Crea-y-Valida-1-1.pdf', verifiedAt: VERIFIED, note: 'Postulación en 2 fases: Perfil de proyecto (obligatorio) y luego la postulación completa.' },
    requirements: [
      { id: 'tipo', label: 'Empresa (persona jurídica) constituida en Chile', detail: 'Universidades, IP y CFT no pueden ser beneficiarias.', check: { kind: 'companyType', allowed: ['spa', 'srl', 'eirl', 'sa'] } },
      { id: 'primera_categoria', label: 'Inicio de actividades en primera categoría, vigente', check: { kind: 'firstCategory', required: true } },
      { id: 'antiguedad', label: 'Al menos 24 meses desde el inicio de actividades', check: { kind: 'age', minMonths: 24 } },
      { id: 'ventas', label: 'Ventas en los 24 meses anteriores a la postulación', check: { kind: 'sales', minCLP: 1 } },
      { id: 'perfil', label: 'Haber enviado el Perfil de Proyecto (fase 1) dentro del plazo' },
      { id: 'prototipo', label: 'Partir desde un prototipo (etapa CREA) y llegar a validación a escala productiva o comercial (etapa VALIDA)' }
    ],
    applicationDocs: [
      { id: 'perfil', label: 'Perfil de proyecto (fase 1): objetivos, problema, solución, costos y participantes', link: 'formulator' },
      { id: 'formulario', label: 'Formulario de postulación completo (fase 2) con planillas y anexos', link: 'formulator' },
      { id: 'objeto_social', label: 'Transcripción del objeto social de la empresa' },
      { id: 'ventas', label: 'Acreditación de ventas de los últimos 24 meses', link: 'taxFolder' },
      { id: 'colaboradoras', label: 'Si es colaborativo: antecedentes de las entidades colaboradoras y declaración jurada', link: 'letters' }
    ],
    formalizationDocs: ['Garantía de fiel cumplimiento (mínimo 30 UF)', 'Acreditación de ventas de 24 meses', 'Antecedentes de empresa liderada por mujeres (si corresponde)', 'Resolución del Sello 40 horas (si corresponde)'],
    formSections: [
      { title: 'a) Resumen y b) Objetivos', blocks: ['title_pitch'] },
      { title: 'c) Problema, desafío u oportunidad y mercado objetivo', blocks: ['problem', 'market'], evaluates: 'Diagnóstico 10% · Mercado 10%' },
      { title: 'd) Participantes y equipo de trabajo', blocks: ['team'], evaluates: 'Capacidades 20%' },
      { title: 'e) Propuesta de solución: metodología, novedad e I+D', blocks: ['solution', 'workplan'], evaluates: 'Metodología 20% · Novedad 10% · I+D 10%' },
      { title: 'f) Introducción al mercado: impacto y escalabilidad', blocks: ['model'], evaluates: 'Impacto 10% · Escalabilidad 10%' },
      { title: 'g) Presupuesto', blocks: ['budget'] }
    ],
    evaluation: {
      scale: '1 a 5', passMark: 3.5, minEach: 3.0, target: 4.0,
      rule: 'Para ser recomendado necesitas al menos 3,00 en cada subcriterio y 3,50 de nota final. Las actividades de I+D se puntúan según su peso en el costo: 30% o más = 5,0.'
    },
    coFinance: { text: 'Subsidio de hasta $180.000.000 (individual) o $220.000.000 (colaborativo). Corfo cubre hasta 80% (micro y pequeña), 60% (mediana) o 40% (grande). Al menos la mitad del aporte de la empresa debe ser en dinero.', bySizePct: { micro_pequena: 80, mediana: 60, grande: 40 }, femalePct: 10, minCashText: 'Al menos 50% del aporte en dinero (pecuniario).' },
    partners: 'Modalidad colaborativa: una o más entidades colaboradoras de I+D por al menos 30% del costo total. Asociados opcionales que cofinancian.',
    guarantee: { required: true, text: 'Garantía de fiel cumplimiento de al menos 30 UF (su costo se puede cargar al proyecto).' },
    portal: { name: 'Portal de postulación de Corfo', url: 'https://www.corfo.cl' },
    duration: 'Hasta 24 meses (máximo 30 con prórrogas).',
    budget: BUDGETS.corfo_crea_valida
  },

  corfo_sumate_innovar: {
    family: 'corfo_innovacion',
    bases: { title: 'Bases técnicas Súmate a Innovar (Res. N°87, Corfo InnovaChile)', url: 'https://www.fomentobiobio.gob.cl/wp-content/uploads/2026/05/2-ResN87BasesTecnicasSumateaInnovar.pdf', verifiedAt: VERIFIED },
    requirements: [
      { id: 'tipo', label: 'Persona natural mayor de 18 años o empresa constituida en Chile', check: { kind: 'companyType', allowed: ['persona_natural', 'spa', 'srl', 'eirl', 'sa'] } },
      { id: 'primera_categoria', label: 'Inicio de actividades en primera categoría, vigente', check: { kind: 'firstCategory', required: true } },
      { id: 'antiguedad', label: 'Al menos 24 meses desde el inicio de actividades', check: { kind: 'age', minMonths: 24 } },
      { id: 'ventas', label: 'Ventas en los últimos 24 meses', check: { kind: 'sales', minCLP: 1 } },
      { id: 'no_beneficiario', label: 'No haber sido beneficiario de un proyecto de I+D o innovación de InnovaChile en los últimos 5 años' },
      { id: 'colaboradora', label: 'Contratar 1 o 2 entidades colaboradoras con capacidades de I+D', detail: 'Universidades, centros de investigación o empresas de servicios tecnológicos.' },
      req.pensionRegistry()
    ],
    applicationDocs: [
      { id: 'formulario', label: 'Formulario en línea con planillas y anexos', link: 'formulator' },
      { id: 'objeto_social', label: 'Transcripción del objeto social' },
      { id: 'colaboradora', label: 'Antecedentes de la entidad colaboradora y currículum de su equipo', link: 'letters' }
    ],
    formalizationDocs: ['Contratos firmados con las entidades colaboradoras (dentro de 2 meses)', 'Acreditación de ventas y tamaño', 'Garantía de fiel cumplimiento (mínimo 5% de lo transferido)', 'Antecedentes de empresa liderada por mujeres (si corresponde)'],
    formSections: [
      { title: '1. Resumen y 2. Objetivos', blocks: ['title_pitch'] },
      { title: '3. Problema o desafío: diagnóstico y potencial', blocks: ['problem', 'market'], evaluates: 'Diagnóstico 15% · Potencial 10%' },
      { title: '4. Solución: metodología, impacto y novedad', blocks: ['solution', 'workplan', 'model'], evaluates: 'Metodología 20% · Impacto 15% · Novedad 15%' },
      { title: '5. Capacidades del beneficiario y de la entidad colaboradora', blocks: ['team'], evaluates: 'Beneficiario 5% · Entidad colaboradora 20%' },
      { title: 'Presupuesto', blocks: ['budget'] }
    ],
    evaluation: { scale: '1 a 5', passMark: 3.0, minEach: 3.0, target: 4.0, rule: 'Necesitas al menos 3,00 en cada criterio para ser recomendado; luego se ordena por ranking.' },
    coFinance: { text: 'Subsidio de hasta $10.000.000. Corfo cubre hasta 80% (micro y pequeña), 70% (mediana) o 40% (grande). Al menos la mitad del aporte en dinero.', bySizePct: { micro_pequena: 80, mediana: 70, grande: 40 }, femalePct: 10, femaleMaxCLP: 11250000, minCashText: 'Al menos 50% del aporte en dinero.' },
    partners: 'Entre 1 y 2 entidades colaboradoras obligatorias.',
    guarantee: { required: true, text: 'Garantía de fiel cumplimiento de al menos 5% de los fondos a transferir (su costo es financiable).' },
    portal: { name: 'Portal de postulación de Corfo', url: 'https://www.corfo.cl' },
    duration: 'Hasta 6 meses (máximo 9 con prórroga).',
    budget: BUDGETS.corfo_sumate,
    notes: ['Solo financia la contratación de las entidades colaboradoras: no equipos, software estándar, certificaciones ni consultoría de negocios.']
  },

  startup_chile_build: {
    family: 'startup_chile',
    bases: { title: 'Start-Up Chile: programa BIG (brochure oficial BIG 12)', url: 'https://startupchile.org/content/uploads/brochure-big-12-esp-1.pdf', verifiedAt: VERIFIED, note: 'Cada generación publica sus bases en startupchile.org; revisa requisitos y fechas al abrir.' },
    requirements: [
      { id: 'base_tec', label: 'Emprendimiento de base tecnológica con potencial global, usando Chile como plataforma' },
      { id: 'etapa', label: 'Etapa temprana: idea validada hasta prototipo inicial' },
      { id: 'tipo', label: 'Persona natural mayor de 18 años (chilena o extranjera) o empresa joven constituida en Chile' }
    ],
    applicationDocs: [
      { id: 'formulario', label: 'Postulación en línea en startupchile.org', link: 'formulator' },
      { id: 'pitch', label: 'Pitch del proyecto (según formulario de la generación)', link: 'pitch' }
    ],
    formalizationDocs: ['Constitución de empresa en Chile (si postulaste como persona)', 'Aporte del equipo (10% del costo total)'],
    formSections: [
      { title: 'Proyecto: problema, solución y tecnología', blocks: ['problem', 'solution'] },
      { title: 'Mercado y potencial de crecimiento', blocks: ['market', 'model'] },
      { title: 'Equipo fundador', blocks: ['team'] },
      { title: 'Plan para el programa', blocks: ['workplan'] },
      { title: 'Pitch', blocks: ['title_pitch'] },
      { title: 'Presupuesto', blocks: ['budget'] }
    ],
    pitch: { label: 'Pitch del proyecto', seconds: 60, content: 'Problema, solución tecnológica, mercado global y equipo.' },
    evaluation: { scale: '1 a 5 (referencial)', passMark: null, target: 4.0, rule: 'Start-Up Chile evalúa base tecnológica, innovación, escalabilidad e impacto; no publica una nota de corte. Al menos 50% de los seleccionados en Build son liderados por mujeres.' },
    coFinance: { text: 'Subsidio de $15.000.000 (90% del costo total). El equipo aporta 10%.' },
    partners: 'Entidad Patrocinadora asignada por el programa.',
    guarantee: { required: false, text: 'Según las bases de la generación.' },
    portal: { name: 'Start-Up Chile', url: 'https://www.startupchile.org' },
    duration: '4 meses.',
    budget: BUDGETS.startup_chile
  },

  startup_chile_ignite: {
    family: 'startup_chile',
    bases: { title: 'Start-Up Chile: programa BIG (brochure oficial BIG 12)', url: 'https://startupchile.org/content/uploads/brochure-big-12-esp-1.pdf', verifiedAt: VERIFIED, note: 'Cada generación publica sus bases en startupchile.org; revisa requisitos y fechas al abrir.' },
    requirements: [
      { id: 'base_tec', label: 'Emprendimiento de base tecnológica con potencial global, usando Chile como plataforma' },
      { id: 'mvp', label: 'Producto funcional (MVP) con validación temprana de clientes' },
      { id: 'tipo', label: 'Empresa joven constituida en Chile (revisa la antigüedad máxima en las bases de la generación)', check: { kind: 'companyType', allowed: ['persona_natural', 'sin_iniciar', 'spa', 'srl', 'eirl', 'sa'] } },
      { id: 'equipo', label: 'Equipo con dedicación al programa en Chile' }
    ],
    applicationDocs: [
      { id: 'formulario', label: 'Postulación en línea en startupchile.org', link: 'formulator' },
      { id: 'pitch', label: 'Pitch del proyecto (según formulario de la generación)', link: 'pitch' }
    ],
    formalizationDocs: ['Antecedentes legales de la empresa', 'Aporte del equipo (20% del costo total; 10% si la líder es mujer)'],
    formSections: [
      { title: 'Proyecto: problema, solución y tecnología', blocks: ['problem', 'solution'] },
      { title: 'Mercado, modelo de negocio y tracción', blocks: ['market', 'model'] },
      { title: 'Equipo fundador', blocks: ['team'] },
      { title: 'Plan para el programa', blocks: ['workplan'] },
      { title: 'Pitch', blocks: ['title_pitch'] },
      { title: 'Presupuesto', blocks: ['budget'] }
    ],
    pitch: { label: 'Pitch del proyecto', seconds: 60, content: 'Problema, solución tecnológica, tracción, mercado global y equipo.' },
    evaluation: { scale: '1 a 5 (referencial)', passMark: null, target: 4.0, rule: 'Start-Up Chile evalúa base tecnológica, innovación, escalabilidad e impacto; no publica una nota de corte.' },
    coFinance: { text: 'Subsidio de $30.000.000: Corfo cubre 80% del costo total (90% si la líder es mujer). Extensión posible de $20.000.000.', femalePct: 90 },
    partners: 'Entidad Patrocinadora asignada por el programa.',
    guarantee: { required: false, text: 'Según las bases de la generación.' },
    portal: { name: 'Start-Up Chile', url: 'https://www.startupchile.org' },
    duration: 'Programa de 4 meses; ejecución del subsidio en 6 meses.',
    budget: BUDGETS.startup_chile
  },

  sercotec_semilla_emprende: {
    family: 'sercotec',
    bases: { title: 'Bases Capital Semilla Emprende 2026 (Sercotec, Región Metropolitana)', url: 'https://www.sercotec.cl/wp-content/uploads/2026/04/Bases-Semilla-EMPRENDE-2026-Metropolitana-VB%C2%B0.pdf', verifiedAt: VERIFIED, note: 'Cada región publica sus bases con su foco y criterios del comité; los montos y el proceso son iguales.' },
    requirements: [
      { id: 'tipo', label: 'Persona natural mayor de 18 años, chilena o extranjera', check: { kind: 'companyType', allowed: ['sin_iniciar'] } },
      { id: 'sin_inicio', label: 'Sin inicio de actividades en primera categoría ante el SII (segunda categoría sí se acepta)', check: { kind: 'firstCategory', required: false } },
      { id: 'no_beneficiario', label: 'No haber ganado Capital Semilla, Abeja o Pioneras (Emprende) en 2023 a 2026' },
      { id: 'participacion', label: 'No tener más del 50% de participación en sociedades existentes' },
      req.noDebts(),
      req.pensionRegistry(),
      { id: 'domicilio', label: 'Domicilio en la región de la convocatoria' }
    ],
    applicationDocs: [
      { id: 'test', label: 'Test de preselección en sercotec.cl', detail: 'Define quién pasa a evaluación (corte según presupuesto regional).' },
      { id: 'formulario', label: 'Formulario de modelo de negocio (10 ámbitos tipo Canvas)', link: 'formulator' },
      { id: 'costos', label: 'Estructura de costos: gestión empresarial e inversiones', link: 'formulator' },
      { id: 'video', label: 'Video pitch de máximo 90 segundos, en español', detail: 'Presentación, problema y clientes, solución y diferenciadores.', link: 'pitch' }
    ],
    formalizationDocs: ['Inicio de actividades en primera categoría en la región', 'Certificados laboral, previsional y tributario', 'Inscripción en el Registro Pymes', 'Cursos de Sercotec: Diseño de Modelos de Negocios, Sustentabilidad y uno de Gestión', 'Pago del aporte empresarial (3%)', 'Autorización para revisar tu carpeta tributaria (365 días)'],
    formSections: [
      { title: 'Clientes', blocks: ['problem'] },
      { title: 'Oferta de valor, elemento diferenciador y sustentabilidad', blocks: ['solution'] },
      { title: 'Canales y relación con los clientes', blocks: ['market'] },
      { title: 'Ingresos, costos y recursos clave', blocks: ['model'] },
      { title: 'Actividades y alianzas clave', blocks: ['workplan'] },
      { title: 'Experiencia de quien postula', blocks: ['team'] },
      { title: 'Video pitch de 90 segundos', blocks: ['title_pitch'] },
      { title: 'Estructura de costos', blocks: ['budget'] }
    ],
    pitch: { label: 'Video pitch de 90 segundos', seconds: 90, content: 'Quién eres, el problema y tus clientes, tu solución, tu oferta de valor y diferenciadores.' },
    evaluation: {
      scale: 'Nota con dos decimales', passMark: null, target: 4.0,
      rule: 'Cada región fija su nota de corte según presupuesto. La nota final suma: evaluación técnica 20% (formulario 60% y video 40%), visita a terreno 30% y comité regional 50% (presentación de 5 minutos).',
      stages: [
        { name: 'Test de preselección', weight: 0, detail: 'Filtro con corte regional' },
        { name: 'Evaluación técnica', weight: 20, detail: 'Formulario 60% y video pitch 40%' },
        { name: 'Visita a terreno', weight: 30, detail: 'Coherencia, factibilidad, estado de desarrollo, viabilidad económica, capacidades y proceso productivo' },
        { name: 'Comité de Evaluación Regional', weight: 50, detail: 'Presentación oral de hasta 5 minutos' }
      ]
    },
    coFinance: { text: 'Subsidio de $3.500.000 netos: entre $200.000 y $500.000 para gestión empresarial y hasta $3.300.000 para inversiones. Aportas 3% del subsidio en efectivo antes del contrato. El IVA lo pagas tú.', contributionOfSubsidyPct: 3 },
    guarantee: { required: false, text: 'No se exigen garantías.' },
    portal: { name: 'Sercotec', url: 'https://www.sercotec.cl' },
    duration: 'Fase de desarrollo con el Agente Operador de Sercotec.',
    budget: BUDGETS.sercotec_emprende,
    notes: ['Durante el proceso hay una visita a terreno y una presentación de 5 minutos ante el comité regional: prepárala con el mismo guion de tu video.']
  },

  sercotec_abeja_emprende: {
    family: 'sercotec',
    bases: { title: 'Bases Capital Abeja Emprende 2026 (Sercotec, Antofagasta)', url: 'https://www.sercotec.cl/wp-content/uploads/2026/05/Bases-Abeja-EMPRENDE-2026-Antofagasta-VB°.pdf', verifiedAt: VERIFIED, note: 'Cada región publica sus bases con sus comunas y focos priorizados.' },
    requirements: [
      { id: 'mujer', label: 'Mujer (sexo registral femenino) mayor de 18 años', check: { kind: 'female' } },
      { id: 'tipo', label: 'Persona natural sin empresa formalizada', check: { kind: 'companyType', allowed: ['sin_iniciar'] } },
      { id: 'sin_inicio', label: 'Sin inicio de actividades en primera categoría (segunda categoría sí se acepta)', check: { kind: 'firstCategory', required: false } },
      { id: 'no_beneficiario', label: 'No haber ganado Capital Semilla, Abeja o Pioneras (Emprende) en 2023 a 2026' },
      req.noDebts(),
      req.pensionRegistry(),
      { id: 'domicilio', label: 'Domicilio en la región de la convocatoria' }
    ],
    applicationDocs: [
      { id: 'test', label: 'Test de preselección en sercotec.cl', detail: 'Pondera 70% tu perfil como emprendedora y 30% el perfil del emprendimiento.' },
      { id: 'formulario', label: 'Formulario de modelo de negocio (10 ámbitos tipo Canvas)', link: 'formulator' },
      { id: 'costos', label: 'Estructura de costos: gestión empresarial e inversiones', link: 'formulator' },
      { id: 'video', label: 'Video pitch de máximo 90 segundos, en español', link: 'pitch' }
    ],
    formalizationDocs: ['Inicio de actividades en primera categoría en la región', 'Certificados laboral, previsional y tributario', 'Registro Pymes', 'Cursos de Sercotec (modelo de negocios, sustentabilidad y gestión)', 'Pago del aporte (3%)'],
    formSections: [
      { title: 'Clientes', blocks: ['problem'] },
      { title: 'Oferta de valor, elemento diferenciador y sustentabilidad', blocks: ['solution'] },
      { title: 'Canales y relación con los clientes', blocks: ['market'] },
      { title: 'Ingresos, costos y recursos clave', blocks: ['model'] },
      { title: 'Actividades y alianzas clave', blocks: ['workplan'] },
      { title: 'Experiencia de quien postula', blocks: ['team'] },
      { title: 'Video pitch de 90 segundos', blocks: ['title_pitch'] },
      { title: 'Estructura de costos', blocks: ['budget'] }
    ],
    pitch: { label: 'Video pitch de 90 segundos', seconds: 90, content: 'Quién eres, el problema y tus clientes, tu solución y qué te diferencia.' },
    evaluation: {
      scale: 'Nota con dos decimales', passMark: null, target: 4.0,
      rule: 'Cada región fija su corte. Nota final: técnica 20% (formulario 60%, video 40%), terreno 30% y comité regional 50%. En el comité también pesan las comunas priorizadas y la participación en programas de SernamEG.',
      stages: [
        { name: 'Test de preselección', weight: 0, detail: 'Perfil emprendedora 70% y emprendimiento 30%' },
        { name: 'Evaluación técnica', weight: 20, detail: 'Formulario 60% y video 40%' },
        { name: 'Visita a terreno', weight: 30, detail: 'Coherencia 25%, factibilidad 25%, estado de desarrollo 20%, viabilidad económica 15%, capacidades 15%' },
        { name: 'Comité de Evaluación Regional', weight: 50, detail: 'Potencial 20%, oportunidad 15%, coherencia y factibilidad 20%, comuna priorizada 20%, programas SernamEG 25%' }
      ]
    },
    coFinance: { text: 'Subsidio de $3.500.000 netos: entre $200.000 y $500.000 para gestión empresarial y hasta $3.300.000 para inversiones. Aportas 3% del subsidio.', contributionOfSubsidyPct: 3 },
    guarantee: { required: false, text: 'No se exigen garantías.' },
    portal: { name: 'Sercotec', url: 'https://www.sercotec.cl' },
    duration: 'Fase de desarrollo con el Agente Operador de Sercotec.',
    budget: BUDGETS.sercotec_emprende
  },

  sercotec_crece: {
    family: 'sercotec',
    bases: { title: 'Bases Crece 2026 (Sercotec, Atacama multisectorial)', url: 'https://www.sercotec.cl/wp-content/uploads/2026/06/Bases-de-Convocatoria_Crece-Multisectorial-2026_Atacama.pdf', verifiedAt: VERIFIED, note: 'Hay versiones regionales y sectoriales (turismo, sostenible, etc.) con criterios de comité propios.' },
    requirements: [
      { id: 'tipo', label: 'Persona natural o jurídica (o cooperativa) con inicio de actividades en primera categoría vigente', check: { kind: 'firstCategory', required: true } },
      { id: 'ventas', label: 'Ventas netas anuales entre 200 UF y 25.000 UF (según los F29 de los últimos 12 meses)', check: { kind: 'sales', minUF: 200, maxUF: 25000 } },
      { id: 'giro', label: 'Giro coherente con la convocatoria (no solo compra y venta sin valor agregado)' },
      { id: 'no_beneficiario', label: 'No haber ganado Crece, Digitaliza tu Almacén o Empresas Sociales y Cooperativas en 2024 a 2026' },
      req.pensionRegistry(),
      { id: 'domicilio', label: 'Domicilio comercial en la región de la convocatoria' }
    ],
    applicationDocs: [
      { id: 'test', label: 'Test de preselección (perfil del empresario 70%, del negocio 30%)' },
      { id: 'formulario', label: 'Formulario de proyecto de negocio (10 ámbitos)', link: 'formulator' },
      { id: 'costos', label: 'Estructura de costos', link: 'formulator' },
      { id: 'video', label: 'Video pitch de máximo 90 segundos', link: 'pitch' },
      { id: 'carpeta', label: 'Carpeta Tributaria para Solicitar Créditos (PDF del SII, con los F29)', link: 'taxFolder' }
    ],
    formalizationDocs: ['Certificado F30-1 (o F30 si no tienes trabajadores)', 'Certificado de deuda de la Tesorería (TGR)', 'Declaraciones juradas de probidad y no consanguinidad', 'Pago del aporte (15% del subsidio)', 'Si es empresa: constitución, estatutos, personería y certificado de vigencia', 'Registro Pymes', '3 cursos aprobados del portal de capacitación de Sercotec', 'Mandato de entrega de información del SII'],
    formSections: [
      { title: 'Clientes', blocks: ['problem'] },
      { title: 'Propuesta de valor', blocks: ['solution'] },
      { title: 'Canales y relación con los clientes', blocks: ['market'] },
      { title: 'Ingresos, costos y recursos clave', blocks: ['model'] },
      { title: 'Actividades y alianzas clave', blocks: ['workplan'] },
      { title: 'Experiencia del empresario', blocks: ['team'] },
      { title: 'Video pitch de 90 segundos', blocks: ['title_pitch'] },
      { title: 'Estructura de costos', blocks: ['budget'] }
    ],
    pitch: { label: 'Video pitch de 90 segundos', seconds: 90, content: 'Presentación, problema y clientes, solución y diferenciación. Lo presenta el titular o representante legal.' },
    evaluation: {
      scale: 'Nota con dos decimales', passMark: null, target: 4.0,
      rule: 'Cada región fija sus cortes. Nota final: técnica 20% (formulario 60%, video 40%), terreno 30% y comité regional 50%.',
      stages: [
        { name: 'Test de preselección', weight: 0, detail: 'Empresario 70%, negocio 30%' },
        { name: 'Evaluación técnica', weight: 20, detail: 'Formulario 60% y video 40%' },
        { name: 'Visita a terreno', weight: 30, detail: 'Coherencia 30%, factibilidad 30%, situación económica sin proyecto 20%, viabilidad con proyecto 20%' },
        { name: 'Comité de Evaluación Regional', weight: 50, detail: 'Potencial 40%, oportunidad 20%, coherencia y factibilidad 20%, manufactura 20%' }
      ]
    },
    coFinance: { text: 'Subsidio de $5.000.000 netos: hasta $1.000.000 para gestión empresarial y el resto en inversiones. Aportas 15% del subsidio. El IVA lo pagas tú.', contributionOfSubsidyPct: 15 },
    guarantee: { required: false, text: 'No se exigen garantías.' },
    portal: { name: 'Sercotec', url: 'https://www.sercotec.cl' },
    duration: 'Hasta 4 meses (prórroga de 1 mes). Al tercer mes debes llevar al menos 50% ejecutado.',
    budget: BUDGETS.sercotec_crece
  },

  anid_fondef_idea: {
    family: 'anid',
    bases: { title: 'Bases concursales IDeA I+D 2026 (ANID)', url: 'https://uchile.cl/dam/jcr:008951ee-8c16-4c1b-a65c-0a5d3b903f48/Bases-Concursales-IDEA-ID-2026.pdf', verifiedAt: VERIFIED },
    requirements: [
      { id: 'institucion', label: 'Postula una universidad, instituto o centro de I+D sin fines de lucro (beneficiaria)', detail: 'Tu empresa participa como entidad asociada: aporta recursos y participa de los resultados, pero no recibe el subsidio.' },
      { id: 'asociada', label: 'Tu empresa como entidad asociada (entre 1 y 3 asociadas por proyecto)' },
      { id: 'trl', label: 'Resultados previos de I+D: TRL 2 cumplido o validado' },
      { id: 'aportes', label: 'Aportes: la beneficiaria al menos 30% y las asociadas al menos 15% del subsidio solicitado' }
    ],
    applicationDocs: [
      { id: 'formulario', label: 'Formulario oficial (capítulos 1 y 2) y planilla de costos', link: 'formulator' },
      { id: 'cartas', label: 'Cartas de compromiso de cada beneficiaria y asociada', link: 'letters' },
      { id: 'presentacion', label: 'Presentación en PDF en el formato de la plataforma' },
      { id: 'cv', label: 'Currículum del director y del equipo en el Portal del Investigador' }
    ],
    formalizationDocs: ['Convenio con ANID (lo firma la institución beneficiaria)', 'Certificado de ética o bioseguridad (si corresponde)'],
    formSections: [
      { title: 'Capítulo 1: relevancia del problema, oportunidad y solución', blocks: ['problem', 'solution', 'market', 'model'], evaluates: '50%' },
      { title: 'Capítulo 2: plan de trabajo, resultados esperados y capacidades', blocks: ['workplan', 'team'], evaluates: '50%' },
      { title: 'Resumen ejecutivo', blocks: ['title_pitch'] },
      { title: 'Presupuesto (planilla oficial)', blocks: ['budget'] }
    ],
    evaluation: { scale: '0 a 5 (con medios puntos)', passMark: 3.0, minEach: 3.0, target: 4.0, rule: 'Cada capítulo debe obtener al menos 3 y el promedio final también. Bonificación de 0,2 si la directora es mujer.' },
    coFinance: { text: 'Subsidio ANID de hasta $227.700.000 en 24 meses. La institución aporta al menos 30% y las empresas asociadas al menos 15% del subsidio.' },
    partners: 'La empresa participa como asociada junto a una universidad o centro de I+D.',
    guarantee: { required: false, text: 'La garantía la entrega la institución beneficiaria.' },
    portal: { name: 'Plataforma de postulación de ANID', url: 'https://anid.cl/concursos/' },
    duration: 'Hasta 24 meses (más 6 por única vez).',
    budget: BUDGETS.anid,
    notes: ['Si eres una pyme, el primer paso es acordar el proyecto con una universidad o centro de I+D: ellos postulan y tu empresa firma como asociada.']
  },

  fia_innovacion_agro: {
    family: 'fia',
    bases: { title: 'Bases FIA Proyectos de Innovación de Interés Privado 2026, Línea 1 (TRL 3 a 5)', url: 'https://dgt.usach.cl/wp-content/uploads/2026/05/D.E.N%C2%B005_BDP_Linea1_TRL3-5_PYT-Privado-2026-2027.pdf', verifiedAt: VERIFIED },
    requirements: [
      { id: 'tipo', label: 'Empresa (persona jurídica) constituida en Chile', detail: 'Las personas naturales pueden participar como asociadas.', check: { kind: 'companyType', allowed: ['spa', 'srl', 'eirl', 'sa'] } },
      { id: 'primera_categoria', label: 'Inicio de actividades en primera categoría', check: { kind: 'firstCategory', required: true } },
      { id: 'ventas', label: 'Micro, pequeña o mediana empresa: ventas anuales de hasta 50.000 UF', check: { kind: 'sales', maxUF: 50000 } },
      { id: 'sector', label: 'Giro del sector silvoagropecuario o de la cadena agroalimentaria', detail: 'Si no lo tienes, debes postular con una empresa asociada del sector.' },
      { id: 'trl', label: 'Prueba de concepto validada (TRL 3 realizado), con meta de llegar a TRL 5' },
      { id: 'lineamiento', label: 'Responder a un lineamiento: recursos hídricos, sanidad vegetal y animal, recursos forestales o mercados agroalimentarios' }
    ],
    applicationDocs: [
      { id: 'formulario', label: 'Formulario de postulación (Word) y Memoria de cálculo FIA', link: 'formulator' },
      { id: 'vigencia', label: 'Certificado de vigencia (máximo 90 días)' },
      { id: 'carpeta', label: 'Carpeta Tributaria Electrónica para solicitar crédito (máximo 90 días)', link: 'taxFolder' },
      { id: 'dj_ventas', label: 'Declaración jurada de ventas de los últimos 12 meses' },
      { id: 'cartas', label: 'Cartas de compromiso de asociados y del equipo técnico', link: 'letters' },
      { id: 'cv', label: 'Currículum del coordinador y del equipo (máximo 3 hojas)' },
      { id: 'garantia', label: 'Carta de conocimiento de la garantía' },
      { id: 'trl', label: 'Evidencia del nivel TRL declarado' },
      { id: 'pitch', label: 'Presentación para el pitch de 5 minutos', link: 'pitch' }
    ],
    formalizationDocs: ['Contrato y plan operativo firmados', 'Garantía (boleta, póliza o certificado de fianza) fijada por FIA'],
    formSections: [
      { title: 'Problema u oportunidad', blocks: ['problem'], evaluates: '15% (evaluación individual)' },
      { title: 'Mérito científico-tecnológico: solución, novedad e incertidumbre', blocks: ['solution'], evaluates: '30% (evaluación individual)' },
      { title: 'Calidad científico-técnica: objetivos, metodología y avance TRL', blocks: ['workplan'], evaluates: '25% (evaluación individual)' },
      { title: 'Diferenciación competitiva y proyección', blocks: ['market', 'model'], evaluates: '10% (evaluación individual)' },
      { title: 'Capacidades del equipo', blocks: ['team'], evaluates: '10% (evaluación individual)' },
      { title: 'Costos (memoria de cálculo)', blocks: ['budget'], evaluates: '10% (evaluación individual)' },
      { title: 'Pitch de 5 minutos', blocks: ['title_pitch'] }
    ],
    pitch: { label: 'Pitch de 5 minutos', seconds: 300, content: 'Vinculación con el sector, innovación, coherencia con TRL 3 a 5, apropiación de resultados y diferenciación.' },
    evaluation: { scale: '1 a 5', passMark: 3.0, target: 4.0, rule: 'Nota mínima 3,0 para ser recomendado. La nota es 50% evaluación individual y 50% comité estratégico.' },
    coFinance: { text: 'FIA aporta hasta $50.000.000 (hasta 80% del costo total). La contraparte aporta al menos 20%, con una parte mínima en dinero.' },
    guarantee: { required: true, text: 'Boleta bancaria, póliza o certificado de fianza; FIA fija el monto antes del contrato.' },
    portal: { name: 'Plataforma de postulación FIA', url: 'https://www.fia.cl' },
    duration: 'Hasta 15 meses (prórroga de hasta 3 meses).',
    budget: BUDGETS.fia
  }
};

/** Reglas genéricas para convocatorias del monitor que no están en el catálogo. */
function monitorRules(fund: ChileanFund): FundRules {
  const url = (fund as any).officialUrl || 'https://www.corfo.cl';
  return {
    family: 'monitor',
    bases: { title: `Bases de "${fund.name}"`, url, verifiedAt: '', note: 'Este concurso viene del monitor: la app no tiene sus bases cargadas. Revisa quién puede postular, montos, criterios y documentos en las bases oficiales.' },
    requirements: [
      { id: 'leer_bases', label: 'Leí las bases y cumplo los requisitos para postular', detail: 'Quién puede postular, ventas y antigüedad exigidas, focos territoriales.' },
      { id: 'region', label: 'Mi proyecto corresponde al territorio de la convocatoria' }
    ],
    applicationDocs: [
      { id: 'formulario', label: 'Formulario de postulación del concurso', link: 'formulator' },
      { id: 'anexos', label: 'Anexos que pidan las bases (cartas, certificados, video)' }
    ],
    formalizationDocs: ['Según las bases del concurso'],
    formSections: [
      { title: 'Problema y solución', blocks: ['problem', 'solution'] },
      { title: 'Mercado y sostenibilidad', blocks: ['market', 'model'] },
      { title: 'Plan de trabajo', blocks: ['workplan'] },
      { title: 'Equipo', blocks: ['team'] },
      { title: 'Presupuesto', blocks: ['budget'] }
    ],
    evaluation: { scale: '1 a 5 (referencial)', passMark: null, target: 4.0, rule: 'La auditoría usa una pauta general; los criterios reales están en las bases del concurso.' },
    coFinance: { text: `${fund.subsidyFormatted || 'Monto según bases'}. Revisa el porcentaje de cofinanciamiento y los aportes en las bases.` },
    guarantee: { required: false, text: 'Revisa en las bases si piden garantía.' },
    portal: { name: fund.agency, url },
    duration: 'Según las bases.',
    budget: BUDGETS.monitor
  };
}

export function getFundRules(fund: ChileanFund): FundRules {
  return fund.rules || FUND_RULES[fund.id] || monitorRules(fund);
}

/** % máximo que pone el fondo, según tamaño de la empresa y liderazgo femenino. */
export function coFinancePctFor(fund: ChileanFund, profile?: Partial<CompanyProfile> | null): number {
  const r = getFundRules(fund);
  if (r.coFinance.contributionOfSubsidyPct) {
    return Math.floor((100 / (100 + r.coFinance.contributionOfSubsidyPct)) * 1000) / 10;
  }
  let pct = fund.maxCoFinancePct;
  if (r.coFinance.bySizePct) {
    const b = String(profile?.salesBracket || '');
    pct = b === 'grande_mayor_100000uf' ? r.coFinance.bySizePct.grande : b === 'mediana_25000_a_100000uf' ? r.coFinance.bySizePct.mediana : r.coFinance.bySizePct.micro_pequena;
    if (profile?.isFemaleLed && r.coFinance.femalePct) pct = Math.min(100, pct + r.coFinance.femalePct);
    return pct;
  }
  if (profile?.isFemaleLed && r.coFinance.femalePct) pct = Math.max(pct, r.coFinance.femalePct);
  return pct;
}

export function maxSubsidyFor(fund: ChileanFund, profile?: Partial<CompanyProfile> | null): number {
  const r = getFundRules(fund);
  return profile?.isFemaleLed && r.coFinance.femaleMaxCLP ? r.coFinance.femaleMaxCLP : fund.maxSubsidyCLP;
}

export function budgetAccountsFor(fund: ChileanFund): FundBudgetAccount[] {
  return getFundRules(fund).budget;
}

export function blockLabel(fund: ChileanFund, block: FormBlock) {
  return FAMILY_BLOCKS[getFundRules(fund).family][block];
}

/** Nota que debe alcanzar la auditoría para considerar la postulación lista. */
export function auditThreshold(fund: ChileanFund): { value: number; label: string } {
  const e = getFundRules(fund).evaluation;
  return e.passMark !== null
    ? { value: e.passMark, label: `Nota mínima de las bases: ${e.passMark.toFixed(1).replace('.', ',')}${e.minEach ? ` (y ${e.minEach.toFixed(1).replace('.', ',')} en cada criterio)` : ''}` }
    : { value: e.target, label: `Sin nota de corte (ranking): meta sugerida ${e.target.toFixed(1).replace('.', ',')}` };
}

export function auditPasses(fund: ChileanFund, audit: { overallScore?: number; criteriaScores?: { score: number }[] } | null | undefined): boolean {
  if (!audit || !(audit.overallScore! > 0)) return false;
  const e = getFundRules(fund).evaluation;
  const t = auditThreshold(fund).value;
  if ((audit.overallScore || 0) < t) return false;
  if (e.minEach && Array.isArray(audit.criteriaScores) && audit.criteriaScores.some(c => (Number(c.score) || 0) < e.minEach!)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Revisión automática de requisitos con los datos de la empresa
// ---------------------------------------------------------------------------
export type ReqStatus = 'ok' | 'fail' | 'unknown';

const isCompany = (t?: string) => t === 'spa' || t === 'srl' || t === 'eirl' || t === 'sa';
const clp = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;

export function evaluateRequirement(r: FundRequirement, profile: Partial<CompanyProfile>, rutValid: boolean): { status: ReqStatus; note?: string } {
  const c = r.check;
  if (!c) return { status: 'unknown' };
  const type = String(profile.companyType || '');
  const months = typeof profile.monthsActive === 'number' ? profile.monthsActive : null;
  const sales = typeof profile.annualSalesCLP === 'number' ? profile.annualSalesCLP : null;
  const hasFolder = Boolean(profile.taxFolderUploaded);
  switch (c.kind) {
    case 'rut':
      return rutValid ? { status: 'ok' } : { status: 'unknown', note: 'Ingresa un RUT válido en Mi empresa' };
    case 'taxFolder':
      return hasFolder ? { status: 'ok' } : { status: 'unknown', note: 'Sube tu carpeta tributaria' };
    case 'companyType':
      if (!type) return { status: 'unknown', note: 'Indica el tipo de postulante en Mi empresa' };
      return (c.allowed as CompanyType[]).includes(type as CompanyType)
        ? { status: 'ok' }
        : { status: 'fail', note: type === 'sin_iniciar' ? 'Este fondo exige postular con inicio de actividades o como empresa' : 'Tu tipo de postulante no está admitido por las bases' };
    case 'firstCategory': {
      if (!type) return { status: 'unknown' };
      const has = type !== 'sin_iniciar';
      if (c.required) return has ? (hasFolder ? { status: 'ok' } : { status: 'unknown', note: 'Confírmalo con tu carpeta tributaria' }) : { status: 'fail', note: 'Necesitas inicio de actividades en primera categoría' };
      return has ? { status: 'fail', note: 'Este fondo es solo para quien no tiene inicio de actividades en primera categoría' } : { status: 'ok' };
    }
    case 'age':
      // Requisitos de antigüedad que solo aplican a empresas (ej. Semilla Inicia para personas naturales no la pide)
      if (type === 'sin_iniciar') return c.minMonths ? { status: 'fail', note: `Pide al menos ${c.minMonths} meses de inicio de actividades` } : { status: 'ok' };
      if (months === null) return { status: 'unknown', note: 'Sube tu carpeta tributaria para revisarlo' };
      if (c.minMonths !== undefined && months < c.minMonths) return { status: 'fail', note: `Tienes ${months} meses; pide al menos ${c.minMonths}` };
      if (c.maxMonths !== undefined && months > c.maxMonths && (isCompany(type) || c.minMonths !== undefined)) return { status: 'fail', note: `Tienes ${months} meses; el máximo es ${c.maxMonths}` };
      return { status: 'ok', note: `${months} meses de inicio de actividades` };
    case 'sales': {
      if (c.noSales) {
        if (type === 'sin_iniciar' || type === 'persona_natural') return { status: 'ok' };
        if (sales === null) return profile.salesBracket === 'sin_ventas' ? { status: 'ok' } : { status: 'unknown', note: 'Sube tu carpeta tributaria para revisarlo' };
        return sales <= 0 ? { status: 'ok' } : { status: 'fail', note: `Registras ventas por ${clp(sales)}; las empresas deben postular sin ventas` };
      }
      if (sales === null) {
        if (profile.salesBracket === 'sin_ventas' && (c.minCLP || c.minUF)) return { status: 'fail', note: 'Declaraste que aún no vendes' };
        return { status: 'unknown', note: 'Sube tu carpeta tributaria para revisarlo' };
      }
      const uf = sales / UF_REF;
      if (c.minCLP !== undefined && sales < c.minCLP) return { status: 'fail', note: `Ventas de 12 meses: ${clp(sales)}` };
      if (c.maxCLP !== undefined && sales > c.maxCLP) return { status: 'fail', note: `Ventas de 12 meses: ${clp(sales)}; el máximo es ${clp(c.maxCLP)}` };
      if (c.minUF !== undefined && uf < c.minUF) return { status: 'fail', note: `Ventas de ${Math.round(uf).toLocaleString('es-CL')} UF; el mínimo es ${c.minUF.toLocaleString('es-CL')} UF` };
      if (c.maxUF !== undefined && uf > c.maxUF) return { status: 'fail', note: `Ventas de ${Math.round(uf).toLocaleString('es-CL')} UF; el máximo es ${c.maxUF.toLocaleString('es-CL')} UF` };
      return { status: 'ok', note: `Ventas de 12 meses: ${clp(sales)}` };
    }
    case 'female':
      return profile.isFemaleLed ? { status: 'ok' } : { status: 'unknown', note: 'Indícalo en Mi empresa' };
  }
  return { status: 'unknown' };
}

// ---------------------------------------------------------------------------
// Hoja de ruta estándar (igual para todos los fondos; el contenido sale de sus bases)
// ---------------------------------------------------------------------------
export interface RoadmapItem {
  id: string;
  label: string;
  done: boolean;
  detail?: string;
  warn?: boolean;
  /** El usuario puede marcarlo como listo */
  confirmable?: boolean;
  /** Destino del botón: pestaña#objetivo, o 'sii' | 'dossier' | 'guarantees' | 'url:...' */
  go?: { label: string; target: string };
}
export interface RoadmapStep {
  number: number;
  id: string;
  title: string;
  subtitle: string;
  items: RoadmapItem[];
  done: boolean;
  action: { label: string; target: string };
}

export interface RoadmapInput {
  fund: ChileanFund;
  profile: Partial<CompanyProfile>;
  rutValid: boolean;
  formulation?: any;
  auditResult?: any;
  checks?: Record<string, boolean>;
  confirmedGarantia?: boolean;
  signedLetters?: number;
  submitted?: boolean;
}

const hasPending = (t?: string) => /\[COMPLETAR/i.test(String(t || ''));

export function blockStatus(block: FormBlock, f: any): { done: boolean; pending: boolean } {
  if (!f) return { done: false, pending: false };
  const txt = (s: any) => String(s || '').trim();
  switch (block) {
    case 'title_pitch': return { done: Boolean(txt(f.projectTitle) && txt(f.pitchSummary30s)), pending: hasPending(f.pitchSummary30s) };
    case 'problem': return { done: txt(f.problemStatement).length > 30, pending: hasPending(f.problemStatement) };
    case 'solution': return { done: txt(f.solutionAndInnovation).length > 30, pending: hasPending(f.solutionAndInnovation) };
    case 'market': return { done: Boolean(txt(f.marketAnalysisTAM?.tam) || txt(f.marketAnalysisTAM?.clientArchetype)), pending: hasPending(JSON.stringify(f.marketAnalysisTAM || '')) };
    case 'model': return { done: txt(f.businessModel).length > 20, pending: hasPending(f.businessModel) };
    case 'workplan': return { done: Array.isArray(f.workPlanMilestones) && f.workPlanMilestones.length > 0, pending: false };
    case 'team': return { done: txt(f.teamCapabilities).length > 20, pending: hasPending(f.teamCapabilities) };
    case 'budget': return { done: Array.isArray(f.budgetBreakdown) && f.budgetBreakdown.some((b: any) => (b.corfoContributionCLP || 0) > 0), pending: false };
  }
}

export function computeRoadmap(input: RoadmapInput): { steps: RoadmapStep[]; completed: number; percentage: number; current: number; nextAction: string } {
  const { fund, profile, rutValid, formulation, auditResult, checks = {}, confirmedGarantia, signedLetters = 0, submitted } = input;
  const r = getFundRules(fund);

  // 1. Requisitos para postular
  const reqItems: RoadmapItem[] = r.requirements.map(q => {
    const ev = evaluateRequirement(q, profile, rutValid);
    const confirmed = Boolean(checks[`req_${q.id}`]);
    const go = q.check?.kind === 'rut' || q.check?.kind === 'companyType' || q.check?.kind === 'female'
      ? { label: 'Completar en Mi empresa', target: 'my-company#company-identity' }
      : (q.check?.kind === 'age' || q.check?.kind === 'sales' || q.check?.kind === 'firstCategory' || q.check?.kind === 'taxFolder') && !profile.taxFolderUploaded
        ? { label: 'Subir carpeta tributaria', target: 'sii' }
        : undefined;
    if (ev.status === 'ok') return { id: `req_${q.id}`, label: q.label, done: true, detail: ev.note || q.detail || 'Cumple según los datos de tu empresa' };
    if (ev.status === 'fail') return { id: `req_${q.id}`, label: q.label, done: false, warn: true, detail: `No cumples: ${ev.note || 'revisa las bases'}`, go };
    return { id: `req_${q.id}`, label: q.label, done: confirmed, confirmable: true, detail: confirmed ? 'Confirmado por ti' : (ev.note || q.detail || 'Revísalo y márcalo cuando lo cumplas'), go };
  });

  // 2. Documentos para postular
  const docItems: RoadmapItem[] = r.applicationDocs.map(d => {
    const id = `doc_${d.id}`;
    const confirmed = Boolean(checks[id]);
    if (d.link === 'taxFolder') {
      const ok = Boolean(profile.taxFolderUploaded) || confirmed;
      return { id, label: d.label, done: ok, detail: ok ? 'Carpeta cargada' : d.detail || 'Descárgala en sii.cl y súbela', go: { label: ok ? 'Ver carpeta' : 'Subir carpeta tributaria', target: 'sii' } };
    }
    if (d.link === 'letters') {
      const ok = signedLetters > 0 || confirmed;
      return { id, label: d.label, done: ok, confirmable: true, detail: ok ? (signedLetters > 0 ? `${signedLetters} carta(s) firmada(s)` : 'Confirmado por ti') : d.detail || 'Puedes generarlas en Documentos', go: { label: 'Generar carta', target: 'documents#doc-generator' } };
    }
    if (d.link === 'formulator') {
      const blocksDone = r.formSections.every(s => s.blocks.every(b => blockStatus(b, formulation).done));
      const ok = blocksDone || confirmed;
      return { id, label: d.label, done: ok, confirmable: !blocksDone, detail: ok ? (blocksDone ? 'Contenido redactado en el formulador' : 'Confirmado por ti') : d.detail || 'Se arma en el paso 3', go: { label: 'Ir al formulador', target: 'formulator#section:next' } };
    }
    if (d.link === 'pitch') {
      const scriptDone = blockStatus('title_pitch', formulation).done;
      return { id, label: d.label, done: confirmed, confirmable: true, detail: confirmed ? 'Grabado' : `${d.detail || ''}${scriptDone ? ' Guion listo en el formulador: grábalo y márcalo.' : ' Primero escribe el guion en el formulador.'}`.trim(), go: { label: scriptDone ? 'Ver guion' : 'Escribir guion', target: 'formulator#section:title_pitch' } };
    }
    return { id, label: d.label, done: confirmed, confirmable: true, detail: confirmed ? 'Listo' : d.detail || 'Márcalo cuando lo tengas' };
  });

  // 3. Formulario oficial
  const formItems: RoadmapItem[] = r.formSections.filter(s => !s.blocks.includes('budget')).map((s, i) => {
    const st = s.blocks.map(b => blockStatus(b, formulation));
    const done = st.every(x => x.done);
    const pending = st.some(x => x.pending);
    return {
      id: `form_${i}`,
      label: s.title,
      done: done && !pending,
      warn: done && pending,
      detail: done ? (pending ? 'Tiene datos marcados [COMPLETAR]' : (s.evaluates ? `Listo · evalúa ${s.evaluates}` : 'Listo')) : (s.evaluates ? `Pendiente · evalúa ${s.evaluates}` : 'Pendiente'),
      go: { label: done ? 'Revisar' : 'Redactar', target: `formulator#section:${s.blocks[0]}` }
    };
  });

  // 4. Presupuesto, aportes y garantía
  const budgetDone = blockStatus('budget', formulation).done;
  const budgetItems: RoadmapItem[] = [
    { id: 'budget', label: `Presupuesto en las cuentas de ${fund.agency}`, done: budgetDone, detail: budgetDone ? `${formulation?.budgetBreakdown?.filter((b: any) => (b.corfoContributionCLP || 0) > 0).length} cuentas con montos` : r.budget.map(b => b.account).join(' · '), go: { label: 'Ir al presupuesto', target: 'formulator#section:budget' } },
    { id: 'aporte', label: 'Aporte de tu empresa', done: budgetDone, detail: r.coFinance.text }
  ];
  if (r.guarantee.required) {
    budgetItems.push({ id: 'garantia', label: 'Garantía', done: Boolean(confirmedGarantia), confirmable: true, detail: r.guarantee.text, go: { label: 'Simular garantía', target: 'guarantees' } });
  }

  // 5. Evaluación simulada
  const th = auditThreshold(fund);
  const hasAudit = Boolean(auditResult && (auditResult.overallScore || 0) > 0);
  const passes = auditPasses(fund, auditResult);
  const auditItems: RoadmapItem[] = [
    { id: 'audit', label: 'Evaluación simulada con los criterios del fondo', done: hasAudit, detail: hasAudit ? `Nota: ${Number(auditResult.overallScore).toFixed(2).replace('.', ',')} (${r.evaluation.scale})` : 'Aún no la ejecutas', go: { label: hasAudit ? 'Ver auditoría' : 'Simular evaluación', target: 'auditor' } },
    { id: 'audit_pass', label: th.label, done: passes, warn: hasAudit && !passes, detail: r.evaluation.rule },
    { id: 'red_flags', label: 'Sin alertas críticas', done: hasAudit && (auditResult?.redFlags?.length || 0) === 0, detail: hasAudit ? `${auditResult?.redFlags?.length || 0} alertas detectadas` : 'Pendiente' }
  ];

  // 6. Envío
  const sendItems: RoadmapItem[] = [
    { id: 'dossier', label: 'Expediente PDF para copiar al portal', done: formItems.every(x => x.done) && budgetDone, go: { label: 'Abrir expediente', target: 'dossier' } },
    { id: 'portal', label: `Postular en ${r.portal.name}`, done: Boolean(submitted), detail: submitted ? 'Postulación enviada' : 'La postulación final la envías tú en el portal oficial', go: { label: 'Abrir portal', target: `url:${r.portal.url}` } }
  ];

  const mk = (number: number, id: string, title: string, subtitle: string, items: RoadmapItem[], action: { label: string; target: string }): RoadmapStep =>
    ({ number, id, title, subtitle, items, done: items.length > 0 && items.every(i => i.done), action });

  const steps = [
    mk(1, 'step_requirements', 'Requisitos para postular', 'Lo que exigen las bases de este fondo. Si no cumples uno, no puedes postular.', reqItems, { label: 'Revisar mis datos', target: profile.taxFolderUploaded ? 'my-company#company-identity' : 'sii' }),
    mk(2, 'step_documents', 'Documentos para postular', 'Lo que se entrega junto al formulario.', docItems, { label: 'Ir a documentos', target: 'documents#doc-generator' }),
    mk(3, 'step_form', 'Formulario del fondo', `Las secciones del formulario oficial de ${fund.agency}, en orden.`, formItems, { label: 'Ir al formulador', target: 'formulator#section:next' }),
    mk(4, 'step_budget', 'Presupuesto y aportes', r.coFinance.text, budgetItems, { label: 'Ir al presupuesto', target: 'formulator#section:budget' }),
    mk(5, 'step_audit', 'Evaluación simulada', `Con los criterios y la escala de las bases (${r.evaluation.scale}).`, auditItems, { label: hasAudit ? 'Volver a evaluar' : 'Simular evaluación', target: 'auditor' }),
    mk(6, 'step_submit', 'Envío oficial', `Se postula en ${r.portal.name}.`, sendItems, { label: 'Abrir expediente', target: 'dossier' })
  ];
  const completed = steps.filter(s => s.done).length;
  const currentStep = steps.find(s => !s.done);
  const firstPending = currentStep?.items.find(i => !i.done);
  return {
    steps,
    completed,
    percentage: Math.round((completed / steps.length) * 100),
    current: currentStep?.number || steps.length,
    nextAction: firstPending ? `${currentStep!.title}: ${firstPending.label}` : 'Postulación lista'
  };
}

// ---------------------------------------------------------------------------
// Preguntas del formulador adaptadas al formulario de cada familia
// (mismas claves internas, distinto enunciado según lo que pide cada fondo)
// ---------------------------------------------------------------------------
type QOverride = { label: string; placeholder?: string; helpText?: string };
export const FAMILY_QUESTIONS: Partial<Record<FundFamily, Partial<Record<FormBlock, Record<string, QOverride>>>>> = {
  sercotec: {
    title_pitch: { projectTitle: { label: '¿Cómo se llama tu negocio y qué vende?', placeholder: 'Ej: Pastelería "Dulce Sur": tortas y kuchenes artesanales a pedido', helpText: 'Un nombre simple y lo que ofreces.' } },
    problem: {
      who: { label: '¿Quiénes son tus clientes? (edad, lugar, tipo de cliente)', placeholder: 'Ej: Familias del sector norte de Temuco y cafeterías del centro' },
      cost: { label: '¿Qué necesidad tienen que tu negocio resuelve?', placeholder: 'Ej: No hay pastelería artesanal a domicilio en el sector' },
      alternatives: { label: '¿Dónde compran hoy y por qué te preferirían?', placeholder: 'Ej: Compran en supermercados; nosotros ofrecemos productos frescos y a pedido' }
    },
    solution: {
      how: { label: '¿Qué ofreces exactamente (productos o servicios)?' },
      tech: { label: '¿Qué te diferencia? (calidad, atención, receta, ubicación…)' },
      noveltyVsCompetitors: { label: '¿Cómo aporta tu negocio a la sustentabilidad (medio ambiente, comunidad, economía local)?', helpText: 'El comité de Sercotec evalúa la orientación sostenible y su coherencia con las inversiones.' }
    },
    market: {
      archetype: { label: '¿Por qué medios llegas a tus clientes? (local, redes sociales, ferias, despacho)' },
      tam: { label: '¿Cómo atiendes y mantienes a tus clientes?', placeholder: 'Ej: WhatsApp para pedidos, tarjeta de fidelización' },
      sam: { label: '¿Cuántos clientes tienes o esperas tener al mes?' },
      som: { label: '¿Cuánto esperas vender al mes después del proyecto?' }
    },
    model: {
      revenue: { label: '¿Cómo ganas dinero? (precios, costos principales y margen)', placeholder: 'Ej: Torta a $18.000; costo de ingredientes $7.000' },
      salesStrategy: { label: '¿Qué recursos clave necesitas? (equipos, local, permisos)' }
    },
    workplan: {
      milestone1: { label: '¿Qué actividades clave harás para que el negocio funcione?', helpText: 'Producción, compras, ventas, permisos.' },
      milestone2: { label: '¿Con quién te vas a aliar? (proveedores, otros negocios, organizaciones)' },
      milestone3: { label: '¿Qué harás con el subsidio en los primeros meses?' }
    },
    team: {
      members: { label: '¿Qué experiencia tienes en este rubro?' },
      dedication: { label: '¿Cuánto tiempo le dedicarás al negocio?' },
      skills: { label: '¿Qué cursos o capacitaciones tienes relacionadas con el negocio?' }
    }
  },
  corfo_emprendimiento: {
    workplan: {
      milestone1: { label: 'Validación técnica: qué probarás, cómo y qué resultado esperas (meses 1 a 3)' },
      milestone2: { label: 'Validación comercial: con qué clientes y cómo medirás el interés (meses 4 a 7)' },
      milestone3: { label: 'Primeras ventas: meta concreta al final del proyecto (meses 8 a 10)' }
    },
    team: { dedication: { label: 'Horas semanales de cada integrante en el proyecto', helpText: 'Corfo evalúa el compromiso del equipo (10%): indica horas reales por persona.' } }
  },
  corfo_innovacion: {
    workplan: {
      milestone1: { label: 'Etapa 1 / primeros meses: actividades de desarrollo, entregable y riesgo' },
      milestone2: { label: 'Etapa 2: validación técnica o pilotaje, entregable y riesgo' },
      milestone3: { label: 'Cierre: validación comercial o implementación productiva, indicador de éxito' }
    },
    team: {
      skills: { label: 'Entidad colaboradora (universidad o centro tecnológico): quién es y qué capacidades aporta', helpText: 'Sus capacidades pesan 20% en la evaluación.' }
    }
  },
  anid: {
    solution: { tech: { label: 'Resultados previos de I+D (TRL 2 cumplido) y estado del arte' } },
    model: {
      revenue: { label: '¿Cómo se transferirán los resultados? (licencia, empresa asociada, uso público)' },
      salesStrategy: { label: 'Mapa de ruta después del proyecto: qué falta para llegar al mercado o a la sociedad' }
    },
    team: { skills: { label: 'Rol de las entidades asociadas (empresas) y su aporte', helpText: 'Las asociadas deben aportar al menos 15% del subsidio en conjunto.' } }
  },
  fia: {
    solution: {
      tech: { label: '¿Cuál es la incertidumbre tecnológica o el desafío de I+D?' },
      noveltyVsCompetitors: { label: '¿Qué tiene de nuevo frente a lo que existe en Chile?' }
    },
    workplan: {
      milestone1: { label: 'Objetivo 1 y diseño experimental (desde TRL 3)' },
      milestone2: { label: 'Objetivo 2: ensayos en condiciones relevantes' },
      milestone3: { label: 'Resultado esperado al final (TRL 5) y cómo se medirá' }
    },
    model: { revenue: { label: '¿Cómo aprovecharán los resultados el postulante o los asociados?' } }
  }
};

export function questionOverride(fund: ChileanFund, block: FormBlock, key: string): QOverride | undefined {
  return FAMILY_QUESTIONS[getFundRules(fund).family]?.[block]?.[key];
}
