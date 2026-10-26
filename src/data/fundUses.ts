/**
 * ¿Para qué sirve cada fondo? Lo que financia (y lo que no), en el lenguaje del emprendedor.
 * Sacado de las cuentas de presupuesto y gastos permitidos de las bases de cada fondo
 * (ver fundStandards.ts y chileanFunds.ts). Si un fondo no aparece en un uso, sus bases
 * no lo dicen claramente: se muestra como "revisa las bases".
 */
export type UseId =
  | 'maquinaria' | 'vehiculos' | 'personas' | 'local' | 'arriendo' | 'mercaderia'
  | 'marketing' | 'tecnologia' | 'prototipos' | 'asesoria' | 'exportar';

export type UseVerdict = 'si' | 'tope' | 'no';

export interface FundUseCategory {
  id: UseId;
  label: string;
  /** Ejemplos para que la persona se reconozca */
  examples: string;
  /** Consejo general para este uso */
  tip: string;
}

export const USE_CATEGORIES: FundUseCategory[] = [
  { id: 'maquinaria', label: 'Máquinas y equipos', examples: 'Hornos, máquinas de coser, herramientas, computadores, vitrinas', tip: 'Sercotec es el que más financia equipos. Los fondos de Corfo los aceptan solo si son indispensables para el proyecto y con un tope.' },
  { id: 'vehiculos', label: 'Vehículos', examples: 'Camioneta, furgón, moto, carro de venta', tip: 'Casi ningún fondo financia vehículos con patente. Sercotec acepta solo los que no necesitan permiso de circulación (por ejemplo, un carro de venta o una bicicleta de carga).' },
  { id: 'personas', label: 'Contratar personas', examples: 'Sueldos u honorarios de tu equipo o de personas nuevas', tip: 'Corfo y Start-Up Chile financian al equipo del proyecto. Sercotec solo contrataciones nuevas y como capital de trabajo.' },
  { id: 'local', label: 'Arreglar o habilitar el local', examples: 'Instalación eléctrica, pintura, sala de proceso', tip: 'Sercotec financia habilitar el lugar donde funciona tu negocio. Si arriendas, el tope es menor.' },
  { id: 'arriendo', label: 'Arriendo', examples: 'Arriendo del local o de un terreno', tip: 'Solo algunos fondos lo aceptan, y casi siempre si es un arriendo nuevo para el proyecto.' },
  { id: 'mercaderia', label: 'Mercadería y materias primas', examples: 'Insumos para producir, productos para vender', tip: 'Es "capital de trabajo": Sercotec lo financia con límites. En los fondos de innovación (Corfo, Start-Up Chile) no es un gasto típico: revisa las bases.' },
  { id: 'marketing', label: 'Marketing y ventas', examples: 'Página web, redes sociales, ferias, publicidad', tip: 'Casi todos financian marketing si está ligado al proyecto.' },
  { id: 'tecnologia', label: 'Software, app o desarrollo tecnológico', examples: 'Desarrollar una app, una plataforma o un sistema', tip: 'Start-Up Chile y Corfo financian desarrollo tecnológico. Sercotec financia software ya hecho (como un sistema de ventas), no desarrollos.' },
  { id: 'prototipos', label: 'Prototipos, pruebas e I+D', examples: 'Probar un producto nuevo, laboratorio, investigación', tip: 'Es el foco de Corfo (Semilla, Crea y Valida, Innova Región), ANID y FIA.' },
  { id: 'asesoria', label: 'Asesorías y capacitación', examples: 'Mentoría, contador, cursos, expertos', tip: 'Todos aceptan algo de asesoría; en Sercotec tiene un monto máximo.' },
  { id: 'exportar', label: 'Vender en otros países', examples: 'Viajes comerciales, certificaciones, ferias internacionales', tip: 'Para escalar afuera: Consolida y Expande, Semilla Expande y Start-Up Chile.' }
];

type Entry = Partial<Record<UseId, { v: UseVerdict; note?: string }>>;

const CORFO_SEMILLA: Entry = {
  maquinaria: { v: 'tope', note: 'Solo equipos indispensables, hasta 20% del subsidio' },
  vehiculos: { v: 'no' },
  personas: { v: 'si', note: 'Equipo del proyecto; socios hasta $700.000 al mes' },
  marketing: { v: 'si', note: 'Marketing, prospección, marca y empaque' },
  tecnologia: { v: 'si', note: 'Producto mínimo viable' },
  prototipos: { v: 'si', note: 'Prototipos, pruebas y validación' },
  asesoria: { v: 'si', note: 'Mentoría (obligatoria) y validación' }
};

const SERCOTEC_EMPRENDE: Entry = {
  maquinaria: { v: 'si', note: 'Máquinas, herramientas, equipos y muebles' },
  vehiculos: { v: 'tope', note: 'Solo sin permiso de circulación' },
  personas: { v: 'tope', note: 'Solo contrataciones nuevas, como capital de trabajo' },
  local: { v: 'tope', note: '100% si eres dueño; hasta 30% si arriendas' },
  arriendo: { v: 'tope', note: 'Solo arriendos nuevos, como capital de trabajo' },
  mercaderia: { v: 'tope', note: 'Mercadería hasta 20% de las inversiones; capital de trabajo hasta 40%' },
  marketing: { v: 'si', note: 'Ferias, publicidad y marketing digital' },
  tecnologia: { v: 'tope', note: 'Software y registro de marca (no desarrollos a medida)' },
  asesoria: { v: 'tope', note: 'Entre $200.000 y $500.000' }
};

const STARTUP: Entry = {
  personas: { v: 'si', note: 'Equipo fundador y contrataciones' },
  tecnologia: { v: 'si', note: 'Desarrollo de producto' },
  marketing: { v: 'si', note: 'Adquisición de clientes' },
  asesoria: { v: 'si', note: 'Mentorías incluidas en el programa' },
  exportar: { v: 'si', note: 'Pensado para crecer a nivel global' }
};

export const FUND_USES: Record<string, Entry> = {
  corfo_semilla_inicia: CORFO_SEMILLA,
  corfo_semilla_expande: { ...CORFO_SEMILLA, exportar: { v: 'si', note: 'Despegue comercial nacional e internacional' } },
  corfo_crea_valida: {
    maquinaria: { v: 'tope', note: 'Hasta 30% del subsidio' },
    personas: { v: 'si', note: 'Equipo del proyecto' },
    marketing: { v: 'si', note: 'Validación comercial y marketing' },
    tecnologia: { v: 'si', note: 'Desarrollo e integración tecnológica' },
    prototipos: { v: 'si', note: 'Es su foco: de prototipo a validación a escala' },
    asesoria: { v: 'si', note: 'Universidades y centros tecnológicos' },
    exportar: { v: 'si', note: 'Validación comercial y aterrizaje en otros mercados' }
  },
  corfo_sumate_innovar: {
    maquinaria: { v: 'no' },
    personas: { v: 'no', note: 'Solo paga a la entidad experta que contratas' },
    tecnologia: { v: 'tope', note: 'Desarrollos hechos por la entidad; no software estándar' },
    prototipos: { v: 'si', note: 'Lo hace una universidad o centro tecnológico' },
    asesoria: { v: 'si', note: 'Es su foco: contratar a una entidad experta' }
  },
  corfo_innova_region: {
    maquinaria: { v: 'tope', note: 'Hasta 30% del subsidio' },
    personas: { v: 'si', note: 'Equipo del proyecto' },
    marketing: { v: 'si', note: 'Estrategia de marketing y validación de mercado' },
    tecnologia: { v: 'si', note: 'Desarrollo del producto o proceso' },
    prototipos: { v: 'si', note: 'Prototipos y validación técnica o comercial' },
    asesoria: { v: 'si', note: 'Entidades colaboradoras y formulación (hasta $2.000.000)' }
  },
  corfo_consolida_expande: {
    maquinaria: { v: 'tope', note: 'Equipos para escalar (revisa el tope en las bases)' },
    personas: { v: 'si', note: 'Equipo comercial y técnico' },
    marketing: { v: 'si', note: 'Marketing, ferias y prospección' },
    tecnologia: { v: 'tope', note: 'Adaptar la solución a nuevos mercados, no desarrollar desde cero' },
    prototipos: { v: 'no', note: 'Es para escalar algo ya validado' },
    asesoria: { v: 'si', note: 'Asesorías especializadas' },
    exportar: { v: 'si', note: 'Es su foco: escalar en Chile o afuera' }
  },
  startup_chile_build: { ...STARTUP, prototipos: { v: 'si', note: 'De idea validada a prototipo' } },
  startup_chile_ignite: STARTUP,
  startup_chile_growth: { ...STARTUP, personas: { v: 'si', note: 'Contrataciones para crecer' } },
  sercotec_semilla_emprende: SERCOTEC_EMPRENDE,
  sercotec_abeja_emprende: SERCOTEC_EMPRENDE,
  sercotec_crece: {
    maquinaria: { v: 'si', note: 'Máquinas, equipos y software' },
    vehiculos: { v: 'tope', note: 'Solo sin permiso de circulación' },
    personas: { v: 'tope', note: 'Solo contrataciones nuevas' },
    local: { v: 'si', note: 'Mejoras del local donde funciona la empresa' },
    arriendo: { v: 'tope', note: 'Solo arriendos nuevos' },
    mercaderia: { v: 'tope', note: 'Materias primas y materiales, como capital de trabajo' },
    marketing: { v: 'si', note: 'Ferias, promoción y difusión' },
    tecnologia: { v: 'tope', note: 'Software (no desarrollos a medida)' },
    asesoria: { v: 'tope', note: 'Hasta $1.000.000' }
  },
  sercotec_digitaliza_almacen: {
    maquinaria: { v: 'si', note: 'Vitrinas, balanzas, cortadoras, iluminación LED, generador' },
    tecnologia: { v: 'si', note: 'Caja y sistema de ventas (POS), control de inventario' },
    marketing: { v: 'tope', note: 'Dentro de los $200.000 a $500.000 de gestión' },
    asesoria: { v: 'tope', note: 'Entre $200.000 y $500.000' }
  },
  anid_fondef_idea: {
    maquinaria: { v: 'si', note: 'Equipos para la investigación' },
    personas: { v: 'si', note: 'Investigadores y equipo' },
    local: { v: 'tope', note: 'Infraestructura y mobiliario hasta 20%' },
    arriendo: { v: 'si' },
    marketing: { v: 'tope', note: 'Solo difusión' },
    tecnologia: { v: 'si', note: 'Software e insumos' },
    prototipos: { v: 'si', note: 'Es su foco (postula una universidad o centro)' }
  },
  fia_innovacion_agro: {
    maquinaria: { v: 'tope', note: 'Equipos menores' },
    personas: { v: 'si', note: 'Personal nuevo del proyecto; el de planta con tope' },
    local: { v: 'tope', note: 'Habilitación menor' },
    arriendo: { v: 'tope', note: 'Arriendo de terreno' },
    marketing: { v: 'tope', note: 'Difusión' },
    prototipos: { v: 'si', note: 'Es su foco: innovación agroalimentaria' },
    asesoria: { v: 'si', note: 'Laboratorios y asesorías (hasta 70% del aporte FIA)' }
  }
};

export function fundsForUse(useId: UseId, fundIds: string[]) {
  const si: { id: string; note?: string }[] = [];
  const tope: { id: string; note?: string }[] = [];
  const no: { id: string; note?: string }[] = [];
  for (const id of fundIds) {
    const e = FUND_USES[id]?.[useId];
    if (!e) continue;
    (e.v === 'si' ? si : e.v === 'tope' ? tope : no).push({ id, note: e.note });
  }
  return { si, tope, no };
}
