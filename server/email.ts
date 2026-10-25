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
  /** Dirección para responder (por defecto contacto@impulsacap.cl) */
  replyTo?: string;
}

export interface EmailEvent { at: string; to: string; subject: string; ok: boolean; id?: string | null; error?: string | null; }
type EmailSink = (e: EmailEvent) => void;
let emailSink: EmailSink | null = null;
/** Registro de cada intento de envío (el servidor lo guarda en Firestore para verlo en /admin). */
export function setEmailEventSink(fn: EmailSink) { emailSink = fn; }
let lastEmailError: string | null = null;
export function getLastEmailError() { return lastEmailError; }

/** Envía un correo. Nunca lanza errores: devuelve true si Resend lo aceptó. */
export async function sendEmail(args: SendArgs): Promise<boolean> {
  const r = await sendEmailDetailed(args);
  return r.ok;
}

export async function sendEmailDetailed({ to, subject, html, text, idempotencyKey, replyTo }: SendArgs): Promise<{ ok: boolean; id?: string | null; error?: string | null }> {
  const done = (ok: boolean, id: string | null, error: string | null) => {
    if (!ok) lastEmailError = error;
    try { emailSink?.({ at: new Date().toISOString(), to: String(to || ''), subject, ok, id, error }); } catch { /* registro opcional */ }
    return { ok, id, error };
  };
  const resend = getClient();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY no configurada; no se envió "${subject}"`);
    return done(false, null, 'RESEND_API_KEY no configurada');
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.warn(`[email] Destinatario inválido para "${subject}"`);
    return done(false, null, 'Destinatario inválido o vacío');
  }
  try {
    const result = await Promise.race([
      resend.emails.send(
        { from: FROM, replyTo: replyTo || REPLY_TO, to, subject, html, text },
        idempotencyKey ? { idempotencyKey } : undefined
      ),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), SEND_TIMEOUT_MS)),
    ]);
    if (result.error) {
      const msg = `${(result.error as any).name || 'error'}: ${result.error.message}`;
      console.error(`[email] Resend rechazó "${subject}" a ${to}:`, msg);
      return done(false, null, msg);
    }
    console.log(`[email] Enviado "${subject}" a ${to} (id ${result.data?.id})`);
    return done(true, result.data?.id || null, null);
  } catch (err: any) {
    console.error(`[email] Error enviando "${subject}" a ${to}:`, err?.message || err);
    return done(false, null, String(err?.message || err));
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
    ['Plan', 'Plan Trimestral ImpulsaCap'],
    ['Monto pagado', `${formatCLP(args.amount)} CLP`],
    ['N° de operación', args.paymentId],
    ['Activo hasta', vence],
  ];
  const html = layout({
    preheader: `Tu Plan Trimestral está activo hasta el ${vence}.`,
    heading: 'Tu Plan Trimestral está activo',
    bodyHtml:
      p('Recibimos tu pago y tu plan ya está activo. Estos son los detalles:') +
      detailTable(rows) +
      p('<br>Ya puedes usar el formulador, los documentos y cartas, la auditoría simulada, el expediente y el asesor experto en hasta 3 postulaciones a la vez.') +
      p('El plan es un pago único y no se renueva automáticamente. Te avisaremos antes de que venza.'),
    cta: { label: 'Ir a mis postulaciones', url: app },
  });
  const text = `Tu Plan Trimestral ImpulsaCap está activo.

Monto pagado: ${formatCLP(args.amount)} CLP
N° de operación: ${args.paymentId}
Activo hasta: ${vence}

El plan es un pago único y no se renueva automáticamente. Te avisaremos antes de que venza.

Ir a mis postulaciones: ${app}

¿Dudas? Escríbenos a ${REPLY_TO}
ImpulsaCap es operado por Tresna SpA.`;
  return { subject: 'Tu Plan Trimestral ImpulsaCap está activo', html, text };
}

export function adminSaleEmail(args: {
  userEmail: string;
  companyName: string;
  amount: number;
  isFirstPurchase: boolean;
  paymentId: string;
  expiresAt: string;
  sellerCode?: string | null;
  commission?: number | null;
}) {
  const rows: [string, string][] = [
    ['Usuario', args.userEmail || '(sin correo)'],
    ['Empresa', args.companyName || '(sin completar)'],
    ['Monto', `${formatCLP(args.amount)} CLP`],
    ['Tipo', args.isFirstPurchase ? (args.sellerCode ? `Primera compra con código ${args.sellerCode}` : 'Primera compra (50% dcto.)') : 'Renovación / compra adicional'],
    ...(args.sellerCode ? [['Comisión del vendedor', `${formatCLP(args.commission || 0)} (${args.sellerCode})`] as [string, string]] : []),
    ['N° de operación', args.paymentId],
    ['Plan activo hasta', formatDateCL(args.expiresAt)],
  ];
  const html = layout({
    preheader: `Nueva venta de ${formatCLP(args.amount)}`,
    heading: `Nueva venta: ${formatCLP(args.amount)}`,
    bodyHtml: p('Se aprobó un pago del Plan Trimestral:') + detailTable(rows),
  });
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  return { subject: `Nueva venta ImpulsaCap: ${formatCLP(args.amount)}`, html, text };
}

export function reminderEmail(kind: '7d' | 'expired', expiresAt: string) {
  const app = getAppUrl();
  const vence = formatDateCL(expiresAt);
  const isExpired = kind === 'expired';
  const subject = isExpired
    ? 'Tu Plan Trimestral ImpulsaCap venció hoy'
    : `Tu Plan Trimestral ImpulsaCap vence el ${vence}`;
  const intro = isExpired
    ? `Tu Plan Trimestral venció hoy (${escapeHtml(vence)}). Tus postulaciones y documentos siguen guardados y puedes consultarlos, pero para generar contenido nuevo necesitas renovar.`
    : `Tu Plan Trimestral vence el <strong>${escapeHtml(vence)}</strong>, en 7 días. Si renuevas antes, los 3 meses nuevos se suman a tu fecha de término actual, así que no pierdes días.`;
  const html = layout({
    preheader: isExpired ? 'Renueva para seguir preparando tus postulaciones.' : `Tu plan vence el ${vence}.`,
    heading: isExpired ? 'Tu plan venció' : 'Tu plan vence en 7 días',
    bodyHtml:
      p(intro) +
      p('El Plan Trimestral cuesta $14.990 CLP por 3 meses, en un pago único sin renovación automática.') +
      `<p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Recibes este aviso porque tienes una cuenta con Plan Trimestral en ImpulsaCap. Si no quieres recibir más recordatorios, responde este correo con la palabra "BAJA".</p>`,
    cta: { label: 'Renovar mi plan', url: `${app}/?pagar=1` },
  });
  const text = `${isExpired ? `Tu Plan Trimestral venció hoy (${vence}).` : `Tu Plan Trimestral vence el ${vence}, en 7 días.`}

Renovar mi plan: ${app}/?pagar=1

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


/* -------------------------------------------------------------------------- */
/* Soporte                                                                     */
/* -------------------------------------------------------------------------- */

export interface SupportTicketEmailData {
  ticketId: string;
  email: string;
  name?: string;
  message: string;
  page?: string;
  conversation?: { role: 'user' | 'bot'; text: string }[];
  hasPlan?: boolean;
}

/** Aviso al administrador; al responder este correo, la respuesta va directo al cliente. */
export function supportTicketAdminEmail(t: SupportTicketEmailData) {
  const convo = (t.conversation || [])
    .map(m => `<p style="margin:0 0 8px;font-size:13px;color:${m.role === 'user' ? '#0f172a' : '#475569'}"><strong>${m.role === 'user' ? 'Cliente' : 'Robot'}:</strong> ${escapeHtml(m.text)}</p>`)
    .join('');
  const html = layout({
    preheader: `Nueva solicitud de soporte de ${t.email}`,
    heading: 'Nueva solicitud de soporte',
    bodyHtml:
      detailTable([
        ['Solicitud', `#${t.ticketId}`],
        ['Cliente', t.name ? `${t.name} (${t.email})` : t.email],
        ['Plan', t.hasPlan ? 'Plan Trimestral activo' : 'Sin plan activo'],
        ['Sección', t.page || '—'],
      ]) +
      p('<strong>Mensaje:</strong>') +
      `<p style="margin:0 0 16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;white-space:pre-line">${escapeHtml(t.message)}</p>` +
      (convo ? p('<strong>Conversación previa con el robot:</strong>') + convo : '') +
      p('Responde este correo para contestarle directamente al cliente.'),
    cta: { label: 'Ver en el panel', url: `${getAppUrl()}/admin` }
  });
  const text = `Nueva solicitud #${t.ticketId} de ${t.email}\n\n${t.message}\n\nResponde este correo para contestarle al cliente.`;
  return { subject: `Soporte #${t.ticketId}: ${t.message.slice(0, 60)}${t.message.length > 60 ? '…' : ''}`, html, text };
}

/** Confirmación al cliente de que su solicitud llegó. */
export function supportTicketUserEmail(t: SupportTicketEmailData) {
  const html = layout({
    preheader: 'Recibimos tu consulta',
    heading: 'Recibimos tu consulta',
    bodyHtml:
      p(`Hola${t.name ? ' ' + escapeHtml(t.name.split(' ')[0]) : ''}, recibimos tu solicitud <strong>#${escapeHtml(t.ticketId)}</strong>. Te responderemos a este correo lo antes posible.`) +
      p('<strong>Tu mensaje:</strong>') +
      `<p style="margin:0 0 16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;white-space:pre-line">${escapeHtml(t.message)}</p>` +
      p('Si quieres agregar algo, responde este correo.')
  });
  const text = `Recibimos tu solicitud #${t.ticketId}. Te responderemos a este correo lo antes posible.\n\nTu mensaje:\n${t.message}`;
  return { subject: `Recibimos tu consulta (#${t.ticketId})`, html, text };
}

/* -------------------------------------------------------------------------- */
/* Acceso anticipado (lanzamiento sin pago en línea)                           */
/* -------------------------------------------------------------------------- */

export function earlyAccessUserEmail(args: { expiresAt: string; price: number }) {
  const html = layout({
    preheader: 'Tu prueba gratis de ImpulsaCap está activa',
    heading: 'Tu prueba gratis está activa',
    bodyHtml:
      p('Como beneficio de lanzamiento para pymes, tienes el <strong>Plan Trimestral completo gratis</strong>: redacción de tu postulación con IA, documentos y cartas, auditoría simulada y expediente PDF.') +
      detailTable([
        ['Prueba gratis hasta', formatDateCL(args.expiresAt)],
        ['Precio de lanzamiento', `${formatCLP(args.price)} por 3 meses (IVA incluido)`],
      ]) +
      p('Te enviaremos por este correo tu enlace para activar el plan y seguir trabajando sin perder nada. Tus datos y postulaciones quedan guardados.') +
      p('Aprovecha estos días para subir tu carpeta tributaria y avanzar en tu postulación.'),
    cta: { label: 'Empezar mi prueba', url: getAppUrl() }
  });
  const text = `Tu prueba gratis del Plan Trimestral está activa hasta el ${formatDateCL(args.expiresAt)}. Te enviaremos tu enlace para activarlo a ${formatCLP(args.price)} (precio de lanzamiento).`;
  return { subject: 'Tu prueba gratis de ImpulsaCap está activa', html, text };
}

export function earlyAccessAdminEmail(args: { userEmail: string; companyName?: string; expiresAt: string; price: number }) {
  const html = layout({
    preheader: `Nueva intención de compra de ${args.userEmail}`,
    heading: 'Nueva intención de compra',
    bodyHtml:
      p('Alguien presionó contratar mientras el pago en línea está en modo de acceso anticipado.') +
      detailTable([
        ['Cliente', args.companyName ? `${args.companyName} (${args.userEmail})` : args.userEmail],
        ['Precio que corresponde', formatCLP(args.price)],
        ['Acceso anticipado hasta', formatDateCL(args.expiresAt)],
      ]),
    cta: { label: 'Ver en el panel', url: `${getAppUrl()}/admin` }
  });
  return { subject: `Intención de compra: ${args.companyName || args.userEmail}`, html, text: `Nueva intención de compra de ${args.userEmail} (${formatCLP(args.price)}).` };
}

export function paymentAvailableEmail(args: { deadline: string; price: number }) {
  const html = layout({
    preheader: 'Activa tu Plan Trimestral a precio de lanzamiento',
    heading: 'Activa tu Plan Trimestral',
    bodyHtml:
      p('Gracias por probar ImpulsaCap. Tus datos y postulaciones siguen guardados: activa tu Plan Trimestral para seguir preparando tu postulación con todas las herramientas.') +
      detailTable([
        ['Tu precio', `${formatCLP(args.price)} por 3 meses (IVA incluido)`],
        ['Incluye', 'Redacción con IA, cartas, presupuesto guiado, auditoría simulada, expediente PDF y asesor experto'],
      ]) +
      p('Es un pago único: no se renueva solo. Los 3 meses parten cuando pagas.'),
    cta: { label: 'Activar mi plan', url: `${getAppUrl()}/?pagar=1` }
  });
  const text = `Tus datos en ImpulsaCap siguen guardados. Activa tu Plan Trimestral a ${formatCLP(args.price)} (3 meses, IVA incluido) para seguir: ${getAppUrl()}/?pagar=1`;
  return { subject: 'Activa tu Plan Trimestral a precio de lanzamiento', html, text };
}

export function sellerSaleEmail(args: { sellerName: string; code: string; amount: number; commission: number; companyName?: string }) {
  const hello = args.sellerName ? `Hola, ${escapeHtml(args.sellerName.split(/\s+/)[0])}:` : 'Hola:';
  const rows: [string, string][] = [
    ['Código', args.code],
    ['Cliente', args.companyName || 'Empresa sin nombre registrado'],
    ['Venta', `${formatCLP(args.amount)} (IVA incluido)`],
    ['Tu comisión', formatCLP(args.commission)],
  ];
  const html = layout({
    preheader: `Nueva venta con tu código ${args.code}: comisión ${formatCLP(args.commission)}`,
    heading: 'Nueva venta con tu código',
    bodyHtml: p(hello) + p('Se aprobó un pago del Plan Trimestral con tu código.') + detailTable(rows) +
      p('<br>Puedes ver todas tus ventas y comisiones en tu panel de vendedor.'),
    cta: { label: 'Ver mi panel', url: `${getAppUrl()}/vendedor` },
  });
  const text = `Nueva venta con tu código ${args.code}.
Cliente: ${args.companyName || 'Empresa sin nombre registrado'}
Venta: ${formatCLP(args.amount)} (IVA incluido)
Tu comisión: ${formatCLP(args.commission)}

Tu panel: ${getAppUrl()}/vendedor`;
  return { subject: `Nueva venta con tu código ${args.code}: ${formatCLP(args.commission)} de comisión`, html, text };
}
