/**
 * Revisión de cifras del texto que redacta la IA.
 * Cada número, monto o porcentaje del texto debe venir de los datos que entregó la persona
 * (o de las bases del fondo). Lo que no esté respaldado se reemplaza por una pregunta
 * [COMPLETAR: …], para que la persona escriba el dato real en vez de enviar una cifra inventada.
 */

// Monto/numero con separadores chilenos (1.234.567,8), con "$" opcional y unidad opcional
const FIGURE_RE = /(?:US\$|\$)?\s?\d{1,3}(?:\.\d{3})+(?:,\d+)?(?:\s?(?:%|por ciento|millones|mill\.?|mil|UF))?|(?:US\$|\$)?\s?\d+(?:,\d+)?(?:\s?(?:%|por ciento|millones|mill\.?|mil|UF))?/gi;

function valueOf(token: string): { value: number; percent: boolean } | null {
  const t = token.trim().toLowerCase();
  const percent = /%|por ciento/.test(t);
  const num = t.replace(/us\$|\$/g, '').match(/\d[\d.]*(?:,\d+)?/)?.[0];
  if (!num) return null;
  let value = Number(num.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  if (/millones|mill/.test(t)) value *= 1e6;
  else if (/\bmil\b/.test(t)) value *= 1e3;
  return { value, percent };
}

/** Todos los valores numéricos presentes en los datos de entrada (texto o JSON). */
export function corpusValues(corpus: string): Set<number> {
  const out = new Set<number>();
  const add = (v: number) => out.add(Math.round(v * 100) / 100);
  // Números tal como aparecen en JSON (40000000, 0.5) y en texto chileno (40.000.000, 4,5)
  for (const m of corpus.matchAll(/-?\d+(?:\.\d+)?/g)) add(Number(m[0]));
  for (const m of corpus.matchAll(FIGURE_RE)) {
    const v = valueOf(m[0]);
    if (v) add(v.value);
  }
  return out;
}

const isYear = (token: string, v: number) => /^\d{4}$/.test(token.trim()) && v >= 1990 && v <= 2040;

export function groundFigures(text: string, corpus: string): { text: string; unverified: string[] } {
  const known = corpusValues(corpus);
  // "$25 millones" y 25000000 valen lo mismo: se comparan valores, no texto
  const has = (v: number) => known.has(Math.round(v * 100) / 100);
  const unverified: string[] = [];
  // Solo se revisa el texto fuera de corchetes (las marcas [COMPLETAR: …] se dejan como están)
  const parts = text.split(/(\[[^\]]*\])/g);
  const checked = parts.map(part => {
    if (part.startsWith('[')) return part;
    return part.replace(FIGURE_RE, (match, offset: number, whole: string) => {
      const token = match.trim();
      if (!token || !/\d/.test(token)) return match;
      // Fechas ("27 de octubre de 2026", "27/10/2026") y RUT ("12.345.678-9") no son cifras del proyecto
      const after = whole.slice(offset + match.length, offset + match.length + 14).toLowerCase();
      const before = whole.slice(Math.max(0, offset - 1), offset);
      if (/^\s*de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/.test(after)) return match;
      if (/^[/-]\d/.test(after) || before === '/' || /^-[\dk]/i.test(after)) return match;
      // Numeración de listas o cláusulas al inicio de línea ("10. Firmas", "11) Plazos")
      const pos = offset + (match.match(/^\s*/)?.[0].length || 0);
      const lineStart = pos === 0 || /\n[ \t]*$/.test(whole.slice(Math.max(0, pos - 4), pos));
      if (lineStart && /^[.)]\s/.test(after)) return match;
      const v = valueOf(token);
      if (!v) return match;
      // Números chicos sin unidad (pasos, "3 hitos", "1 año") y años no se revisan
      if (!v.percent && !/\$|millones|mill|mil|uf/i.test(token) && (v.value < 10 || isYear(token, v.value))) return match;
      if (has(v.value)) return match;
      unverified.push(token);
      const lead = match.match(/^\s*/)?.[0] || '';
      return `${lead}[COMPLETAR: ¿Es correcto "${token}"? Escribe la cifra real o bórrala]`;
    });
  });
  return { text: checked.join(''), unverified: Array.from(new Set(unverified)) };
}
