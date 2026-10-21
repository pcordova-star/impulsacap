/**
 * Postular a cualquier convocatoria del monitor, aunque no esté en el catálogo interno de fondos.
 * Se arma una ficha del concurso (con rúbrica y cuentas estándar de CORFO) que se guarda
 * dentro de la postulación (fundSnapshot), para que funcione igual que un fondo del catálogo.
 */
import type { ChileanFund, Agency } from '../types/funds';
import type { Convocatoria } from '../types/convocatoria';
import type { ApplicationItem } from '../types/application';
import { CHILEAN_FUNDS } from '../data/chileanFunds';

const AGENCIES: Agency[] = ['CORFO', 'SERCOTEC', 'ANID', 'START-UP CHILE', 'FIA', 'PROCHILE'];

/** "$15.000.000", "Hasta 30 millones", "UF 1.500"… → pesos (0 si no se puede leer). */
export function parseTopeCLP(raw: string | null | undefined): number {
  if (!raw) return 0;
  const t = String(raw).toLowerCase();
  if (/uf/.test(t)) return 0; // en UF: se deja "según bases"
  const m = t.match(/(\d{1,3}(?:[.\s]\d{3})+|\d+(?:,\d+)?)/);
  if (!m) return 0;
  let n = Number(m[1].replace(/[.\s]/g, '').replace(',', '.'));
  if (/mill[oó]n|millones|mm\b/.test(t) && n < 100000) n = n * 1_000_000;
  return Number.isFinite(n) && n >= 100000 ? Math.round(n) : 0;
}

export const fundIdForConvocatoria = (conv: Pick<Convocatoria, 'id'>) =>
  `conv_${String(conv.id || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(0, 80);

export function fundFromConvocatoria(conv: Convocatoria): ChileanFund {
  const agency = (AGENCIES.find(a => a === String(conv.fuente || '').toUpperCase()) || 'CORFO') as Agency;
  const tope = parseTopeCLP(conv.tope_aprox);
  const text = `${conv.titulo} ${conv.resumen || ''}`.toLowerCase();
  const category: ChileanFund['category'] =
    /i\+d|investigaci|tecnol/.test(text) ? 'I+D+i y Tecnológico'
    : /agr[ií]col|riego|sosten|agro|pesca|forest/.test(text) ? 'Innovación Agro / Sostenible'
    : /export|internacional/.test(text) ? 'Internacionalización'
    : /crece|escal|expande|inversi/.test(text) ? 'Crecimiento y Escalamiento'
    : 'Capital Semilla';
  return {
    id: fundIdForConvocatoria(conv),
    name: String(conv.titulo || 'Convocatoria').slice(0, 160),
    agency,
    category,
    badge: conv.alcance || 'Convocatoria abierta',
    maxSubsidyCLP: tope,
    subsidyFormatted: tope ? `$${tope.toLocaleString('es-CL')} CLP` : (conv.tope_aprox || 'Según bases'),
    maxCoFinancePct: 70,
    beneficiaryTypes: ['persona_natural', 'spa', 'srl', 'eirl', 'sa', 'sin_iniciar'],
    salesRequirement: 'Según bases de la convocatoria',
    salesBracketsEligible: ['sin_ventas', 'menor_60m', 'micro_200_a_2400uf', 'pequena_2400_a_25000uf', 'mediana_25000_a_100000uf', 'grande_mayor_100000uf'],
    trlRange: 'Según bases',
    trlEligible: ['idea_concepto', 'prototipo_lab', 'mvp_validado', 'primeras_ventas', 'escalamiento_global'],
    requiresInnovation: false,
    requiresCommercialValidation: false,
    status: 'Abierto',
    callStatus: 'abierta',
    closeDate: conv.cierre || null,
    lastVerified: new Date().toISOString().slice(0, 10),
    callSchedule: conv.cierre ? `Cierre: ${conv.cierre}` : 'Ventanilla abierta',
    summary: String(conv.resumen || conv.beneficio || conv.titulo || '').slice(0, 600),
    description: String(conv.resumen || conv.beneficio || '').slice(0, 2000),
    // Pauta general: la app no tiene las bases de este concurso cargadas (ver getFundRules → reglas de monitor)
    evaluationCriteria: [
      { name: 'Propuesta de valor e innovación (pauta referencial)', weight: 35, description: 'Problema, solución y qué la diferencia de lo que existe.' },
      { name: 'Mercado y modelo de negocio (pauta referencial)', weight: 30, description: 'Tamaño de mercado, clientes, cómo se cobra y estrategia comercial.' },
      { name: 'Capacidad del equipo (pauta referencial)', weight: 20, description: 'Experiencia, roles y dedicación del equipo para ejecutar el proyecto.' },
      { name: 'Plan de trabajo y presupuesto (pauta referencial)', weight: 15, description: 'Hitos verificables y coherencia de los gastos con los objetivos.' }
    ],
    eligibleExpenses: ['Recursos humanos del proyecto', 'Gastos de operación', 'Asesorías y servicios externos', 'Gastos de administración (según bases)'],
    ineligibleExpenses: ['IVA recuperable', 'Pago de deudas', 'Gastos no relacionados con el proyecto'],
    requiredDocuments: ['Carpeta tributaria', 'Certificado de vigencia y poderes', 'Formulario de postulación', 'Documentos que indiquen las bases'],
    corfoAccountsBudget: [
      { account: 'Recursos Humanos', description: 'Equipo dedicado al proyecto' },
      { account: 'Gastos de Operación', description: 'Insumos, materiales y servicios' },
      { account: 'Asistencia Técnica', description: 'Servicios de terceros especializados' },
      { account: 'Gastos de Administración', description: 'Gestión y garantías', maxPct: 10 }
    ],
    // Datos extra para mostrar las bases
    ...( { officialUrl: conv.url || null, convocatoriaId: conv.id, fromMonitor: true } as any)
  };
}

/** Fondo de una postulación: catálogo (o versión en vivo) y, si no, la ficha guardada en la postulación. */
export function resolveFund(app: Pick<ApplicationItem, 'fundId'> & { fundSnapshot?: ChileanFund | null } | null | undefined, funds: ChileanFund[] = CHILEAN_FUNDS): ChileanFund {
  if (!app) return funds[0] || CHILEAN_FUNDS[0];
  return funds.find(f => f.id === app.fundId)
    || CHILEAN_FUNDS.find(f => f.id === app.fundId)
    || (app.fundSnapshot as ChileanFund | undefined)
    || funds[0]
    || CHILEAN_FUNDS[0];
}
