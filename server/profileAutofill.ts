/**
 * Ayudas opcionales para completar el perfil del proyecto con información real:
 * - Leer el sitio web de la empresa (texto visible de la portada y páginas "nosotros"/"servicios").
 * - Leer currículums (PDF, Word .docx o texto) para describir al equipo.
 * Solo se extrae texto; la IA propone y el usuario decide qué usar.
 */
import dns from 'node:dns/promises';
import net from 'node:net';
import { PDFParse } from 'pdf-parse';
import zlib from 'node:zlib';

const MAX_HTML_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 10_000;

export class AutofillError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const l = ip.toLowerCase();
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:127.') || l.startsWith('::ffff:10.') || l.startsWith('::ffff:192.168.');
}

/** Normaliza y valida la dirección (solo sitios públicos: evita que se use para leer redes internas). */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let s = String(raw || '').trim();
  if (!s) throw new AutofillError('Escribe la dirección de tu sitio web.');
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try { u = new URL(s); } catch { throw new AutofillError('La dirección no es válida. Ejemplo: www.miempresa.cl'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new AutofillError('Solo se aceptan direcciones http o https.');
  if (u.username || u.password) throw new AutofillError('La dirección no es válida.');
  if (u.port && !['80', '443'].includes(u.port)) throw new AutofillError('La dirección no es válida.');
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) throw new AutofillError('La dirección no es válida.');
  if (net.isIP(host) && isPrivateIp(host)) throw new AutofillError('La dirección no es válida.');
  let addrs: { address: string }[] = [];
  try { addrs = await dns.lookup(host, { all: true }); } catch { throw new AutofillError('No encontramos ese sitio. Revisa que la dirección esté bien escrita.', 422); }
  if (addrs.length === 0 || addrs.some(a => isPrivateIp(a.address))) throw new AutofillError('La dirección no es válida.');
  return u;
}

async function fetchHtml(start: URL): Promise<{ url: URL; html: string }> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicUrl(url.toString());
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ImpulsaCapBot/1.0; +https://impulsacap.cl)', Accept: 'text/html,application/xhtml+xml' } });
    } catch {
      clearTimeout(t);
      throw new AutofillError('No pudimos abrir tu sitio (no respondió a tiempo). Intenta de nuevo o completa el perfil a mano.', 422);
    }
    clearTimeout(t);
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url);
      continue;
    }
    if (!res.ok) throw new AutofillError(`Tu sitio respondió con un error (${res.status}).`, 422);
    const type = res.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml|text\/plain/i.test(type)) throw new AutofillError('Esa dirección no es una página web.', 422);
    const reader = res.body?.getReader();
    if (!reader) return { url, html: '' };
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.length;
      if (size > MAX_HTML_BYTES) { try { await reader.cancel(); } catch { /* corte */ } break; }
    }
    return { url, html: Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8') };
  }
  throw new AutofillError('Tu sitio redirige demasiadas veces.', 422);
}

const decode = (s: string) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export function htmlToText(html: string): { title: string; description: string; text: string } {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim());
  const meta = (name: string) => decode((html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'))?.[1] || '').trim());
  const description = meta('description') || meta('og:description');
  const text = decode(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
  return { title, description, text };
}

const SUBPAGE_RE = /(nosotros|quienes|qui%C3%A9nes|about|empresa|servicios|services|productos|products|equipo|team|soluciones)/i;

/** Lee la portada y hasta 2 páginas internas relevantes. */
export async function readCompanySite(raw: string): Promise<{ pages: string[]; content: string }> {
  const start = await assertPublicUrl(raw);
  const home = await fetchHtml(start);
  const pages: string[] = [home.url.toString()];
  const parts: string[] = [];
  const h = htmlToText(home.html);
  parts.push(`PÁGINA: ${home.url}\nTÍTULO: ${h.title}\nDESCRIPCIÓN: ${h.description}\n${h.text.slice(0, 12000)}`);

  const links = Array.from(home.html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)).map(m => m[1]);
  const internal: string[] = [];
  for (const href of links) {
    try {
      const u = new URL(href, home.url);
      if (u.hostname.replace(/^www\./, '') !== home.url.hostname.replace(/^www\./, '')) continue;
      if (!SUBPAGE_RE.test(u.pathname)) continue;
      const key = u.origin + u.pathname;
      if (!internal.includes(key) && key !== home.url.origin + home.url.pathname) internal.push(key);
    } catch { /* enlace inválido */ }
    if (internal.length >= 2) break;
  }
  for (const link of internal) {
    try {
      const p = await fetchHtml(new URL(link));
      const t = htmlToText(p.html);
      pages.push(p.url.toString());
      parts.push(`PÁGINA: ${p.url}\nTÍTULO: ${t.title}\n${t.text.slice(0, 6000)}`);
    } catch { /* una subpágina que falla no detiene la lectura */ }
  }
  const content = parts.join('\n\n---\n\n').slice(0, 25000);
  if (content.replace(/\s/g, '').length < 200) {
    throw new AutofillError('Tu sitio casi no tiene texto que podamos leer (puede estar hecho solo con imágenes o requerir JavaScript). Completa el perfil a mano.', 422);
  }
  return { pages, content };
}


/** Lee un archivo dentro de un .zip (como word/document.xml de un .docx) sin librerías externas. */
function readZipEntry(buf: Buffer, wanted: string): Buffer | null {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    if (name === wanted) {
      if (buf.readUInt32LE(localOff) !== 0x04034b50) return null;
      const lName = buf.readUInt16LE(localOff + 26);
      const lExtra = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + lName + lExtra;
      const data = buf.subarray(start, start + compSize);
      if (method === 0) return data;
      if (method === 8) return zlib.inflateRawSync(data, { maxOutputLength: 20 * 1024 * 1024 } as any);
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

export interface CvFile { name?: string; mimeType?: string; base64: string }

/** Texto de un currículum; si es un PDF escaneado sin texto, se devuelve el PDF para que lo lea la IA. */
export async function cvToText(f: CvFile): Promise<{ name: string; text: string; pdfBase64?: string }> {
  const name = String(f.name || 'cv').slice(0, 120);
  const clean = String(f.base64 || '').replace(/^data:[^;]+;base64,/, '');
  const buf = Buffer.from(clean, 'base64');
  if (buf.length === 0) throw new AutofillError(`El archivo ${name} está vacío.`);
  if (buf.length > 5 * 1024 * 1024) throw new AutofillError(`El archivo ${name} pesa más de 5 MB.`);
  const lower = name.toLowerCase();
  const isPdf = f.mimeType === 'application/pdf' || lower.endsWith('.pdf') || buf.subarray(0, 4).toString() === '%PDF';
  const isDocx = lower.endsWith('.docx') || f.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (isPdf) {
    let text = '';
    try { text = (await new PDFParse({ data: buf }).getText())?.text || ''; } catch { text = ''; }
    return text.replace(/\s/g, '').length > 80 ? { name, text: text.slice(0, 15000) } : { name, text: '', pdfBase64: clean };
  }
  if (isDocx) {
    try {
      const xml = readZipEntry(buf, 'word/document.xml')?.toString('utf8');
      const text = decode(String(xml || '').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')).replace(/\n\s*\n+/g, '\n').trim();
      if (text) return { name, text: text.slice(0, 15000) };
    } catch { /* cae al error de abajo */ }
    throw new AutofillError(`No pudimos leer ${name}. Guárdalo como PDF e inténtalo de nuevo.`, 422);
  }
  if (lower.endsWith('.doc')) throw new AutofillError(`${name} es un Word antiguo (.doc). Guárdalo como PDF o .docx.`, 422);
  const text = buf.toString('utf8');
  if (/[\x00-\x08]/.test(text.slice(0, 2000))) throw new AutofillError(`No pudimos leer ${name}. Usa PDF, Word (.docx) o texto.`, 422);
  return { name, text: text.slice(0, 15000) };
}
