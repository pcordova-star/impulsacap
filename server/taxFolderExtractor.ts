import { validateRut, formatRut, cleanRut } from '../src/utils/rutValidator';
import { PDFParse } from 'pdf-parse';

export interface TaxFolderParsedResult {
  rut: string;
  companyName: string;
  companyType: 'spa' | 'srl' | 'eirl' | 'sa' | 'persona_natural' | '';
  monthsActive: number | null;
  annualSalesCLP: number;
  salesBracket: 'sin_ventas' | 'menor_60m' | 'micro_200_a_2400uf' | 'pequena_2400_a_25000uf' | 'mediana_25000_a_100000uf' | 'grande_mayor_100000uf' | '';
  hasMissingF29: boolean;
  siiStatusObservations: string;
  admissibilityVerdict: string;
  bestFitFundRecommendation: string;
  periodsFound: number;
  verificationCode?: string;
  firstCategory: boolean;
  startDate?: string;
}

const UF_CLP = 39000;

export function parseNumberCLP(val: any): number {
  if (typeof val === 'number') return Math.round(val);
  if (!val) return 0;
  const str = String(val).trim();
  const cleaned = str.replace(/[^0-9.,]/g, '').trim();
  if (!cleaned) return 0;
  
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const noThousands = cleaned.replace(/\./g, '').replace(',', '.');
    const num = Math.round(parseFloat(noThousands));
    return isNaN(num) ? 0 : num;
  }
  if (cleaned.includes('.')) {
    const noDots = cleaned.replace(/\./g, '');
    const num = parseInt(noDots, 10);
    return isNaN(num) ? 0 : num;
  }
  if (cleaned.includes(',')) {
    const noCommas = cleaned.replace(/,/g, '');
    const num = parseInt(noCommas, 10);
    return isNaN(num) ? 0 : num;
  }
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

export function isValidTaxRut(rut: any): boolean {
  if (!rut || typeof rut !== 'string') return false;
  return validateRut(rut);
}

export function isValidTaxCompanyName(name: any): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 3) return false;
  const letters = trimmed.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g);
  if (!letters || letters.length < 3) return false;
  // Sin palabras de encabezado como RUT, Fecha, Forma de actuación, Nombre, Incorporación
  const forbiddenHeaders = /\b(?:RUT|Fecha|Forma\s+de\s+actuaci[oó]n|Nombre|Incorporaci[oó]n)\b/i;
  if (forbiddenHeaders.test(trimmed)) return false;
  return true;
}

export function isValidTaxSales(sales: any): boolean {
  const num = parseNumberCLP(sales);
  return num > 1000;
}

export function extractTaxFolderData(text: string, fileName?: string): TaxFolderParsedResult {
  const normText = text || '';
  const lines = normText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 1. Extraer RUT (solo si es válido módulo 11, sino queda vacío)
  let foundRut = '';
  const rutLabelMatch = normText.match(/(?:R\.?U\.?T\.?|RUT|Contribuyente|TITULAR)\s*[:\.\-]?\s*([0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}-?[0-9kK]|[0-9]{7,8}-?[0-9kK])/i);
  if (rutLabelMatch && rutLabelMatch[1] && validateRut(rutLabelMatch[1])) {
    foundRut = formatRut(rutLabelMatch[1].trim());
  }

  if (!foundRut) {
    const rutMatches = normText.match(/\b([0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}-?[0-9kK]|[0-9]{7,8}-[0-9kK])\b/gi) || [];
    for (const cand of rutMatches) {
      if (validateRut(cand)) {
        foundRut = formatRut(cand);
        break;
      }
    }
  }

  if (!foundRut && fileName) {
    const fileRutMatch = fileName.match(/([0-9]{7,8}-?[0-9kK])/i);
    if (fileRutMatch && validateRut(fileRutMatch[1])) {
      foundRut = formatRut(fileRutMatch[1]);
    }
  }

  // 2. Extraer Razón Social (sin palabras de encabezado y con al menos 3 letras)
  let foundName = '';
  const nameMatch = normText.match(/(?:Raz[oó]n\s+Social|Nombre\s+o\s+Raz[oó]n\s+Social|Nombre\s+del\s+Contribuyente|Nombre\s+Contribuyente)\s*[:\.]?\s*([^\n\r\|;]+)/i);
  if (nameMatch && nameMatch[1]) {
    let candidate = nameMatch[1].trim();
    candidate = candidate.replace(/\b(?:FECHA|RUT|ACTIVIDAD|DOMICILIO|C[OÓ]DIGO|INICIO|REGIMEN|FORMA\s+DE\s+ACTUACI[OÓ]N)\b.*/i, '').trim();
    candidate = candidate.replace(/[;,|]+$/, '').trim();
    if (isValidTaxCompanyName(candidate)) {
      foundName = candidate;
    }
  }

  if (!foundName) {
    const altNameMatch = normText.match(/(?:CONTRIBUYENTE|RAZON\s+SOCIAL|TITULAR)\s*[:\.]?\s*([^\n\r\|;]+)/i);
    if (altNameMatch && altNameMatch[1]) {
      let candidate = altNameMatch[1].trim();
      candidate = candidate.replace(/\b(?:FECHA|RUT|ACTIVIDAD|DOMICILIO|C[OÓ]DIGO|INICIO|REGIMEN|FORMA\s+DE\s+ACTUACI[OÓ]N)\b.*/i, '').trim();
      candidate = candidate.replace(/[;,|]+$/, '').trim();
      if (isValidTaxCompanyName(candidate)) {
        foundName = candidate;
      }
    }
  }

  // No usar nombres inventados como 'Empresa Contribuyente SpA'. Si no se detecta, queda vacío.

  // 3. Extraer Tipo de Empresa (solo si se detecta, de lo contrario queda vacío)
  const fullCheck = `${foundName} ${normText}`.toLowerCase();
  let companyType: TaxFolderParsedResult['companyType'] = '';
  if (/\b(?:spa|sociedad por acciones)\b/i.test(fullCheck)) {
    companyType = 'spa';
  } else if (/\b(?:eirl|empresario individual|empresa individual)\b/i.test(fullCheck)) {
    companyType = 'eirl';
  } else if (/\b(?:ltda|limitada|srl|sociedad de responsabilidad limitada)\b/i.test(fullCheck)) {
    companyType = 'srl';
  } else if (/\b(?:s\.?a\.?|sociedad anonima|sociedad anónima)\b/i.test(fullCheck)) {
    companyType = 'sa';
  } else if (/\bpersona natural\b/i.test(fullCheck)) {
    companyType = 'persona_natural';
  } else if (foundRut) {
    const rutNum = parseInt(cleanRut(foundRut).slice(0, -1), 10);
    if (!isNaN(rutNum) && rutNum < 50000000 && !/\b(?:spa|ltda|srl|sa|eirl)\b/i.test(foundName)) {
      companyType = 'persona_natural';
    }
  }

  // 4. Fecha de Inicio de Actividades y Antigüedad (sin defaults inventados)
  let startDate: string | undefined = undefined;
  let monthsActive: number | null = null;
  const dateMatch = normText.match(/(?:Fecha\s+Inicio\s+Actividades|Inicio\s+de\s+Actividades|INICIO\s+ACTIVIDADES|Inicio\s+Actividades|Fecha\s+de\s+Inicio)\s*[:\.]?\s*([0-3]?[0-9][\/\-.][0-1]?[0-9][\/\-.][1-2][0-9]{3})/i);
  if (dateMatch && dateMatch[1]) {
    startDate = dateMatch[1].trim();
    const parts = startDate.split(/[\/\-.]/);
    if (parts.length === 3) {
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month)) {
        const now = new Date();
        const diff = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
        monthsActive = Math.max(0, diff);
      }
    }
  }

  // Contar periodos F29 efectivamente encontrados (sin número fijo de 12)
  const periodMatches = normText.match(/(?:PER[IÍ]ODO|Periodo|F29)\s*(?:TRIBUTARIO)?\s*[:\.]?\s*(?:20\d\d[-/]?\d\d|\d\d[-/]20\d\d|[0-9]{4}-[0-9]{2})/gi) || [];
  const periodsFound = periodMatches.length;

  // 5. Ventas Anuales en CLP (solo si son mayores a $1.000)
  let annualSalesCLP = 0;
  const totalMatch = normText.match(/(?:TOTAL\s+(?:FACTURACI[OÓ]N|VENTAS|DEBITO\s+FISCAL)|VENTAS\s+TOTALES|FACTURACI[OÓ]N\s+TOTAL|TOTAL\s+ANUAL|BASE\s+IMPONIBLE\s+ANUAL|VENTAS\s+NETAS\s+ACUMULADAS)[^:\n]*[:\.]?\s*[\$]?\s*([\d\.\,]+)/i);
  if (totalMatch && totalMatch[1]) {
    const parsedVal = parseNumberCLP(totalMatch[1]);
    if (parsedVal > 1000) annualSalesCLP = parsedVal;
  }

  if (annualSalesCLP === 0) {
    let sumMonthly = 0;
    for (const line of lines) {
      const monthlyMatch = line.match(/(?:VENTAS\s+NETAS\s+AFECTAS|VENTAS\s+NETAS|BASE\s+IMPONIBLE|C[OÓ]DIGO\s+538|C[OÓ]D\.\s*538)\s*[:\.]?\s*[\$]?\s*([\d\.\,]+)/i);
      if (monthlyMatch && monthlyMatch[1]) {
        const val = parseNumberCLP(monthlyMatch[1]);
        if (val > 0) sumMonthly += val;
      }
    }
    if (sumMonthly > 1000) annualSalesCLP = sumMonthly;
  }

  // 6. Tramo de ventas
  let salesBracket: TaxFolderParsedResult['salesBracket'] = '';
  if (annualSalesCLP > 0) {
    if (annualSalesCLP < 60000000) {
      salesBracket = 'menor_60m';
    } else {
      const ufVal = annualSalesCLP / UF_CLP;
      if (ufVal < 2400) {
        salesBracket = 'micro_200_a_2400uf';
      } else if (ufVal < 25000) {
        salesBracket = 'pequena_2400_a_25000uf';
      } else if (ufVal < 100000) {
        salesBracket = 'mediana_25000_a_100000uf';
      } else {
        salesBracket = 'grande_mayor_100000uf';
      }
    }
  } else if (periodsFound > 0) {
    salesBracket = 'sin_ventas';
  }

  // 7. Código Verificador (solo si existe en el texto, no inventar)
  let verificationCode: string | undefined = undefined;
  const verifMatch = normText.match(/(?:C[OÓ]DIGO\s+(?:DE\s+)?VERIFICACI[OÓ]N|C[OÓ]DIGO\s+VERIFICADOR)\s*[:\.]?\s*([A-Za-z0-9\-]+)/i);
  if (verifMatch && verifMatch[1]) {
    verificationCode = verifMatch[1].trim();
  }

  // 8. Inconsistencias F29
  const hasMissingF29 = /(?:NO\s+DECLARADO|FUERA\s+DE\s+PLAZO|IMPAGO)/i.test(normText);

  // 9. Observaciones: solo describe lo que efectivamente se leyó (sin frases inventadas sobre TGR ni 100% admisible)
  const descParts: string[] = [];
  if (foundRut) descParts.push(`RUT: ${foundRut}`);
  if (foundName) descParts.push(`Razón Social: ${foundName}`);
  if (startDate) descParts.push(`Inicio de actividades: ${startDate}${monthsActive !== null ? ` (${monthsActive} meses)` : ''}`);
  if (periodsFound > 0) descParts.push(`${periodsFound} periodo(s) F29 detectado(s)`);
  if (annualSalesCLP > 1000) {
    descParts.push(`Ventas 12 meses: $${annualSalesCLP.toLocaleString('es-CL')} CLP`);
  } else if (periodsFound > 0) {
    descParts.push('Sin registro de ventas en los periodos informados');
  }

  const siiStatusObservations = descParts.length > 0
    ? `Datos leídos de la Carpeta Tributaria: ${descParts.join(' | ')}.`
    : 'No se detectaron datos tributarios legibles en el documento cargado.';

  const admissibilityVerdict = hasMissingF29
    ? 'Observaciones en F29 detectadas'
    : (descParts.length > 0 ? 'Datos tributarios extraídos' : 'Lectura pendiente');

  // 10. Recomendación referencial de fondo
  let bestFitFundRecommendation = '';
  if (salesBracket === 'sin_ventas') {
    bestFitFundRecommendation = 'CORFO Semilla Inicia / SERCOTEC Capital Semilla o Abeja';
  } else if (salesBracket === 'menor_60m') {
    bestFitFundRecommendation = 'CORFO Semilla Inicia / Expande / SERCOTEC Crece';
  } else if (salesBracket === 'micro_200_a_2400uf' || salesBracket === 'pequena_2400_a_25000uf') {
    bestFitFundRecommendation = 'SERCOTEC Crece / CORFO Crea y Valida';
  } else if (salesBracket) {
    bestFitFundRecommendation = 'CORFO Innova Alta Tecnología / Crédito CORFO';
  }

  return {
    rut: foundRut,
    companyName: foundName,
    companyType,
    monthsActive,
    annualSalesCLP,
    salesBracket,
    hasMissingF29,
    siiStatusObservations,
    admissibilityVerdict,
    bestFitFundRecommendation,
    periodsFound,
    verificationCode,
    firstCategory: Boolean(startDate || foundRut),
    startDate,
  };
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result?.text || '';
  } catch (err: any) {
    console.warn('[extractTextFromPdfBuffer] Error al leer PDF con pdf-parse:', err?.message);
    return '';
  }
}
