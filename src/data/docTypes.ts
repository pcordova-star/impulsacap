/**
 * Documentos que se pueden redactar con IA en "Documentos y anexos".
 * Cada tipo dice qué datos necesita: así no se piden datos que no corresponden
 * (por ejemplo, una contraparte para la memoria de gastos) ni se redacta sin los que sí
 * (por ejemplo, los montos del presupuesto para la carta de aporte).
 */
export interface DocTypeDef {
  value: string;
  label: string;
  /** Es una carta que alguien firma (cuenta en la hoja de ruta cuando está firmada) */
  letter: boolean;
  /** Quién firma o recibe además de la empresa postulante; null si no hay contraparte */
  counterparty: { label: string; placeholder: string; contactLabel?: string } | null;
  needsLegalRep: boolean;
  /** 'pecuniario' exige aporte en dinero > 0 en el presupuesto; 'any' exige al menos una cuenta con montos */
  needsBudget: 'pecuniario' | 'any' | null;
  needsFormulation: boolean;
  /** Solo se ofrece si las bases del fondo piden cartas de asociados o colaboradores */
  onlyIfFundAsksLetters?: boolean;
  hint: string;
}

export const DOC_TYPES: DocTypeDef[] = [
  {
    value: 'Carta de Manifestación de Interés Comercial (LOI)',
    label: 'Carta de interés de un cliente (LOI)',
    letter: true,
    counterparty: { label: 'Cliente o empresa interesada', placeholder: 'Ej: Ferretería Los Andes Ltda.', contactLabel: 'Nombre y cargo de quien firma por el cliente' },
    needsLegalRep: true, needsBudget: null, needsFormulation: false,
    hint: 'La firma un cliente o futuro cliente y muestra que hay interés real en lo que ofreces.'
  },
  {
    value: 'Carta de Compromiso de Aporte Empresarial Pecuniario',
    label: 'Carta de compromiso de aporte en dinero',
    letter: true, counterparty: null, needsLegalRep: true, needsBudget: 'pecuniario', needsFormulation: false,
    hint: 'La firma el representante de tu empresa. Usa el aporte en dinero que pusiste en el presupuesto.'
  },
  {
    value: 'Carta de Compromiso de Aporte Valorado de Socios',
    label: 'Carta de compromiso de aporte valorado (socios)',
    letter: true,
    counterparty: { label: 'Socio o persona que aporta', placeholder: 'Ej: María Soto (socia)', contactLabel: 'Qué aporta (horas, equipos, local) y su valor' },
    needsLegalRep: true, needsBudget: null, needsFormulation: false,
    hint: 'Para aportes que no son dinero (horas de trabajo, equipos, uso de un local), valorizados en pesos.'
  },
  {
    value: 'Carta de Compromiso de Entidad Asociada o Colaboradora',
    label: 'Carta de compromiso de entidad asociada o colaboradora',
    letter: true,
    counterparty: { label: 'Entidad asociada o colaboradora', placeholder: 'Ej: Universidad de Talca, Centro de Innovación', contactLabel: 'Nombre y cargo de quien firma por la entidad' },
    needsLegalRep: true, needsBudget: null, needsFormulation: true, onlyIfFundAsksLetters: true,
    hint: 'Las bases de este fondo piden cartas de las entidades que participan en el proyecto.'
  },
  {
    value: 'Memoria Explicativa de Gastos e Inversiones',
    label: 'Memoria explicativa de gastos',
    letter: false, counterparty: null, needsLegalRep: false, needsBudget: 'any', needsFormulation: false,
    hint: 'Explica cada gasto del presupuesto con los montos y justificaciones que escribiste en el paso de presupuesto.'
  },
  {
    value: 'Resumen Ejecutivo de 1 Página para Evaluadores',
    label: 'Resumen ejecutivo de 1 página',
    letter: false, counterparty: null, needsLegalRep: false, needsBudget: null, needsFormulation: true,
    hint: 'Resume tu formulario en una página. Primero redacta las secciones del formulario.'
  }
];

export const docTypeDef = (value: string): DocTypeDef =>
  DOC_TYPES.find(d => d.value === value) || DOC_TYPES[0];

/** Documentos que son cartas (las que cuentan en la hoja de ruta cuando están firmadas). */
export const isLetterDoc = (tipo?: string) => /^carta/i.test(String(tipo || '').trim());
