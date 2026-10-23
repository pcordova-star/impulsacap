/**
 * Proyectos ganadores de CORFO Semilla Inicia (2020–2025) informados públicamente
 * (listados de Corfo y comités regionales, y prensa regional). Es una MUESTRA: no es la lista
 * completa de ganadores y la cobertura es dispareja entre años (2025 incluye la generación Inicia Mujeres).
 * Sirve para inspirar y dar ejemplos; no para calcular tasas de éxito.
 */
export type WinnerSector =
  | 'software_ia' | 'sustentabilidad' | 'energia' | 'mascotas' | 'salud' | 'educacion' | 'mineria'
  | 'agro_acuicultura' | 'alimentos' | 'turismo' | 'moda_diseno' | 'construccion' | 'seguridad'
  | 'finanzas' | 'social' | 'servicios';

export const SECTOR_LABEL: Record<WinnerSector, string> = {
  software_ia: 'Software e IA', sustentabilidad: 'Sustentabilidad y economía circular', energia: 'Energía',
  mascotas: 'Mascotas', salud: 'Salud', educacion: 'Educación', mineria: 'Minería', agro_acuicultura: 'Agro y acuicultura',
  alimentos: 'Alimentos', turismo: 'Turismo', moda_diseno: 'Moda y diseño', construccion: 'Construcción',
  seguridad: 'Seguridad', finanzas: 'Finanzas y gestión', social: 'Impacto social', servicios: 'Servicios'
};

export interface SemillaWinner { year: number; name: string; region: string; idea: string | null; sectors: WinnerSector[]; mujeres?: boolean }

type Row = [number, string, string, string | null, WinnerSector[], boolean?];
const ROWS: Row[] = [
  [2020, 'Cyclico', 'Metropolitana', 'Reutiliza aluminio y latas de bebida para fabricar cubiertos y utensilios ecológicos.', ['sustentabilidad']],
  [2020, 'Liberty (luego Seifrei)', 'Antofagasta', 'App que conecta clientes con personas que ofrecen lavado y planchado de ropa a domicilio.', ['software_ia', 'servicios']],
  [2021, 'Conectatas', 'Metropolitana', 'Plataforma que conecta oferentes de servicios de salud para el cuidado de adultos mayores.', ['salud', 'software_ia', 'social']],
  [2021, 'EducLine', 'Biobío', 'Plataforma que digitaliza y automatiza materiales y gestión administrativa docente.', ['educacion', 'software_ia']],
  [2021, 'Evaluación de eficacia de nutrición en salmónidos', 'Aysén', 'Servicio para medir si los nutrientes del alimento son asimilados por los peces.', ['agro_acuicultura']],
  [2021, 'Lago Copa Travels', 'Aysén', 'Programa turístico que combina yoga y pesca con mosca en la Patagonia.', ['turismo']],
  [2021, 'Happy Patagonia', 'Aysén', 'Juguetes y mobiliario infantil de maderas nobles, inspirado en Montessori.', ['moda_diseno', 'educacion']],
  [2021, 'AeroBQZ y Asociados', 'Aysén', 'Arquitectura e ingeniería con drones y tecnología RTK para levantamientos BIM.', ['construccion', 'software_ia']],
  [2021, 'Berrybees', 'Aysén', 'Suplemento natural con berries nativos (calafate) y propóleo para el sistema inmune.', ['alimentos', 'salud']],
  [2021, 'Barbucho', 'Aysén', 'Snack saludable para mascotas con ingredientes naturales y funcionales de la región.', ['mascotas', 'alimentos']],
  [2021, 'Monumento a la Patagonia', 'Aysén', 'Hito turístico de letras gigantes hechas con corrales ovejeros y bosque nativo.', ['turismo']],
  [2021, 'Ecodetergentes', 'Aysén', 'Detergentes biodegradables elaborados con aceite de cocina usado.', ['sustentabilidad']],
  [2021, 'ItSave', 'Antofagasta', 'Plataforma que organiza las finanzas y el flujo de caja de micro y pequeños empresarios.', ['finanzas', 'software_ia']],
  [2021, 'Descon', 'Antofagasta', 'Red de puntos de carga para vehículos de micromovilidad eléctrica.', ['energia', 'sustentabilidad']],
  [2022, 'Femsafe', 'Biobío', 'App de seguridad que envía alertas de emergencia y registra datos biométricos ante riesgo en la vía pública.', ['seguridad', 'software_ia']],
  [2023, 'Visual Solution', 'Aysén', 'Software con IA que predice y personaliza contenido de campañas publicitarias.', ['software_ia']],
  [2023, 'H2 Energy Clean Patagonia', 'Aysén', 'Estufa que genera hidrógeno verde con agua y energía solar para calefacción.', ['energia', 'sustentabilidad']],
  [2023, 'Micro-Refugios Eco-Sostenibles', 'Aysén', 'Red de refugios ecosostenibles para lugares remotos, con energía autónoma.', ['turismo', 'sustentabilidad']],
  [2023, 'Pellet Chile Chico', 'Aysén', 'Pellets de biomasa hechos con desechos de podas de cerezos, para calefacción.', ['energia', 'sustentabilidad']],
  [2023, 'Nalkay Sustainable Clothing', 'Aysén', 'Ropa deportiva de mujer con telas biodegradables y materiales reciclados.', ['moda_diseno', 'sustentabilidad']],
  [2023, 'Biomedicina Fúngica', 'Aysén', 'Laboratorio de extractos funcionales a partir del cultivo y recolección de hongos.', ['salud', 'alimentos']],
  [2023, 'Trafficgo', 'Valparaíso', 'Inteligencia artificial aplicada a la seguridad vial.', ['software_ia', 'seguridad']],
  [2023, 'Swapp', 'Valparaíso', null, []],
  [2023, 'Pet SDI', 'Valparaíso', 'Proyecto del ámbito de mascotas.', ['mascotas']],
  [2023, 'Veter Chile', 'Valparaíso', 'Proyecto del ámbito veterinario.', ['mascotas']],
  [2023, 'Abcv.Health', 'Valparaíso', 'Proyecto del ámbito de la salud.', ['salud']],
  [2023, 'Llatraza', 'Valparaíso', null, []],
  [2023, 'Smart Reactor', 'Valparaíso', 'Proyecto tecnológico.', ['software_ia']],
  [2023, 'Investfinder', 'Valparaíso', 'Proyecto del ámbito de inversiones.', ['finanzas']],
  [2023, 'Mi Ruta Escolar', 'Valparaíso', 'Proyecto vinculado al transporte escolar.', ['educacion', 'servicios']],
  [2023, 'Ecobloques Chile', 'Valparaíso', 'Bloques constructivos ecológicos.', ['construccion', 'sustentabilidad']],
  [2023, 'Fitvigor', 'Valparaíso', 'Pasaporte digital orientado al fitness y bienestar físico.', ['salud', 'software_ia']],
  [2023, 'Control de gastos de servicios externos', 'Valparaíso', 'Herramienta para controlar y gestionar gastos de servicios externos.', ['finanzas', 'software_ia']],
  [2023, 'Agenda Receptor Judicial app', 'Valparaíso', 'Aplicación de agenda para receptores judiciales.', ['software_ia', 'servicios']],
  [2023, 'Bowtiepro', 'Valparaíso', null, []],
  [2023, 'Impacta Tech', 'Nacional', 'Legal tech de registro de marca y gestión de contratos en CRM.', ['software_ia', 'servicios']],
  [2024, 'Futuramind', "O'Higgins", 'Inteligencia artificial aplicada a soporte técnico y servicio de postventa.', ['software_ia']],
  [2024, 'Minevision-AI', "O'Higgins", 'Monitoreo de equipos mineros mediante visión artificial.', ['mineria', 'software_ia']],
  [2024, 'Apps educativas de realidad aumentada', "O'Higgins", 'Aplicaciones educativas basadas en realidad aumentada.', ['educacion', 'software_ia']],
  [2024, 'Eco Guitarra', "O'Higgins", 'Fabricación de guitarras con enfoque ecológico y sustentable.', ['moda_diseno', 'sustentabilidad']],
  [2024, 'Timberbiz', "O'Higgins", 'Herramienta digital para la gestión forestal en terreno.', ['agro_acuicultura', 'software_ia']],
  [2024, 'Tejear', "O'Higgins", 'Prendas de vestir con enfoque de impacto social.', ['moda_diseno', 'social']],
  [2024, 'Guardián 360', "O'Higgins", 'Sistema de control de seguridad en tiempo real.', ['seguridad', 'software_ia']],
  [2024, 'Centro de Capacitación Imperio Seguridad', 'Tarapacá', 'Centro de capacitación en el área de seguridad.', ['educacion', 'seguridad']],
  [2024, 'Proyecto ICL', 'Tarapacá', 'Servicio de asesorías empresariales y representaciones.', ['servicios']],
  [2024, 'Biot', 'Tarapacá', 'Inteligencia de datos aplicada a procesos de inspección.', ['software_ia']],
  [2024, 'Infinite Fog', 'Tarapacá', 'Sistema no convencional de captación de agua desde la niebla costera.', ['sustentabilidad']],
  [2024, 'Paneles vegetales acústicos', 'Tarapacá', 'Paneles vegetales para acondicionamiento acústico de espacios.', ['construccion', 'sustentabilidad']],
  [2024, 'Mipymes y Mujeres Cuidadoras', 'Tarapacá', 'Plataforma de empleo que conecta mipymes con mujeres cuidadoras.', ['social', 'software_ia']],
  [2024, 'Notariax', 'Tarapacá', 'Servicio digital vinculado a trámites notariales.', ['software_ia', 'servicios']],
  [2024, 'App Infantia', 'Tarapacá', 'Aplicación para el cuidado y desarrollo de la primera infancia.', ['educacion', 'software_ia']],
  [2025, 'Huiroterra', 'Arica y Parinacota', 'Biofertilizante ecológico elaborado a partir de algas.', ['agro_acuicultura', 'sustentabilidad']],
  [2025, 'Ukiri eco-creaciones', 'Tarapacá', 'Creaciones sostenibles y personalizadas con enfoque ecológico.', ['moda_diseno', 'sustentabilidad']],
  [2025, 'Terra Risk Sentinel', 'Antofagasta', 'Monitoreo satelital y reportes colaborativos para anticipar riesgos en faenas mineras.', ['mineria', 'software_ia', 'seguridad']],
  [2025, 'Climaire', 'Antofagasta', null, [], true],
  [2025, 'Ciencia circular', 'Antofagasta', 'Reciclaje y economía circular aplicada a paneles solares en desuso.', ['sustentabilidad', 'energia']],
  [2025, 'Neuro minería', 'Atacama', null, ['mineria'], true],
  [2025, 'QRGO', 'Atacama', null, [], true],
  [2025, 'VIOBACT', 'Coquimbo', 'Probióticos naturales aplicados a la acuicultura.', ['agro_acuicultura']],
  [2025, 'MedConsult', 'Valparaíso', null, ['salud'], true],
  [2025, 'MicroMareas', 'Valparaíso', null, [], true],
  [2025, 'OroVerde Minería Urbana', 'Valparaíso', 'Minería urbana sin contaminantes para recuperar metales.', ['mineria', 'sustentabilidad']],
  [2025, 'Impulso Laboral Mujer', 'Valparaíso', 'Plataforma de impulso laboral orientada a mujeres.', ['social', 'software_ia']],
  [2025, 'Sanapet', 'Valparaíso', 'Producto sanador y protector de la salud bucal de mascotas.', ['mascotas']],
  [2025, 'Academia de Pianistas Beethoven', 'Valparaíso', 'Academia de formación musical especializada en piano.', ['educacion']],
  [2025, 'APP Conectemos', 'Valparaíso', 'Aplicación para conectar personas.', ['software_ia', 'social']],
  [2025, 'Dermocosmético de Ganoderma', 'Valparaíso', 'Dermocosmético elaborado con polisacáridos del hongo Ganoderma.', ['salud']],
  [2025, 'AMA a MAR', 'Valparaíso', 'Proyecto de protección medioambiental marina.', ['sustentabilidad']],
  [2025, 'Irisfera', 'Valparaíso', null, [], true],
  [2025, 'Q-far', 'Valparaíso', 'Innovación en tratamientos farmacológicos.', ['salud']],
  [2025, 'Reconstrucción de biodiversidad e impacto minero', 'Metropolitana', 'Reconstrucción de biodiversidad afectada por la actividad minera.', ['mineria', 'sustentabilidad']],
  [2025, 'Tommi.Ai', 'Metropolitana', null, ['software_ia'], true],
  [2025, 'Matematiza', 'Metropolitana', 'Herramienta educativa para la enseñanza de matemáticas.', ['educacion', 'software_ia']],
  [2025, 'blokka', 'Metropolitana', null, [], true],
  [2025, 'TRASFECAN', 'Metropolitana', 'Tratamiento veterinario mediante trasplante de microbiota fecal en perros.', ['mascotas', 'salud']],
  [2025, 'PrensaGo', 'Metropolitana', 'Plataforma de periodismo accesible.', ['software_ia', 'social']],
  [2025, 'Neomilk', 'Metropolitana', null, [], true],
  [2025, 'b2match', 'Metropolitana', null, [], true],
  [2025, 'PRS Reportería en Sostenibilidad', 'Metropolitana', 'Plataforma para la reportería de sostenibilidad empresarial.', ['software_ia', 'sustentabilidad']],
  [2025, 'Plataforma sobreproductores', 'Metropolitana', 'Plataforma orientada a productores.', ['software_ia', 'agro_acuicultura']],
  [2025, 'Voltsense', 'Metropolitana', null, ['energia'], true],
  [2025, 'Transparent Mental Health', 'Metropolitana', 'Plataforma orientada a la salud mental.', ['salud', 'software_ia']],
  [2025, 'Waslaa', 'Metropolitana', null, [], true],
  [2025, 'Wine Track Ordinals', 'Metropolitana', 'Trazabilidad de vinos mediante tecnología blockchain.', ['software_ia', 'alimentos']],
  [2025, 'BioMap', 'Metropolitana', 'Mapeo inteligente de zonas con contaminación.', ['sustentabilidad', 'software_ia']],
  [2025, 'Nico.AI', 'Metropolitana', 'Herramienta de inteligencia artificial para comunicación y gestión eficiente.', ['software_ia']],
  [2025, 'Teal Shot', 'Metropolitana', 'Test genético prenatal de precisión.', ['salud']],
  [2025, 'Nanotecnología para captura de CO2', 'Metropolitana', 'Solución de nanotecnología para capturar CO2.', ['sustentabilidad']],
  [2025, 'MediTrack', 'Metropolitana', null, ['salud'], true],
  [2025, 'Eliminación de pelos y alérgenos de mascotas', 'Metropolitana', 'Solución para eliminar pelos y alérgenos de mascotas en el hogar.', ['mascotas']],
  [2025, 'RConn3ct', 'Metropolitana', null, [], true],
  [2025, 'TutorIA', 'Metropolitana', 'Tutoría educativa basada en inteligencia artificial.', ['educacion', 'software_ia']],
  [2025, 'Reboot Studio', "O'Higgins", null, [], true],
  [2025, 'TAX-AI', 'Maule', 'Inteligencia artificial aplicada a materias tributarias.', ['software_ia', 'finanzas']],
  [2025, 'LabRegen', 'Maule', 'Plataforma de agroforestería regenerativa.', ['agro_acuicultura', 'sustentabilidad']],
  [2025, 'Fito Luminaria', 'Ñuble', null, [], true],
  [2025, 'GreenMyc', 'Ñuble', 'Fungicida sostenible para uso agrícola.', ['agro_acuicultura', 'sustentabilidad']],
  [2025, 'Pexxam', 'Biobío', 'Plataforma para comparar y reservar exámenes médicos.', ['salud', 'software_ia']],
  [2025, 'Oportunidad Pública', 'Biobío', 'Herramienta que simplifica la postulación a oportunidades públicas.', ['software_ia', 'servicios']],
  [2025, 'Elutron', 'Biobío', 'Robot automatizado aplicado a medicina nuclear.', ['salud']],
  [2025, 'Notia', 'Biobío', 'Sistema de gestión de emergencias en establecimientos escolares.', ['seguridad', 'educacion', 'software_ia']],
  [2025, 'BOTEA', 'Biobío', 'Tecnología asistida para personas con Trastorno del Espectro Autista.', ['salud', 'social']],
  [2025, 'NeuroDolia', 'Biobío', null, [], true],
  [2025, 'Modutex', 'Biobío', 'Diseños y soluciones textiles sostenibles.', ['moda_diseno', 'sustentabilidad']],
  [2025, 'Neblina', 'Biobío', 'Captador hídrico de partículas suspendidas (niebla).', ['sustentabilidad']],
  [2025, 'InstanTé', 'La Araucanía', 'Mix de hierbas en polvo de preparación instantánea.', ['alimentos']],
  [2025, 'Nativa', 'La Araucanía', 'Sidra espumante premium de elaboración regional.', ['alimentos']],
  [2025, 'SOHE BIMHub', 'Los Ríos', 'Plataforma de integración BIM para proyectos de construcción.', ['construccion', 'software_ia']],
  [2025, 'Simulación clínica gineco-obstétrica', 'Los Ríos', 'Software de simulación clínica para formación gineco-obstétrica.', ['salud', 'educacion', 'software_ia']],
  [2025, 'Coddy', 'Los Ríos', 'Automatización de despachos mediante inteligencia artificial.', ['software_ia', 'servicios']],
  [2025, 'Legado Vivo', 'Los Ríos', 'Plataforma orientada al bienestar personal.', ['salud', 'software_ia']],
  [2025, 'Plataforma de datos de trazabilidad', 'Los Lagos', 'Plataforma de acceso a datos de trazabilidad.', ['software_ia']],
  [2025, 'Pintapá', 'Aysén', 'Kit terapéutico orientado a familias neurodiversas.', ['salud', 'social']],
  [2025, 'koster', 'Magallanes', 'Alimentación natural para perros y gatos.', ['mascotas', 'alimentos']],
  [2025, 'ComandaPro', 'Antofagasta', 'Software de gestión para bares y restaurantes: pedidos, pago y cierre de cuentas.', ['software_ia', 'servicios']]
];

export const SEMILLA_WINNERS: SemillaWinner[] = ROWS.map(([year, name, region, idea, sectors, mujeres]) => ({ year, name, region, idea, sectors, mujeres: Boolean(mujeres) }));

export const WINNERS_SOURCE_NOTE = 'Muestra de ganadores informados públicamente entre 2020 y 2025 (listados de Corfo y comités regionales, y prensa regional). No es la lista completa: sirve como ejemplo, no como estadística.';

/** Palabras que delatan el rubro de un proyecto (para comparar con lo que cuenta la empresa) */
const SECTOR_WORDS: Record<WinnerSector, RegExp> = {
  software_ia: /\b(software|app|aplicaci|plataforma|digital|ia\b|inteligencia artificial|datos|saas|web|algoritm|automatiz|blockchain)/,
  sustentabilidad: /(sustentab|sostenib|recicl|circular|residuo|ecol[oó]gic|biodegrad|medioambient|contamina|co2|carbono|agua|huella)/,
  energia: /(energ[ií]a|solar|hidr[oó]geno|el[eé]ctric|bater[ií]a|biomasa|calefacci)/,
  mascotas: /(mascota|perro|gato|veterinari|canin|felin)/,
  salud: /(salud|m[eé]dic|cl[ií]nic|paciente|bienestar|terap|farmac|hospital|mental|enfermer)/,
  educacion: /(educa|escuel|colegio|estudiante|docente|ense[nñ]anza|aprendiz|capacitaci|curso|tutor)/,
  mineria: /(miner|faena|metal|cobre|litio)/,
  agro_acuicultura: /(agr[ií]col|agro|cultivo|riego|forestal|salm[oó]n|acuicul|pesca|fertiliz|campo|vi[nñ]a|fruta)/,
  alimentos: /(aliment|comida|snack|bebida|gastronom|restaur|cocina|nutrici|suplement)/,
  turismo: /(turis|hotel|viaje|refugio|patagoni|experiencia)/,
  moda_diseno: /(ropa|moda|textil|prenda|dise[nñ]o|mueble|artesan)/,
  construccion: /(construcci|arquitect|vivienda|bim|edific|inmobiliari)/,
  seguridad: /(seguridad|emergencia|alerta|vigilancia|riesgo)/,
  finanzas: /(finanz|contab|tributari|inversi|pago|cr[eé]dito|gasto|flujo de caja)/,
  social: /(social|inclusi|mujer|comunidad|adulto mayor|discapacidad|vulnerable|empleo)/,
  servicios: /(servicio|asesor|consultor|gesti[oó]n|tr[aá]mite|log[ií]stic|despacho)/
};

export function sectorsOfText(text: string): WinnerSector[] {
  const t = String(text || '').toLowerCase();
  return (Object.keys(SECTOR_WORDS) as WinnerSector[]).filter(s => SECTOR_WORDS[s].test(t));
}

const normRegion = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/region( de| del)?/g, '').replace(/[^a-z ]/g, ' ').trim();

/** Ganadores parecidos al proyecto: mismo rubro primero; a igualdad, de la misma región y más recientes */
export function similarWinners(projectText: string, region: string | undefined, limit = 5) {
  const mine = sectorsOfText(projectText);
  const reg = normRegion(region || '');
  const scored = SEMILLA_WINNERS.filter(w => w.idea).map(w => {
    const shared = w.sectors.filter(s => mine.includes(s));
    const key = reg.split(' ').filter(x => x.length > 3)[0] || reg;
    const sameRegion = Boolean(key) && normRegion(w.region).includes(key);
    const score = shared.length * 10 + (sameRegion ? 4 : 0) + (w.year - 2020) * 0.3;
    return { w, shared, sameRegion, score };
  }).filter(x => x.shared.length > 0 || (mine.length === 0 && x.sameRegion));
  scored.sort((a, b) => b.score - a.score);
  return { sectors: mine, items: scored.slice(0, limit) };
}

export function winnersInRegion(region: string | undefined) {
  const reg = normRegion(region || '');
  if (!reg) return [];
  const key = reg.split(' ').filter(w => w.length > 3)[0] || reg;
  return SEMILLA_WINNERS.filter(w => normRegion(w.region).includes(key));
}

/** ¿Esta postulación es a Semilla Inicia? (fondo del catálogo o convocatoria regional del monitor) */
export function isSemillaInicia(fund: { id?: string; name?: string } | null | undefined) {
  if (!fund) return false;
  return fund.id === 'corfo_semilla_inicia' || /semilla inicia/i.test(String(fund.name || ''));
}
