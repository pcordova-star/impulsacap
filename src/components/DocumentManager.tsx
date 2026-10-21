import React, { useState, useEffect } from 'react';
import { consume, onRequest } from '../utils/navFocus';
import { REQUIRED_DOCUMENTS_GUIDE, CHILEAN_FUNDS } from '../data/chileanFunds';
import { CompanyProfile, ChileanFund, FormulationOutput, CompanyUser, GeneratedDocument } from '../types/funds';
import { ExpedienteData, DocChecklistStatuses } from '../types/expediente';
import { apiFetch } from '../utils/apiFetch';
import { usePlan } from '../hooks/usePlan';
import { PlanPaywallCard } from './PlanPaywallCard';
import { exportMarkdownToDocx } from '../utils/docxExport';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { 
  FileText, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Download, 
  Copy, 
  Check, 
  RefreshCw,
  Building, 
  UserCheck, 
  FileCheck,
  ArrowLeft,
  RotateCcw,
  FileCode,
  Trash2,
  Clock,
  ShieldCheck
} from 'lucide-react';

interface DocumentManagerProps {
  profile: CompanyProfile;
  activeFund?: ChileanFund | null;
  formulation?: FormulationOutput | null;
  currentUser?: CompanyUser | null;
  expediente?: ExpedienteData;
  onUpdateDocStatuses?: (patch: Partial<DocChecklistStatuses>) => void;
  onAddGeneratedDoc?: (doc: GeneratedDocument) => void;
  onUpdateGeneratedDocStatus?: (docId: string, status: 'borrador' | 'firmada') => void;
  onDeleteGeneratedDoc?: (docId: string) => void;
  onNavigateTab?: (tab: string) => void;
  onOpenSiiModal?: () => void;
  onUpdateValidationCount?: (count: number) => void;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({ 
  profile,
  activeFund,
  formulation,
  currentUser,
  expediente,
  onUpdateDocStatuses,
  onAddGeneratedDoc,
  onUpdateGeneratedDocStatus,
  onDeleteGeneratedDoc,
  onNavigateTab,
  onOpenSiiModal,
  onUpdateValidationCount
}) => {
  // Requirement 2: Eliminados valores true por defecto. estatuto_res parte en false.
  // f29_sii solo es true si la carpeta tributaria fue acreditada.
  const isTaxFolderDone = expediente ? Boolean(expediente.taxFolder.taxFolderUploaded) : Boolean(profile.taxFolderUploaded);
  const [localDocStatuses, setLocalDocStatuses] = useState<DocChecklistStatuses>(() => ({
    f29_sii: isTaxFolderDone,
    estatuto_res: false,
    deuda_tgr: false,
    previsional_f30: false,
    carta_interes_loi: false
  }));

  const docStatuses: DocChecklistStatuses = expediente ? expediente.docStatuses : localDocStatuses;

  const { hasActivePlan, loading: planLoading } = usePlan();
  const [showPaywall, setShowPaywall] = useState<boolean>(false);

  // Form fields for AI Document Generator - initialized cleanly without sample data
  const [genDocType, setGenDocType] = useState<string>(() => consume('docType') || 'Carta de Manifestación de Interés Comercial (LOI)');
  // "Generar carta" desde la Hoja de Ruta: abre el formulario con el tipo de documento elegido
  useEffect(() => onRequest('docType', (t) => { setGenDocType(t); setGeneratedDocText(null); setDocError(null); }), []);
  const [clientName, setClientName] = useState<string>('');
  const [clientContactName, setClientContactName] = useState<string>('');
  const [fundTarget, setFundTarget] = useState<string>(activeFund?.name || CHILEAN_FUNDS[0].name);
  const [projectName, setProjectName] = useState<string>(
    formulation?.projectTitle || (profile.projectSummary ? profile.projectSummary.slice(0, 60) : '')
  );
  const [legalRepName, setLegalRepName] = useState<string>(currentUser?.representativeName || '');
  const [legalRepRut, setLegalRepRut] = useState<string>(currentUser?.representativeRut || '');
  const [city, setCity] = useState<string>(profile.city || '');

  // Generation state
  const [generatingDoc, setGeneratingDoc] = useState<boolean>(false);
  const [generatedDocText, setGeneratedDocText] = useState<string | null>(null);
  const [activeDocRecord, setActiveDocRecord] = useState<GeneratedDocument | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [downloadingDocx, setDownloadingDocx] = useState<boolean>(false);

  // User-scoped generated documents list
  const userKey = (currentUser as any)?.uid || currentUser?.id || auth.currentUser?.uid || 'guest';
  const [localGeneratedDocsList, setLocalGeneratedDocsList] = useState<GeneratedDocument[]>(() => {
    try {
      const cached = localStorage.getItem(`impulsacap_${userKey}_generated_docs`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const generatedDocsList = expediente ? expediente.generatedDocs : localGeneratedDocsList;

  // Load generated docs from Firestore for authenticated users
  useEffect(() => {
    const fetchDocsFromFirestore = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      try {
        const q = query(collection(db, 'generatedDocs'), where('ownerId', '==', uid));
        const snap = await getDocs(q);
        const docs: GeneratedDocument[] = [];
        snap.forEach((d) => {
          docs.push({ id: d.id, ...d.data() } as GeneratedDocument);
        });
        docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setLocalGeneratedDocsList(docs);
        localStorage.setItem(`impulsacap_${uid}_generated_docs`, JSON.stringify(docs));
      } catch (err) {
        console.warn('Could not fetch generatedDocs from Firestore:', err);
      }
    };
    fetchDocsFromFirestore();
  }, [userKey]);

  // Sync signed LOI count with Roadmap whenever generatedDocsList changes
  useEffect(() => {
    const signedLois = generatedDocsList.filter(
      (d) => (d.tipo.includes('LOI') || d.tipo.includes('Interés')) && d.status === 'firmada'
    ).length;
    if (onUpdateValidationCount) {
      onUpdateValidationCount(signedLois);
    }
    setLocalDocStatuses((prev) => ({
      ...prev,
      carta_interes_loi: signedLois > 0,
    }));
  }, [generatedDocsList, onUpdateValidationCount]);

  const toggleStatus = (id: string) => {
    const key = id as keyof DocChecklistStatuses;
    const nextVal = !docStatuses[key];
    if (onUpdateDocStatuses) {
      onUpdateDocStatuses({ [key]: nextVal });
    }
    setLocalDocStatuses(prev => ({
      ...prev,
      [key]: nextVal
    }));
  };

  const handleGenerateDocument = async () => {
    setDocError(null);

    // Validation of mandatory fields
    if (!projectName.trim()) {
      setDocError('Por favor ingresa el Nombre del Proyecto a postular.');
      return;
    }
    if (!clientName.trim()) {
      setDocError('Por favor ingresa el nombre de la Empresa Cliente o Contraparte Colaboradora.');
      return;
    }
    if (!legalRepName.trim()) {
      setDocError('Por favor ingresa el Nombre del Representante Legal de la empresa postulante.');
      return;
    }
    if (!legalRepRut.trim()) {
      setDocError('Por favor ingresa el RUT del Representante Legal de la empresa postulante.');
      return;
    }
    if (!city.trim()) {
      setDocError('Por favor ingresa la Ciudad de emisión del documento.');
      return;
    }

    if (!hasActivePlan) {
      setShowPaywall(true);
      return;
    }

    setGeneratingDoc(true);
    setDocError(null);
    // Si la IA no responde en 2 minutos, se corta y se ofrece reintentar (antes el indicador quedaba girando)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await apiFetch('/api/gemini/generate-doc', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: genDocType,
          companyName: profile.companyName || '[COMPLETAR: Razón Social]',
          clientOrPartnerName: clientName.trim(),
          projectName: projectName.trim(),
          fundName: fundTarget,
          legalRepName: legalRepName.trim(),
          legalRepRut: legalRepRut.trim(),
          city: city.trim(),
          profile,
          projectProfile: profile.projectProfile,
          taxFolderData: {
            sector: profile.sector,
            region: profile.region,
            monthsActive: profile.monthsActive,
            annualSalesCLP: profile.annualSalesCLP
          },
          details: {
            clientContact: clientContactName.trim() || undefined,
            rut: profile.rut,
            sector: profile.sector || undefined,
            region: profile.region || undefined,
            city: city.trim()
          },
          formulation: formulation ? {
            projectTitle: formulation.projectTitle || projectName.trim(),
            problemStatement: formulation.problemStatement,
            solutionOverview: formulation.solutionAndInnovation
          } : null,
          taxFolderSummary: profile.taxFolderSummary || (profile.taxFolderUploaded ? 'Carpeta Tributaria Electrónica SII acreditada y validada en el expediente' : null)
        })
      });

      if (response.status === 402) {
        setShowPaywall(true);
        setGeneratingDoc(false);
        return;
      }

      if (response.status === 429) {
        const errJson = await response.json().catch(() => ({}));
        setDocError(errJson.error || 'Puedes tener hasta 3 postulaciones activas a la vez. Archiva una para comenzar otra.');
        setGeneratingDoc(false);
        return;
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.');
      }

      const data = await response.json();
      const docText = data.documentText;
      setGeneratedDocText(docText);

      // Create document record
      const uid = auth.currentUser?.uid || userKey;
      const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newDocRecord: GeneratedDocument = {
        id: docId,
        ownerId: uid,
        tipo: genDocType,
        contraparte: clientName.trim(),
        proyecto: projectName.trim(),
        fondo: fundTarget,
        texto: docText,
        status: 'borrador',
        fecha: new Date().toLocaleDateString('es-CL'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setActiveDocRecord(newDocRecord);

      // Persist in unified Expediente and local cache
      if (onAddGeneratedDoc) {
        onAddGeneratedDoc(newDocRecord);
      }
      const updatedList = [newDocRecord, ...localGeneratedDocsList];
      setLocalGeneratedDocsList(updatedList);
      try {
        localStorage.setItem(`impulsacap_${userKey}_generated_docs`, JSON.stringify(updatedList));
      } catch (e) {
        console.warn('Could not cache generated doc in localStorage:', e);
      }

      // Persist to Firestore if user is authenticated (sin esperar: el documento ya está listo en pantalla)
      if (auth.currentUser) {
        setDoc(doc(db, 'generatedDocs', docId), newDocRecord).catch(dbErr => {
          console.warn('Could not sync generatedDoc to Firestore:', dbErr);
        });
      }
      setTimeout(() => document.getElementById('doc-next-steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (err: any) {
      console.error('Doc generation error:', err);
      setGeneratedDocText(null);
      setDocError(err?.name === 'AbortError'
        ? 'La IA está tardando más de lo normal. Intenta de nuevo en un momento.'
        : (err?.message || 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.'));
    } finally {
      clearTimeout(timeoutId);
      setGeneratingDoc(false);
    }
  };

  const handleToggleDocSigned = async (docItem: GeneratedDocument) => {
    const nextStatus: 'borrador' | 'firmada' = docItem.status === 'firmada' ? 'borrador' : 'firmada';
    if (onUpdateGeneratedDocStatus) {
      onUpdateGeneratedDocStatus(docItem.id, nextStatus);
    }
    const updated = localGeneratedDocsList.map((d) => 
      d.id === docItem.id ? { ...d, status: nextStatus, updatedAt: new Date().toISOString() } : d
    );
    setLocalGeneratedDocsList(updated);
    if (activeDocRecord && activeDocRecord.id === docItem.id) {
      setActiveDocRecord({ ...activeDocRecord, status: nextStatus });
    }

    try {
      localStorage.setItem(`impulsacap_${userKey}_generated_docs`, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not cache update in localStorage:', e);
    }

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'generatedDocs', docItem.id), { status: nextStatus, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (err) {
        console.warn('Could not update doc in Firestore:', err);
      }
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (onDeleteGeneratedDoc) {
      onDeleteGeneratedDoc(docId);
    }
    const updated = localGeneratedDocsList.filter((d) => d.id !== docId);
    setLocalGeneratedDocsList(updated);
    if (activeDocRecord && activeDocRecord.id === docId) {
      setActiveDocRecord(null);
      setGeneratedDocText(null);
    }

    try {
      localStorage.setItem(`impulsacap_${userKey}_generated_docs`, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not update cache after delete:', e);
    }

    if (auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'generatedDocs', docId));
      } catch (err) {
        console.warn('Could not delete doc in Firestore:', err);
      }
    }
  };

  const handleCopyDoc = () => {
    if (!generatedDocText) return;
    navigator.clipboard.writeText(generatedDocText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadDocx = async () => {
    if (!generatedDocText) return;
    setDownloadingDocx(true);
    try {
      const fileName = `${genDocType.replace(/\s+/g, '_')}_${clientName.replace(/\s+/g, '_') || 'Contraparte'}.docx`;
      await exportMarkdownToDocx(generatedDocText, fileName);
    } catch (e) {
      console.error('Error generating docx:', e);
      alert('Hubo un problema al exportar el archivo Word. Puedes copiar el texto o descargar en formato Markdown.');
    } finally {
      setDownloadingDocx(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!generatedDocText) return;
    const blob = new Blob([generatedDocText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${genDocType.replace(/\s+/g, '_')}_${profile.companyName || 'Documento'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const completedCount = Object.values(docStatuses).filter(Boolean).length;
  const totalDocs = REQUIRED_DOCUMENTS_GUIDE.length;

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Paywall Banner shown whenever user attempts to generate without active plan */}
      {(showPaywall || (!hasActivePlan && !planLoading)) && (
        <div className="animate-fade-in">
          <PlanPaywallCard
            highlightText="El Generador de Documentos Oficiales (Cartas LOI, Compromisos y Memorias) requiere el Plan Semestral ImpulsaCap. Redacta y descarga cartas en formato Word (.docx) con plena validez para CORFO y SERCOTEC."
          />
        </div>
      )}

      {/* Back to Dashboard Navigation */}
      {onNavigateTab && (
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <button
            onClick={() => onNavigateTab('my-application')}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>← Volver al Dashboard (Hoja de Ruta)</span>
          </button>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Bóveda Legal & Documental • bases CORFO / SERCOTEC 2026
          </span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-1">
              <FileCheck className="w-3.5 h-3.5" />
              Gestión de Admisibilidad Legal & Documental
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Tramitación de Certificados y Generador Legal con IA
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
              Más del 30% de los proyectos en Chile son rechazados por errores en la carpeta tributaria o estatutos. Supera el examen de admisibilidad y genera cartas de interés comercial en segundos.
            </p>
          </div>

          {/* Progress Tracker */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-4 shrink-0">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Progreso Documental</p>
              <p className="text-lg font-black text-emerald-400">
                {completedCount} de {totalDocs} al día
              </p>
            </div>
            <div className="w-12 h-12 rounded-full border-2 border-slate-800 border-t-emerald-400 flex items-center justify-center font-bold text-xs text-white">
              {Math.round((completedCount / totalDocs) * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: AI Legal Document Generator Form */}
      <div id="doc-generator" className="scroll-mt-40 p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950/40 border border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Generador de Documentos Formales con IA
              </h3>
              <p className="text-xs text-slate-400">
                Redacta cartas de manifestación de interés (LOI), aportes y compromisos con estándar oficial de postulación.
              </p>
            </div>
          </div>
        </div>

        {/* Input Fields Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tipo de Documento: <span className="text-red-400">*</span>
            </label>
            <select
              value={genDocType}
              onChange={(e) => setGenDocType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-hidden"
            >
              <option value="Carta de Manifestación de Interés Comercial (LOI)">Carta de Interés Comercial (LOI)</option>
              <option value="Carta de Compromiso de Aporte Empresarial Pecuniario">Carta Compromiso Aporte Efectivo</option>
              <option value="Carta de Compromiso de Aporte Valorado de Socios">Carta Compromiso Aporte Valorado</option>
              <option value="Memoria Explicativa de Gastos e Inversiones CORFO">Memoria Explicativa de Gastos</option>
              <option value="Resumen Ejecutivo de 1 Página para Evaluadores">Resumen Ejecutivo de 1 Página</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Fondo Concursable Destino: <span className="text-red-400">*</span>
            </label>
            <select
              value={fundTarget}
              onChange={(e) => setFundTarget(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-hidden"
            >
              {CHILEAN_FUNDS.map((f) => (
                <option key={f.id} value={f.name}>
                  {f.agency} • {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nombre del Proyecto: <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Ej: Plataforma de Optimización con IA"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-hidden placeholder:text-slate-500 placeholder:italic"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Cliente Piloto / Contraparte Colaboradora: <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ej: Minera Escondida, Sodimac, Viña San Pedro"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-hidden placeholder:text-slate-500 placeholder:italic"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nombre y Cargo del Decisor Contraparte:
            </label>
            <input
              type="text"
              value={clientContactName}
              onChange={(e) => setClientContactName(e.target.value)}
              placeholder="Ej: Juan Pérez (Gerente de Operaciones)"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-hidden placeholder:text-slate-500 placeholder:italic"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Ciudad de Emisión: <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ej: Santiago, Concepción, Antofagasta"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-hidden placeholder:text-slate-500 placeholder:italic"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Representante Legal (Empresa Postulante): <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={legalRepName}
              onChange={(e) => setLegalRepName(e.target.value)}
              placeholder="Ej: Constanza Morales Valenzuela"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-hidden placeholder:text-slate-500 placeholder:italic"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              RUT Representante Legal: <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={legalRepRut}
              onChange={(e) => setLegalRepRut(e.target.value)}
              placeholder="Ej: 15.420.318-9"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-hidden placeholder:text-slate-500 placeholder:italic"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Empresa Postulante:
            </label>
            <div className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800/80 text-slate-300 text-xs truncate flex items-center justify-between">
              <span>{profile.companyName || 'Sin completar'}</span>
              <span className="text-[10px] text-slate-500">{profile.rut || 'RUT pendiente'}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-slate-400">
            Los campos marcados con <span className="text-red-400">*</span> son obligatorios para generar el documento.
          </p>

          <button
            onClick={handleGenerateDocument}
            disabled={generatingDoc || planLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {planLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
                <span>Verificando tu plan…</span>
              </>
            ) : generatingDoc ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generando Documento Legal...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-cyan-200" />
                <span>Generar Documento con IA</span>
              </>
            )}
          </button>
        </div>

        {/* Error Banner with Retry */}
        {docError && (
          <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{docError}</span>
            </div>
            <button
              onClick={handleGenerateDocument}
              disabled={generatingDoc || planLoading}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reintentar</span>
            </button>
          </div>
        )}

        {/* Generated Output Preview */}
        {generatedDocText && (
          <div className="mt-6 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 animate-fade-in shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  Vista Previa del Documento Redactado
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Revisa el borrador y descarga en formato Word (.docx) para editar o enviar a firma.
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                <button
                  onClick={handleDownloadDocx}
                  disabled={downloadingDocx}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  title="Descargar documento editable en formato Microsoft Word (.docx)"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{downloadingDocx ? 'Exportando Word…' : 'Descargar en Word (.docx)'}</span>
                </button>

                <button
                  onClick={handleDownloadMarkdown}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Descargar en formato Markdown (.md)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar .md</span>
                </button>

                <button
                  onClick={handleCopyDoc}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Copiar texto al portapapeles"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
                </button>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-[480px] overflow-y-auto select-text">
              {generatedDocText}
            </div>

            {/* Qué hacer ahora con el documento */}
            <div id="doc-next-steps" className="scroll-mt-40 p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
              <p className="text-sm font-bold text-emerald-200">¿Y ahora qué hago con este documento?</p>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-200 leading-relaxed">
                <li><strong>Descárgalo en Word</strong> y revisa que los datos estén correctos. Completa cualquier marca [COMPLETAR].</li>
                <li><strong>Envíaselo a {clientName.trim() || 'la contraparte'}</strong> por correo, pidiéndole que lo pase a su papel con logo, lo firme y te lo devuelva en PDF.</li>
                <li>Cuando tengas la carta firmada, búscala en <strong>"Tus documentos generados"</strong> (más abajo) y presiona <strong>"Marcar como firmada"</strong>. Así cuenta en tu Hoja de Ruta.</li>
                <li>Guarda el PDF firmado: lo adjuntarás al postular en el portal del fondo.</li>
              </ol>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadDocx}
                  disabled={downloadingDocx}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {downloadingDocx ? 'Exportando Word…' : 'Descargar en Word'}
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('docs-generated-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                >
                  Ver mis documentos
                </button>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('my-application')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Volver a la Hoja de Ruta
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: User Generated Documents History List */}
      <div id="docs-generated-list" className="scroll-mt-40 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <FileCode className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                Tus Documentos Generados & Cartas LOI
              </h3>
              <p className="text-xs text-slate-400">
                Las cartas LOI comienzan como "borrador". Al marcarlas como "firmada" se contabilizan oficialmente en tu Hoja de Ruta.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Cartas LOI Firmadas:
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs">
              {generatedDocsList.filter((d) => (d.tipo.includes('LOI') || d.tipo.includes('Interés')) && d.status === 'firmada').length} firmadas
            </span>
          </div>
        </div>

        {generatedDocsList.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800/80 space-y-2">
            <FileText className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-400">Aún no has generado ningún documento legal</p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Utiliza el formulario superior para redactar tu primera carta de interés comercial (LOI) o carta de aporte con inteligencia artificial.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {generatedDocsList.map((docItem) => {
              const isLOI = docItem.tipo.includes('LOI') || docItem.tipo.includes('Interés');
              const isSigned = docItem.status === 'firmada';

              return (
                <div
                  key={docItem.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSigned
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white truncate">
                        {docItem.tipo}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isSigned
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      }`}>
                        {isSigned ? '✓ Firmada y Validada' : 'Borrador'}
                      </span>
                      {isLOI && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                          Respaldo Comercial
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-300 flex items-center gap-2 flex-wrap">
                      <span>Contraparte: <strong className="text-white">{docItem.contraparte || 'No especificada'}</strong></span>
                      {docItem.proyecto && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="truncate">Proyecto: {docItem.proyecto}</span>
                        </>
                      )}
                    </p>

                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {docItem.fecha || new Date(docItem.createdAt).toLocaleDateString('es-CL')}
                      </span>
                      {docItem.fondo && (
                        <span>Fondo: {docItem.fondo}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions for this document */}
                  <div className="flex items-center flex-wrap gap-2 shrink-0">
                    {/* Toggle Signed Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleDocSigned(docItem)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSigned
                          ? 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                      }`}
                      title={isSigned ? 'Cambiar a borrador' : 'Confirmar que ya cuentas con la carta firmada'}
                    >
                      {isSigned ? (
                        <>
                          <RotateCcw className="w-3 h-3" />
                          <span>Marcar como Borrador</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Marcar como Firmada</span>
                        </>
                      )}
                    </button>

                    {/* View in preview */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDocRecord(docItem);
                        setGeneratedDocText(docItem.texto);
                        setGenDocType(docItem.tipo);
                        if (docItem.contraparte) setClientName(docItem.contraparte);
                        if (docItem.proyecto) setProjectName(docItem.proyecto);
                        if (docItem.fondo) setFundTarget(docItem.fondo);
                        window.scrollTo({ top: 350, behavior: 'smooth' });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                    >
                      Ver
                    </button>

                    {/* Download Word (.docx) */}
                    <button
                      type="button"
                      onClick={() => {
                        const fileName = `${docItem.tipo.replace(/\s+/g, '_')}_${(docItem.contraparte || 'Documento').replace(/\s+/g, '_')}.docx`;
                        exportMarkdownToDocx(docItem.texto, fileName);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 transition-all cursor-pointer"
                      title="Descargar en Word (.docx)"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('¿Estás seguro de eliminar este documento?')) {
                          handleDeleteDoc(docItem.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-500 hover:text-red-400 transition-all cursor-pointer"
                      title="Eliminar documento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 3: Official Required Documents Guide (SII, TGR, Legal) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Building className="w-4 h-4 text-emerald-400" />
            <span>Guía de Certificados Oficiales del Estado</span>
          </h3>
          <span className="text-xs text-slate-400">
            Requisitos habilitantes de admisibilidad
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REQUIRED_DOCUMENTS_GUIDE.map((docItem) => {
            const isDone = docStatuses[docItem.id as keyof DocChecklistStatuses] || false;
            return (
              <div
                key={docItem.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isDone 
                    ? 'bg-slate-900/90 border-emerald-500/30' 
                    : 'bg-slate-900/40 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{docItem.name}</h4>
                      <p className="text-[11px] text-slate-400">{docItem.issuer}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleStatus(docItem.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      isDone 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    <span>{isDone ? 'Acreditado' : 'Pendiente'}</span>
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  {docItem.purpose}
                </p>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  {(() => {
                    const docActionLinks: Record<string, { url: string; actionText: string }> = {
                      f29_sii: { url: 'https://www.sii.cl', actionText: 'Tramitar en SII.cl' },
                      estatuto_res: { url: 'https://www.tuempresasenundia.cl', actionText: 'Tramitar en Tu Empresa en un Día' },
                      deuda_tgr: { url: 'https://www.tgr.cl', actionText: 'Obtener en TGR.cl' },
                      previsional_f30: { url: 'https://www.direcciondeltrabajo.cl', actionText: 'Obtener en DT.gob.cl' },
                      carta_interes_loi: { url: '#', actionText: 'Redactar Carta LOI con IA' },
                    };
                    const linkInfo = docActionLinks[docItem.id] || { url: 'https://www.corfo.cl', actionText: 'Ver Información' };
                    return (
                      <a
                        href={linkInfo.url}
                        target={linkInfo.url === '#' ? '_self' : '_blank'}
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-semibold"
                      >
                        <span>{linkInfo.actionText}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    );
                  })()}

                  {docItem.id === 'f29_sii' && onOpenSiiModal && (
                    <button
                      onClick={onOpenSiiModal}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                    >
                      {profile.taxFolderUploaded ? 'Reemplazar Carpeta F29' : 'Subir Carpeta Tributaria'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
