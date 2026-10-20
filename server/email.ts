import { Resend } from 'resend';

/**
 * Correos transaccionales de ImpulsaCap (Resend).
 *
 * Regla general: enviar un correo NUNCA debe hacer fallar un pago, un registro
 * ni ninguna otra acción. Todas las funciones públicas capturan sus errores,
 * los registran en los logs y devuelven `false` si no se pudo enviar.
 */

const FROM = 'ImpulsaCap <notificaciones@impulsacap.cl>';
const REPLY_TO = 'contacto@impulsacap.cl';
const SEND_TIMEOUT_MS = 8000;

let client: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export function getAppUrl(): string {
  return (process.env.APP_URL || 'https://impulsacap.cl').replace(/\/+$/, '');
}

export function getAdminEmail(): string | null {
  const v = (process.env.ADMIN_EMAIL || '').trim();
  return v || null;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatCLP(amount: number): string {
  return `$${Math.round(amount).toLocaleString('es-CL')}`;
}

export function formatDateCL(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Santiago' });
}

interface LayoutOptions {
  preheader: string;
  heading: string;
  /** HTML ya escapado */
  bodyHtml: string;
  cta?: { label: string; url: string };
}

function layout({ preheader, heading, bodyHtml, cta }: LayoutOptions): string {
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px">
         <tr><td style="border-radius:10px;background:#059669">
           <a href="${escapeHtml(cta.url)}" target="_blank"
              style="display:inline-block;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px">${escapeHtml(cta.label)}</a>
         </td></tr>
       </table>`
    : '';

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0">
      <tr><td style="padding:28px 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#0f172a">
        Impulsa<span style="color:#059669">Cap</span>
      </td></tr>
      <tr><td style="padding:8px 32px 28px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:15px;line-height:1.6">
        <h1 style="margin:12px 0 16px;font-size:20px;line-height:1.3;color:#0f172a">${escapeHtml(heading)}</h1>
        ${bodyHtml}
        ${button}
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#64748b">
        ¿Dudas? Escríbenos a <a href="mailto:${REPLY_TO}" style="color:#059669">${REPLY_TO}</a><br>
        ImpulsaCap es operado por Tresna SpA.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 12px">${text}</p>`;
}

function detailTable(rows: [string, string][]): string {
  const trs = rows
    .map(([k, v]) => `<tr>
        <td style="padding:8px 12px 8px 0;color:#64748b;font-size:14px;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td>
        <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:bold">${escapeHtml(v)}</td>
      </tr>`)
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;border-top:1px solid #e2e8f0;width:100%">${trs}</table>`;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Evita duplicados si la misma acción se reintenta (p. ej. webhook) */
  idempotencyKey?: string;
}

/** Envía un correo. Nunca lanza errores: devuelve true si Resend lo aceptó. */
export async function sendEmail({ to, subject, html, text, idempotencyKey }: SendArgs): Promise<boolean> {
  const resend = getClient();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY no configurada; no se envió "${subject}" a ${to}`);
    return false;
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.warn(`[email] Destinatario inválido para "${subject}": ${to}`);
    return false;
  }
  try {
    const result = await Promise.race([
      resend.emails.send(
        { from: FROM, replyTo: REPLY_TO, to, subject, html, text },
        idempotencyKey ? { idempotencyKey } : undefined
      ),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), SEND_TIMEOUT_MS)),
    ]);
    if (result.error) {
      console.error(`[email] Resend rechazó "${subject}" a ${to}:`, result.error.message);
      return false;
    }
    console.log(`[email] Enviado "${subject}" a ${to} (id ${result.data?.id})`);
    return true;
  } catch (err: any) {
    console.error(`[email] Error enviando "${subject}" a ${to}:`, err?.message || err);
    return false;
  }
}

// ------------------------------------------------------------------
// Plantillas
// ------------------------------------------------------------------

export function welcomeEmail(name: string) {
  const app = getAppUrl();
  const hello = name ? `Hola, ${escapeHtml(name)}:` : 'Hola:';
  const html = layout({
    preheader: 'Tu cuenta en ImpulsaCap está lista. Así puedes empezar.',
    heading: 'Bienvenido a ImpulsaCap',
    bodyHtml:
      p(hello) +
      p('Tu cuenta está lista. Para preparar tu primera postulación:') +
      `<ol style="margin:0 0 12px;padding-left:20px">
         <li style="margin-bottom:6px"><strong>Completa el perfil de tu proyecto.</strong> Con tus datos reales, las herramientas redactan mejor y no inventan información.</li>
         <li style="margin-bottom:6px"><strong>Elige un fondo</strong> del catálogo o de las convocatorias abiertas.</li>
         <li><strong>Sigue la Hoja de Ruta</strong> paso a paso hasta tener tu expediente listo.</li>
       </ol>`,
    cta: { label: 'Ir a ImpulsaCap', url: app },
  });
  const text = `${name ? `Hola, ${name}:` : 'Hola:'}

Tu cuenta en ImpulsaCap está lista. Para preparar tu primera postulación:
1. Completa el perfil de tu proyecto.
2. Elige un fondo del catálogo o de las convocatorias abiertas.
3. Sigue la Hoja de Ruta paso a paso.

Ir a ImpulsaCap: ${app}

¿Dudas? Escríbenos a ${REPLY_TO}
ImpulsaCap es operado por Tresna SpA.`;
  return { subject: 'Bienvenido a ImpulsaCap', html, text };
}

export function purchaseEmail(args: { amount: number; paymentId: string; expiresAt: string }) {
  const app = getAppUrl();
  const vence = formatDateCL(args.expiresAt);
  const rows: [string, string][] = [
    ['Plan', 'Plan Semestral ImpulsaCap'],
    ['Monto pagado', `${formatCLP(args.amount)} CLP`],
    ['Operación Mercado Pago', args.paymentId],
    ['Activo hasta', vence],
  ];
  const html = layout({
    preheader: `Tu Plan Semestral está activo hasta el ${vence}.`,
    heading: 'Tu Plan Semestral está activo',
    bodyHtml:
      p('Recibimos tu pago y tu plan ya está activo. Estos son los detalles:') +
      detailTable(rows) +
      p('<br>Ya puedes usar el formulador, los documentos y cartas, la auditoría simulada, el expediente y el asesor experto en hasta 3 postulaciones a la vez.') +
      p('El plan es un pago único y no se renueva automáticamente. Te avisaremos antes de que venza.'),
    cta: { label: 'Ir a mis postulaciones', url: app },
  });
  const text = `Tu Plan Semestral ImpulsaCap está activo.

Monto pagado: ${formatCLP(args.amount)} CLP
Operación Mercado Pago: ${args.paymentId}
Activo hasta: ${vence}

El plan es un pago único y no se renueva automáticamente. Te avisaremos antes de que venza.

Ir a mis postulaciones: ${app}

¿Dudas? Escríbenos a ${REPLY_TO}
ImpulsaCap es operado por Tresna SpA.`;
  return { subject: 'Tu Plan Semestral ImpulsaCap está activo', html, text };
}

export function adminSaleEmail(args: {
  userEmail: string;
  companyName: string;
  amount: number;
  isFirstPurchase: boolean;
  paymentId: string;
  expiresAt: string;
}) {
  const rows: [string, string][] = [
    ['Usuario', args.userEmail || '(sin correo)'],
    ['Empresa', args.companyName || '(sin completar)'],
    ['Monto', `${formatCLP(args.amount)} CLP`],
    ['Tipo', args.isFirstPurchase ? 'Primera compra (50% dcto.)' : 'Renovación / compra adicional'],
    ['Operación Mercado Pago', args.paymentId],
    ['Plan activo hasta', formatDateCL(args.expiresAt)],
  ];
  const html = layout({
    preheader: `Nueva venta de ${formatCLP(args.amount)}`,
    heading: `Nueva venta: ${formatCLP(args.amount)}`,
    bodyHtml: p('Se aprobó un pago del Plan Semestral:') + detailTable(rows),
  });
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  return { subject: `Nueva venta ImpulsaCap: ${formatCLP(args.amount)}`, html, text };
}

export function reminderEmail(kind: '7d' | 'expired', expiresAt: string) {
  const app = getAppUrl();
  const vence = formatDateCL(expiresAt);
  const isExpired = kind === 'expired';
  const subject = isExpired
    ? 'Tu Plan Semestral ImpulsaCap venció hoy'
    : `Tu Plan Semestral ImpulsaCap vence el ${vence}`;
  const intro = isExpired
    ? `Tu Plan Semestral venció hoy (${escapeHtml(vence)}). Tus postulaciones y documentos siguen guardados y puedes consultarlos, pero para generar contenido nuevo necesitas renovar.`
    : `Tu Plan Semestral vence el <strong>${escapeHtml(vence)}</strong>, en 7 días. Si renuevas antes, los 6 meses nuevos se suman a tu fecha de término actual, así que no pierdes días.`;
  const html = layout({
    preheader: isExpired ? 'Renueva para seguir preparando tus postulaciones.' : `Tu plan vence el ${vence}.`,
    heading: isExpired ? 'Tu plan venció' : 'Tu plan vence en 7 días',
    bodyHtml:
      p(intro) +
      p('El Plan Semestral cuesta $39.990 CLP por 6 meses, en un pago único sin renovación automática.') +
      `<p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Recibes este aviso porque tienes una cuenta con Plan Semestral en ImpulsaCap. Si no quieres recibir más recordatorios, responde este correo con la palabra "BAJA".</p>`,
    cta: { label: 'Renovar mi plan', url: app },
  });
  const text = `${isExpired ? `Tu Plan Semestral venció hoy (${vence}).` : `Tu Plan Semestral vence el ${vence}, en 7 días.`}

Renovar mi plan: ${app}

Si no quieres recibir más recordatorios, responde este correo con la palabra "BAJA".
ImpulsaCap es operado por Tresna SpA.`;
  return { subject, html, text };
}

export function testEmail() {
  const html = layout({
    preheader: 'Correo de prueba de ImpulsaCap',
    heading: 'Correo de prueba',
    bodyHtml:
      p('Si estás leyendo esto, los correos automáticos de ImpulsaCap están funcionando.') +
      detailTable([
        ['Remitente', FROM],
        ['Responder a', REPLY_TO],
        ['Enviado', new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })],
      ]),
  });
  return { subject: 'Prueba de correos ImpulsaCap', html, text: 'Los correos automáticos de ImpulsaCap están funcionando.' };
}
