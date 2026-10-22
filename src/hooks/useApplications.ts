import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChileanFund, CompanyProfile, FormulationOutput, BlindAuditResult, GeneratedDocument } from '../types/funds';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { resolveFund } from '../utils/convocatoriaFund';
import { ApplicationItem, ApplicationStatus } from '../types/application';
import { RoadmapConfirmations, DocChecklistStatuses } from '../types/expediente';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { 
  loadActiveFormulation, 
  loadActiveAudit,
  getCurrentUser
} from '../utils/storage';

export function useApplications(profile: CompanyProfile) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [activeApplicationId, setActiveApplicationIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const userKey = currentUser?.uid || getCurrentUser()?.id || 'guest';
  const localKey = `impulsacap_applications_${userKey}`;
  const activeIdKey = `impulsacap_active_app_id_${userKey}`;

  // Helper to persist to localStorage
  const persistLocal = useCallback((items: ApplicationItem[], activeId?: string | null) => {
    try {
      localStorage.setItem(localKey, JSON.stringify(items));
      if (activeId !== undefined) {
        if (activeId) {
          localStorage.setItem(activeIdKey, activeId);
        } else {
          localStorage.removeItem(activeIdKey);
        }
      }
    } catch (e) {
      console.warn('Could not save applications to localStorage', e);
    }
  }, [localKey, activeIdKey]);

  // Load initial from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(localKey);
      const savedActiveId = localStorage.getItem(activeIdKey);
      if (raw) {
        const parsed: ApplicationItem[] = JSON.parse(raw);
        setApplications(parsed);
        if (savedActiveId && parsed.some(a => a.id === savedActiveId)) {
          setActiveApplicationIdState(savedActiveId);
        } else if (parsed.length > 0) {
          const firstActive = parsed.find(a => a.status !== 'archivada') || parsed[0];
          setActiveApplicationIdState(firstActive.id);
        }
      }
    } catch {}
  }, [localKey, activeIdKey]);

  // Firebase Auth sync & Firestore fetch / migration
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setCurrentUser(fbUser);
      setLoading(true);

      const effectiveUid = fbUser?.uid || getCurrentUser()?.id;

      if (!effectiveUid) {
        // Guest mode: ensure at least one guest application exists if none
        setLoading(false);
        setApplications(prev => {
          if (prev.length === 0) {
            const defaultFund = CHILEAN_FUNDS[0];
            const guestApp: ApplicationItem = {
              id: `guest_app_${defaultFund.id}`,
              ownerId: 'guest',
              fundId: defaultFund.id,
              fundName: defaultFund.name,
              status: 'en_preparacion',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              answersBySection: {},
              generatedTextsBySection: {},
              formulation: null,
              auditResult: null,
              docStatuses: {
                f29_sii: Boolean(profile.taxFolderUploaded),
                estatuto_res: false,
                deuda_tgr: false,
                previsional_f30: false,
                carta_interes_loi: false
              },
              roadmapConfirmations: {
                confirmedInicioActividades: false,
                confirmedEstatutoSocial: false,
                confirmedGarantia: false
              },
              generatedDocs: []
            };
            persistLocal([guestApp], guestApp.id);
            setActiveApplicationIdState(guestApp.id);
            return [guestApp];
          }
          return prev;
        });
        return;
      }

      // Authenticated user: Load from Firestore
      try {
        const appsRef = collection(db, 'applications');
        const q = query(appsRef, where('ownerId', '==', effectiveUid));
        const snap = await getDocs(q);

        let firestoreApps: ApplicationItem[] = [];
        snap.forEach(d => {
          firestoreApps.push(d.data() as ApplicationItem);
        });

        // Requirement 3: Data Migration if no applications exist but user has old saved formulation/audit
        // Solo se migra si había trabajo anterior guardado; una cuenta nueva parte sin postulaciones
        const oldFormulationCheck = firestoreApps.length === 0 ? loadActiveFormulation(effectiveUid) : null;
        const oldAuditCheck = firestoreApps.length === 0 ? loadActiveAudit(effectiveUid) : null;
        if (firestoreApps.length === 0 && (oldFormulationCheck || oldAuditCheck)) {
          const oldFormulation = oldFormulationCheck;
          const oldAudit = oldAuditCheck;

          // Find fund for old formulation, or default to first fund
          const targetFund = (oldFormulation?.fundId 
            ? CHILEAN_FUNDS.find(f => f.id === oldFormulation.fundId)
            : null) || CHILEAN_FUNDS[0];

          const migratedApp: ApplicationItem = {
            id: `app_${effectiveUid}_${targetFund.id}`,
            ownerId: effectiveUid,
            fundId: targetFund.id,
            fundName: targetFund.name,
            status: 'en_preparacion',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            answersBySection: {},
            generatedTextsBySection: {},
            formulation: oldFormulation,
            auditResult: oldAudit,
            docStatuses: {
              f29_sii: Boolean(profile.taxFolderUploaded),
              estatuto_res: false,
              deuda_tgr: false,
              previsional_f30: false,
              carta_interes_loi: false
            },
            roadmapConfirmations: {
              confirmedInicioActividades: false,
              confirmedEstatutoSocial: false,
              confirmedGarantia: false
            },
            generatedDocs: []
          };

          // Save migrated app to Firestore
          try {
            await setDoc(doc(db, 'applications', migratedApp.id), migratedApp);
            firestoreApps = [migratedApp];
          } catch (e) {
            console.warn('Could not save migrated application to Firestore:', e);
            firestoreApps = [migratedApp];
          }
        }

        setApplications(firestoreApps);

        // Determine active application
        const savedActiveId = localStorage.getItem(`impulsacap_active_app_id_${effectiveUid}`);
        if (savedActiveId && firestoreApps.some(a => a.id === savedActiveId && a.status !== 'archivada')) {
          setActiveApplicationIdState(savedActiveId);
        } else {
          const firstActive = firestoreApps.find(a => a.status !== 'archivada') || firestoreApps[0];
          const chosenId = firstActive ? firstActive.id : null;
          setActiveApplicationIdState(chosenId);
          if (chosenId) {
            localStorage.setItem(`impulsacap_active_app_id_${effectiveUid}`, chosenId);
          }
        }

        persistLocal(firestoreApps);
      } catch (err) {
        console.warn('Error fetching applications from Firestore:', err);
        // Fall back to localStorage
        try {
          const raw = localStorage.getItem(`impulsacap_applications_${effectiveUid}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            setApplications(parsed);
          }
        } catch {}
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [profile.taxFolderUploaded, persistLocal]);

  // Derived application collections
  const activeApplications = useMemo(() => {
    return applications.filter(a => a.status !== 'archivada');
  }, [applications]);

  const archivedApplications = useMemo(() => {
    return applications.filter(a => a.status === 'archivada');
  }, [applications]);

  const activeApplication = useMemo(() => {
    if (!activeApplicationId) {
      return activeApplications[0] || applications[0] || null;
    }
    return applications.find(a => a.id === activeApplicationId) || activeApplications[0] || applications[0] || null;
  }, [applications, activeApplicationId, activeApplications]);

  const activeFund = useMemo(() => {
    if (!activeApplication) return CHILEAN_FUNDS[0];
    const found = resolveFund(activeApplication);
    return found || CHILEAN_FUNDS[0];
  }, [activeApplication]);

  const setActiveApplicationId = useCallback((id: string) => {
    setActiveApplicationIdState(id);
    const key = `impulsacap_active_app_id_${currentUser?.uid || getCurrentUser()?.id || 'guest'}`;
    try {
      localStorage.setItem(key, id);
    } catch {}
  }, [currentUser]);

  // Save single application update to state, local storage and Firestore
  const saveApplication = useCallback(async (updatedApp: ApplicationItem) => {
    const updatedWithDate = {
      ...updatedApp,
      updatedAt: new Date().toISOString()
    };

    setApplications(prev => {
      const exists = prev.some(a => a.id === updatedWithDate.id);
      const next = exists
        ? prev.map(a => (a.id === updatedWithDate.id ? updatedWithDate : a))
        : [...prev, updatedWithDate];
      persistLocal(next);
      return next;
    });

    // Firestore sync if signed in
    if (currentUser?.uid) {
      try {
        await setDoc(doc(db, 'applications', updatedWithDate.id), updatedWithDate, { merge: true });
      } catch (err) {
        console.warn('Could not sync application to Firestore:', err);
      }
    }
  }, [currentUser, persistLocal]);

  // Create Application (Requirement 7, 8, 9, 10, 11)
  const createApplication = useCallback(async (
    fundOrId: string | ChileanFund
  ): Promise<{ ok: boolean; application?: ApplicationItem; error?: string; limitReached?: boolean }> => {
    const fundId = typeof fundOrId === 'string' ? fundOrId : fundOrId.id;
    const catalogFund = CHILEAN_FUNDS.find(f => f.id === fundId);
    // Fondo del catálogo o ficha de una convocatoria del monitor (se guarda en la postulación)
    const targetFund = catalogFund || (typeof fundOrId === 'string' ? CHILEAN_FUNDS[0] : fundOrId);
    const snapshot = !catalogFund && typeof fundOrId !== 'string' ? fundOrId : null;

    // Requirement 9: No permitir dos postulaciones activas al mismo fondo
    const existing = activeApplications.find(a => a.fundId === fundId);
    if (existing) {
      setActiveApplicationId(existing.id);
      return { 
        ok: false, 
        application: existing, 
        error: `Ya tienes una postulación activa para ${targetFund.name}. Te hemos redirigido a ella.` 
      };
    }

    // Requirement 11: Límite de 3 postulaciones simultáneas del Plan Trimestral
    if (activeApplications.length >= 3) {
      return {
        ok: false,
        limitReached: true,
        error: 'Has alcanzado el límite de 3 postulaciones simultáneas del Plan Trimestral. Puedes archivar una postulación activa para liberar cupo e iniciar una nueva.'
      };
    }

    const currentUid = currentUser?.uid || getCurrentUser()?.id || 'guest';
    const newId = `app_${currentUid}_${fundId.slice(0, 40)}_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);

    const newApp: ApplicationItem = {
      id: newId,
      ownerId: currentUid,
      fundId: targetFund.id,
      fundName: targetFund.name.slice(0, 160),
      ...(snapshot ? { fundSnapshot: JSON.parse(JSON.stringify(snapshot)), convocatoriaId: (snapshot as any).convocatoriaId || null } : {}),
      status: 'en_preparacion',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      answersBySection: {},
      generatedTextsBySection: {},
      formulation: null,
      auditResult: null,
      docStatuses: {
        f29_sii: Boolean(profile.taxFolderUploaded),
        estatuto_res: false,
        deuda_tgr: false,
        previsional_f30: false,
        carta_interes_loi: false
      },
      roadmapConfirmations: {
        confirmedInicioActividades: false,
        confirmedEstatutoSocial: false,
        confirmedGarantia: false
      },
      generatedDocs: []
    };

    await saveApplication(newApp);
    setActiveApplicationId(newApp.id);

    return { ok: true, application: newApp };
  }, [activeApplications, currentUser, profile.taxFolderUploaded, saveApplication, setActiveApplicationId]);

  // Archive Application (Requirement 1, 11)
  const archiveApplication = useCallback(async (
    applicationId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const target = applications.find(a => a.id === applicationId);
    if (!target) return { ok: false, error: 'Postulación no encontrada' };

    const archived: ApplicationItem = {
      ...target,
      status: 'archivada',
      updatedAt: new Date().toISOString()
    };

    await saveApplication(archived);

    // If active app was archived, switch active application to another active postulation
    if (activeApplicationId === applicationId) {
      const remainingActive = applications.filter(a => a.id !== applicationId && a.status !== 'archivada');
      if (remainingActive.length > 0) {
        setActiveApplicationId(remainingActive[0].id);
      } else {
        setActiveApplicationIdState(null);
      }
    }

    return { ok: true };
  }, [applications, activeApplicationId, saveApplication, setActiveApplicationId]);

  // Reactivate Application (Requirement 11)
  const reactivateApplication = useCallback(async (
    applicationId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const target = applications.find(a => a.id === applicationId);
    if (!target) return { ok: false, error: 'Postulación no encontrada' };

    if (activeApplications.length >= 3) {
      return {
        ok: false,
        error: 'No puedes reactivar esta postulación porque ya tienes 3 postulaciones activas simultáneas. Archiva una postulación primero.'
      };
    }

    const reactivated: ApplicationItem = {
      ...target,
      status: 'en_preparacion',
      updatedAt: new Date().toISOString()
    };

    await saveApplication(reactivated);
    setActiveApplicationId(reactivated.id);
    return { ok: true };
  }, [applications, activeApplications, saveApplication, setActiveApplicationId]);

  // Scoped updates for active application.
  // Cada cambio se aplica sobre la versión MÁS RECIENTE de la postulación (ref sincronizado) y a Firestore
  // solo se envían los campos que cambian (merge). Así un guardado no pisa lo que otro acaba de escribir
  // (antes: guardar la formulación devolvía el texto editado a su versión anterior).
  const applicationsRef = useRef<ApplicationItem[]>(applications);
  applicationsRef.current = applications;
  const activeAppIdRef = useRef<string | null>(null);
  activeAppIdRef.current = activeApplication?.id || null;

  const patchActive = useCallback(async (
    build: (app: ApplicationItem) => { local: Partial<ApplicationItem>; remote?: Record<string, any> }
  ) => {
    const id = activeAppIdRef.current;
    if (!id) return false;
    const list = applicationsRef.current;
    const app = list.find(a => a.id === id);
    if (!app) return false;
    const { local, remote } = build(app);
    const now = new Date().toISOString();
    const updated: ApplicationItem = { ...app, ...local, updatedAt: now };
    const next = list.map(a => (a.id === id ? updated : a));
    applicationsRef.current = next;
    setApplications(next);
    persistLocal(next);
    if (currentUser?.uid) {
      try {
        await setDoc(doc(db, 'applications', id), {
          ownerId: app.ownerId,
          fundId: app.fundId,
          fundName: app.fundName,
          status: app.status,
          ...(remote ?? local),
          updatedAt: now
        }, { merge: true });
      } catch (err) {
        console.warn('Could not sync application patch to Firestore:', err);
        return false;
      }
    }
    return true;
  }, [currentUser, persistLocal]);

  const updateActiveFormulation = useCallback(async (formulation: FormulationOutput) => {
    return patchActive(() => ({ local: { formulation } }));
  }, [patchActive]);

  const updateActiveAuditResult = useCallback(async (auditResult: BlindAuditResult) => {
    await patchActive(() => ({ local: { auditResult } }));
  }, [patchActive]);

  const updateActiveRoadmapConfirmations = useCallback(async (roadmapConfirmations: Partial<RoadmapConfirmations>) => {
    await patchActive(app => ({
      local: {
        roadmapConfirmations: {
          ...(app.roadmapConfirmations || {
            confirmedInicioActividades: false,
            confirmedEstatutoSocial: false,
            confirmedGarantia: false
          }),
          ...roadmapConfirmations
        } as RoadmapConfirmations
      }
    }));
  }, [patchActive]);

  const updateActiveDocStatuses = useCallback(async (docStatuses: Partial<DocChecklistStatuses>) => {
    await patchActive(app => ({
      local: {
        docStatuses: {
          ...(app.docStatuses || {
            f29_sii: Boolean(profile.taxFolderUploaded),
            estatuto_res: false,
            deuda_tgr: false,
            previsional_f30: false,
            carta_interes_loi: false
          }),
          ...docStatuses
        } as DocChecklistStatuses
      }
    }));
  }, [patchActive, profile.taxFolderUploaded]);

  const addActiveGeneratedDoc = useCallback(async (docItem: GeneratedDocument) => {
    await patchActive(app => ({
      local: {
        generatedDocs: [
          ...(app.generatedDocs || []).filter(d => d.id !== docItem.id),
          { ...docItem, applicationId: app.id } as any
        ]
      }
    }));
  }, [patchActive]);

  const updateActiveGeneratedDocStatus = useCallback(async (docId: string, status: 'borrador' | 'firmada') => {
    await patchActive(app => ({
      local: { generatedDocs: (app.generatedDocs || []).map(d => (d.id === docId ? { ...d, status } : d)) }
    }));
  }, [patchActive]);

  const deleteActiveGeneratedDoc = useCallback(async (docId: string) => {
    await patchActive(app => ({
      local: { generatedDocs: (app.generatedDocs || []).filter(d => d.id !== docId) }
    }));
  }, [patchActive]);

  const saveActiveSectionAnswers = useCallback(async (
    sectionKey: string,
    answers: Record<string, string>,
    generatedText?: string
  ) => {
    await patchActive(app => {
      const local: Partial<ApplicationItem> = {
        answersBySection: { ...(app.answersBySection || {}), [sectionKey]: answers }
      };
      const remote: Record<string, any> = { answersBySection: { [sectionKey]: answers } };
      if (typeof generatedText === 'string') {
        local.generatedTextsBySection = { ...(app.generatedTextsBySection || {}), [sectionKey]: generatedText };
        remote.generatedTextsBySection = { [sectionKey]: generatedText };
      }
      return { local, remote };
    });
  }, [patchActive]);

  return {
    applications,
    activeApplications,
    archivedApplications,
    activeApplication,
    activeApplicationId,
    activeFund,
    loading,
    setActiveApplicationId,
    createApplication,
    archiveApplication,
    reactivateApplication,
    saveApplication,
    updateActiveFormulation,
    updateActiveAuditResult,
    updateActiveRoadmapConfirmations,
    updateActiveDocStatuses,
    addActiveGeneratedDoc,
    updateActiveGeneratedDocStatus,
    deleteActiveGeneratedDoc,
    saveActiveSectionAnswers
  };
}
