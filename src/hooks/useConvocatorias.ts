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
    // Respaldo: /api/convocatorias (si la lectura en vivo no responde)
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
    // Una sola lectura en vivo (antes se leía todo dos veces por visita: una lectura y una suscripción)
    let gotFirst = false;
    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      fetchConvocatorias().finally(() => setLoading(false));
    };
    const safety = setTimeout(() => { if (!gotFirst) fallback(); }, 8000);
    let unsubConvos = () => {};
    let unsubMeta = () => {};
    try {
      unsubConvos = onSnapshot(collection(db, 'convocatorias'), (snapshot) => {
        gotFirst = true;
        clearTimeout(safety);
        if (snapshot.empty) { fallback(); return; }
        const list: Convocatoria[] = [];
        snapshot.forEach(d => { list.push(enrichConvocatoria(d.data())); });
        setConvocatorias(list);
        setLoading(false);
      }, () => { clearTimeout(safety); fallback(); });

      unsubMeta = onSnapshot(doc(db, 'meta', 'convocatoriasSync'), (docSnap) => {
        if (docSnap.exists()) setSyncMeta(docSnap.data() as ConvocatoriasSyncMeta);
      }, () => {});
    } catch {
      clearTimeout(safety);
      fallback();
    }
    return () => {
      clearTimeout(safety);
      unsubConvos();
      unsubMeta();
    };
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
