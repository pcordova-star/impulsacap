import { useState, useEffect, useCallback, useRef } from 'react';
import { ExpedienteData, TaxFolderData, RoadmapConfirmations, DocChecklistStatuses } from '../types/expediente';
import { CompanyProfile, FormulationOutput, BlindAuditResult, GeneratedDocument, ChileanFund } from '../types/funds';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getCleanDefaultProfile } from '../utils/storage';

export function useExpediente(currentFund: ChileanFund, initialProfile?: CompanyProfile) {
  const user = auth.currentUser;
  const userKey = user?.uid || 'guest';
  const fundId = currentFund.id;
  const expedienteId = `exp_${userKey}_${fundId}`.replace(/[^a-zA-Z0-9_-]/g, '_');

  const getDefaultExpediente = useCallback((): ExpedienteData => {
    const prof = initialProfile || getCleanDefaultProfile(null);
    return {
      id: expedienteId,
      ownerId: userKey,
      fundId: fundId,
      fundName: currentFund.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      profile: prof,
      taxFolder: {
        fileName: prof.taxFolderFileName,
        uploadDate: prof.taxFolderUploadDate,
        rut: prof.rut,
        companyName: prof.companyName,
        monthsActive: prof.monthsActive,
        annualSalesCLP: prof.annualSalesCLP,
        salesBracket: prof.salesBracket,
        f29Periods: prof.taxFolderF29Periods || 0,
        siiStatusObservations: prof.taxFolderSummary,
        admissibilityVerdict: prof.taxFolderUploaded ? 'aprobado' : null,
        taxFolderUploaded: Boolean(prof.taxFolderUploaded)
      },
      roadmapConfirmations: {
        confirmedInicioActividades: localStorage.getItem(`confirmed_inicio_${userKey}`) === 'true',
        confirmedEstatutoSocial: localStorage.getItem(`confirmed_estatuto_${userKey}`) === 'true',
        confirmedGarantia: localStorage.getItem(`confirmed_garantia_${userKey}`) === 'true'
      },
      docStatuses: {
        f29_sii: Boolean(prof.taxFolderUploaded),
        estatuto_res: false, // Inicia pendiente como exige el requerimiento
        deuda_tgr: false,
        previsional_f30: false,
        carta_interes_loi: false
      },
      generatedDocs: [],
      answersBySection: {},
      generatedTextsBySection: {},
      formulation: null,
      auditResult: null
    };
  }, [userKey, fundId, currentFund.name, expedienteId, initialProfile]);

  const [expediente, setExpediente] = useState<ExpedienteData>(() => {
    try {
      const cached = localStorage.getItem(`impulsacap_exp_${userKey}_${fundId}`);
      if (cached) {
        const parsed: ExpedienteData = JSON.parse(cached);
        return parsed;
      }
    } catch (e) {
      console.warn('Error reading cached expediente:', e);
    }
    return getDefaultExpediente();
  });

  const [loading, setLoading] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync to Firestore & localStorage
  const persistExpediente = useCallback((data: ExpedienteData) => {
    try {
      localStorage.setItem(`impulsacap_exp_${userKey}_${fundId}`, JSON.stringify(data));
      // Also sync user profile key for backward compat
      localStorage.setItem(`impulsacap_${userKey}_profile`, JSON.stringify(data.profile));
    } catch (e) {
      console.warn('Error saving to localStorage:', e);
    }

    if (auth.currentUser && userKey !== 'guest') {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await setDoc(doc(db, 'expedientes', data.id), data, { merge: true });
        } catch (err) {
          console.warn('Could not sync expediente to Firestore:', err);
        }
      }, 500);
    }
  }, [userKey, fundId]);

  // Load from Firestore on mount or fund/user change
  useEffect(() => {
    let isMounted = true;
    const loadFromCloud = async () => {
      if (!auth.currentUser || userKey === 'guest') {
        const def = getDefaultExpediente();
        setExpediente(def);
        return;
      }

      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'expedientes', expedienteId));
        if (snap.exists() && isMounted) {
          const cloudData = snap.data() as ExpedienteData;
          setExpediente(cloudData);
          localStorage.setItem(`impulsacap_exp_${userKey}_${fundId}`, JSON.stringify(cloudData));
        } else if (isMounted) {
          // Initialize fresh
          const fresh = getDefaultExpediente();
          setExpediente(fresh);
          persistExpediente(fresh);
        }
      } catch (err) {
        console.warn('Could not load expediente from Firestore:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadFromCloud();
    return () => { isMounted = false; };
  }, [userKey, fundId, expedienteId, getDefaultExpediente, persistExpediente]);

  // Mutation: Profile
  const updateProfile = useCallback((patch: Partial<CompanyProfile>) => {
    setExpediente(prev => {
      const updatedProfile = { ...prev.profile, ...patch };
      const updatedTaxFolder: TaxFolderData = {
        ...prev.taxFolder,
        rut: updatedProfile.rut || prev.taxFolder.rut,
        companyName: updatedProfile.companyName || prev.taxFolder.companyName,
        monthsActive: updatedProfile.monthsActive,
        annualSalesCLP: updatedProfile.annualSalesCLP,
        salesBracket: updatedProfile.salesBracket,
        taxFolderUploaded: Boolean(updatedProfile.taxFolderUploaded)
      };
      const next: ExpedienteData = {
        ...prev,
        profile: updatedProfile,
        taxFolder: updatedTaxFolder,
        docStatuses: {
          ...prev.docStatuses,
          f29_sii: Boolean(updatedProfile.taxFolderUploaded)
        },
        updatedAt: new Date().toISOString()
      };
      persistExpediente(next);
      return next;
    });
  }, [persistExpediente]);

  // Mutation: Tax Folder
  const updateTaxFolder = useCallback((data: Partial<TaxFolderData>) => {
    setExpediente(prev => {
      const isUploaded = data.taxFolderUploaded ?? prev.taxFolder.taxFolderUploaded;
      const updatedTax: TaxFolderData = {
        ...prev.taxFolder,
        ...data,
        taxFolderUploaded: isUploaded
      };
      const updatedProfile: CompanyProfile = {
        ...prev.profile,
        rut: data.rut || prev.profile.rut,
        companyName: data.companyName || prev.profile.companyName,
        monthsActive: data.monthsActive !== undefined ? data.monthsActive : prev.profile.monthsActive,
        salesBracket: (data.salesBracket as any) !== undefined ? (data.salesBracket as any) : prev.profile.salesBracket,
        annualSalesCLP: data.annualSalesCLP !== undefined ? data.annualSalesCLP : prev.profile.annualSalesCLP,
        taxFolderUploaded: isUploaded,
        taxFolderFileName: data.fileName || prev.profile.taxFolderFileName,
        taxFolderUploadDate: data.uploadDate || prev.profile.taxFolderUploadDate,
        taxFolderSummary: data.siiStatusObservations || prev.profile.taxFolderSummary
      };
      const next: ExpedienteData = {
        ...prev,
        taxFolder: updatedTax,
        profile: updatedProfile,
        docStatuses: {
          ...prev.docStatuses,
          f29_sii: isUploaded
        },
        updatedAt: new Date().toISOString()
      };
      persistExpediente(next);
      return next;
    });
  }, [persistExpediente]);

  // Mutation: Roadmap Confirmations
  const updateRoadmapConfirmations = useCallback((patch: Partial<RoadmapConfirmations>) => {
    setExpediente(prev => {
      const updatedRoadmap = { ...prev.roadmapConfirmations, ...patch };
      // Sync localStorage keys
      if (patch.confirmedInicioActividades !== undefined) {
        localStorage.setItem(`confirmed_inicio_${userKey}`, String(patch.confirmedInicioActividades));
      }
      if (patch.confirmedEstatutoSocial !== undefined) {
        localStorage.setItem(`confirmed_estatuto_${userKey}`, String(patch.confirmedEstatutoSocial));
      }
      if (patch.confirmedGarantia !== undefined) {
        localStorage.setItem(`confirmed_garantia_${userKey}`, String(patch.confirmedGarantia));
      }

      const next: ExpedienteData = {
        ...prev,
        roadmapConfirmations: updatedRoadmap,
        docStatuses: {
          ...prev.docStatuses,
          estatuto_res: patch.confirmedEstatutoSocial !== undefined ? patch.confirmedEstatutoSocial : prev.docStatuses.estatuto_res
        },
        updatedAt: new Date().toISOString()
      };
      persistExpediente(next);
      return next;
    });
  }, [userKey, persistExpediente]);

  // Mutation: Checklist Doc Statuses
  const updateDocStatuses = useCallback((patch: Partial<DocChecklistStatuses>) => {
    setExpediente(prev => {
      const nextStatuses = { ...prev.docStatuses, ...patch };
      const next: ExpedienteData = {
        ...prev,
        docStatuses: nextStatuses,
        updatedAt: new Date().toISOString()
      };
      persistExpediente(next);
      return next;
    });
  }, [persistExpediente]);

  // Mutation: Generated Documents (Add, Update status, Delete)
  const addGeneratedDoc = useCallback((newDoc: GeneratedDocument) => {
    setExpediente(prev => {
      const updatedDocs = [newDoc, ...prev.generatedDocs];
      const signedLoiCount = updatedDocs.filter(
        d => (d.tipo.includes('LOI') || d.tipo.includes('Interés')) && d.status === 'firmada'
      ).length;

      const next: ExpedienteData = {
        ...prev,
        generatedDocs: updatedDocs,
        profile: {
          ...prev.profile,
          customerValidationCount: signedLoiCount
        },
        docStatuses: {
          ...prev.docStatuses,
          carta_interes_loi: signedLoiCount > 0
        },
        updatedAt: new Date().toISOString()
      };
      persistExpediente(next);
      return next;
    });
  }, [persistExpediente]);

  const updateGeneratedDocStatus = useCallback((docId: string, status: 'borrador' | 'firmada') => {
    setExpediente(prev => {
      const updatedDocs = prev.generatedDocs.map(d => 
        d.id === docId ? { ...d, status, updatedAt: new Date().toISOString() } : d
      );
      const signedLoiCount = updatedDocs.filter(
        d => (d.tipo.includes('LOI') || d.tipo.includes('Interés')) && d.status === 'firmada'
      ).length;

      const next: ExpedienteData = {
        ...prev,
        generatedDocs: updatedDocs,
        profile: {
          ...prev.profile,
          customerValidationCount: signedLoiCount
        },
        docStatuses: {
          ...prev.docStatuses,
          carta_interes_loi: signedLoiCount > 0
        },
        updatedAt: new Date().toISOString()
      };
      persistExpediente(next);
      return next;
    });
  }, [persistExpediente]);

  const deleteGeneratedDoc = useCallback((docId: string) => {
    setExpediente(prev => {
      const updatedDocs = prev.generatedDocs.filter(d => d.id !== docId);
      const signedLoiCount = updatedDocs.filter(
        d => (d.tipo.includes('LOI') || d.tipo.includes('Interés')) && d.status === 'firmada'
      ).length;

      const next: ExpedienteData = {
        ...prev,
        generatedDocs: updatedDocs,
        profile: {
          ...prev.profile,
          customerValidationCount: signedLoiCount
        },
        docStatuses: {
          ...prev.docStatuses,
          carta_interes_loi: signedLoiCount > 0
        },
        updatedAt: new Date().toISOString()
      };
      persistExpediente(next);
      return next;
    });
  }, [persistExpediente]);

  // Mutation: Section answers and generated texts (AiFormulator)
  const saveSectionAnswers = useCallback((sectionId: string, answers: Record<string, string>, generatedText?: string) => {
    setExpediente(prev => {
      const updatedAnswers = {
        ...prev.answersBySection,
        [sectionId]: answers
      };
      const updatedTexts = generatedText !== undefined ? {
        ...prev.generatedTextsBySection,
        [sectionId]: generatedText
      } : prev.generatedTextsBySection;

      const next: ExpedienteData = {
        ...prev,
        answersBySection: updatedAnswers,
        generatedTextsBySection: updatedTexts,
        updatedAt: new Date().toISOString()
      };
      persistExpediente(next);
      return next;
    });
  }, [persistExpediente]);

  // Mutation: Full Formulation
  const updateFormulation = useCallback((formulation: FormulationOutput | null) => {
    setExpediente(prev => {
      const next: ExpedienteData = {
        ...prev,
        formulation,
        updatedAt: new Date().toISOString()
      };
      persistExpediente(next);
      return next;
    });
  }, [persistExpediente]);

  // Mutation: Audit Result
  const updateAuditResult = useCallback((auditResult: BlindAuditResult | null) => {
    setExpediente(prev => {
      const next: ExpedienteData = {
        ...prev,
        auditResult,
        updatedAt: new Date().toISOString()
      };
      persistExpediente(next);
      return next;
    });
  }, [persistExpediente]);

  return {
    expediente,
    loading,
    updateProfile,
    updateTaxFolder,
    updateRoadmapConfirmations,
    updateDocStatuses,
    addGeneratedDoc,
    updateGeneratedDocStatus,
    deleteGeneratedDoc,
    saveSectionAnswers,
    updateFormulation,
    updateAuditResult
  };
}
