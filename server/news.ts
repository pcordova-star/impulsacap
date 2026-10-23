/**
 * Novedades de fondos: recolecta noticias de fuentes oficiales, gobierno y prensa,
 * las filtra y resume con IA, las deja para aprobación del administrador, y arma
 * el boletín semanal y las alertas de convocatorias nuevas que calzan con cada empresa.
 *
 * Nunca se copia el texto de los artículos: solo título, fuente, enlace y un resumen propio.
 */
import { createHash, createHmac } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { CHILEAN_FUNDS } from '../src/data/chileanFunds';
import { fundFit } from '../src/data/journey';

// ---------------------------------------------------------------------------
// Fuentes
// ---------------------------------------------------------------------------
export type SourceKind = 'oficial' | 'gobierno' | 'prensa';
export interface NewsSource {
  id: string;
  name: string;
  kind: SourceKind;
  /** Se prueban en orden: primero RSS/Atom; si no responde XML, se leen los enlaces del HTML */
  urls: string[];
  /** Para la lectura de HTML: solo enlaces cuyo camino calce con esto */
  linkPattern?: RegExp;
}

const gnews = (q: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:7d')}&hl=es-419&gl=CL&ceid=CL:es-419`;

export const NEWS_SOURCES: NewsSource[] = [
  { id: 'corfo', name: 'Corfo', kind: 'oficial', urls: ['https://www.corfo.gob.cl/sites/cpp/feed/', 'https://www.corfo.gob.cl/sites/cpp/sala_de_prensa/'], linkPattern: /\/sites\/cpp\/(sala_de_prensa|noticias|convocatoria)/i },
  { id: 'sercotec', name: 'Sercotec', kind: 'oficial', urls: ['https://www.sercotec.cl/feed/', 'https://www.sercotec.cl/noticias/'], linkPattern: /sercotec\.cl\/[a-z0-9-]{12,}\/?$/i },
  { id: 'anid', name: 'ANID', kind: 'oficial', urls: ['https://anid.cl/feed/', 'https://anid.cl/noticias/'], linkPattern: /anid\.cl\/[a-z0-9-]{12,}\/?$/i },
  { id: 'fia', name: 'FIA', kind: 'oficial', urls: ['https://www.fia.cl/feed/', 'https://www.fia.cl/noticias/'], linkPattern: /fia\.cl\/[a-z0-9-/]{12,}$/i },
  { id: 'startupchile', name: 'Start-Up Chile', kind: 'oficial', urls: ['https://startupchile.org/feed/', 'https://startupchile.org/es/blog/'], linkPattern: /startupchile\.org\/[a-z0-9-/]{12,}$/i },
  { id: 'economia', name: 'Ministerio de Economía', kind: 'gobierno', urls: ['https://www.economia.gob.cl/feed', 'https://www.economia.gob.cl/category/noticias'], linkPattern: /economia\.gob\.cl\/\d{4}\/\d{2}\//i },
  { id: 'minciencia', name: 'Ministerio de Ciencia', kind: 'gobierno', urls: ['https://www.minciencia.gob.cl/feed/', 'https://www.minciencia.gob.cl/noticias/'], linkPattern: /minciencia\.gob\.cl\/noticias\/[a-z0-9-]{8,}/i },
  // Prensa y cobertura general (Google Noticias: título, medio y enlace)
  { id: 'gn-corfo', name: 'Prensa · Corfo', kind: 'prensa', urls: [gnews('Corfo convocatoria OR postulaciones OR subsidio')] },
  { id: 'gn-sercotec', name: 'Prensa · Sercotec', kind: 'prensa', urls: [gnews('Sercotec postulaciones OR convocatoria OR "Capital Semilla"')] },
  { id: 'gn-anid', name: 'Prensa · ANID', kind: 'prensa', urls: [gnews('ANID concurso OR convocatoria Fondef')] },
  { id: 'gn-fondos', name: 'Prensa · Fondos concursables', kind: 'prensa', urls: [gnews('"fondos concursables" emprendedores OR pymes Chile')] },
  { id: 'gn-presupuesto', name: 'Prensa · Presupuesto y fomento', kind: 'gobierno', urls: [gnews('presupuesto Corfo OR Sercotec OR "fomento productivo"')] },
  { id: 'gn-startup', name: 'Prensa · Start-Up Chile y FIA', kind: 'prensa', urls: [gnews('"Start-Up Chile" OR "Fundación para la Innovación Agraria" convocatoria')] }
];

export interface RawItem { url: string; title: string; snippet: string; publishedAt: string | null; sourceId: string; sourceName: string; kind: SourceKind; outlet?: string }

// ---------------------------------------------------------------------------
// Lectura de RSS/Atom/HTML (sin dependencias)
// ---------------------------------------------------------------------------
const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const NAMED: Record<string, string> = { hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', deg: '°', ordm: 'º', ordf: 'ª', iquest: '¿', iexcl: '¡' };
const decodeNamed = (s: string) => s.replace(/&([a-zA-Z]+);/g, (m, n) => NAMED[n] ?? m);
// Se decodifica dos veces: los feeds suelen traer HTML escapado dentro de la descripción
const stripTags = (s: string) => decodeNamed(decode(decode(s).replace(/<[^>]+>/g, ' '))).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? m[1] : '';
};

export function parseFeed(xml: string): { url: string; title: string; snippet: string; publishedAt: string | null; outlet?: string }[] {
  const out: { url: string; title: string; snippet: string; publishedAt: string | null; outlet?: string }[] = [];
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const it of items) {
    const url = stripTags(tag(it, 'link')) || (it.match(/<guid[^>]*>([^<]+)<\/guid>/i)?.[1] || '').trim();
    const title = stripTags(tag(it, 'title'));
    const date = stripTags(tag(it, 'pubDate')) || stripTags(tag(it, 'dc:date'));
    const outlet = stripTags(tag(it, 'source')) || undefined;
    // Google Noticias agrega " - Medio" al final del título
    const cleanTitle = outlet && title.endsWith(` - ${outlet}`) ? title.slice(0, -(outlet.length + 3)) : title;
    let snippet = stripTags(tag(it, 'description'));
    if (outlet && snippet.replace(outlet, '').trim().length < 12) snippet = '';
    if (url && title) out.push({ url, title: cleanTitle, snippet: snippet.slice(0, 400), publishedAt: toIso(date), outlet });
  }
  const entries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const it of entries) {
    const url = it.match(/<link[^>]*href="([^"]+)"/i)?.[1] || '';
    const title = stripTags(tag(it, 'title'));
    const date = stripTags(tag(it, 'updated')) || stripTags(tag(it, 'published'));
    if (url && title) out.push({ url, title, snippet: stripTags(tag(it, 'summary') || tag(it, 'content')).slice(0, 400), publishedAt: toIso(date) });
  }
  return out;
}

export function parseHtmlLinks(html: string, baseUrl: string, pattern?: RegExp) {
  const out: { url: string; title: string; snippet: string; publishedAt: string | null }[] = [];
  const seen = new Set<string>();
  const re = /<a\s[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  const host = new URL(baseUrl).host;
  while ((m = re.exec(html)) && out.length < 25) {
    let url: string;
    try { url = new URL(decode(m[1]), baseUrl).toString(); } catch { continue; }
    if (new URL(url).host !== host || seen.has(url)) continue;
    if (pattern && !pattern.test(url)) continue;
    const title = stripTags(m[2]);
    if (title.length < 25 || title.length > 220) continue;
    seen.add(url);
    out.push({ url, title, snippet: '', publishedAt: null });
  }
  return out;
}

function toIso(s: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string; type: string }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ImpulsaCapNovedades/1.0; +https://impulsacap.cl)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000)
  });
  const text = (await res.text()).slice(0, 1_500_000);
  return { ok: res.ok, status: res.status, text, type: res.headers.get('content-type') || '' };
}

export async function readSource(src: NewsSource): Promise<{ items: RawItem[]; usedUrl: string | null; error: string | null }> {
  let lastError: string | null = null;
  for (const url of src.urls) {
    try {
      const r = await fetchText(url);
      if (!r.ok) { lastError = `HTTP ${r.status} en ${url}`; continue; }
      const looksXml = /xml|rss|atom/i.test(r.type) || /^\s*<\?xml|<rss[\s>]|<feed[\s>]/i.test(r.text.slice(0, 500));
      const parsed = looksXml ? parseFeed(r.text) : parseHtmlLinks(r.text, url, src.linkPattern);
      if (!parsed.length) { lastError = `Sin noticias reconocibles en ${url}`; continue; }
      return {
        usedUrl: url,
        error: null,
        items: parsed.slice(0, 20).map(p => ({ ...p, sourceId: src.id, sourceName: src.name, kind: src.kind }))
      };
    } catch (e: any) {
      lastError = `${e?.name === 'TimeoutError' ? 'Tiempo agotado' : (e?.message || 'Error')} en ${url}`;
    }
  }
  return { items: [], usedUrl: null, error: lastError };
}

/** Id estable por noticia (mismo enlace o mismo título en la misma fuente = misma noticia) */
export function newsId(item: { url: string; title: string; sourceId: string }) {
  const norm = item.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  return createHash('sha1').update(`${item.sourceId}|${norm}`).digest('hex').slice(0, 24);
}

// ---------------------------------------------------------------------------
// IA: filtrar, resumir y clasificar
// ---------------------------------------------------------------------------
export const NEWS_TYPES = ['apertura', 'cierre', 'resultados', 'cambio_bases', 'presupuesto', 'politica', 'evento', 'otro'] as const;
export type NewsType = typeof NEWS_TYPES[number];
export const NEWS_TYPE_LABEL: Record<NewsType, string> = {
  apertura: 'Convocatoria abierta',
  cierre: 'Cierre próximo',
  resultados: 'Resultados',
  cambio_bases: 'Cambio en las bases',
  presupuesto: 'Presupuesto',
  politica: 'Anuncio del gobierno',
  evento: 'Evento o taller',
  otro: 'Novedad'
};

export interface AiNews { relevante: boolean; titulo: string; resumen: string; tipo: NewsType; paraQuien: string; fondos: string[]; importancia: 1 | 2 | 3 }

export function buildNewsPrompt(items: RawItem[]) {
  const funds = CHILEAN_FUNDS.map(f => `${f.id}: ${f.name}`).join('\n');
  const list = items.map((it, i) => `[${i}] Fuente: ${it.sourceName}${it.outlet ? ` (${it.outlet})` : ''}\nTítulo: ${it.title}\nExtracto: ${it.snippet || '(sin extracto)'}\nFecha: ${it.publishedAt || 'sin fecha'}`).join('\n\n');
  return `Eres el editor de ImpulsaCap, un servicio que ayuda a emprendedores y pymes de Chile a postular a fondos públicos (Corfo, Sercotec, ANID, FIA, Start-Up Chile, Indap, gobiernos regionales).

Revisa estas noticias y decide cuáles le sirven a un emprendedor o pyme chilena que quiere postular a fondos concursables. Son relevantes: aperturas y cierres de convocatorias, resultados, cambios en bases o requisitos, presupuesto de los programas de fomento, anuncios del gobierno sobre programas de apoyo, y talleres o charlas de postulación. NO son relevantes: noticias institucionales sin impacto para postulantes, nombramientos, becas de posgrado para personas, crónicas generales o noticias de otros países.

Para cada noticia responde con un objeto JSON con:
- "i": el número de la noticia
- "relevante": true o false
- "titulo": un título claro y corto en español (máximo 90 caracteres), escrito por ti
- "resumen": 2 o 3 frases con TUS PALABRAS (no copies el extracto) que expliquen qué pasó y qué significa para un postulante. Si no hay datos suficientes, dilo con prudencia ("según la nota..."). No inventes fechas ni montos que no estén en el título o extracto.
- "tipo": uno de ${NEWS_TYPES.join(', ')}
- "paraQuien": a quién le sirve, en una frase corta (ej.: "Pymes con ventas de la Región del Biobío")
- "fondos": ids de los fondos del catálogo relacionados (puede ser vacío). Catálogo:
${funds}
- "importancia": 3 si abre o cierra pronto una convocatoria o cambia algo que obliga a actuar; 2 si es útil para planificar; 1 si es contexto

Responde SOLO un arreglo JSON.

NOTICIAS:
${list}`;
}

export function parseAiNews(text: string, count: number): Map<number, AiNews> {
  const map = new Map<number, AiNews>();
  let arr: any[] = [];
  try {
    const start = text.indexOf('[');
    arr = JSON.parse(start >= 0 ? text.slice(start, text.lastIndexOf(']') + 1) : text);
  } catch { return map; }
  if (!Array.isArray(arr)) return map;
  const fundIds = new Set(CHILEAN_FUNDS.map(f => f.id));
  for (const o of arr) {
    const i = Number(o?.i);
    if (!Number.isInteger(i) || i < 0 || i >= count) continue;
    map.set(i, {
      relevante: o.relevante === true,
      titulo: String(o.titulo || '').slice(0, 140),
      resumen: String(o.resumen || '').slice(0, 700),
      tipo: (NEWS_TYPES as readonly string[]).includes(o.tipo) ? o.tipo : 'otro',
      paraQuien: String(o.paraQuien || '').slice(0, 200),
      fondos: Array.isArray(o.fondos) ? o.fondos.map(String).filter((f: string) => fundIds.has(f)).slice(0, 5) : [],
      importancia: ([1, 2, 3].includes(Number(o.importancia)) ? Number(o.importancia) : 1) as 1 | 2 | 3
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Recolección completa
// ---------------------------------------------------------------------------
export interface CollectDeps {
  db: Firestore;
  /** Llama a la IA con un prompt y devuelve el texto (JSON) */
  generate: (prompt: string) => Promise<string>;
}

export async function collectNews({ db, generate }: CollectDeps) {
  const now = new Date();
  const results = await Promise.all(NEWS_SOURCES.map(async src => ({ src, r: await readSource(src) })));
  const summary = { fuentes: NEWS_SOURCES.length, fuentesOk: 0, leidas: 0, nuevas: 0, relevantes: 0, descartadas: 0, errorIa: 0 };

  // Salud de cada fuente (visible en el panel)
  const healthBatch = db.batch();
  for (const { src, r } of results) {
    if (!r.error) summary.fuentesOk++;
    healthBatch.set(db.collection('news_sources').doc(src.id), {
      name: src.name, kind: src.kind,
      lastRunAt: now.toISOString(),
      ok: !r.error,
      lastError: r.error,
      lastCount: r.items.length,
      usedUrl: r.usedUrl,
      ...(r.error ? {} : { lastOkAt: now.toISOString() })
    }, { merge: true });
  }
  await healthBatch.commit();

  // Solo noticias recientes (o sin fecha) que no se hayan visto antes
  const cutoff = now.getTime() - 21 * 864e5;
  const fresh: (RawItem & { id: string })[] = [];
  const seenIds = new Set<string>();
  for (const { r } of results) {
    for (const it of r.items) {
      summary.leidas++;
      if (it.publishedAt && new Date(it.publishedAt).getTime() < cutoff) continue;
      const id = newsId(it);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      fresh.push({ ...it, id });
    }
  }
  const existing = new Set<string>();
  for (let i = 0; i < fresh.length; i += 100) {
    const refs = fresh.slice(i, i + 100).map(f => db.collection('news_items').doc(f.id));
    const snaps = await db.getAll(...refs);
    snaps.forEach(s => { if (s.exists) existing.add(s.id); });
  }
  const nuevos = fresh.filter(f => !existing.has(f.id)).slice(0, 60);
  summary.nuevas = nuevos.length;

  for (let i = 0; i < nuevos.length; i += 20) {
    const chunk = nuevos.slice(i, i + 20);
    let ai = new Map<number, AiNews>();
    try {
      ai = parseAiNews(await generate(buildNewsPrompt(chunk)), chunk.length);
    } catch (e: any) {
      console.warn('[novedades] IA no disponible para un grupo:', e?.message);
    }
    const batch = db.batch();
    chunk.forEach((it, k) => {
      const a = ai.get(k);
      if (!a) summary.errorIa++;
      const status = !a ? 'pendiente' : a.relevante ? 'pendiente' : 'descartada_ia';
      if (a?.relevante) summary.relevantes++;
      if (a && !a.relevante) summary.descartadas++;
      batch.set(db.collection('news_items').doc(it.id), {
        url: it.url,
        originalTitle: it.title.slice(0, 300),
        snippet: it.snippet.slice(0, 400),
        sourceId: it.sourceId,
        sourceName: it.sourceName,
        outlet: it.outlet || null,
        kind: it.kind,
        publishedAt: it.publishedAt,
        fetchedAt: now.toISOString(),
        status,
        title: a?.titulo || it.title.slice(0, 140),
        summary: a?.resumen || '',
        type: a?.tipo || 'otro',
        audience: a?.paraQuien || '',
        fundIds: a?.fondos || [],
        importance: a?.importancia || 1,
        aiReviewed: Boolean(a),
        approvedAt: null,
        digestSentAt: null
      });
    });
    await batch.commit();
  }

  await db.collection('meta').doc('novedades').set({ lastCollectAt: now.toISOString(), lastCollect: summary }, { merge: true });
  return summary;
}

// ---------------------------------------------------------------------------
// Desuscripción (enlace firmado, sin iniciar sesión)
// ---------------------------------------------------------------------------
function unsubSecret() {
  return process.env.NOVEDADES_SECRET || process.env.CONVOCATORIAS_IMPORT_TOKEN || 'impulsacap-novedades';
}
export function unsubToken(uid: string) {
  return createHmac('sha256', unsubSecret()).update(`unsub:${uid}`).digest('hex').slice(0, 32);
}
export function unsubUrl(appUrl: string, uid: string) {
  return `${appUrl.replace(/\/$/, '')}/api/novedades/desuscribir?u=${encodeURIComponent(uid)}&t=${unsubToken(uid)}`;
}

// ---------------------------------------------------------------------------
// Correos
// ---------------------------------------------------------------------------
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface DigestItem { title: string; summary: string; type: NewsType; audience: string; url: string; sourceName: string; outlet?: string | null; importance: number }
export interface ClosingCall { titulo: string; cierre: string; url: string; diasRestantes: number }

function shell(inner: string, footer: string, preheader: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0">
<tr><td style="padding:26px 30px 6px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#0f172a">Impulsa<span style="color:#059669">Cap</span></td></tr>
<tr><td style="padding:6px 30px 24px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:15px;line-height:1.6">${inner}</td></tr>
<tr><td style="padding:18px 30px;border-top:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#64748b">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

export function digestEmail(args: { firstName?: string; items: DigestItem[]; closing: ClosingCall[]; appUrl: string; unsubscribeUrl: string; weekLabel: string }) {
  const { items, closing, appUrl } = args;
  const top = [...items].sort((a, b) => b.importance - a.importance);
  const itemHtml = top.map(it => `
    <div style="margin:0 0 18px;padding:0 0 16px;border-bottom:1px solid #f1f5f9">
      <p style="margin:0 0 4px;font-size:11px;font-weight:bold;letter-spacing:.04em;text-transform:uppercase;color:${it.importance >= 3 ? '#b91c1c' : '#2563eb'}">${esc(NEWS_TYPE_LABEL[it.type] || 'Novedad')}</p>
      <p style="margin:0 0 6px;font-size:16px;font-weight:bold;color:#0f172a">${esc(it.title)}</p>
      <p style="margin:0 0 6px">${esc(it.summary)}</p>
      ${it.audience ? `<p style="margin:0 0 6px;font-size:13px;color:#475569"><strong>Le sirve a:</strong> ${esc(it.audience)}</p>` : ''}
      <p style="margin:0;font-size:13px"><a href="${esc(it.url)}" style="color:#059669">Leer en ${esc(it.outlet || it.sourceName)} →</a></p>
    </div>`).join('');
  const closingHtml = closing.length ? `
    <h2 style="margin:22px 0 10px;font-size:17px;color:#0f172a">Cierran pronto</h2>
    <ul style="margin:0 0 8px;padding-left:18px">${closing.map(c => `<li style="margin:0 0 6px"><a href="${esc(c.url)}" style="color:#0f172a;font-weight:bold;text-decoration:none">${esc(c.titulo)}</a> · cierra ${c.diasRestantes === 0 ? '<strong>hoy</strong>' : `en <strong>${c.diasRestantes} ${c.diasRestantes === 1 ? 'día' : 'días'}</strong>`}</li>`).join('')}</ul>` : '';
  const hello = args.firstName ? `Hola, ${esc(args.firstName)}:` : 'Hola:';
  const inner = `
    <h1 style="margin:10px 0 6px;font-size:21px;line-height:1.3;color:#0f172a">Lo que pasó esta semana en fondos concursables</h1>
    <p style="margin:0 0 18px;color:#64748b;font-size:13px">${esc(args.weekLabel)}</p>
    <p style="margin:0 0 18px">${hello} te dejo lo más importante de la semana sobre convocatorias, cambios y anuncios del Estado, ya revisado y explicado en simple.</p>
    ${itemHtml || '<p>Esta semana no hubo anuncios nuevos relevantes.</p>'}
    ${closingHtml}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px"><tr><td style="border-radius:10px;background:#059669">
      <a href="${esc(appUrl)}" style="display:inline-block;padding:13px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">Ver qué fondos calzan con mi empresa</a>
    </td></tr></table>`;
  const footer = `Recibes este boletín porque tienes una cuenta en ImpulsaCap. <a href="${esc(args.unsubscribeUrl)}" style="color:#64748b">Dejar de recibir novedades</a>.<br>ImpulsaCap es operado por Tresna SpA. Los resúmenes son nuestros; la información oficial está en el sitio de cada organismo.`;
  const text = [
    'Lo que pasó esta semana en fondos concursables', args.weekLabel, '',
    ...top.map(it => `• ${NEWS_TYPE_LABEL[it.type]}: ${it.title}\n  ${it.summary}\n  ${it.url}`),
    ...(closing.length ? ['', 'Cierran pronto:', ...closing.map(c => `• ${c.titulo} (en ${c.diasRestantes} días) ${c.url}`)] : []),
    '', `Dejar de recibir novedades: ${args.unsubscribeUrl}`
  ].join('\n');
  return { subject: `Fondos concursables: lo de la semana${top[0] ? ` · ${top[0].title}` : ''}`.slice(0, 140), html: shell(inner, footer, top[0]?.title || 'Novedades de fondos concursables'), text };
}

export function alertEmail(args: { firstName?: string; companyName?: string; fundName: string; titulo: string; cierre?: string | null; url: string; appUrl: string; unsubscribeUrl: string; fundSummary?: string }) {
  const hello = args.firstName ? `Hola, ${esc(args.firstName)}:` : 'Hola:';
  const inner = `
    <p style="margin:10px 0 4px;font-size:11px;font-weight:bold;letter-spacing:.04em;text-transform:uppercase;color:#b91c1c">Alerta: convocatoria abierta</p>
    <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:#0f172a">Se abrió ${esc(args.titulo)}</h1>
    <p style="margin:0 0 12px">${hello} acaba de abrir una convocatoria de <strong>${esc(args.fundName)}</strong>, y según los datos de ${args.companyName ? esc(args.companyName) : 'tu empresa'} <strong>cumples los requisitos que podemos revisar</strong>.</p>
    ${args.fundSummary ? `<p style="margin:0 0 12px">${esc(args.fundSummary)}</p>` : ''}
    ${args.cierre ? `<p style="margin:0 0 12px"><strong>Cierre:</strong> ${esc(args.cierre)}. Te recomiendo partir esta semana: armar bien una postulación toma tiempo.</p>` : ''}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 6px"><tr><td style="border-radius:10px;background:#059669">
      <a href="${esc(args.appUrl)}" style="display:inline-block;padding:13px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">Empezar mi postulación</a>
    </td></tr></table>
    <p style="margin:12px 0 0;font-size:13px"><a href="${esc(args.url)}" style="color:#059669">Ver la convocatoria en el sitio oficial →</a></p>`;
  const footer = `Te avisamos porque tu empresa calza con este fondo. <a href="${esc(args.unsubscribeUrl)}" style="color:#64748b">Dejar de recibir novedades y alertas</a>.<br>ImpulsaCap es operado por Tresna SpA.`;
  const text = `Se abrió ${args.titulo} (${args.fundName}). Según tus datos cumples los requisitos que podemos revisar.${args.cierre ? ` Cierre: ${args.cierre}.` : ''}\nEmpieza tu postulación: ${args.appUrl}\nConvocatoria oficial: ${args.url}\n\nDejar de recibir: ${args.unsubscribeUrl}`;
  return { subject: `Se abrió ${args.titulo} y tu empresa calza`.slice(0, 140), html: shell(inner, footer, `Convocatoria abierta de ${args.fundName}`), text };
}

// ---------------------------------------------------------------------------
// Destinatarios
// ---------------------------------------------------------------------------
export interface Recipient { uid: string; email: string; firstName: string; companyName: string; profile: any | null }

export async function listRecipients(db: Firestore): Promise<Recipient[]> {
  const [usersSnap, companiesSnap] = await Promise.all([db.collection('users').get(), db.collection('companies').get()]);
  const companies = new Map<string, any>();
  companiesSnap.docs.forEach(d => { const c = d.data(); if (c?.ownerId) companies.set(String(c.ownerId), c); });
  const out: Recipient[] = [];
  const seenEmails = new Set<string>();
  for (const d of usersSnap.docs) {
    const u = d.data() || {};
    const email = String(u.email || '').trim().toLowerCase();
    if (!email || !email.includes('@') || u.newsOptOut === true || seenEmails.has(email)) continue;
    seenEmails.add(email);
    const comp = companies.get(d.id);
    const profile = comp?.profileData || (comp ? { ...comp } : null);
    const name = String(profile?.representativeName || u.representativeName || u.displayName || '').trim();
    out.push({ uid: d.id, email, firstName: name.split(/\s+/)[0] || '', companyName: String(profile?.companyName || u.companyName || ''), profile });
  }
  return out;
}

/** Empresas que calzan con un fondo (requisitos comprobables cumplidos con sus datos) */
export function recipientsFitting(recipients: Recipient[], fundId: string) {
  const fund = CHILEAN_FUNDS.find(f => f.id === fundId);
  if (!fund) return { fund: null, list: [] as Recipient[] };
  return { fund, list: recipients.filter(r => r.profile && fundFit(fund, r.profile).status === 'cumple') };
}
