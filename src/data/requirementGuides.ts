/**
 * Guías "¿Qué es y cómo lo consigo?" para cada requisito de la hoja de ruta.
 * Clave: el texto exacto del requisito (label) en MyActiveApplication.
 * Mantener breves, concretas y con enlaces oficiales. Las bases de cada convocatoria mandan.
 */
export interface RequirementGuide {
  what: string;
  why?: string;
  steps: string[];
  links?: { label: string; url: string }[];
  cost?: string;
  tip?: string;
}

export const REQUIREMENT_GUIDES: Record<string, RequirementGuide> = {
  'RUT de la empresa válido (Módulo 11)': {
    what: 'El RUT de la empresa que postula, con su dígito verificador correcto.',
    why: 'Es el identificador con que el organismo revisa a la empresa en el SII y en sus registros.',
    steps: [
      'Ingrésalo en "Mi empresa"; la app lo formatea y revisa el dígito verificador.',
      'Si subes tu carpeta tributaria, se completa solo.'
    ]
  },
  'Inicio de actividades en 1ª Categoría': {
    what: 'El trámite ante el SII que registra que la empresa empezó a operar con un giro de primera categoría (empresas que venden bienes o servicios).',
    why: 'La mayoría de los fondos para empresas lo exige, y algunos piden una antigüedad mínima o máxima desde esa fecha.',
    steps: [
      'Revísalo en tu carpeta tributaria: aparece como "Fecha de Inicio de Actividades" y la categoría de cada actividad.',
      'También puedes verlo en sii.cl > Servicios online > Situación tributaria.',
      'Si aún no lo tienes, se hace gratis en sii.cl > Servicios online > RUT e Inicio de actividades.'
    ],
    links: [{ label: 'Servicios online del SII', url: 'https://www.sii.cl' }],
    cost: 'Gratis.'
  },
  'Carpeta Tributaria Electrónica F29': {
    what: 'Documento del SII que resume los datos de tu empresa y sus declaraciones de IVA (F29) y renta (F22).',
    why: 'Con ella se acredita el tamaño de la empresa, sus ventas y su antigüedad.',
    steps: [
      'Entra a sii.cl con el RUT de la empresa y su clave tributaria.',
      'Ve a Servicios online > Situación tributaria > Carpeta tributaria electrónica.',
      'Elige "Acreditar tamaño de empresa" (o una personalizada con F29 y F22) y descárgala en PDF.',
      'Súbela aquí con "Subir carpeta": verás tu diagnóstico tributario gratis.'
    ],
    links: [{ label: 'sii.cl', url: 'https://www.sii.cl' }],
    cost: 'Gratis.'
  },
  'Estatuto social y poderes de representación': {
    what: 'El estatuto es el documento que creó tu sociedad (socios, capital, administración). Los poderes indican quién puede firmar y representar a la empresa. Normalmente se acreditan con certificados que demuestran que la sociedad y esos poderes están vigentes.',
    why: 'El organismo necesita saber que la empresa existe legalmente y que quien firma la postulación puede representarla.',
    steps: [
      'Si creaste la empresa en "Tu Empresa en un Día" (Registro de Empresas y Sociedades): entra a registrodeempresasysociedades.cl con tu ClaveÚnica y descarga el certificado de estatuto actualizado y el certificado de vigencia de la sociedad.',
      'Si la creaste por escritura pública en una notaría: pide al Conservador de Bienes Raíces de la comuna donde se inscribió la sociedad (Registro de Comercio) el certificado de vigencia de la sociedad y el certificado de vigencia de poderes. Muchos conservadores permiten pedirlo en línea.',
      'Revisa en las bases qué antigüedad máxima deben tener los certificados (suele pedirse que sean recientes).',
      'Cuando los tengas, marca este punto como listo.'
    ],
    links: [
      { label: 'Registro de Empresas y Sociedades', url: 'https://www.registrodeempresasysociedades.cl' },
      { label: 'Certificado de vigencia (ChileAtiende)', url: 'https://www.chileatiende.gob.cl/fichas/442-certificado-de-vigencia-de-sociedad-del-registro-de-comercio' },
      { label: 'Certificado de vigencia de poder (ChileAtiende)', url: 'https://www.chileatiende.gob.cl/fichas/30438-certificado-de-vigencia-de-poder-del-registro-de-comercio' }
    ],
    cost: 'En el Registro de Empresas y Sociedades, el certificado de vigencia es gratis. En el Conservador tiene un costo que fija cada oficina.',
    tip: '¿No sabes cómo se creó tu empresa? Si tienes ClaveÚnica, entra al Registro de Empresas y Sociedades: si aparece ahí, se creó en "Tu Empresa en un Día".'
  },
  'Cartas de Intención de Compra / LOI': {
    what: 'Cartas firmadas por potenciales clientes o aliados que declaran interés en tu producto o servicio (LOI, "letter of intent"). No obligan a comprar.',
    why: 'Demuestran que hay demanda real: los evaluadores las valoran como validación comercial.',
    steps: [
      'Haz una lista de 2 a 4 clientes o aliados que conozcan tu solución.',
      'Genera el borrador en la pestaña "Documentos y cartas" con sus datos.',
      'Envíales el borrador para que lo revisen, lo pasen a su papel con logo y lo firmen.',
      'Guarda las cartas firmadas en PDF para adjuntarlas a la postulación.'
    ],
    tip: 'Pide cartas a quienes realmente podrían comprarte; las cartas genéricas o de familiares restan credibilidad.'
  },
  'Acreditación de Liderazgo Femenino': {
    what: 'Algunos fondos dan beneficios (por ejemplo, más cofinanciamiento o líneas exclusivas) a empresas lideradas por mujeres.',
    why: 'Para CORFO, en sus líneas para mujeres, una empresa es liderada por mujeres si una o más mujeres tienen al menos el 50% del capital, o al menos el 30% cuando la representación legal también es de una mujer.',
    steps: [
      'Revisa la participación de cada socia en tu estatuto o en tu carpeta tributaria ("Conformación de la sociedad").',
      'Si cumples, márcalo en "Mi empresa" y revisa en las bases del fondo cómo se acredita.',
      'Si no aplica, no afecta la postulación: solo no recibes el beneficio.'
    ],
    links: [{ label: 'Semilla Inicia para empresas lideradas por mujeres', url: 'https://www.chileatiende.gob.cl/fichas/108057-semilla-inicia-para-empresas-lideradas-por-mujeres' }],
    tip: 'Las condiciones exactas cambian entre convocatorias: confírmalas en las bases.'
  },
  'Verificación de IVA no imputado al subsidio': {
    what: 'Los gastos del proyecto se presupuestan sin IVA cuando la empresa puede recuperarlo como crédito fiscal.',
    why: 'El subsidio no financia IVA que la empresa recupera; si lo incluyes, el presupuesto queda mal calculado.',
    steps: [
      'Si tu empresa declara IVA (emite facturas afectas), presupuesta cada gasto con su valor neto.',
      'Si tu empresa no recupera IVA (por ejemplo, solo ventas exentas), revisa en las bases si puedes incluirlo.'
    ]
  },
  'Aporte empresarial pecuniario': {
    what: 'La parte del proyecto que financia tu empresa. Pecuniario significa en dinero (no valorizado).',
    why: 'Cada fondo fija qué porcentaje cubre el subsidio y cuánto debe aportar la empresa.',
    steps: [
      'Revisa en las bases el porcentaje de cofinanciamiento y cuánto del aporte debe ser en dinero.',
      'Asegúrate de tener esos fondos disponibles durante la ejecución.'
    ]
  },
  'Simulación de póliza de garantía para anticipo': {
    what: 'Si quieres recibir parte del subsidio por adelantado, el organismo suele pedir una garantía por ese monto.',
    why: 'Resguarda los recursos públicos entregados antes de ejecutar los gastos.',
    steps: [
      'Revisa en las bases si el fondo entrega anticipos y qué garantías acepta.',
      'Lo habitual es una boleta de garantía bancaria o una póliza de seguro de garantía por el monto del anticipo.',
      'Cotiza con tu banco o una compañía de seguros antes de firmar el convenio.',
      'Si no pides anticipo, normalmente no necesitas garantía (los gastos se reembolsan contra rendición).'
    ],
    cost: 'Depende del banco o la aseguradora y del monto.'
  },
  'Subida formal a la plataforma oficial': {
    what: 'El envío de la postulación en el portal del organismo. ImpulsaCap no postula por ti.',
    steps: [
      'Abre la convocatoria en el sitio del organismo (en el monitor tienes el enlace "Ver bases").',
      'Crea tu usuario o entra con ClaveÚnica según indique el portal.',
      'Copia las respuestas de tu expediente y adjunta los documentos.',
      'Envía antes de la hora de cierre y guarda el comprobante de postulación.'
    ],
    tip: 'No dejes el envío para el último día: los portales suelen saturarse cerca del cierre.'
  }
};

/** Guía para un requisito de cualquier fondo (los textos cambian según las bases, así que se busca por tema). */
export function guideFor(label: string): RequirementGuide | undefined {
  if (REQUIREMENT_GUIDES[label]) return REQUIREMENT_GUIDES[label];
  const l = label.toLowerCase();
  if (/\brut\b/.test(l)) return REQUIREMENT_GUIDES['RUT de la empresa válido (Módulo 11)'];
  if (/carpeta tributaria/.test(l)) return REQUIREMENT_GUIDES['Carpeta Tributaria Electrónica F29'];
  if (/primera categor[ií]a|inicio de actividades/.test(l)) return REQUIREMENT_GUIDES['Inicio de actividades en 1ª Categoría'];
  if (/estatuto|objeto social|vigencia/.test(l)) return REQUIREMENT_GUIDES['Estatuto social y poderes de representación'];
  if (/carta/.test(l)) return REQUIREMENT_GUIDES['Cartas de Intención de Compra / LOI'];
  if (/mujer/.test(l)) return REQUIREMENT_GUIDES['Acreditación de Liderazgo Femenino'];
  if (/garant[ií]a/.test(l)) return REQUIREMENT_GUIDES['Simulación de póliza de garantía para anticipo'];
  if (/aporte/.test(l)) return REQUIREMENT_GUIDES['Aporte empresarial pecuniario'];
  if (/^postular en/.test(l)) return REQUIREMENT_GUIDES['Subida formal a la plataforma oficial'];
  return undefined;
}
