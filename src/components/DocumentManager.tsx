import React, { useState } from 'react';
import { REQUIRED_DOCUMENTS_GUIDE } from '../data/chileanFunds';
import { CompanyProfile } from '../types/funds';
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
  Upload,
  RotateCcw
} from 'lucide-react';

interface DocumentManagerProps {
  profile: CompanyProfile;
  onNavigateTab?: (tab: string) => void;
  onOpenSiiModal?: () => void;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({ 
  profile,
  onNavigateTab,
  onOpenSiiModal
}) => {
  const [docStatuses, setDocStatuses] = useState<Record<string, boolean>>({
    f29_sii: true,
    estatuto_res: true,
    deuda_tgr: false,
    previsional_f30: false,
    carta_interes_loi: false,
  });

  // State for AI Document Generator
  const [genDocType, setGenDocType] = useState<string>('Carta de Manifestación de Interés Comercial (LOI)');
  const [clientName, setClientName] = useState<string>('Empresa Minera del Norte S.A.');
  const [clientContactName, setClientContactName] = useState<string>('Rodrigo Valenzuela (Gerente de Operaciones)');
  const [projectName, setProjectName] = useState<string>(profile.projectSummary.slice(0, 60) || 'Solución de Optimización con Inteligencia Artificial');
  const [fundTarget, setFundTarget] = useState<string>('CORFO Semilla Inicia / Expande');
  const [generatingDoc, setGeneratingDoc] = useState<boolean>(false);
  const [generatedDocText, setGeneratedDocText] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const toggleStatus = (id: string) => {
    setDocStatuses(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleGenerateDocument = async () => {
    setGeneratingDoc(true);
    try {
      const response = await fetch('/api/gemini/generate-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: genDocType,
          companyName: profile.companyName,
          clientOrPartnerName: clientName,
          projectName: projectName,
          fundName: fundTarget,
          details: {
            clientContact: clientContactName,
            rut: profile.rut,
            sector: profile.sector,
            region: profile.region
          }
        })
      });

      if (!response.ok) {
        throw new Error('Error al generar el documento legal');
      }

      const data = await response.json();
      setGeneratedDocText(data.documentText);
    } catch (err: any) {
      console.error(err);
      // High-standard fallback legal document
      const fallback = `
# CARTA DE MANIFESTACIÓN DE INTERÉS COMERCIAL Y COMPROMISO DE PILOTAJE

**A: COMITÉ DE ASIGNACIÓN DE FONDOS - ${fundTarget.toUpperCase()}**  
**PRESENTE**  

Santiago de Chile, ${new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}  

De nuestra consideración:

Por medio de la presente, yo, **${clientContactName}**, en representación de **${clientName}**, manifiesto formalmente nuestro alto interés comercial e institucional en el proyecto titulado:

> **"${projectName}"**,  
desarrollado por la empresa **${profile.companyName}** (RUT: ${profile.rut || 'En trámite'}).

### 1. RECONOCIMIENTO DEL PROBLEMA Y DOLOR EN LA INDUSTRIA
En nuestra experiencia como empresa activa en el mercado chileno, confirmamos que los problemas de ineficiencia y falta de digitalización en el sector representan un dolor crítico que genera sobrecostos operacionales sustanciales y retrasos productivos. Actualmente no encontramos en el mercado nacional soluciones tecnológicas integradas que atiendan este requerimiento con la flexibilidad y costo adecuado.

### 2. COMPROMISO DE VALIDACIÓN Y PILOTAJE
Tras haber sostenido reuniones de trabajo con el equipo de **${profile.companyName}** y conocer su propuesta técnica, declaramos que nuestra compañía está dispuesta a:
1. Actuar como **Empresa Piloto / Early Adopter** durante el período de ejecución del proyecto financiado por ${fundTarget}.
2. Facilitar el acceso controlado a datos de prueba y entorno operativo para validar el desempeño de la solución.
3. Evaluar formalmente la contratación o adquisición comercial de la solución una vez verificado el cumplimiento de los estándares técnicos comprometidos.

### 3. RESPALDO A LA POSTULACIÓN
Consideramos que este proyecto presenta un alto mérito innovador y un impacto significativo para la productividad en Chile, por lo que respaldamos decididamente su postulación a los fondos públicos cofinanciados por el Estado.

Sin otro particular, saluda atentamente a ustedes,

___________________________________________________  
**${clientContactName}**  
Representante / Cargo Directivo  
**${clientName}**  
RUT Institucional: _____________________________  
Teléfono / Contacto: __________________________  
Email Corporativo: ____________________________  
*(Firma y Timbre de la Empresa Interesada)*
`;
      setGeneratedDocText(fallback.trim());
    } finally {
      setGeneratingDoc(false);
    }
  };

  const handleCopyDoc = () => {
    if (!generatedDocText) return;
    navigator.clipboard.writeText(generatedDocText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadDoc = () => {
    if (!generatedDocText) return;
    const blob = new Blob([generatedDocText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${genDocType.replace(/\s+/g, '_')}_${profile.companyName}.md`;
    link.click();
  };

  const completedCount = Object.values(docStatuses).filter(Boolean).length;
  const totalDocs = REQUIRED_DOCUMENTS_GUIDE.length;

  return (
    <div className="space-y-8">
      {/* Back to Dashboard Navigation */}
      {onNavigateTab && (
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <button
            onClick={() => onNavigateTab('my-application')}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 font-bold text-xs shadow-sm transition-all cursor-pointer"
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

      {/* SECTION 1: AI Legal Document Generator */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950/40 border border-slate-800 space-y-6">
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
                Crea cartas de interés comercial (LOI), cartas de compromiso de cofinanciamiento y memorias presupuestarias con estándar oficial
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tipo de Documento:
            </label>
            <select
              value={genDocType}
              onChange={(e) => setGenDocType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
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
              Cliente Piloto / Contraparte:
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ej: Minera Escondida, Sodimac, Viña San Pedro"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nombre y Cargo del Decisor:
            </label>
            <input
              type="text"
              value={clientContactName}
              onChange={(e) => setClientContactName(e.target.value)}
              placeholder="Ej: Juan Pérez (Gerente de Innovación)"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Fondo Destino:
            </label>
            <input
              type="text"
              value={fundTarget}
              onChange={(e) => setFundTarget(e.target.value)}
              placeholder="Ej: CORFO Semilla Expande"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleGenerateDocument}
            disabled={generatingDoc}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {generatingDoc ? (
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

        {/* Generated Output Preview */}
        {generatedDocText && (
          <div className="mt-4 p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                Vista Previa del Documento Redactado
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyDoc}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar Texto'}</span>
                </button>
                <button
                  onClick={handleDownloadDoc}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar (.md)</span>
                </button>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-slate-900/60 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-line max-h-96 overflow-y-auto">
              {generatedDocText}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Official Chilean Certificates Checklist & Instructions */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          Guía de Tramitación de Certificados Obligatorios en Chile
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {REQUIRED_DOCUMENTS_GUIDE.map((doc) => {
            const isDone = docStatuses[doc.id] || false;

            return (
              <div
                key={doc.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isDone
                    ? 'bg-slate-900/90 border-emerald-900/40 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleStatus(doc.id)}
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                        isDone
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'border-slate-700 hover:border-slate-500 text-transparent'
                      }`}
                    >
                      <Check className="w-4 h-4 font-bold" />
                    </button>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {doc.name}
                        {isDone && (
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Validado
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {doc.issuer} • Vigencia: {doc.frequency}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2 shrink-0">
                    <span className="text-xs text-slate-400 italic sm:text-right max-w-sm">
                      {doc.purpose}
                    </span>
                    {doc.id === 'f29_sii' && onOpenSiiModal && (
                      <div className="flex items-center gap-2">
                        {profile.taxFolderUploaded ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Subida: {profile.taxFolderFileName || 'F29.pdf'}</span>
                          </div>
                        ) : null}
                        <button
                          onClick={onOpenSiiModal}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition-all cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{profile.taxFolderUploaded ? 'Subir Nueva Versión' : 'Subir Carpeta Tributaria'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step by Step Guide */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 mt-3 space-y-2 text-xs">
                  <p className="font-semibold text-slate-300">Pasos para obtener en línea:</p>
                  <div className="space-y-1 text-slate-300">
                    {doc.stepByStep.map((step, sIdx) => (
                      <p key={sIdx} className="leading-relaxed">{step}</p>
                    ))}
                  </div>

                  {doc.criticalTip && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-start gap-2 text-[11px] text-amber-300 font-medium">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>Alerta de admisibilidad: {doc.criticalTip}</span>
                    </div>
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
