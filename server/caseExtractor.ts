import type { GoogleGenAI } from '@google/genai';
import { CaseFeatures, SECTORES, ETAPAS, OBJETIVOS, INNOVACION } from '../src/utils/caseRecommender';

const SCHEMA = {
  type: 'object',
  properties: {
    esValido: { type: 'boolean' },
    rubro: { type: 'string' },
    sector: { type: 'string', enum: [...SECTORES] },
    etapa: { type: 'string', enum: [...ETAPAS] },
    ventasAnualesCLP: { type: ['number', 'null'] },
    objetivos: { type: 'array', items: { type: 'string', enum: [...OBJETIVOS] } },
    nivelInnovacion: { type: 'string', enum: [...INNOVACION] },
    vinculoUniversidad: { type: 'boolean' },
    liderazgoFemenino: { type: ['boolean', 'null'] },
    region: { type: ['string', 'null'] },
  },
  required: ['esValido', 'rubro', 'sector', 'etapa', 'ventasAnualesCLP', 'objetivos', 'nivelInnovacion', 'vinculoUniversidad', 'liderazgoFemenino', 'region'],
};

const INSTRUCCIONES = `Eres un analista que clasifica descripciones de negocios en Chile para recomendar fondos públicos.
Lee la descripción y devuelve SOLO los datos pedidos en el esquema JSON. No recomiendes fondos.
- etapa: "idea" (aún no opera); "en_marcha_sin_formalizar" (opera sin inicio de actividades en el SII); "formalizada_sin_ventas"; "con_ventas" (si vende, factura, tiene clientes, menciona ventas, o es un negocio establecido como "tengo una clínica", "mi botillería", "somos una constructora con 20 trabajadores"); "desconocida" si no se puede inferir.
- ventasAnualesCLP: convierte montos ("40 millones" = 40000000; montos mensuales x12). Si no hay monto, null. No inventes.
- objetivos: equipos, motor, máquina, vehículo de trabajo, horno → "maquinaria_equipamiento"; galpón, local, bodega → "infraestructura"; software o tienda online para su negocio → "digitalizacion"; producto o servicio nuevo → "innovacion_producto"; desarrollar tecnología propia o prototipo técnico → "desarrollo_tecnologico"; investigación científica → "investigacion_id"; problema de productividad a resolver con expertos → "resolver_problema_productivo"/"contratar_expertos". Si no se menciona, lista vacía.
- nivelInnovacion: "ninguna" = negocio tradicional que quiere crecer o equiparse (aunque compre una máquina o software estándar); "incremental" = mejora novedosa en su producto o proceso; "tecnologica" = desarrolla tecnología propia con potencial de escalar; "cientifica" = investigación científica o vínculo con universidad.
- sector: el más cercano; "otro" solo si ninguno aplica.
- esValido = false solo si no describe ninguna actividad.
- No supongas datos que el texto no dice: usa "desconocida", null o lista vacía.`;

function oneOf<T extends readonly string[]>(v: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T[number]) : fallback;
}

export function sanitizeFeatures(raw: any): CaseFeatures | null {
  if (!raw || typeof raw !== 'object') return null;
  const ventas = Number(raw.ventasAnualesCLP);
  return {
    esValido: raw.esValido !== false,
    rubro: String(raw.rubro || 'tu negocio').slice(0, 80),
    sector: oneOf(raw.sector, SECTORES, 'otro'),
    etapa: oneOf(raw.etapa, ETAPAS, 'desconocida'),
    ventasAnualesCLP: raw.ventasAnualesCLP === null || !Number.isFinite(ventas) || ventas < 0 ? null : ventas,
    objetivos: (Array.isArray(raw.objetivos) ? raw.objetivos : []).filter((o: unknown) => (OBJETIVOS as readonly string[]).includes(o as string)),
    nivelInnovacion: oneOf(raw.nivelInnovacion, INNOVACION, 'ninguna'),
    vinculoUniversidad: raw.vinculoUniversidad === true,
    liderazgoFemenino: raw.liderazgoFemenino === true ? true : raw.liderazgoFemenino === false ? false : null,
    region: typeof raw.region === 'string' && raw.region.trim() ? raw.region.trim().slice(0, 60) : null,
  };
}

export async function extractCaseFeatures(ai: GoogleGenAI, model: string, description: string): Promise<CaseFeatures | null> {
  const response = await ai.models.generateContent({
    model,
    contents: `DESCRIPCIÓN DEL USUARIO:\n"""${description.slice(0, 2000)}"""`,
    config: { systemInstruction: INSTRUCCIONES, responseMimeType: 'application/json', responseJsonSchema: SCHEMA, temperature: 0 },
  });
  const text = response.text || '';
  if (!text) return null;
  return sanitizeFeatures(JSON.parse(text));
}
