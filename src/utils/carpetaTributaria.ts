/**
 * Lector determinista de la Carpeta Tributaria Electrónica (CTE) del SII.
 *
 * Recibe el texto extraído del PDF (pdf-parse) y devuelve solo lo que el documento dice.
 * Si el texto no tiene la estructura de una CTE, devuelve null y el servidor usa la IA como respaldo.
 *
 * Formato conocido (CTE "Regular", "Acreditar tamaño" y "Personalizada", generadas con Apache FOP):
 *  - Encabezado: "Nombre del Emisor", "RUT del Emisor", "Fecha de generación de la Carpeta".
 *  - Datos del contribuyente, actividades (código + glosa + categoría + fecha), régimen, domicilio.
 *  - Representantes legales, conformación de la sociedad (socios y %), anotaciones vigentes.
 *  - F29: un bloque por mes ("Agosto 2026 2/36") con códigos "563 BASE IMPONIBLE \t 9.655.521",
 *    o "No se registra declaración para este período".
 *  - F22: un bloque por año tributario ("Año Tributario 2026 1/ 5") con códigos 1400, 1410, 1411, 315...
 */

export interface CteActivity {
  code: string;
  description: string;
  category: string;
  since: string | null;
}

export interface CtePerson {
  name: string;
  rut: string;
  since: string | null;
  participationCapitalPct?: number | null;
  participationProfitPct?: number | null;
}

export interface CteF29Month {
  period: string; // AAAA-MM
  declared: boolean;
  folio?: string;
  presentationDate?: string | null; // DD/MM/AAAA
  declarationType?: string | null; // Primitiva / Rectificatoria
  revenue: number; // 563 base imponible (ingresos del mes) + 142 ventas exentas
  invoicesIssued: number; // 503
  totalDebits: number; // 538
  employeeTaxWithheld: number; // 048 impuesto único de trabajadores retenido
  feesWithheld: number; // 151 retenciones de honorarios
  totalToPay: number; // 91
  lateCharges: number; // 93 intereses y multas
}

export interface CteF22Year {
  taxYear: number; // año tributario (año comercial = taxYear - 1)
  presentationDate: string | null;
  dueMonth: string | null; // MM/AAAA
  grossIncome: number | null; // 1400 ingresos del giro percibidos
  totalIncome: number | null; // 1410
  salariesPaid: number | null; // 1411 remuneraciones pagadas
  feesPaid: number | null; // 1412 honorarios pagados
  taxableBase: number | null; // 1440 (negativa = pérdida)
  regionCode: string | null; // 53
  activityCode: string | null; // 14
  activityDescription: string | null; // 13
  lateCharges: number; // 93 intereses y multas por declaración fuera de plazo
}

export interface CarpetaTributaria {
  kind: string; // p. ej. "CARPETA TRIBUTARIA REGULAR PARA SOLICITAR CRÉDITO"
  generatedAt: string | null; // DD/MM/AAAA HH:MM
  rut: string;
  companyName: string;
  startDate: string | null;
  constitutionDate: string | null;
  entityType: string | null; // "SOCIEDAD POR ACCIONES"
  taxCategory: string | null;
  taxRegime: string | null;
  accounting: string | null;
  address: string | null;
  commune: string | null;
  branches: string | null;
  activities: CteActivity[];
  observations: string[]; // anotaciones vigentes (vacío si "No registra información")
  legalRepresentatives: CtePerson[];
  partners: CtePerson[];
  hasProperties: boolean | null;
  f29: CteF29Month[]; // del más reciente al más antiguo
  f22: CteF22Year[]; // del más reciente al más antiguo
}

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};

/** "1.234.567" → 1234567; "-24.968.963" → -24968963; vacío → null */
export function cteNumber(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const neg = s.startsWith('-');
  const digits = s.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return isNaN(n) ? null : neg ? -n : n;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const DATE = String.raw`\d{2}\/\d{2}\/\d{4}`;
const RUT = String.raw`\d{7,8}-[\dkK]`;

function between(text: string, start: RegExp, end: RegExp): string {
  const a = text.search(start);
  if (a === -1) return '';
  const rest = text.slice(a);
  const b = rest.slice(1).search(end);
  return b === -1 ? rest : rest.slice(0, b + 1);
}

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m && m[1] ? clean(m[1]) : null;
}

/** Valor de un código del F29 dentro del bloque de un mes: "563 BASE IMPONIBLE \t 9.655.521" */
function f29Code(block: string, code: string): number {
  const re = new RegExp(`^${code} [^\\n]*?[\\t ]+(-?[\\d.]+)\\s*$`, 'm');
  const m = block.match(re);
  return m ? cteNumber(m[1]) || 0 : 0;
}

/** Valor de un código del F22, que puede aparecer en medio de la línea o en la línea siguiente */
function f22Code(block: string, code: string, label: RegExp): number | null {
  const re = new RegExp(`(?:^|\\s)${code}\\s+${label.source}[\\s\\S]{0,160}?\\s(-?\\d{1,3}(?:\\.\\d{3})+|-?\\d+)(?=\\s|$)`, 'm');
  const m = block.match(re);
  return m ? cteNumber(m[1]) : null;
}

function parsePeople(block: string, withPct: boolean): CtePerson[] {
  const flat = clean(block);
  const people: CtePerson[] = [];
  const re = withPct
    ? new RegExp(`([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ .,'&-]{2,}?)\\s+(${RUT})\\s+(${DATE})\\s+([\\d.,]+)%\\s+([\\d.,]+)%`, 'g')
    : new RegExp(`([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ .,'&-]{2,}?)\\s+(${RUT})\\s+(${DATE})`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(flat))) {
    const name = clean(m[1].replace(/^(?:Conformación de la sociedad|Representante\(s\) Legal\(es\)|Participación en sociedades vigentes(?: \(\d\))?)\s*/i, ''));
    if (!name || /RAZÓN SOCIAL|^RUT$/i.test(name)) continue;
    const person: CtePerson = { name, rut: m[2].toUpperCase(), since: m[3] };
    if (withPct) {
      person.participationCapitalPct = parseFloat(m[4].replace(',', '.'));
      person.participationProfitPct = parseFloat(m[5].replace(',', '.'));
    }
    people.push(person);
  }
  return people;
}

function parseF29(text: string): CteF29Month[] {
  const header = /^(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Setiembre|Octubre|Noviembre|Diciembre) (\d{4}) \d+\s*\/\s*\d+\s*$/gim;
  const marks: { idx: number; period: string }[] = [];
  let m: RegExpExecArray | null;
  const f22Start = text.search(/Declaraciones de Renta - Formulario 22/i);
  while ((m = header.exec(text))) {
    if (f22Start !== -1 && m.index > f22Start) break;
    const month = MONTHS[m[1].toLowerCase()];
    marks.push({ idx: m.index, period: `${m[2]}-${String(month).padStart(2, '0')}` });
  }
  const months: CteF29Month[] = [];
  marks.forEach((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].idx : (f22Start !== -1 ? f22Start : text.length);
    const block = text.slice(mk.idx, end);
    if (/No se registra declaración para este período/i.test(block) && !/FORMULARIO 29/i.test(block)) {
      months.push({ period: mk.period, declared: false, revenue: 0, invoicesIssued: 0, totalDebits: 0, employeeTaxWithheld: 0, feesWithheld: 0, totalToPay: 0, lateCharges: 0 });
      return;
    }
    const pres = block.match(new RegExp(`Fecha de Presentación\\s*\\n\\s*(\\S+)[^\\n]*?(${DATE})`, 'i'));
    const lateMatch = block.match(/Interes(?:es)? y Multas\s+93\s+([\d.]+)/i);
    const totalMatch = block.match(/TOTAL A PAGAR DENTRO DEL PLAZO LEGAL\s+91\s+([\d.]+)/i);
    months.push({
      period: mk.period,
      declared: true,
      folio: firstMatch(block, /FOLIO \[07\]\s*(\d+)/) || undefined,
      presentationDate: pres ? pres[2] : null,
      declarationType: pres ? clean(pres[1]) : null,
      revenue: f29Code(block, '563') + f29Code(block, '142'),
      invoicesIssued: f29Code(block, '503'),
      totalDebits: f29Code(block, '538'),
      employeeTaxWithheld: f29Code(block, '048'),
      feesWithheld: f29Code(block, '151'),
      totalToPay: totalMatch ? cteNumber(totalMatch[1]) || 0 : 0,
      lateCharges: lateMatch ? cteNumber(lateMatch[1]) || 0 : 0
    });
  });
  return months;
}

function parseF22(text: string): CteF22Year[] {
  const start = text.search(/Declaraciones de Renta - Formulario 22/i);
  if (start === -1) return [];
  const section = text.slice(start);
  const header = /^Año Tributario (\d{4}) \d+\s*\/\s*\d+\s*$/gim;
  const marks: { idx: number; year: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = header.exec(section))) marks.push({ idx: m.index, year: parseInt(m[1], 10) });
  return marks.map((mk, i) => {
    const block = section.slice(mk.idx, i + 1 < marks.length ? marks[i + 1].idx : section.length);
    const activity = block.match(/13 Actividad, profesión o giro del negocio[^\n]*\n([^\n]+?)\s+(\d{6})\b/);
    const late = block.match(/Intereses y Multas\s*\n?\s*Declaración Fuera de Plazo\s+93\s+([\d.]+)/i)
      || block.match(/Intereses y Multas Declaración Fuera de Plazo\s+93\s+([\d.]+)/i);
    return {
      taxYear: mk.year,
      presentationDate: firstMatch(block, new RegExp(`315 Fecha Presentación\\s+(${DATE})`)),
      dueMonth: firstMatch(block, /15 Fecha Vencimiento Declaración\s+(\d{2}\/\d{4})/),
      grossIncome: f22Code(block, '1400', /Ingresos del giro percibidos/),
      totalIncome: f22Code(block, '1410', /Total de ingresos anuales/),
      salariesPaid: f22Code(block, '1411', /Remuneraciones pagadas/),
      feesPaid: f22Code(block, '1412', /Honorarios pagados/),
      taxableBase: (() => {
        const mm = block.match(/pérdida tributaria del ejercicio\s+(-?\d{1,3}(?:\.\d{3})+|-?\d+)(?:\s|$)/)
          || block.match(/1440\s+Base Imponible afecta a IDPC[\s\S]{0,220}?\n(-?\d{1,3}(?:\.\d{3})+)(?:\s|$)/);
        return mm ? cteNumber(mm[1]) : null;
      })(),
      regionCode: firstMatch(block, /53 Región\s+(\d{1,2})\b/),
      activityCode: activity ? activity[2] : null,
      activityDescription: activity ? clean(activity[1]) : null,
      lateCharges: late ? cteNumber(late[1]) || 0 : 0
    };
  });
}

export function parseCarpetaTributaria(rawText: string): CarpetaTributaria | null {
  const text = (rawText || '').replace(/\r/g, '');
  if (!/CARPETA TRIBUTARIA/i.test(text) || !/RUT del Emisor/i.test(text)) return null;

  const kindLines = text.split('\n').slice(0, 3).map(clean).filter(l => /^(CARPETA TRIBUTARIA|PARA )/i.test(l));
  const contribuyente = between(text, /Datos del Contribuyente/i, /Información proporcionada por el contribuyente|Declaraciones de IVA/i);

  // Actividades: "429000 CONSTRUCCION DE ... Primera Categoría 24/01/2020"
  const activities: CteActivity[] = [];
  const actRe = new RegExp(`^(\\d{6})\\s+(.+?)\\s+(Primera Categoría|Segunda Categoría|Sin Categoría|[A-ZÁÉÍÓÚa-záéíóú]+ Categoría)\\s+(${DATE})?\\s*$`, 'gm');
  let am: RegExpExecArray | null;
  while ((am = actRe.exec(contribuyente))) {
    activities.push({ code: am[1], description: clean(am[2]), category: am[3], since: am[4] || null });
  }

  const obsBlock = between(text, /Anotaciones y Observaciones tributarias vigentes/i, /Información proporcionada por el contribuyente/i);
  const observations = /No registra información/i.test(obsBlock)
    ? []
    : obsBlock.split('\n').map(clean).filter(l => new RegExp(`^${DATE}`).test(l));

  const repBlock = between(text, /Representante\(s\) Legal\(es\)/i, /Nombre o Razón Social RUT Fecha de Incorporación % de participación/i);
  const partnersBlock = between(text, /Conformación de la sociedad/i, /Participación en sociedades vigentes|\(1\) Información declarada/i);
  const propBlock = between(text, /Propiedades y Bienes Raíces/i, /\n\(3\) La presente|Boletas de Honorarios/i);

  const domicilio = firstMatch(contribuyente, /Domicilio:\s*([^\n]+)/i);
  const commune = domicilio && domicilio.includes(',') ? clean(domicilio.split(',').pop() || '') : null;
  const regime = firstMatch(contribuyente, /Régimen Tributario:\s*([^\n]+)/i);
  const accounting = firstMatch(contribuyente, /Régimen Tributario:[^\n]*\n\s*(CONTABILIDAD[^\n]*)/i);

  const result: CarpetaTributaria = {
    kind: clean(kindLines.join(' ')),
    generatedAt: firstMatch(text, new RegExp(`Fecha de generación de la Carpeta:\\s*(${DATE}(?:\\s+\\d{2}:\\d{2})?)`, 'i')),
    rut: firstMatch(text, new RegExp(`RUT del Emisor:\\s*(${RUT})`, 'i'))?.toUpperCase() || '',
    companyName: firstMatch(text, /Nombre del Emisor:\s*([^\n]+)/i) || '',
    startDate: firstMatch(contribuyente, new RegExp(`Fecha de Inicio de Actividades:\\s*(${DATE})`, 'i')),
    constitutionDate: firstMatch(contribuyente, new RegExp(`Fecha de Constitución:\\s*(${DATE})`, 'i')),
    entityType: firstMatch(contribuyente, /Clasificación Entidad:\s*([^\n]+)/i),
    taxCategory: firstMatch(contribuyente, /Categoría Tributaria:\s*([^\n]+)/i),
    taxRegime: regime,
    accounting,
    address: domicilio ? clean(domicilio.replace(/\s+,/g, ',')) : null,
    commune,
    branches: firstMatch(contribuyente, /Sucursales:\s*([^\n]+)/i),
    activities,
    observations,
    legalRepresentatives: parsePeople(repBlock, false),
    partners: parsePeople(partnersBlock, true),
    hasProperties: propBlock ? !/No registra información/i.test(propBlock) : null,
    f29: parseF29(text),
    f22: parseF22(text)
  };

  // Si no se reconoce lo esencial, no es una CTE legible
  if (!result.rut && result.f29.length === 0 && result.f22.length === 0) return null;
  return result;
}
