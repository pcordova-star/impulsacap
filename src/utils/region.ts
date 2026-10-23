/** Compara el alcance de una convocatoria ("Todo Chile", "Arica y Parinacota", "Región Metropolitana") con la región de la empresa. */
const norm = (s: string) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\bregion(es)?\b|\bde(l)?\b|\bla\b|\bgeneral\b|\bbernardo\b|\bo'?higgins\b(?=.*libertador)|libertador|santiago|antartica chilena|\by\b|\bdel\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export type RegionFit = 'nacional' | 'tu_region' | 'otra_region' | 'sin_region';

export function isNationalScope(alcance?: string | null) {
  const a = String(alcance || '').toLowerCase();
  return !a.trim() || a.includes('todo chile') || a.includes('nacional') || a.includes('todas las regiones');
}

export function regionFit(alcance: string | null | undefined, userRegion: string | null | undefined): RegionFit {
  if (isNationalScope(alcance)) return 'nacional';
  if (!String(userRegion || '').trim()) return 'sin_region';
  const a = norm(String(alcance));
  const r = norm(String(userRegion));
  if (!a || !r) return 'sin_region';
  // Coincide si comparten la palabra principal (ej. "metropolitana", "arica", "biobio", "nuble")
  const aw = a.split(' ').filter(w => w.length > 3);
  const rw = new Set(r.split(' ').filter(w => w.length > 3));
  return aw.some(w => rw.has(w)) || a.includes(r) || r.includes(a) ? 'tu_region' : 'otra_region';
}

/** Nombres oficiales de las 16 regiones (para elegir de una lista y no escribir a mano) */
export const REGIONES_OFICIALES = [
  'Región de Arica y Parinacota', 'Región de Tarapacá', 'Región de Antofagasta', 'Región de Atacama', 'Región de Coquimbo',
  'Región de Valparaíso', 'Región Metropolitana', "Región de O'Higgins", 'Región del Maule', 'Región de Ñuble',
  'Región del Biobío', 'Región de La Araucanía', 'Región de Los Ríos', 'Región de Los Lagos', 'Región de Aysén', 'Región de Magallanes'
];

/** Lleva un texto libre ("Santiago", "RM", "Metropolitana") al nombre oficial, si se reconoce */
export function toOfficialRegion(value: string | null | undefined): string | null {
  const v = String(value || '').trim();
  if (!v) return null;
  const low = v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/\brm\b|santiago|metropolitana/.test(low)) return 'Región Metropolitana';
  return REGIONES_OFICIALES.find(r => regionFit(r.replace(/^Región (de |del )?/, ''), v) === 'tu_region') || null;
}
