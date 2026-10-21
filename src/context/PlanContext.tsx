import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { apiFetch } from '../utils/apiFetch';
import { getStoredRef, previewCode, syncStoredRefToAccount, onReferralChanged } from '../utils/referral';

export interface PlanState {
  hasActivePlan: boolean;
  expiresAt: string | null;
  /** Id del último pago de Mercado Pago que activó o extendió el plan. */
  lastPaymentId: string | null;
  /** Acceso anticipado sin cobro (lanzamiento) */
  provisional: boolean;
  daysLeft: number;
  isFirstPurchase: boolean;
  price: number;
  /** Código de vendedor aplicado a la primera compra (fija el precio) */
  referralCode: string | null;
  referralDiscountPct: number | null;
  referralSellerName: string | null;
  activeFundIds: string[];
  isExpiringSoon: boolean;
  isExpired: boolean;
  loading: boolean;
  planStatus: 'active' | 'expired' | 'none';
  refresh: () => Promise<void>;
}

const defaultPlanState: PlanState = {
  hasActivePlan: false,
  expiresAt: null,
  lastPaymentId: null,
  provisional: false,
  daysLeft: 0,
  isFirstPurchase: true,
  price: 19990,
  referralCode: null,
  referralDiscountPct: null,
  referralSellerName: null,
  activeFundIds: [],
  isExpiringSoon: false,
  isExpired: false,
  loading: true,
  planStatus: 'none',
  refresh: async () => {}
};

const PlanContext = createContext<PlanState>(defaultPlanState);

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [loading, setLoading] = useState<boolean>(true);
  const [entitlementData, setEntitlementData] = useState<{
    plan?: string;
    status?: string;
    expiresAt?: string;
    lastPaymentId?: string;
    provisional?: boolean;
    activeFundIds?: string[];
  } | null>(null);

  const [pricingState, setPricingState] = useState<{
    isFirstPurchase: boolean;
    price: number;
    code: string | null;
    discountPct: number | null;
    sellerName: string | null;
  }>({
    isFirstPurchase: true,
    price: 19990,
    code: null,
    discountPct: null,
    sellerName: null
  });

  // Track auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setEntitlementData(null);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Fetch pricing from /api/pagos/estado
  const fetchPricing = useCallback(async () => {
    if (!currentUser) {
      // Visitante sin cuenta: precio de referencia con el código guardado desde un link
      const stored = getStoredRef();
      const preview = stored ? await previewCode(stored.code) : null;
      if (preview && !('error' in preview)) {
        setPricingState({ isFirstPurchase: true, price: preview.price, code: preview.code, discountPct: preview.discountPct, sellerName: preview.sellerName });
      } else {
        setPricingState({ isFirstPurchase: true, price: 19990, code: null, discountPct: null, sellerName: null });
      }
      return;
    }
    try {
      await syncStoredRefToAccount();
      const res = await apiFetch('/api/pagos/estado');
      if (res.ok) {
        const data = await res.json();
        setPricingState({
          isFirstPurchase: !!data.isFirstPurchase,
          price: data.price || (data.isFirstPurchase ? 19990 : 39990),
          code: data.code || null,
          discountPct: typeof data.discountPct === 'number' ? data.discountPct : null,
          sellerName: data.sellerName || null
        });
      }
    } catch (err) {
      console.warn('Could not fetch pricing state in PlanProvider:', err);
    }
  }, [currentUser]);

  // Cambios de código de vendedor: recalcula el precio
  useEffect(() => onReferralChanged(() => { fetchPricing(); }), [fetchPricing]);

  // Real-time listener on entitlements/{uid} - exactly ONCE for the whole app
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      fetchPricing();
      return;
    }

    setLoading(true);
    fetchPricing();

    const entDocRef = doc(db, 'entitlements', currentUser.uid);
    const unsub = onSnapshot(
      entDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setEntitlementData({
            plan: data.plan,
            status: data.status,
            expiresAt: data.expiresAt,
            lastPaymentId: data.lastPaymentId ? String(data.lastPaymentId) : undefined,
            provisional: data.provisional === true,
            activeFundIds: Array.isArray(data.activeFundIds) ? data.activeFundIds : []
          });
        } else {
          setEntitlementData(null);
        }
        setLoading(false);
      },
      (error) => {
        console.warn('Error listening to entitlements in PlanProvider:', error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [currentUser, fetchPricing]);

  // Compute plan active & expiry status
  const expiresAt = entitlementData?.expiresAt || null;
  let hasActivePlan = false;
  let daysLeft = 0;
  let isExpired = false;
  let planStatus: 'active' | 'expired' | 'none' = 'none';

  if (expiresAt) {
    const expTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));
    daysLeft = Math.max(0, diffDays);

    if (entitlementData?.status === 'active' && expTime > now) {
      hasActivePlan = true;
      planStatus = 'active';
    } else {
      isExpired = true;
      planStatus = 'expired';
    }
  }

  const isExpiringSoon = hasActivePlan && daysLeft <= 7 && daysLeft > 0;
  const activeFundIds = entitlementData?.activeFundIds || [];

  const value: PlanState = {
    hasActivePlan,
    expiresAt,
    lastPaymentId: entitlementData?.lastPaymentId || null,
    provisional: Boolean(entitlementData?.provisional),
    daysLeft,
    isFirstPurchase: pricingState.isFirstPurchase,
    price: pricingState.price,
    referralCode: pricingState.code,
    referralDiscountPct: pricingState.discountPct,
    referralSellerName: pricingState.sellerName,
    activeFundIds,
    isExpiringSoon,
    isExpired,
    loading,
    planStatus,
    refresh: fetchPricing
  };

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
};

export const usePlan = (): PlanState => {
  return useContext(PlanContext);
};
