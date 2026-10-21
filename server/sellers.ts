/**
 * Vendedores: códigos que identifican al vendedor, fijan el precio de la primera compra
 * (reemplazan al 50% de primera compra) y generan una comisión sobre lo pagado.
 *
 * Colecciones (solo servidor):
 *  - sellers/{CODE}          { code, name, email, discountPct, commissionPct, active, createdAt, updatedAt }
 *  - referrals/{uid}         { code, appliedAt, source }  — código del comprador, vale hasta su primera compra
 *  - checkout_orders/{ref}   { uid, price, code, commissionPct, createdAt } — precio esperado por preferencia
 *  - seller_sales/{payment}  { code, sellerEmail, uid, buyerEmail, companyName, amount, commissionPct, commission, status, createdAt, paidAt }
 */
import type { Firestore } from 'firebase-admin/firestore';

export const PRICE_FULL = 39990;
export const PRICE_FIRST = 19990;
export const MAX_DISCOUNT_PCT = 90;
export const MAX_COMMISSION_PCT = 80;

export interface Seller {
  code: string;
  name: string;
  email: string;
  discountPct: number;
  commissionPct: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Pricing {
  isFirstPurchase: boolean;
  price: number;
  code: string | null;
  discountPct: number | null;
  commissionPct: number | null;
  sellerName: string | null;
}

export function normalizeCode(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 20);
}

export const isValidCodeFormat = (code: string) => /^[A-Z0-9][A-Z0-9_-]{2,19}$/.test(code);

/** Precio del Plan Trimestral con el descuento del código, sobre el precio normal. */
export function priceWithDiscount(discountPct: number): number {
  const pct = Math.min(MAX_DISCOUNT_PCT, Math.max(0, Number(discountPct) || 0));
  // Redondeado hacia abajo a la decena: $15.990 en vez de $15.996
  return Math.floor((PRICE_FULL * (1 - pct / 100)) / 10) * 10;
}

export function commissionFor(amount: number, commissionPct: number): number {
  const pct = Math.min(MAX_COMMISSION_PCT, Math.max(0, Number(commissionPct) || 0));
  return Math.round((Number(amount) || 0) * pct / 100);
}

/** Primer nombre para mostrar al comprador ("Código de Juan"). */
export const firstName = (name: string) => String(name || '').trim().split(/\s+/)[0] || '';

export async function getActiveSeller(db: Firestore, rawCode: unknown): Promise<Seller | null> {
  const code = normalizeCode(rawCode);
  if (!isValidCodeFormat(code)) return null;
  const snap = await db.collection('sellers').doc(code).get();
  if (!snap.exists) return null;
  const s = snap.data() as Seller;
  return s.active ? { ...s, code } : null;
}

export async function hasApprovedPayment(db: Firestore, uid: string): Promise<boolean> {
  const snap = await db.collection('payments').where('uid', '==', uid).where('status', '==', 'approved').limit(1).get();
  return !snap.empty;
}

/**
 * Precio que corresponde al usuario. Primera compra: el código vigente define el precio;
 * sin código, 50% de descuento. Compras siguientes: precio normal y sin código.
 */
export async function resolvePricing(db: Firestore, uid: string): Promise<Pricing> {
  const none = { code: null, discountPct: null, commissionPct: null, sellerName: null };
  let isFirstPurchase = true;
  try {
    isFirstPurchase = !(await hasApprovedPayment(db, uid));
  } catch {
    isFirstPurchase = true;
  }
  if (!isFirstPurchase) return { isFirstPurchase, price: PRICE_FULL, ...none };

  try {
    const ref = await db.collection('referrals').doc(uid).get();
    const code = ref.exists ? ref.data()?.code : null;
    if (code) {
      const seller = await getActiveSeller(db, code);
      if (seller) {
        return {
          isFirstPurchase,
          price: priceWithDiscount(seller.discountPct),
          code: seller.code,
          discountPct: seller.discountPct,
          commissionPct: seller.commissionPct,
          sellerName: firstName(seller.name)
        };
      }
    }
  } catch (e: any) {
    console.warn('[vendedores] No se pudo leer el código del usuario:', e?.message);
  }
  return { isFirstPurchase, price: PRICE_FIRST, ...none };
}

/** Oculta parte del correo del comprador en el panel del vendedor. */
export function maskEmail(email: string): string {
  const [user, domain] = String(email || '').split('@');
  if (!user || !domain) return '';
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(6, user.length - 2)))}@${domain}`;
}
