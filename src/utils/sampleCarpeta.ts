/**
 * Carpeta Tributaria de EJEMPLO con una empresa ficticia, en el mismo formato de texto que entrega
 * el SII, para mostrar el diagnóstico completo sin subir un archivo. Todos los datos son inventados
 * y la pantalla los marca como ejemplo; no se pueden guardar en el perfil.
 */
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const fmt = (n: number) => Math.round(n).toLocaleString('es-CL');
const dmy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

export function buildSampleCarpetaText(now = new Date()): string {
  const gen = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate(), 10), 10, 30);
  const start = new Date(gen.getFullYear() - 3, gen.getMonth() - 4, 15);
  const lines: string[] = [
    'CARPETA TRIBUTARIA PARA ACREDITAR TAMAÑO',
    'DE EMPRESA',
    'Nombre del Emisor: EJEMPLO SOLUCIONES DIGITALES SPA',
    'RUT del Emisor: 76111222-8',
    `Fecha de generación de la Carpeta: ${dmy(gen)} 10:30`,
    'Datos del Contribuyente',
    `Fecha de Inicio de Actividades: ${dmy(start)}`,
    `Fecha de Constitución: ${dmy(new Date(start.getTime() - 20 * 864e5))}`,
    'Clasificación Entidad: SOCIEDAD POR ACCIONES',
    'Actividades Económicas: ACTIVIDADES DE PROGRAMACION',
    'Código Actividad Categoría Tributaria A partir de',
    `620100 ACTIVIDADES DE PROGRAMACION INFORMATICA Primera Categoría ${dmy(start)}`,
    `631100 PROCESAMIENTO DE DATOS, HOSPEDAJE Y ACTIVIDADES CONEXAS Primera Categoría ${dmy(start)}`,
    'Categoría Tributaria: Primera Categoría',
    'Régimen Tributario: REGIMEN PRO PYME GENERAL (14D)',
    'CONTABILIDAD COMPLETA',
    'Domicilio: AV EJEMPLO 123 OF 45 , CONCEPCION',
    'Sucursales: -',
    'Anotaciones y Observaciones tributarias vigentes',
    'Fecha Glosa Descripción',
    'No registra información',
    'Información proporcionada por el contribuyente para fines tributarios (1)',
    'Nombre o Razón Social RUT Fecha de Incorporación Forma de actuación',
    `Representante(s) Legal(es) CAMILA ANDREA EJEMPLO ROJAS 11111111-1 ${dmy(start)} Cualquiera`,
    'Nombre o Razón Social RUT Fecha de Incorporación % de participación',
    '(capital)',
    `Conformación de la sociedad CAMILA ANDREA EJEMPLO ROJAS 11111111-1 ${dmy(start)} 60% 60%`,
    `MATIAS IGNACIO MUESTRA SOTO 10222333-0 ${dmy(start)} 40% 40%`,
    'Participación en sociedades vigentes (2) No registra información',
    '(1) Información declarada por el contribuyente y que puede haber sufrido modificaciones.',
    'Propiedades y Bienes Raíces Registrados en el SII (3)',
    'No registra información',
    '(3) La presente información no acredita dominio de una propiedad',
    'Declaraciones de IVA - Formulario 29 (F29)'
  ];
  // 24 meses: el más reciente aún en plazo; ventas crecientes con estacionalidad
  const total = 24;
  for (let i = 0; i < total; i++) {
    const d = new Date(gen.getFullYear(), gen.getMonth() - 1 - i, 1);
    const period = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
    lines.push(`${MONTHS[d.getMonth()]} ${d.getFullYear()} ${i + 1}/${total}`);
    if (i === 0) {
      lines.push('No se registra declaración para este período. En caso de haber generado cupón de pago, o declarado en papel, esto aún podría no estar registrado en nuestros sistemas');
      continue;
    }
    const base = 2_400_000 + (total - i) * 95_000 + (d.getMonth() === 11 ? 900_000 : 0) + ((i * 37) % 5) * 120_000;
    const pres = new Date(d.getFullYear(), d.getMonth() + 1, i === 7 ? 27 : 14);
    lines.push(
      'FORMULARIO 29',
      `FOLIO [07] ${8000000000 + i}`,
      'RUT \t[03] 76.111.222-8',
      `PERIODO [15] ${period}`,
      'Código \tGlosa \tValor',
      `503 CANTIDAD FACTURAS EMITIDAS \t${3 + (i % 4)}`,
      `563 BASE IMPONIBLE \t${fmt(base)}`,
      `502 DÉBITOS FACTURAS EMITIDAS \t${fmt(base * 0.19)}`,
      `538 TOTAL DÉBITOS \t${fmt(base * 0.19)}`,
      `048 IMPUESTO ÚNICO TRABAJADORES \t${fmt(85_000)}`,
      `TOTAL A PAGAR DENTRO DEL PLAZO LEGAL \t91 \t${fmt(base * 0.07)} +`,
      'Tipo de Declaración \tCorrige a Folio(s) \tBanco \tMedio de Pago \tFecha de Presentación',
      `Primitiva \t${dmy(pres)}`
    );
  }
  lines.push('Declaraciones de Renta - Formulario 22 (F22)');
  const incomes = [21_500_000, 30_800_000, 38_900_000];
  for (let k = 0; k < 3; k++) {
    const at = gen.getFullYear() - k;
    lines.push(
      `Año Tributario ${at} ${k + 1}/ 3`,
      'FORM. 22',
      `AÑO TRIBUTARIO ${at}`,
      '13 Actividad, profesión o giro del negocio \t14 Código actividad económica 903 RUT del Representante',
      'ACTIVIDADES DE PROGRAMACION INFORMATICA 620100 \t11111111-1',
      `15 Fecha Vencimiento Declaración \t04/${at} 18`,
      '53 Región \t8 60 Porcent. Condonac. \t0',
      `315 Fecha Presentación \t28/04/${at}`,
      `1400 Ingresos del giro percibidos \t${fmt(incomes[2 - k] * (k === 0 ? 1 : 1))}`,
      `1410 Total de ingresos anuales \t${fmt(incomes[2 - k])}`,
      `1411 Remuneraciones pagadas \t${fmt(11_200_000 - k * 2_500_000)}`
    );
  }
  return lines.join('\n');
}
