import React, { useState } from 'react';
import { ChileanFund } from '../types/funds';
import { ExpedienteData } from '../types/expediente';
import { validateRut } from '../utils/rutValidator';
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  Download, 
  ShieldCheck, 
  Building2, 
  Calendar, 
  DollarSign, 
  FileText,
  Award,
  Sparkles,
  AlertCircle,
  Clock,
  ArrowRight,
  Receipt,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import { InkiLogo } from './InkiLogo';

interface OfficialDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  expediente: ExpedienteData;
  fund: ChileanFund;
  onNavigateTab?: (tab: string) => void;
  onNavigateToSection?: (sectionId: string) => void;
  onOpenSiiModal?: () => void;
}

export const OfficialDossierModal: React.FC<OfficialDossierModalProps> = ({
  isOpen,
  onClose,
  expediente,
  fund,
  onNavigateTab,
  onNavigateToSection,
  onOpenSiiModal
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const { profile, taxFolder, roadmapConfirmations, docStatuses, generatedDocs, formulation, auditResult } = expediente;

  const isRutValid = validateRut(profile.rut);
  const nowStr = new Date().toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Calculate real signed LOIs
  const signedDocs = generatedDocs.filter(d => d.status === 'firmada');
  const signedLoiCount = signedDocs.filter(d => d.tipo.includes('LOI') || d.tipo.includes('Interés')).length;

  // Real budget calculation - NO FAKE DEFAULTS
  const realBudgetItems = formulation?.budgetBreakdown && formulation.budgetBreakdown.length > 0
    ? formulation.budgetBreakdown
    : [];
  const hasRealBudget = realBudgetItems.length > 0 && realBudgetItems.some(b => (b.corfoContributionCLP || 0) > 0);

  const totalCorfo = realBudgetItems.reduce((acc, curr) => acc + (curr.corfoContributionCLP || 0), 0);
  const totalCompanyCash = realBudgetItems.reduce((acc, curr) => acc + (curr.companyPecuniaryCLP || 0), 0);
  const totalProject = totalCorfo + totalCompanyCash;

  // 10 Sections Completeness Evaluation
  const sectionsStatus = [
    {
      id: 'profile',
      name: 'Ficha de Empresa y RUT',
      isComplete: Boolean(profile.companyName?.trim() && isRutValid),
      missingText: !profile.companyName?.trim() ? 'Razón Social de la empresa' : (!isRutValid ? 'RUT válido con Módulo 11' : '')
    },
    {
      id: 'tax_folder',
      name: 'Antecedentes Tributarios (SII)',
      isComplete: Boolean(taxFolder.taxFolderUploaded),
      missingText: 'Cargar Carpeta Tributaria Electrónica SII'
    },
    {
      id: 'legal_statutes',
      name: 'Estatuto Social y Poderes',
      isComplete: Boolean(roadmapConfirmations.confirmedEstatutoSocial || docStatuses.estatuto_res),
      missingText: 'Confirmar estatuto social y vigencia de poderes'
    },
    {
      id: 'title_pitch',
      name: 'Título y Pitch Ejecutivo',
      isComplete: Boolean(formulation?.projectTitle?.trim() && formulation?.pitchSummary30s?.trim()),
      missingText: 'Título del proyecto y pitch de 30s'
    },
    {
      id: 'problem',
      name: 'Problema u Oportunidad',
      isComplete: Boolean(formulation?.problemStatement?.trim()),
      missingText: 'Definición del problema y dolor de mercado'
    },
    {
      id: 'solution',
      name: 'Solución y Novedad Técnica',
      isComplete: Boolean(formulation?.solutionAndInnovation?.trim()),
      missingText: 'Solución innovadora y grado de novedad'
    },
    {
      id: 'market',
      name: 'Análisis de Mercado',
      isComplete: Boolean(
        formulation?.marketAnalysisTAM?.tam?.trim() || 
        formulation?.marketAnalysisTAM?.clientArchetype?.trim()
      ),
      missingText: 'Dimensionamiento de mercado (TAM/SAM/SOM)'
    },
    {
      id: 'workplan',
      name: 'Plan de Trabajo e Hitos',
      isComplete: Boolean(formulation?.workPlanMilestones && formulation.workPlanMilestones.length > 0),
      missingText: 'Hitos clave y entregables verificables'
    },
    {
      id: 'budget',
      name: 'Presupuesto Oficial',
      isComplete: hasRealBudget,
      missingText: 'Desglose de montos por cuentas presupuestarias'
    },
    {
      id: 'letters',
      name: 'Cartas de Respaldo LOI',
      isComplete: signedLoiCount > 0,
      missingText: 'Al menos una Carta de Interés (LOI) firmada'
    }
  ];

  const completedCount = sectionsStatus.filter(s => s.isComplete).length;
  const missingSections = sectionsStatus.filter(s => !s.isComplete);
  const completionPercentage = Math.round((completedCount / sectionsStatus.length) * 100);

  const handleGoToFormulator = (sectionKey?: string) => {
    onClose();
    if (onNavigateToSection && sectionKey) {
      onNavigateToSection(sectionKey);
    }
    onNavigateTab?.('formulator');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    const md = `# EXPEDIENTE DE POSTULACIÓN (BORRADOR PARA REVISIÓN) - ${fund.agency} CHILE
**Fondo:** ${fund.name}  
**Fecha de Emisión:** ${nowStr}  
**Preparado con:** ImpulsaCap (Asesoría Tecnológica de Fondos Públicos)  
*Nota: Este documento es una ayuda de preparación; la postulación oficial se realiza en el portal del organismo.*

---

## RESUMEN DE COMPLETITUD
- **Estado General:** ${completedCount} de 10 secciones completas (${completionPercentage}%)
${missingSections.length > 0 ? `- **Secciones Pendientes:** ${missingSections.map(s => s.name).join(', ')}` : '- **Todas las secciones requeridas han sido completadas.'}

---

## 1. IDENTIFICACIÓN DE LA ENTIDAD POSTULANTE
- **Razón Social:** ${profile.companyName || 'Sin completar'}
- **RUT Empresa:** ${profile.rut || 'Sin completar'} (${isRutValid ? 'Válido Módulo 11' : 'RUT inválido'})
- **Tipo Societario:** ${profile.companyType?.toUpperCase() || 'Sin completar'}
- **Región:** ${profile.region || 'Sin completar'}
- **Sector Económico:** ${profile.sector || 'Sin completar'}
- **Etapa Tecnológica (TRL):** ${profile.trlStage ? profile.trlStage.replace('_', ' ') : 'Sin completar'}
- **Bonificación de Género:** ${profile.isFemaleLed ? `Aplica (+${(100 - fund.maxCoFinancePct > 15 ? 10 : 5)}% subsidio estatal)` : 'No aplica'}

---

## 2. ANTECEDENTES TRIBUTARIOS (SII)
- **RUT Contribuyente SII:** ${taxFolder.rut || profile.rut || 'Sin completar'}
- **Razón Social SII:** ${taxFolder.companyName || profile.companyName || 'Sin completar'}
- **Antigüedad tributaria:** ${taxFolder.monthsActive ? `${taxFolder.monthsActive} meses` : 'Sin completar'}
- **Ventas 12 Meses (F29):** ${taxFolder.annualSalesCLP !== null && taxFolder.annualSalesCLP !== undefined ? `$${taxFolder.annualSalesCLP.toLocaleString('es-CL')} CLP` : 'Sin completar'}
- **Períodos F29 Procesados:** ${taxFolder.f29Periods || 0} periodos
- **Veredicto de Admisibilidad SII:** ${taxFolder.admissibilityVerdict?.toUpperCase() || (taxFolder.taxFolderUploaded ? 'Acreditado' : 'Pendiente de carga')}
- **Archivo de Respaldo:** ${taxFolder.fileName || 'Pendiente de adjuntar'}
- **Observaciones SII:** ${taxFolder.siiStatusObservations || 'Sin observaciones registradas'}

---

## 3. FORMULACIÓN TÉCNICA OFICIAL
### 3.1. Título del Proyecto
${formulation?.projectTitle || '[Pendiente — completa esta sección en el Formulador]'}

### 3.2. Elevator Pitch (30 segundos)
${formulation?.pitchSummary30s || '[Pendiente — completa esta sección en el Formulador]'}

### 3.3. Problema / Oportunidad Identificada
${formulation?.problemStatement || '[Pendiente — completa esta sección en el Formulador]'}

### 3.4. Solución Propuesta y Grado de Novedad
${formulation?.solutionAndInnovation || '[Pendiente — completa esta sección en el Formulador]'}

### 3.5. Análisis de Mercado (TAM - SAM - SOM)
${formulation?.marketAnalysisTAM?.tam ? `
- **TAM:** ${formulation.marketAnalysisTAM.tam}
- **SAM:** ${formulation.marketAnalysisTAM.sam || 'No especificado'}
- **SOM:** ${formulation.marketAnalysisTAM.som || 'No especificado'}
- **Arquetipo:** ${formulation.marketAnalysisTAM.clientArchetype || 'No especificado'}
` : '[Pendiente — completa esta sección en el Formulador]'}

### 3.6. Modelo de Negocio y Monetización
${formulation?.businessModel || '[Pendiente — completa esta sección en el Formulador]'}

### 3.7. Capacidades del Equipo
${formulation?.teamCapabilities || '[Pendiente — completa esta sección en el Formulador]'}

### 3.8. Plan de Trabajo e Hitos
${formulation?.workPlanMilestones && formulation.workPlanMilestones.length > 0 
  ? formulation.workPlanMilestones.map((m, i) => `${i + 1}. **${m.title}** (${m.month}): ${m.description} | Entregable: ${m.deliverable} | Riesgo: ${m.criticalRisk}`).join('\n')
  : '[Pendiente — completa esta sección en el Formulador]'}

---

## 4. PRESUPUESTO OFICIAL (CUENTAS ${fund.agency})
${hasRealBudget ? `
- **Subsidio Solicitado (${fund.agency}):** $${totalCorfo.toLocaleString('es-CL')} CLP
- **Aporte Pecuniario Postulante:** $${totalCompanyCash.toLocaleString('es-CL')} CLP
- **Costo Total del Proyecto:** $${totalProject.toLocaleString('es-CL')} CLP
` : '[Pendiente — completa esta sección en el Formulador]'}

---

## 5. DOCUMENTOS DE ADMISIBILIDAD
- Carpeta Tributaria Electrónica SII: ${taxFolder.taxFolderUploaded ? (taxFolder.admissibilityVerdict === 'observado' ? '✗ Con observaciones' : '✓ Listo') : '⏳ Pendiente'}
- Estatutos Sociales y Personería: ${roadmapConfirmations.confirmedEstatutoSocial || docStatuses.estatuto_res ? '✓ Listo' : '⏳ Pendiente'}
- Certificado Deudas TGR: ${docStatuses.deuda_tgr ? '✓ Listo' : '⏳ Pendiente'}
- Certificado F30 Laboral: ${docStatuses.previsional_f30 ? '✓ Listo' : '⏳ Pendiente'}
- Cartas de Interés Comercial LOI: ${signedLoiCount > 0 ? `✓ Listo (${signedLoiCount} firmada${signedLoiCount > 1 ? 's' : ''})` : '⏳ Pendiente'}

---

## 6. CARTAS DE RESPALDO GENERADAS
${generatedDocs.length > 0 
  ? generatedDocs.map(d => `- **${d.tipo}** | Contraparte: ${d.contraparte} | Fecha: ${d.fecha} | Estado: ${d.status.toUpperCase()}`).join('\n')
  : 'No se han generado cartas de respaldo aún.'}
`.trim();

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const md = `# EXPEDIENTE DE POSTULACIÓN (BORRADOR PARA REVISIÓN) - ${fund.agency} CHILE
**Fondo:** ${fund.name}
**Empresa:** ${profile.companyName || 'Sin completar'} (RUT: ${profile.rut || 'Sin completar'})
**Preparado con:** ImpulsaCap
**Fecha:** ${nowStr}
*Nota: Este documento es una ayuda de preparación; la postulación oficial se realiza en el portal del organismo.*

${formulation?.projectTitle ? `Título: ${formulation.projectTitle}` : ''}
${formulation?.pitchSummary30s ? `Pitch: ${formulation.pitchSummary30s}` : ''}
${formulation?.problemStatement ? `Problema: ${formulation.problemStatement}` : ''}
${formulation?.solutionAndInnovation ? `Solución: ${formulation.solutionAndInnovation}` : ''}
${hasRealBudget ? `Subsidio Solicitado: $${totalCorfo.toLocaleString('es-CL')} CLP | Aporte Privado: $${totalCompanyCash.toLocaleString('es-CL')} CLP` : ''}
`.trim();

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Expediente_${fund.agency}_${(profile.companyName || 'Empresa').replace(/\s+/g, '_')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper render for pending formulation section
  const renderPendingSectionBanner = (label: string, sectionKey?: string) => (
    <div className="p-4 rounded-xl bg-slate-900/60 border border-dashed border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:border-black print:bg-white">
      <div className="flex items-center gap-2 text-amber-300 print:text-black">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 print:text-black" />
        <span className="text-xs font-medium">Pendiente — completa esta sección en el Formulador</span>
      </div>
      <button
        onClick={() => handleGoToFormulator(sectionKey)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30 transition-colors cursor-pointer print:hidden shrink-0"
      >
        <span>Completar en Formulador</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md p-2 sm:p-6 flex items-center justify-center animate-fade-in print:p-0 print:bg-white print:fixed-none">
      <div className="w-full max-w-4xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden print:max-h-none print:border-none print:bg-white print:text-black print:shadow-none">
        
        {/* Modal Top Control Bar (Hidden on print) */}
        <div className="p-4 sm:px-6 sm:py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Expediente de Postulación (borrador para revisión)</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  completedCount === 10
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {completedCount === 10 ? 'Listo para Postulación' : `${completedCount}/10 Completo`}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Preparado con ImpulsaCap • Base estructurada para postulación en {fund.agency}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/25 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>
            <button
              onClick={handleCopyMarkdown}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar Texto'}</span>
            </button>
            <button
              onClick={handleDownloadMarkdown}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
              title="Descargar en formato Markdown"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable & Scrollable Expediente Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 bg-slate-900/60 text-slate-200 print:text-black print:bg-white print:p-0 print:overflow-visible">
          
          {/* Note Banner Requirement 9 */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2.5 print:border-black print:text-black print:bg-slate-100">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 print:text-black" />
            <span>
              <strong>Nota importante:</strong> Este documento es una ayuda de preparación; la postulación oficial se realiza en el portal del organismo ({fund.agency}).
            </span>
          </div>

          {/* Completeness Indicator (Requirement 8) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 print:border-black print:bg-white">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 print:text-black">
                Expediente: {completedCount} de 10 secciones completas ({completionPercentage}%)
              </span>
              <span className={`font-semibold ${completedCount === 10 ? 'text-emerald-400' : 'text-amber-400'} print:text-black`}>
                {completedCount === 10 ? '✓ Expediente Listo' : `${missingSections.length} por completar`}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden print:border print:border-black">
              <div 
                className={`h-full transition-all duration-500 ${completedCount === 10 ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-cyan-500'}`}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>

            {/* Missing Sections Pills */}
            {missingSections.length > 0 && (
              <div className="pt-1 text-xs">
                <span className="text-slate-400 font-medium block mb-1.5 print:text-black">
                  Falta completar:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {missingSections.map((s, idx) => (
                    <span 
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-medium inline-flex items-center gap-1 print:border-black print:text-black"
                    >
                      <Clock className="w-3 h-3 text-amber-400 print:text-black" />
                      <span>{s.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Expediente Cover / Header (Requirement 9) */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 border border-slate-800 text-center space-y-4 print:border-black print:bg-white print:text-black">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 print:border-black">
              <div className="flex items-center gap-2">
                <InkiLogo size={28} withText withTagline={false} />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400 block print:text-black">
                  EXPEDIENTE DE POSTULACIÓN (BORRADOR PARA REVISIÓN)
                </span>
                <span className="text-xs text-slate-400 font-mono print:text-black">{nowStr}</span>
              </div>
            </div>

            <div className="py-2 space-y-1">
              <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold inline-block print:border-black print:text-black">
                {fund.agency} CHILE • {fund.category.toUpperCase()}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white print:text-black">
                {fund.name}
              </h1>
              <p className="text-sm font-semibold text-cyan-400 print:text-black">
                Postulación de Proyecto por: {profile.companyName || 'Empresa Postulante'} (RUT: {profile.rut || 'Sin completar'})
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left pt-3 border-t border-slate-800/80 text-xs print:border-black">
              <div>
                <span className="text-[10px] text-slate-400 block print:text-black">Subsidio Máximo</span>
                <strong className="text-white print:text-black">{fund.subsidyFormatted}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block print:text-black">Cofinanciamiento</span>
                <strong className="text-emerald-400 print:text-black">
                  Hasta {profile.isFemaleLed ? 85 : fund.maxCoFinancePct}% Estatal
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block print:text-black">Régimen Legal</span>
                <strong className="text-white print:text-black">{profile.companyType?.toUpperCase() || 'Sin completar'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block print:text-black">Región</span>
                <strong className="text-white print:text-black">{profile.region || 'Sin completar'}</strong>
              </div>
            </div>
          </div>

          {/* Section 1: Entidad Postulante (Requirement 4) */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 print:border-black print:bg-white print:text-black">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 print:text-black">
              <Building2 className="w-4 h-4" />
              <span>1. Ficha de la Entidad Postulante</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-[10px] text-slate-400 block print:text-black">Razón Social</span>
                <strong className="text-white print:text-black">
                  {profile.companyName?.trim() || <span className="text-slate-500 italic">Sin completar</span>}
                </strong>
              </div>

              {/* Requirement 4: "✓ Módulo 11" solo si validateRut(profile.rut) es true; si no, "RUT inválido" en rojo */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-[10px] text-slate-400 block print:text-black">RUT Empresa</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <strong className="font-mono text-cyan-400 print:text-black">
                    {profile.rut?.trim() || 'Sin completar'}
                  </strong>
                  {profile.rut?.trim() ? (
                    isRutValid ? (
                      <span className="text-[10px] text-emerald-400 font-semibold">✓ Módulo 11</span>
                    ) : (
                      <span className="text-[10px] text-rose-500 font-bold">✗ RUT inválido</span>
                    )
                  ) : (
                    <span className="text-[10px] text-slate-500 italic">Sin completar</span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-[10px] text-slate-400 block print:text-black">Ventas 12 Meses (SII)</span>
                <strong className="text-white print:text-black">
                  {profile.annualSalesCLP !== null && profile.annualSalesCLP !== undefined
                    ? `$${profile.annualSalesCLP.toLocaleString('es-CL')} CLP`
                    : <span className="text-slate-500 italic">Sin completar</span>}
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-[10px] text-slate-400 block print:text-black">Madurez Tecnológica (TRL)</span>
                <strong className="text-white capitalize print:text-black">
                  {profile.trlStage ? profile.trlStage.replace('_', ' ') : <span className="text-slate-500 italic">Sin completar</span>}
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-[10px] text-slate-400 block print:text-black">Bono Liderazgo Femenino</span>
                <strong className={profile.isFemaleLed ? 'text-pink-400 print:text-black' : 'text-slate-400 print:text-black'}>
                  {profile.isFemaleLed ? `Aplica (${profile.femaleEquityPct || 0}% socias)` : 'No aplica'}
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-[10px] text-slate-400 block print:text-black">Validaciones Comerciales</span>
                <strong className="text-emerald-400 print:text-black">
                  {signedLoiCount} {signedLoiCount === 1 ? 'carta firmada' : 'cartas firmadas'}
                </strong>
              </div>
            </div>
          </div>

          {/* Section 2: Antecedentes Tributarios (SII) (Requirement 6) */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 print:border-black print:bg-white print:text-black">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2 print:text-black">
                <Receipt className="w-4 h-4" />
                <span>2. Antecedentes Tributarios (SII)</span>
              </h2>
              {taxFolder.taxFolderUploaded ? (
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold inline-flex items-center gap-1 print:border-black print:text-black">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Carpeta Acreditada</span>
                </span>
              ) : (
                <button
                  onClick={onOpenSiiModal}
                  className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium inline-flex items-center gap-1 cursor-pointer print:hidden"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Cargar Carpeta SII</span>
                </button>
              )}
            </div>

            {taxFolder.taxFolderUploaded ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                  <span className="text-[10px] text-slate-400 block print:text-black">Razón Social en SII</span>
                  <strong className="text-white print:text-black">{taxFolder.companyName || profile.companyName || 'Sin completar'}</strong>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                  <span className="text-[10px] text-slate-400 block print:text-black">RUT Contribuyente</span>
                  <strong className="font-mono text-cyan-400 print:text-black">{taxFolder.rut || profile.rut || 'Sin completar'}</strong>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                  <span className="text-[10px] text-slate-400 block print:text-black">Antigüedad Tributaria</span>
                  <strong className="text-white print:text-black">
                    {taxFolder.monthsActive ? `${taxFolder.monthsActive} meses activos` : (profile.monthsActive ? `${profile.monthsActive} meses` : 'Sin completar')}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                  <span className="text-[10px] text-slate-400 block print:text-black">Ventas F29 (12 Meses)</span>
                  <strong className="text-emerald-400 print:text-black">
                    {taxFolder.annualSalesCLP !== null && taxFolder.annualSalesCLP !== undefined
                      ? `$${taxFolder.annualSalesCLP.toLocaleString('es-CL')} CLP`
                      : (profile.annualSalesCLP !== null && profile.annualSalesCLP !== undefined
                          ? `$${profile.annualSalesCLP.toLocaleString('es-CL')} CLP`
                          : 'Sin completar')}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                  <span className="text-[10px] text-slate-400 block print:text-black">Períodos F29 Procesados</span>
                  <strong className="text-white print:text-black">{taxFolder.f29Periods || profile.taxFolderF29Periods || 0} períodos</strong>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                  <span className="text-[10px] text-slate-400 block print:text-black">Veredicto Admisibilidad</span>
                  <strong className={`capitalize ${
                    taxFolder.admissibilityVerdict === 'aprobado' ? 'text-emerald-400' : 
                    taxFolder.admissibilityVerdict === 'observado' ? 'text-amber-400' : 'text-slate-300'
                  } print:text-black`}>
                    {taxFolder.admissibilityVerdict || 'Aprobado'}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 sm:col-span-2 print:border-black print:bg-white">
                  <span className="text-[10px] text-slate-400 block print:text-black">Archivo y Fecha de Carga</span>
                  <span className="text-white text-xs block truncate print:text-black font-mono">
                    {taxFolder.fileName || profile.taxFolderFileName || 'Carpeta_Tributaria.pdf'} 
                    <span className="text-slate-400 ml-1.5 font-sans">
                      ({taxFolder.uploadDate || profile.taxFolderUploadDate || 'Fecha registrada'})
                    </span>
                  </span>
                </div>

                {taxFolder.siiStatusObservations && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 sm:col-span-4 print:border-black print:bg-white">
                    <span className="text-[10px] text-slate-400 block print:text-black">Observaciones SII</span>
                    <p className="text-slate-300 text-xs mt-0.5 print:text-black">
                      {taxFolder.siiStatusObservations}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-dashed border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:border-black print:bg-white">
                <div className="flex items-center gap-2 text-amber-300 print:text-black">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 print:text-black" />
                  <span className="text-xs font-medium">Carpeta Tributaria Electrónica SII pendiente de acreditación</span>
                </div>
                {onOpenSiiModal && (
                  <button
                    onClick={onOpenSiiModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30 transition-colors cursor-pointer print:hidden shrink-0"
                  >
                    <span>Subir Carpeta Tributaria</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Formulación Técnica Oficial (Requirement 3: Sin datos inventados) */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 print:border-black print:bg-white print:text-black">
            <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2 print:text-black">
              <Sparkles className="w-4 h-4" />
              <span>3. Formulación Técnica Oficial ({fund.agency})</span>
            </h2>

            {/* 3.1 Título del Proyecto */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase print:text-black">
                3.1. Título del Proyecto
              </h3>
              {formulation?.projectTitle?.trim() ? (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-semibold leading-relaxed print:border-black print:bg-white print:text-black">
                  {formulation.projectTitle}
                </div>
              ) : renderPendingSectionBanner('Título del Proyecto', 'title_pitch')}
            </div>

            {/* 3.2 Pitch 30s */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase print:text-black">
                3.2. Elevator Pitch (30 Segundos)
              </h3>
              {formulation?.pitchSummary30s?.trim() ? (
                <p className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed italic print:border-black print:bg-white print:text-black">
                  "{formulation.pitchSummary30s}"
                </p>
              ) : renderPendingSectionBanner('Elevator Pitch', 'title_pitch')}
            </div>

            {/* 3.3 Problema */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase print:text-black">
                3.3. Definición del Problema u Oportunidad
              </h3>
              {formulation?.problemStatement?.trim() ? (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-line print:border-black print:bg-white print:text-black">
                  {formulation.problemStatement}
                </div>
              ) : renderPendingSectionBanner('Problema y Oportunidad', 'problem')}
            </div>

            {/* 3.4 Solución e Innovación */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase print:text-black">
                3.4. Solución Propuesta y Grado de Novedad
              </h3>
              {formulation?.solutionAndInnovation?.trim() ? (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-line print:border-black print:bg-white print:text-black">
                  {formulation.solutionAndInnovation}
                </div>
              ) : renderPendingSectionBanner('Solución e Innovación', 'solution')}
            </div>

            {/* 3.5 Mercado TAM SAM SOM */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase print:text-black">
                3.5. Dimensionamiento de Mercado (Metodología TAM - SAM - SOM)
              </h3>
              {formulation?.marketAnalysisTAM?.tam?.trim() || formulation?.marketAnalysisTAM?.clientArchetype?.trim() ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                      <span className="text-[10px] text-cyan-400 font-bold block print:text-black">TAM (Total)</span>
                      <span className="text-white text-xs print:text-black">
                        {formulation.marketAnalysisTAM.tam || 'No especificado'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                      <span className="text-[10px] text-blue-400 font-bold block print:text-black">SAM (Accesible)</span>
                      <span className="text-white text-xs print:text-black">
                        {formulation.marketAnalysisTAM.sam || 'No especificado'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                      <span className="text-[10px] text-emerald-400 font-bold block print:text-black">SOM (Objetivo 24m)</span>
                      <span className="text-white text-xs print:text-black">
                        {formulation.marketAnalysisTAM.som || 'No especificado'}
                      </span>
                    </div>
                  </div>
                  {formulation.marketAnalysisTAM.clientArchetype && (
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 print:border-black print:bg-white print:text-black">
                      <strong className="text-white print:text-black">Arquetipo de Cliente: </strong>
                      {formulation.marketAnalysisTAM.clientArchetype}
                    </div>
                  )}
                </div>
              ) : renderPendingSectionBanner('Análisis de Mercado', 'market')}
            </div>

            {/* 3.6 Modelo de Negocio */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase print:text-black">
                3.6. Modelo de Negocio y Escalabilidad
              </h3>
              {formulation?.businessModel?.trim() ? (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-line print:border-black print:bg-white print:text-black">
                  {formulation.businessModel}
                </div>
              ) : renderPendingSectionBanner('Modelo de Negocio', 'model')}
            </div>

            {/* 3.7 Capacidades del Equipo */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase print:text-black">
                3.7. Equipo y Capacidades
              </h3>
              {formulation?.teamCapabilities?.trim() ? (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-line print:border-black print:bg-white print:text-black">
                  {formulation.teamCapabilities}
                </div>
              ) : renderPendingSectionBanner('Equipo y Capacidades', 'team')}
            </div>

            {/* 3.8 Plan de Trabajo e Hitos */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase print:text-black">
                3.8. Plan de Trabajo e Hitos a 12 Meses
              </h3>
              {formulation?.workPlanMilestones && formulation.workPlanMilestones.length > 0 ? (
                <div className="space-y-2">
                  {formulation.workPlanMilestones.map((m, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1 print:border-black print:bg-white print:text-black">
                      <div className="flex items-center justify-between">
                        <strong className="text-white font-semibold print:text-black">{m.title}</strong>
                        <span className="text-[10px] text-cyan-400 font-mono print:text-black">{m.month}</span>
                      </div>
                      <p className="text-slate-300 print:text-black">{m.description}</p>
                      <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 print:border-black print:text-black flex flex-col sm:flex-row justify-between gap-1">
                        <span><strong>Entregable:</strong> {m.deliverable}</span>
                        <span><strong>Riesgo crítico:</strong> {m.criticalRisk}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : renderPendingSectionBanner('Plan de Trabajo e Hitos', 'workplan')}
            </div>
          </div>

          {/* Section 4: Presupuesto Detallado por Cuentas (Requirement 3: Sin inventar valores) */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 print:border-black print:bg-white print:text-black">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2 print:text-black">
                <DollarSign className="w-4 h-4" />
                <span>4. Presupuesto Detallado por Cuentas {fund.agency}</span>
              </h2>
              {hasRealBudget && (
                <span className="text-[11px] text-slate-400 print:text-black font-semibold">
                  Valores Netos en Pesos Chilenos (CLP)
                </span>
              )}
            </div>

            {hasRealBudget ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 print:border-black print:text-black">
                      <th className="py-2 px-2 font-bold">Cuenta Presupuestaria</th>
                      <th className="py-2 px-2 font-bold">Ítem / Actividad</th>
                      <th className="py-2 px-2 font-bold text-right">Subsidio {fund.agency}</th>
                      <th className="py-2 px-2 font-bold text-right">Aporte Pecuniario</th>
                      <th className="py-2 px-2 font-bold text-right">Total Ítem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 print:divide-black">
                    {realBudgetItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-2.5 px-2 font-semibold text-white print:text-black">{item.account}</td>
                        <td className="py-2.5 px-2 text-slate-300 print:text-black">{item.item || 'Gasto programado'}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-cyan-400 print:text-black">
                          ${(item.corfoContributionCLP || 0).toLocaleString('es-CL')}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-emerald-400 print:text-black">
                          ${(item.companyPecuniaryCLP || 0).toLocaleString('es-CL')}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-white print:text-black">
                          ${((item.corfoContributionCLP || 0) + (item.companyPecuniaryCLP || 0)).toLocaleString('es-CL')}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold border-t-2 border-slate-700 text-white bg-slate-900/60 print:border-black print:bg-white print:text-black">
                      <td colSpan={2} className="py-3 px-2 uppercase text-slate-300 print:text-black">
                        Total Consolidado del Proyecto
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-cyan-400 print:text-black">
                        ${totalCorfo.toLocaleString('es-CL')} CLP
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-emerald-400 print:text-black">
                        ${totalCompanyCash.toLocaleString('es-CL')} CLP
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-amber-400 text-sm print:text-black">
                        ${totalProject.toLocaleString('es-CL')} CLP
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : renderPendingSectionBanner('Presupuesto Oficial', 'budget')}
          </div>

          {/* Section 5: Checklist Admisibilidad & Documentos (Requirement 5) */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 print:border-black print:bg-white print:text-black">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 print:text-black">
              <ShieldCheck className="w-4 h-4" />
              <span>5. Checklist de Admisibilidad Administrativa y Legal</span>
            </h2>

            {/* Requirement 5: Checklist reflects real state: ✓ listo, ⏳ pendiente, ✗ con observaciones. Never ready by default */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              
              {/* Item 1: Carpeta SII */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                {taxFolder.taxFolderUploaded ? (
                  taxFolder.admissibilityVerdict === 'observado' ? (
                    <span className="p-1 rounded-md bg-amber-500/20 text-amber-400 font-bold shrink-0">✗</span>
                  ) : (
                    <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 font-bold shrink-0">✓</span>
                  )
                ) : (
                  <span className="p-1 rounded-md bg-amber-500/10 text-amber-400 font-bold shrink-0">⏳</span>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-white print:text-black">Carpeta Tributaria Electrónica SII</strong>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      taxFolder.taxFolderUploaded
                        ? (taxFolder.admissibilityVerdict === 'observado' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400')
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {taxFolder.taxFolderUploaded 
                        ? (taxFolder.admissibilityVerdict === 'observado' ? 'Con observaciones' : 'Listo')
                        : 'Pendiente'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 print:text-black mt-0.5">
                    {taxFolder.taxFolderUploaded ? `F29 de ${taxFolder.f29Periods || profile.taxFolderF29Periods || 12} periodos acreditados` : 'Pendiente de carga en SII'}
                  </p>
                </div>
              </div>

              {/* Item 2: Estatutos */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                {(roadmapConfirmations.confirmedEstatutoSocial || docStatuses.estatuto_res) ? (
                  <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 font-bold shrink-0">✓</span>
                ) : (
                  <span className="p-1 rounded-md bg-amber-500/10 text-amber-400 font-bold shrink-0">⏳</span>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-white print:text-black">Estatuto Social y Poderes</strong>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      (roadmapConfirmations.confirmedEstatutoSocial || docStatuses.estatuto_res)
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {(roadmapConfirmations.confirmedEstatutoSocial || docStatuses.estatuto_res) ? 'Listo' : 'Pendiente'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 print:text-black mt-0.5">
                    {(roadmapConfirmations.confirmedEstatutoSocial || docStatuses.estatuto_res)
                      ? 'Confirmado con personería y vigencia de poderes'
                      : 'Pendiente de confirmación o carga'}
                  </p>
                </div>
              </div>

              {/* Item 3: TGR */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                {docStatuses.deuda_tgr ? (
                  <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 font-bold shrink-0">✓</span>
                ) : (
                  <span className="p-1 rounded-md bg-amber-500/10 text-amber-400 font-bold shrink-0">⏳</span>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-white print:text-black">Certificado Deudas Tributarias TGR</strong>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      docStatuses.deuda_tgr ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {docStatuses.deuda_tgr ? 'Listo' : 'Pendiente'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 print:text-black mt-0.5">
                    {docStatuses.deuda_tgr ? 'Acreditado sin deudas morosas' : 'Pendiente de adjuntar certificado TGR'}
                  </p>
                </div>
              </div>

              {/* Item 4: F30 Laboral */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                {docStatuses.previsional_f30 ? (
                  <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 font-bold shrink-0">✓</span>
                ) : (
                  <span className="p-1 rounded-md bg-amber-500/10 text-amber-400 font-bold shrink-0">⏳</span>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-white print:text-black">Certificado de Antecedentes F30</strong>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      docStatuses.previsional_f30 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {docStatuses.previsional_f30 ? 'Listo' : 'Pendiente'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 print:text-black mt-0.5">
                    {docStatuses.previsional_f30 ? 'Dirección del Trabajo al día sin multas' : 'Pendiente de certificar'}
                  </p>
                </div>
              </div>

              {/* Item 5: Cartas LOI */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 sm:col-span-2 print:border-black print:bg-white">
                {signedLoiCount > 0 ? (
                  <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 font-bold shrink-0">✓</span>
                ) : (
                  <span className="p-1 rounded-md bg-amber-500/10 text-amber-400 font-bold shrink-0">⏳</span>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-white print:text-black">Cartas de Manifestación de Interés (LOI)</strong>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      signedLoiCount > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {signedLoiCount > 0 ? `Listo (${signedLoiCount} firmada${signedLoiCount > 1 ? 's' : ''})` : 'Pendiente'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 print:text-black mt-0.5">
                    {signedLoiCount > 0
                      ? 'Firmadas por contrapartes y clientes para acreditar validación comercial'
                      : 'Genera cartas LOI en la sección Documentos y márcalas como firmadas'}
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Section 6: Cartas de Respaldo Generadas (Requirement 7) */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 print:border-black print:bg-white print:text-black">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2 print:text-black">
                <FileCheck2 className="w-4 h-4" />
                <span>6. Cartas de Respaldo del Proyecto</span>
              </h2>
              {onNavigateTab && (
                <button
                  onClick={() => { onClose(); onNavigateTab('documents'); }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium inline-flex items-center gap-1 cursor-pointer print:hidden"
                >
                  <span>Gestionar Cartas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {generatedDocs.length > 0 ? (
              <div className="space-y-2">
                {generatedDocs.map((doc, idx) => (
                  <div 
                    key={doc.id || idx}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs print:border-black print:bg-white print:text-black"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-white font-semibold print:text-black">{doc.tipo}</strong>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          doc.status === 'firmada'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        } print:border-black print:text-black`}>
                          {doc.status === 'firmada' ? '✓ Firmada' : '⏳ Borrador'}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] print:text-black">
                        Contraparte: <strong className="text-slate-200 print:text-black">{doc.contraparte}</strong> • Fecha: {doc.fecha}
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono shrink-0 print:text-black">
                      {doc.proyecto || fund.name}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-dashed border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:border-black print:bg-white">
                <div className="flex items-center gap-2 text-amber-300 print:text-black">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 print:text-black" />
                  <span className="text-xs font-medium">No se han generado cartas de respaldo aún</span>
                </div>
                {onNavigateTab && (
                  <button
                    onClick={() => { onClose(); onNavigateTab('documents'); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold border border-cyan-500/30 transition-colors cursor-pointer print:hidden shrink-0"
                  >
                    <span>Ir a Generador de Cartas</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Section 7: Dictamen Auditor Ciego (si existe) */}
          {auditResult && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-blue-950 border border-blue-900/50 space-y-3 print:border-black print:bg-white print:text-black">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-blue-300 flex items-center gap-2 print:text-black">
                  <Award className="w-4 h-4" />
                  <span>7. Dictamen Auditor Ciego Preliminar</span>
                </h2>
                <div className="text-right">
                  <span className="text-xs text-slate-400 mr-2 print:text-black">Calificación Ponderada:</span>
                  <span className="text-lg font-black text-amber-400 font-mono print:text-black">
                    {(auditResult.overallScore || 0).toFixed(1)} / 5.0
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 print:border-black print:bg-white print:text-black">
                <span className="font-bold text-white block mb-1 print:text-black">Veredicto Oficial:</span>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold print:border-black print:text-black">
                  {auditResult.verdict}
                </span>
                <p className="mt-2 text-[11px] text-slate-400 print:text-black">
                  La propuesta ha sido auditada con los criterios de evaluación del organismo {fund.agency}.
                </p>
              </div>
            </div>
          )}

          {/* Signatures & Certification Block (Requirement 9: Preparado con ImpulsaCap) */}
          <div className="pt-8 border-t border-slate-800 grid grid-cols-2 gap-8 text-center text-xs print:border-black">
            <div className="space-y-1">
              <div className="w-48 mx-auto border-b border-slate-600 pb-1 print:border-black" />
              <p className="font-bold text-white print:text-black">{profile.companyName || 'Empresa Postulante'}</p>
              <p className="text-[10px] text-slate-400 print:text-black">Representante Legal • RUT {profile.rut || 'Pendiente'}</p>
            </div>
            <div className="space-y-1">
              <div className="w-48 mx-auto border-b border-slate-600 pb-1 print:border-black" />
              <p className="font-bold text-amber-400 print:text-black">Preparado con ImpulsaCap</p>
              <p className="text-[10px] text-slate-400 print:text-black">Ayuda Técnica de Preparación de Postulaciones</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
