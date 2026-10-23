/**
 * Cliente mínimo de la API de Flow (flow.cl), versión 3.
 * Cada llamada se firma con HMAC-SHA256: se ordenan los parámetros por nombre, se concatenan
 * como nombre+valor (sin separadores) y se firma con la Secret Key. La firma va en el parámetro "s".
 * Las claves viven solo en variables de entorno (Secrets): FLOW_API_KEY y FLOW_SECRET_KEY.
 */
import { createHmac } from 'node:crypto';

const PROD_URL = 'https://www.flow.cl/api';
const SANDBOX_URL = 'https://sandbox.flow.cl/api';

export function flowConfig() {
  const apiKey = (process.env.FLOW_API_KEY || '').trim();
  const secretKey = (process.env.FLOW_SECRET_KEY || '').trim();
  const sandbox = ['1', 'true', 'si', 'sí', 'sandbox'].includes(String(process.env.FLOW_SANDBOX || '').trim().toLowerCase());
  const baseUrl = (process.env.FLOW_API_URL || (sandbox ? SANDBOX_URL : PROD_URL)).replace(/\/$/, '');
  return { apiKey, secretKey, baseUrl, sandbox, configured: Boolean(apiKey && secretKey) };
}

export function flowSign(params: Record<string, string | number>, secretKey: string): string {
  const toSign = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  return createHmac('sha256', secretKey).update(toSign).digest('hex');
}

async function flowCall<T>(method: 'GET' | 'POST', path: string, params: Record<string, string | number>): Promise<T> {
  const cfg = flowConfig();
  if (!cfg.configured) throw new Error('Flow no está configurado (faltan FLOW_API_KEY o FLOW_SECRET_KEY).');
  const all: Record<string, string | number> = { ...params, apiKey: cfg.apiKey };
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(all)) body.append(k, String(v));
  body.append('s', flowSign(all, cfg.secretKey));
  const url = `${cfg.baseUrl}${path}`;
  const res = method === 'GET'
    ? await fetch(`${url}?${body.toString()}`, { signal: AbortSignal.timeout(20000) })
    : await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(20000)
      });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* respuesta no JSON */ }
  if (!res.ok) {
    // Flow responde { code, message } en los errores; nunca se registran las claves
    throw new Error(`Flow ${path} respondió ${res.status}: ${data?.message || text.slice(0, 200)}`);
  }
  return data as T;
}

export interface FlowPaymentStatus {
  flowOrder: number;
  commerceOrder: string;
  requestDate: string;
  /** 1 pendiente, 2 pagada, 3 rechazada, 4 anulada */
  status: number;
  subject: string;
  currency: string;
  amount: number | string;
  payer: string;
  optional?: any;
  paymentData?: { date?: string; media?: string; amount?: number | string; fee?: number | string; balance?: number | string; transferDate?: string } | null;
}

/** Crea una orden de cobro y devuelve la URL a la que se envía al comprador. */
export async function flowCreatePayment(p: {
  commerceOrder: string;
  subject: string;
  amount: number;
  email: string;
  urlConfirmation: string;
  urlReturn: string;
}) {
  const r = await flowCall<{ url: string; token: string; flowOrder: number }>('POST', '/payment/create', {
    commerceOrder: p.commerceOrder,
    subject: p.subject,
    currency: 'CLP',
    amount: Math.round(p.amount),
    email: p.email,
    paymentMethod: 9, // todos los medios habilitados en el comercio
    urlConfirmation: p.urlConfirmation,
    urlReturn: p.urlReturn
  });
  return { redirectUrl: `${r.url}?token=${encodeURIComponent(r.token)}`, token: r.token, flowOrder: r.flowOrder };
}

/** Estado oficial de un pago a partir del token que Flow envía. Nunca se confía en lo que trae la notificación. */
export function flowGetStatus(token: string) {
  return flowCall<FlowPaymentStatus>('GET', '/payment/getStatus', { token });
}
