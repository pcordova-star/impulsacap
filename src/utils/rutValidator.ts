/**
 * Validador oficial de RUT chileno con algoritmo Módulo 11
 */

export function cleanRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

export function formatRut(rut: string): string {
  const cleaned = cleanRut(rut);
  if (cleaned.length <= 1) return cleaned;

  const dv = cleaned.slice(-1);
  const body = cleaned.slice(0, -1);

  // Formato con puntos: XX.XXX.XXX-Y
  let formattedBody = '';
  for (let i = body.length - 1, j = 1; i >= 0; i--, j++) {
    formattedBody = body[i] + formattedBody;
    if (j % 3 === 0 && i !== 0) {
      formattedBody = '.' + formattedBody;
    }
  }

  return `${formattedBody}-${dv}`;
}

export function validateRut(rut: string): boolean {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 8 || cleaned.length > 9) return false;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  // Calcular dígito verificador esperado por Módulo 11
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  let expectedDv = '';
  if (remainder === 11) {
    expectedDv = '0';
  } else if (remainder === 10) {
    expectedDv = 'K';
  } else {
    expectedDv = remainder.toString();
  }

  return dv === expectedDv;
}

/**
 * Formatea un RUT mientras se escribe: deja solo números y K, máximo 9 caracteres,
 * y agrega puntos y guion (129019123 → 12.901.912-3).
 */
export function formatRutInput(raw: string): string {
  const cleaned = cleanRut(raw).replace(/K(?=.)/g, '').slice(0, 9);
  if (cleaned.length < 2) return cleaned;
  return formatRut(cleaned);
}

/** Estado del RUT para mostrar ayuda bajo el campo. */
export function rutStatus(raw: string): 'vacio' | 'incompleto' | 'valido' | 'invalido' {
  const cleaned = cleanRut(raw);
  if (!cleaned) return 'vacio';
  if (cleaned.length < 8) return 'incompleto';
  return validateRut(raw) ? 'valido' : 'invalido';
}

/**
 * Formatea un celular chileno mientras se escribe: +56 9 1234 5678.
 * Acepta que el usuario escriba con o sin +56.
 */
export function formatPhoneCLInput(raw: string): string {
  let rest = (raw || '').trim();
  if (rest.startsWith('+56')) rest = rest.slice(3);
  let digits = rest.replace(/\D/g, '');
  if (digits.length > 9 && digits.startsWith('56')) digits = digits.slice(2);
  digits = digits.slice(0, 9);
  if (!digits) return '';
  const a = digits.slice(0, 1);
  const b = digits.slice(1, 5);
  const c = digits.slice(5, 9);
  return `+56 ${a}${b ? ' ' + b : ''}${c ? ' ' + c : ''}`;
}
