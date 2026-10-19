import { useState, useEffect, useMemo, useCallback } from 'react';
import { Convocatoria, ConvocatoriasSyncMeta } from '../types/convocatoria';
import { ChileanFund } from '../types/funds';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { enrichConvocatoria, updateFundsWithLiveConvocatorias } from '../utils/convocatorias';
import { db } from '../firebase';
import { collection, doc, getDocs, getDoc, onSnapshot } from 'firebase/firestore';

export function useConvocatorias() {
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [syncMeta, setSyncMeta] = useState<ConvocatoriasSyncMeta | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch convocatorias from Firestore or API
  const fetchConvocatorias = useCallback(async () => {
    try {
      // 1. Intentar Firestore directamente (lectura pública)
      const convosRef = collection(db, 'convocatorias');
      const snap = await getDocs(convosRef);

      if (!snap.empty) {
        const list: Convocatoria[] = [];
        snap.forEach(d => {
          list.push(enrichConvocatoria(d.data()));
        });
        setConvocatorias(list);

        const metaDoc = await getDoc(doc(db, 'meta', 'convocatoriasSync'));
        if (metaDoc.exists()) {
          setSyncMeta(metaDoc.data() as ConvocatoriasSyncMeta);
        }
        return;
      }
    } catch (e) {
      console.warn('Firestore direct fetch failed, trying API fallback:', e);
    }

    // 2. Fallback a /api/convocatorias
    try {
      const res = await fetch('/api/convocatorias');
      if (res.ok) {
        const data = await res.json();
        const list = (data.convocatorias || []).map((c: any) => enrichConvocatoria(c));
        setConvocatorias(list);
        if (data.meta) {
          setSyncMeta(data.meta);
        }
      }
    } catch (err) {
      console.warn('Could not fetch convocatorias from API:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConvocatorias().finally(() => setLoading(false));

    // Suscribirse a cambios en Firestore si está disponible
    try {
      const unsubConvos = onSnapshot(collection(db, 'convocatorias'), (snapshot) => {
        if (!snapshot.empty) {
          const list: Convocatoria[] = [];
          snapshot.forEach(d => {
            list.push(enrichConvocatoria(d.data()));
          });
          setConvocatorias(list);
        }
      }, () => {});

      const unsubMeta = onSnapshot(doc(db, 'meta', 'convocatoriasSync'), (docSnap) => {
        if (docSnap.exists()) {
          setSyncMeta(docSnap.data() as ConvocatoriasSyncMeta);
        }
      }, () => {});

      return () => {
        unsubConvos();
        unsubMeta();
      };
    } catch {}
  }, [fetchConvocatorias]);

  // Convocatorias activas (vigentes y abiertas/próximas)
  const activeConvocatorias = useMemo(() => {
    return convocatorias.filter(c => c.vigente);
  }, [convocatorias]);

  // Requirement 7: Si lastSyncAt tiene más de 48 horas, muestra advertencia
  const isStale = useMemo(() => {
    if (!syncMeta?.lastSyncAt) return true;
    const syncTime = new Date(syncMeta.lastSyncAt).getTime();
    if (isNaN(syncTime)) return true;
    const diffHours = (Date.now() - syncTime) / (1000 * 60 * 60);
    return diffHours > 48;
  }, [syncMeta]);

  // Requirement 5: Relaciona automáticamente las convocatorias con los fondos de CHILEAN_FUNDS
  // Cuando exista una convocatoria vigente para un fondo, su callStatus y closeDate se toman de ahí; si no, queda "por_confirmar".
  const liveFunds = useMemo(() => {
    return updateFundsWithLiveConvocatorias(CHILEAN_FUNDS, activeConvocatorias);
  }, [activeConvocatorias]);

  return {
    convocatorias,
    activeConvocatorias,
    syncMeta,
    isStale,
    loading,
    liveFunds,
    refreshConvocatorias: fetchConvocatorias
  };
}
