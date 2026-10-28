/**
 * Presentación de cada fondo con la voz del consultor: en qué consiste, para quién está pensado,
 * qué financia, cómo se gana y un consejo práctico. Basado en las bases de cada concurso
 * (los datos duros —montos, requisitos, criterios— viven en chileanFunds y fundStandards).
 */
import type { ChileanFund } from '../types/funds';
import { getFundRules } from './fundStandards';

export interface FundIntro {
  /** Una frase que resume el fondo como lo explicaría un consultor */
  hook: string;
  queEs: string;
  paraQuien: string;
  queFinancia: string;
  comoSeGana: string;
  consejo: string;
}

const INTROS: Record<string, FundIntro> = {
  corfo_semilla_inicia: {
    hook: 'El primer empujón de Corfo para pasar de la idea a tus primeras ventas.',
    queEs: 'Es un subsidio de Corfo para emprendimientos innovadores que están partiendo. No es un préstamo ni pide parte de tu empresa: Corfo pone hasta el 75% del proyecto y tú el resto. Se ejecuta en hasta 10 meses de la mano de una entidad patrocinadora (una incubadora o aceleradora), que te acompaña y administra los fondos.',
    paraQuien: 'Personas mayores de 18 años con una idea innovadora, o empresas jóvenes (máximo 18 meses de inicio de actividades) que todavía no venden. Si ya tienes ventas, este no es tu fondo: mira Semilla Expande.',
    queFinancia: 'Validar que tu solución funciona y que alguien la compraría: producto mínimo viable, pruebas con clientes, mentoría, modelo de negocio y marketing inicial.',
    comoSeGana: 'No hay nota de corte: los proyectos se ordenan por nota y se financian hasta que se acaba el presupuesto de la región. Lo que más pesa es la propuesta de valor (25%) y el equipo (30% entre capacidad y compromiso).',
    consejo: 'Elige tu entidad patrocinadora antes de escribir: ellos postulan contigo y conocen bien lo que buscan los evaluadores de tu región. Y muestra evidencia de que el problema existe (conversaciones, encuestas, cartas de interés), no solo la idea.'
  },
  corfo_semilla_expande: {
    hook: 'Para cuando ya vendiste y quieres crecer en serio.',
    queEs: 'Es el subsidio de Corfo para emprendimientos innovadores que ya tienen sus primeras ventas y quieren escalar. Corfo pone hasta el 75% del proyecto, sin pedir participación en tu empresa. Incluye mentoría o aceleración obligatoria.',
    paraQuien: 'Empresas con hasta 36 meses de inicio de actividades, que ya vendieron su producto (al menos $100.000) pero que en total venden menos de $80.000.000 al año.',
    queFinancia: 'Salir a vender más: prospección comercial, marketing, certificaciones, propiedad intelectual, equipo de trabajo y mentoría o aceleración.',
    comoSeGana: 'Se adjudica por ranking. Pesan la innovación (40%), la escalabilidad (30%) y el equipo (30%). Si tienes Sello 40 horas suma una bonificación.',
    consejo: 'Tus ventas son tu mejor argumento: muestra cuánto vendes, a quién y cómo crece. Un plan comercial concreto (a qué clientes vas, con qué canal y cuánto cuesta conseguir cada uno) pesa más que una visión grande.'
  },
  corfo_crea_valida: {
    hook: 'Para empresas establecidas que van a desarrollar algo nuevo con I+D.',
    queEs: 'Es el instrumento de Corfo para proyectos de investigación y desarrollo: crear un producto, proceso o servicio nuevo (o muy mejorado) desde un prototipo hasta validarlo a escala. Tiene dos etapas obligatorias: CREA (desarrollo) y VALIDA (validación productiva o comercial).',
    paraQuien: 'Empresas con al menos 24 meses de inicio de actividades y ventas en los últimos 2 años, que tienen un desafío técnico real que resolver. Se puede postular sola o en colaboración con universidades o centros de I+D.',
    queFinancia: 'Las actividades de I+D, prototipos, pruebas, equipo técnico, entidades de investigación y la validación a escala. Corfo cubre hasta 80% si eres micro o pequeña empresa.',
    comoSeGana: 'Necesitas al menos 3,0 en cada subcriterio y 3,5 de nota final. La metodología (20%) y las capacidades del equipo y socios (20%) son lo que más pesa. Mientras más del costo vaya a I+D (30% o más), mejor nota.',
    consejo: 'Primero hay que enviar el Perfil de Proyecto dentro del plazo: sin eso no puedes postular. Y explica con claridad cuál es la incertidumbre técnica: si la solución ya existe y solo hay que comprarla, no es I+D.'
  },
  corfo_sumate_innovar: {
    hook: 'Tu primera experiencia innovando, con una universidad o empresa experta a tu lado.',
    queEs: 'Es un subsidio de Corfo para empresas que nunca han innovado. Financia contratar a una universidad, centro de investigación o empresa tecnológica para que te ayude a resolver un problema concreto de productividad o competitividad. Dura hasta 6 meses.',
    paraQuien: 'Personas naturales o empresas con al menos 24 meses de inicio de actividades y ventas, que no hayan recibido un proyecto de innovación de Corfo en los últimos 5 años.',
    queFinancia: 'Solo la contratación de 1 o 2 entidades colaboradoras expertas que diseñan y prueban la solución contigo.',
    comoSeGana: 'Necesitas al menos 3,0 en cada criterio. Pesan mucho la metodología (20%) y la capacidad de la entidad que contrates (20%).',
    consejo: 'La elección de la entidad colaboradora es la mitad de la postulación: busca una con experiencia demostrable en tu problema y pídele su propuesta técnica antes de escribir.'
  },
  startup_chile_build: {
    hook: 'Pre-aceleración para startups tecnológicas que recién parten.',
    queEs: 'Es un programa de Start-Up Chile (Corfo) de 4 meses que te entrega $15.000.000 sin pedirte participación en tu empresa, más acompañamiento y red de contactos para avanzar de idea validada a prototipo.',
    paraQuien: 'Emprendimientos de base tecnológica en etapa temprana, con potencial global, de personas chilenas o extranjeras. Al menos la mitad de los seleccionados son liderados por mujeres.',
    queFinancia: 'El desarrollo del prototipo, la validación con clientes y la operación del equipo durante el programa. Corfo cubre el 90% y el equipo el 10%.',
    comoSeGana: 'Se evalúan por igual la base tecnológica, la innovación, la escalabilidad y el impacto. No hay nota de corte publicada.',
    consejo: 'Muestra por qué tu equipo puede construir la tecnología y por qué el mercado es más grande que Chile. Un video corto y claro del equipo ayuda mucho.'
  },
  startup_chile_ignite: {
    hook: 'Aceleración para startups tecnológicas con producto funcionando.',
    queEs: 'Es el programa de aceleración de Start-Up Chile: 4 meses de aceleración con $30.000.000 sin cesión de participación, mentorías, espacio de trabajo y red internacional. Puede extenderse con $20.000.000 más.',
    paraQuien: 'Startups de base tecnológica que ya tienen un producto funcional (MVP) y primeros clientes, y buscan encajar con su mercado. Abierto a fundadores chilenos y extranjeros.',
    queFinancia: 'Crecimiento del producto y del negocio: desarrollo, ventas, marketing y equipo. Corfo cubre el 80% (90% si la líder es mujer).',
    comoSeGana: 'Se evalúan por igual base tecnológica, innovación, escalabilidad e impacto. Compites con startups de todo el mundo.',
    consejo: 'Lleva métricas: usuarios, ventas, retención o pilotos. Lo que diferencia a un ganador es la tracción demostrable y un equipo dedicado al proyecto en Chile.'
  },
  sercotec_semilla_emprende: {
    hook: 'Para dar el paso de la idea a tu propio negocio formal.',
    queEs: 'Es un subsidio de Sercotec de $3.500.000 para personas que quieren empezar un negocio. No se devuelve: solo aportas el 3% en efectivo. Te ayuda con asesorías y capacitación, y sobre todo con inversiones para partir.',
    paraQuien: 'Personas mayores de 18 años, chilenas o extranjeras, que todavía no tienen inicio de actividades en primera categoría y no han ganado Capital Semilla, Abeja o Pioneras entre 2023 y 2026.',
    queFinancia: 'Entre $200.000 y $500.000 en asesoría o capacitación, y hasta $3.300.000 en máquinas, equipos, habilitación del local, marketing y capital de trabajo.',
    comoSeGana: 'Primero un test de preselección, luego el formulario y un video de 90 segundos (20% de la nota), una visita a terreno (30%) y una presentación ante el comité regional (50%). Cada región fija su nota de corte.',
    consejo: 'El comité regional vale la mitad: practica tu presentación de 5 minutos. Y cuida que las inversiones que pides tengan relación directa con el negocio y con su orientación sostenible (pesa 30%).'
  },
  sercotec_modo_empleo: {
    hook: 'Para quienes están sin trabajo y quieren crear su propio negocio.',
    queEs: 'Es un subsidio de Sercotec de $3.000.000 para personas desempleadas que quieren empezar un negocio formal. No se devuelve: solo aportas el 3% en efectivo, y recibes acompañamiento y capacitación.',
    paraQuien: 'Personas mayores de 18 años sin inicio de actividades en primera categoría y sin cotizaciones previsionales en los últimos 6 meses. Prioriza a jóvenes de 18 a 29 años, mujeres de 30 a 54 años y personas de 55 años o más.',
    queFinancia: 'Entre $200.000 y $500.000 en asesoría, capacitación o marketing, y hasta $2.800.000 en máquinas, equipos, habilitación del lugar y capital de trabajo.',
    comoSeGana: 'Primero un test de preselección, luego el formulario y un video de 90 segundos (20% de la nota), una visita a terreno (30%) y el comité regional (50%). En el comité lo que más pesa es que demuestres que conoces tu negocio (40%).',
    consejo: 'Ten listo tu certificado de cotizaciones de la AFP: es lo que acredita que estás sin trabajo. Y practica tu presentación: el comité regional vale la mitad de la nota.'
  },
  sercotec_abeja_emprende: {
    hook: 'Capital para que las mujeres partan su propio negocio.',
    queEs: 'Es la versión de Capital Semilla exclusiva para mujeres: $3.500.000 de Sercotec, con un aporte tuyo de solo 3%, para iniciar un negocio.',
    paraQuien: 'Mujeres mayores de 18 años sin empresa formalizada ni inicio de actividades en primera categoría, que no hayan ganado Capital Semilla, Abeja o Pioneras entre 2023 y 2026.',
    queFinancia: 'Entre $200.000 y $500.000 en asesoría o capacitación, y hasta $3.300.000 en equipos, habilitación, marketing y capital de trabajo.',
    comoSeGana: 'Igual que Capital Semilla: formulario y video (20%), visita a terreno (30%) y comité regional (50%). El comité prioriza algunas comunas y a participantes de programas de SernamEG.',
    consejo: 'Cuenta tu historia y tu experiencia en el rubro: las capacidades de la emprendedora pesan 15%. Llega a la visita a terreno con el lugar y las cotizaciones listas.'
  },
  sercotec_crece: {
    hook: 'Para que tu pyme en marcha dé el siguiente salto.',
    queEs: 'Es un subsidio de Sercotec de $5.000.000 para micro y pequeñas empresas que ya funcionan y quieren crecer. Aportas el 15% del subsidio.',
    paraQuien: 'Empresas o personas con inicio de actividades en primera categoría y ventas anuales entre 200 UF y 25.000 UF, que no hayan ganado Crece en 2024 a 2026.',
    queFinancia: 'Hasta $1.000.000 en asesoría o capacitación, y el resto en inversiones: equipos, habilitación, marketing y capital de trabajo.',
    comoSeGana: 'Formulario y video (20%), visita a terreno (30%) y comité regional (50%). El potencial del proyecto de negocio es lo que más pesa (40%).',
    consejo: 'Muestra con números cómo la inversión hará crecer tus ventas o tu productividad. Tus F29 son la prueba de dónde partes: tenlos a mano.'
  },
  anid_fondef_idea: {
    hook: 'Investigación aplicada de universidades, con tu empresa como socia.',
    queEs: 'Es un concurso de ANID que financia proyectos de investigación aplicada de universidades y centros de I+D. Tu empresa no recibe el subsidio directamente: participa como asociada, aporta y luego aprovecha los resultados.',
    paraQuien: 'Universidades o centros de I+D que postulan, junto a 1 a 3 empresas asociadas interesadas en usar los resultados. Requiere resultados previos de investigación.',
    queFinancia: 'Hasta $227.700.000 en 24 meses para el trabajo de investigación, pruebas y transferencia. La institución aporta al menos 30% y las empresas al menos 15% del subsidio.',
    comoSeGana: 'Cada capítulo (relevancia del problema y plan de trabajo) debe sacar al menos 3, igual que el promedio final.',
    consejo: 'Si eres empresa, el camino es encontrar a un grupo de investigación que trabaje en tu problema y sumarte como asociada. Tu carta de compromiso y tu aporte pesan en la evaluación.'
  },
  corfo_innova_region: {
    hook: 'El fondo de Corfo para innovar en tu región, con foco en lo que la región necesita.',
    queEs: 'Es un subsidio de Corfo de hasta $60.000.000 para desarrollar un producto o proceso nuevo o mejorado, desde el prototipo hasta validarlo en terreno o con clientes. Lo abre cada región por separado y cada una define sus focos (por ejemplo minería, turismo, agua o alimentos). No se devuelve ni pide parte de tu empresa.',
    paraQuien: 'Empresas o personas con al menos 18 meses de inicio de actividades en primera categoría y ventas en los últimos 18 meses, con domicilio en la región de la convocatoria. Tu solución ya tiene que haber pasado la prueba de concepto.',
    queFinancia: 'Prototipos, pruebas y validación, entidades colaboradoras (universidades o centros tecnológicos), equipos (hasta 30% del subsidio), propiedad intelectual, certificaciones y el equipo del proyecto. Corfo cubre hasta 80% si eres micro o pequeña empresa.',
    comoSeGana: 'Lo que más pesa es la metodología (20%), qué tan nueva es tu solución (20%), el impacto (15%) y el equipo (15%). Necesitas al menos 3,0 en cada criterio y después se ordena por nota hasta agotar el presupuesto de la región.',
    consejo: 'Antes de escribir, lee la resolución de focos de tu región: un proyecto fuera de foco no pasa aunque sea bueno. Y muestra que ya tienes una prueba de concepto (fotos, resultados de pruebas, un cliente que lo probó).'
  },
  corfo_consolida_expande: {
    hook: 'Para cuando tu innovación ya funciona y quieres llevarla a más mercados.',
    queEs: 'Es un subsidio de Corfo de hasta $150.000.000 para escalar un producto, servicio o proceso innovador que ya validaste: crecer en Chile o salir al extranjero. Es el paso siguiente a Crea y Valida.',
    paraQuien: 'Empresas o personas con al menos 18 meses de inicio de actividades en primera categoría y ventas en los últimos 18 meses, con una innovación que requirió I+D y ya está validada técnica o comercialmente.',
    queFinancia: 'Escalamiento comercial o productivo, validación y adaptación en los mercados de destino, marketing internacional, certificaciones y el equipo. Corfo cubre hasta 60% si eres micro o pequeña empresa (más 10% si la lidera una mujer).',
    comoSeGana: 'El problema u oportunidad pesa 30% y la solución, con tu plan de negocios y las capacidades del equipo, 70%. Se postula con un plan de negocios y tiene un hito de continuidad al mes 3.',
    consejo: 'Este fondo no es para seguir desarrollando: si tu producto todavía no está validado, mira Crea y Valida o Innova Región. Llega con evidencia de validación (ventas, pilotos, certificaciones) y un plan de negocios con números.'
  },
  startup_chile_growth: {
    hook: 'Para startups tecnológicas que ya venden y quieren crecer rápido desde Chile.',
    queEs: 'Es la línea de Start-Up Chile para startups consolidadas: hasta $75.000.000 sin ceder participación, con mentorías, preparación para levantar capital y redes para expandirse.',
    paraQuien: 'Empresas tecnológicas constituidas en Chile, con al menos 24 meses de actividad y ventas entre $80.000.000 y $800.000.000 en los últimos 12 meses. El líder del equipo trabaja a tiempo completo desde Chile.',
    queFinancia: 'Contrataciones, expansión comercial, desarrollo de producto y levantamiento de capital. Corfo cubre 50% (60% si la líder es mujer) y la empresa pone el resto en dinero.',
    comoSeGana: 'Se evalúan el equipo, la tracción, el potencial de crecer fuera de Chile y el impacto en el país. Se seleccionan pocos proyectos por generación.',
    consejo: 'Tus números son tu mejor argumento: ventas mes a mes, crecimiento, clientes y retención. Y ten claro cuánto vas a aportar en dinero, porque es la mitad del proyecto.'
  },
  sercotec_digitaliza_almacen: {
    hook: 'Para modernizar el almacén del barrio y vender más.',
    queEs: 'Es un subsidio de Sercotec de hasta $3.000.000 netos para almacenes y negocios de barrio: tecnología para vender y controlar el inventario, equipos y un poco de asesoría. No se devuelve.',
    paraQuien: 'Almacenes, minimarkets, panaderías, carnicerías, rotiserías, botillerías y bazares con inicio de actividades en primera categoría, más de 12 meses funcionando y ventas de hasta 5.000 UF al año.',
    queFinancia: 'Entre $2.500.000 y $2.800.000 en inversiones (caja y sistema de ventas, control de inventario, balanzas, vitrinas, iluminación LED, generador) y entre $200.000 y $500.000 en asesoría, capacitación o marketing. El aporte lo fija cada región (máximo 20%) y el IVA lo pagas tú.',
    comoSeGana: 'Primero se revisa que cumplas y se pone nota al formulario. Después vienen una visita a tu almacén (40%) y el comité regional (60%).',
    consejo: 'Explica con ejemplos del día a día qué vas a mejorar: "perdemos mercadería porque no sabemos qué vence" o "la fila es larga porque cobramos a mano". Y cuenta cuánto esperas vender más con lo que vas a comprar.'
  },
  fia_innovacion_agro: {
    hook: 'Innovación para el campo, los alimentos y lo forestal.',
    queEs: 'Es un concurso de la Fundación para la Innovación Agraria (FIA) que cofinancia el desarrollo y la validación de tecnologías para el sector silvoagropecuario y agroalimentario. FIA pone hasta 80% del proyecto, con un máximo de $50.000.000.',
    paraQuien: 'Micro, pequeñas o medianas empresas del sector agro, alimentos o forestal (ventas de hasta 50.000 UF), con una prueba de concepto ya validada.',
    queFinancia: 'Llevar tu tecnología de prueba de concepto a validación en un entorno real: ensayos, equipos, asesoría experta y equipo técnico.',
    comoSeGana: 'Nota mínima 3,0. La mitad la pone la evaluación técnica y la otra mitad un comité estratégico. Pesan mucho el mérito innovador y el impacto competitivo (20% cada uno).',
    consejo: 'Conecta tu proyecto con uno de los lineamientos de FIA (agua, sanidad, recursos forestales o mercados) y prepara bien el pitch de 5 minutos de la admisión.'
  }
};

const BENEF_TEXT: Record<string, string> = {
  sin_iniciar: 'personas sin inicio de actividades',
  persona_natural: 'personas naturales con giro',
  spa: 'empresas'
};

/** Presentación del fondo; si no tenemos una escrita a mano, se arma con sus datos y bases. */
export function getFundIntro(fund: ChileanFund): FundIntro {
  const known = INTROS[fund.id];
  if (known) return known;
  const r = getFundRules(fund);
  const quien = Array.from(new Set(fund.beneficiaryTypes.map(t => BENEF_TEXT[t] || 'empresas'))).join(' y ');
  return {
    hook: fund.summary || `Convocatoria de ${fund.agency}.`,
    queEs: fund.description || fund.summary,
    paraQuien: fund.salesRequirement || `Pensado para ${quien}.`,
    queFinancia: fund.eligibleExpenses?.length ? `Entre otras cosas: ${fund.eligibleExpenses.slice(0, 4).join(', ').toLowerCase()}.` : r.coFinance.text,
    comoSeGana: r.evaluation.rule,
    consejo: 'Lee las bases de esta convocatoria con calma (el enlace está más abajo) y confirma cada requisito antes de escribir. Si tienes dudas, pregúntale al Asesor de la postulación.'
  };
}
