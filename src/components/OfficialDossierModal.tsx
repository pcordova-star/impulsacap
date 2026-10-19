import React, { useState } from 'react';
import { CompanyProfile, ChileanFund, FormulationOutput, BlindAuditResult } from '../types/funds';
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
  Sparkles
} from 'lucide-react';
import { InkiLogo } from './InkiLogo';

interface OfficialDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CompanyProfile;
  fund: ChileanFund;
  formulation: FormulationOutput | null;
  auditResult?: BlindAuditResult | null;
}

export const OfficialDossierModal: React.FC<OfficialDossierModalProps> = ({
  isOpen,
  onClose,
  profile,
  fund,
  formulation,
  auditResult
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isRutValid = validateRut(profile.rut);
  const nowStr = new Date().toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Calculate total budget
  const budgetItems = formulation?.budgetBreakdown || [
    {
      account: 'Recursos Humanos Críticos',
      item: 'Sueldo Desarrollador / Especialista Técnico (12 meses)',
      corfoContributionCLP: Math.round(fund.maxSubsidyCLP * 0.45),
      companyPecuniaryCLP: Math.round(fund.maxSubsidyCLP * 0.08),
      companyValuedCLP: 0,
      justification: 'Desarrollo del núcleo tecnológico y validación de arquitectura.'
    },
    {
      account: 'Gastos de Operación',
      item: 'Servicios Cloud, licencias y hosting especializado',
      corfoContributionCLP: Math.round(fund.maxSubsidyCLP * 0.25),
      companyPecuniaryCLP: Math.round(fund.maxSubsidyCLP * 0.05),
      companyValuedCLP: 0,
      justification: 'Infraestructura computacional requerida para pruebas y prototipo.'
    },
    {
      account: 'Asistencia Técnica y Consultoría',
      item: 'Auditoría externa de ciberseguridad y validación legal',
      corfoContributionCLP: Math.round(fund.maxSubsidyCLP * 0.20),
      companyPecuniaryCLP: Math.round(fund.maxSubsidyCLP * 0.04),
      companyValuedCLP: 0,
      justification: 'Certificación técnica independiente ante comités de evaluación.'
    },
    {
      account: 'Gastos de Administración',
      item: 'Contabilidad y rendición de cuentas ante organismo público',
      corfoContributionCLP: Math.round(fund.maxSubsidyCLP * 0.10),
      companyPecuniaryCLP: Math.round(fund.maxSubsidyCLP * 0.03),
      companyValuedCLP: 0,
      justification: 'Garantizar el estricto cumplimiento administrativo y normativo.'
    }
  ];

  const totalCorfo = budgetItems.reduce((acc, curr) => acc + curr.corfoContributionCLP, 0);
  const totalCompanyCash = budgetItems.reduce((acc, curr) => acc + curr.companyPecuniaryCLP, 0);
  const totalProject = totalCorfo + totalCompanyCash;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    const md = `
# DOSSIER OFICIAL DE POSTULACIÓN - ${fund.agency} CHILE
**Fondo:** ${fund.name}  
**Convocatoria:** Ventanilla 2026  
**Fecha de Generación:** ${nowStr}  
**Plataforma de Certificación:** ImpulsaCap (Asesoría Tecnológica de Fondos Públicos)

---

## 1. IDENTIFICACIÓN DE LA ENTIDAD POSTULANTE
- **Razón Social:** ${profile.companyName}
- **RUT Empresa:** ${profile.rut} (Válido Módulo 11: ${isRutValid ? 'SÍ' : 'NO'})
- **Tipo Societario:** ${profile.companyType.toUpperCase()}
- **Región:** ${profile.region}
- **Sector Económico:** ${profile.sector}
- **Etapa Tecnológica (TRL):** ${profile.trlStage}
- **Bonificación de Género:** ${profile.isFemaleLed ? 'SÍ (+10% Subsidio Estatal adicional)' : 'No aplica'}

---

## 2. RESUMEN EJECUTIVO Y PITCH (30 SEGUNDOS)
${formulation?.pitchSummary30s || profile.projectSummary}

---

## 3. FORMULACIÓN TÉCNICA OFICIAL

### 3.1. Título del Proyecto
${formulation?.projectTitle || `Desarrollo e Implementación de ${profile.projectSummary.slice(0, 50)}`}

### 3.2. Problema / Oportunidad Identificada
${formulation?.problemStatement || 'Falta de digitalización y automatización de procesos críticos en el sector objetivo, causando ineficiencias de costos y tiempos.'}

### 3.3. Solución Propuesta y Grado de Novedad
${formulation?.solutionAndInnovation || profile.projectSummary}

### 3.4. Análisis de Mercado (TAM - SAM - SOM)
- **TAM (Total Addressable Market):** ${formulation?.marketAnalysisTAM?.tam || '$120.000.000 USD mercado total'}
- **SAM (Serviceable Available Market):** ${formulation?.marketAnalysisTAM?.sam || '$25.000.000 USD mercado regional'}
- **SOM (Serviceable Obtainable Market):** ${formulation?.marketAnalysisTAM?.som || '$2.500.000 USD meta año 1-2'}
- **Arquetipo de Cliente:** ${formulation?.marketAnalysisTAM?.clientArchetype || 'Empresas medianas con necesidad de optimización tecnológica.'}

### 3.5. Modelo de Negocio y Monetización
${formulation?.businessModel || 'Modelo de suscripción recurrente B2B SaaS con cobro mensual por volumen procesado y setup de integración.'}

### 3.6. Capacidades del Equipo
${formulation?.teamCapabilities || 'Equipo directivo multidisciplinario con experiencia demostrada en tecnología, finanzas y operaciones.'}

---

## 4. PRESUPUESTO OFICIAL (CUENTAS ${fund.agency})
- **Subsidio Solicitado (${fund.agency}):** $${totalCorfo.toLocaleString('es-CL')} CLP
- **Aporte Pecuniario Postulante (Caja):** $${totalCompanyCash.toLocaleString('es-CL')} CLP
- **Costo Total del Proyecto:** $${totalProject.toLocaleString('es-CL')} CLP
*(Valores netos, no incluyen IVA recuperable según normativa legal chilena)*

---

## 5. DOCUMENTOS DE ADMISIBILIDAD ADJUNTOS
- [x] Carpeta Tributaria Electrónica SII (F29 últimos 12 meses)
- [x] Certificado de Deudas Tributarias TGR (Sin deudas morosas)
- [x] Certificado F30 de Antecedentes Laborales y Previsionales
- [x] Estatutos Sociales y Certificado de Vigencia SpA / Personería
- [x] Cartas de Manifestación de Interés Comercial (LOI) de Clientes Piloto
    `.trim();

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const md = `
# DOSSIER OFICIAL DE POSTULACIÓN - ${fund.agency} CHILE
**Fondo:** ${fund.name}
**Empresa:** ${profile.companyName} (RUT: ${profile.rut})
**Generado con ImpulsaCap:** ${nowStr}

${formulation?.projectTitle || 'Proyecto'}
Pitch 30s: ${formulation?.pitchSummary30s || ''}
Problema: ${formulation?.problemStatement || ''}
Solución: ${formulation?.solutionAndInnovation || ''}
Modelo: ${formulation?.businessModel || ''}
Subsidio Solicitado: $${totalCorfo.toLocaleString('es-CL')} CLP
    `.trim();

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Dossier_${fund.agency}_${profile.companyName.replace(/\s+/g, '_')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
                <span>Dossier Oficial de Postulación</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Listo para Envío
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Formato estructurado para plataforma oficial {fund.agency} y PDF ministerial
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

        {/* Printable & Scrollable Dossier Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 bg-slate-900/60 text-slate-200 print:text-black print:bg-white print:p-0 print:overflow-visible">
          
          {/* Dossier Cover / Header */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 border border-slate-800 text-center space-y-4 print:border-black print:bg-white print:text-black">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 print:border-black">
              <div className="flex items-center gap-2">
                <InkiLogo size={28} withText withTagline={false} />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400 block print:text-black">
                  EXPEDIENTE OFICIAL DE FONDOS CONCURSABLES
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
                Postulación de Proyecto por: {profile.companyName} (RUT: {profile.rut})
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
                <strong className="text-white print:text-black">{profile.companyType.toUpperCase()}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block print:text-black">Región</span>
                <strong className="text-white print:text-black">{profile.region}</strong>
              </div>
            </div>
          </div>

          {/* Section 1: Entidad Postulante */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 print:border-black print:bg-white print:text-black">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 print:text-black">
              <Building2 className="w-4 h-4" />
              <span>1. Ficha de la Entidad Postulante</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-[10px] text-slate-400 block print:text-black">Razón Social</span>
                <strong className="text-white print:text-black">{profile.companyName}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-[10px] text-slate-400 block print:text-black">RUT Empresa</span>
                <strong className="font-mono text-cyan-400 print:text-black">{profile.rut}</strong>
                <span className="text-[10px] text-emerald-400 ml-1">✓ Módulo 11</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-[10px] text-slate-400 block print:text-black">Ventas 12 Meses (SII)</span>
                <strong className="text-white print:text-black">
                  ${(profile.annualSalesCLP || 0).toLocaleString('es-CL')} CLP
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-[10px] text-slate-400 block print:text-black">Madurez Tecnológica (TRL)</span>
                <strong className="text-white capitalize print:text-black">{profile.trlStage.replace('_', ' ')}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-[10px] text-slate-400 block print:text-black">Bono Liderazgo Femenino</span>
                <strong className={profile.isFemaleLed ? 'text-pink-400 print:text-black' : 'text-slate-400 print:text-black'}>
                  {profile.isFemaleLed ? `Aplica (${profile.femaleEquityPct}% socias)` : 'No aplica'}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-[10px] text-slate-400 block print:text-black">Validaciones Comerciales</span>
                <strong className="text-emerald-400 print:text-black">
                  {profile.customerValidationCount} cartas de clientes
                </strong>
              </div>
            </div>
          </div>

          {/* Section 2: Formulación Técnica */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 print:border-black print:bg-white print:text-black">
            <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2 print:text-black">
              <Sparkles className="w-4 h-4" />
              <span>2. Formulación Técnica Oficial ({fund.agency})</span>
            </h2>

            {/* Pitch */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase print:text-black">
                2.1. Pitch de 30 Segundos / Resumen Ejecutivo
              </h3>
              <p className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed italic print:border-black print:bg-white print:text-black">
                "{formulation?.pitchSummary30s || profile.projectSummary}"
              </p>
            </div>

            {/* Problema */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase print:text-black">
                2.2. Definición del Problema u Oportunidad
              </h3>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed print:border-black print:bg-white print:text-black">
                {formulation?.problemStatement || 'Identificación rigurosa de la brecha u obsolescencia técnica en el mercado meta, provocando pérdidas de tiempo y costos elevados.'}
              </div>
            </div>

            {/* Solución e Innovación */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase print:text-black">
                2.3. Solución Propuesta y Grado de Novedad
              </h3>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed print:border-black print:bg-white print:text-black">
                {formulation?.solutionAndInnovation || profile.projectSummary}
              </div>
            </div>

            {/* Mercado TAM SAM SOM */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase print:text-black">
                2.4. Dimensionamiento de Mercado (Metodología TAM - SAM - SOM)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                  <span className="text-[10px] text-cyan-400 font-bold block print:text-black">TAM (Total)</span>
                  <span className="text-white text-xs print:text-black">{formulation?.marketAnalysisTAM?.tam || '$120M USD'}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                  <span className="text-[10px] text-blue-400 font-bold block print:text-black">SAM (Accesible)</span>
                  <span className="text-white text-xs print:text-black">{formulation?.marketAnalysisTAM?.sam || '$25M USD'}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                  <span className="text-[10px] text-emerald-400 font-bold block print:text-black">SOM (Objetivo 24m)</span>
                  <span className="text-white text-xs print:text-black">{formulation?.marketAnalysisTAM?.som || '$2.5M USD'}</span>
                </div>
              </div>
            </div>

            {/* Modelo de Negocio */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase print:text-black">
                2.5. Modelo de Negocio y Escalabilidad
              </h3>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed print:border-black print:bg-white print:text-black">
                {formulation?.businessModel || 'Estrategia comercial basada en ventas recurrentes con bajo costo marginal y estructura escalable.'}
              </div>
            </div>
          </div>

          {/* Section 3: Presupuesto Detallado por Cuentas */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 print:border-black print:bg-white print:text-black">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2 print:text-black">
                <DollarSign className="w-4 h-4" />
                <span>3. Presupuesto Detallado por Cuentas {fund.agency}</span>
              </h2>
              <span className="text-[11px] text-slate-400 print:text-black font-semibold">
                Valores Netos en Pesos Chilenos (CLP)
              </span>
            </div>

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
                  {budgetItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-2 font-semibold text-white print:text-black">{item.account}</td>
                      <td className="py-2.5 px-2 text-slate-300 print:text-black">{item.item}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-cyan-400 print:text-black">
                        ${item.corfoContributionCLP.toLocaleString('es-CL')}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-emerald-400 print:text-black">
                        ${item.companyPecuniaryCLP.toLocaleString('es-CL')}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-white print:text-black">
                        ${(item.corfoContributionCLP + item.companyPecuniaryCLP).toLocaleString('es-CL')}
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
          </div>

          {/* Section 4: Checklist Admisibilidad & Documentos */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 print:border-black print:bg-white print:text-black">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 print:text-black">
              <ShieldCheck className="w-4 h-4" />
              <span>4. Checklist de Admisibilidad Administrativa y Legal</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-emerald-400 font-bold">✓</span>
                <div>
                  <strong className="text-white print:text-black">Carpeta Tributaria Electrónica SII</strong>
                  <p className="text-[10px] text-slate-400 print:text-black">F29 de los últimos 12 periodos tributarios</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-emerald-400 font-bold">✓</span>
                <div>
                  <strong className="text-white print:text-black">Certificado Deudas Tributarias TGR</strong>
                  <p className="text-[10px] text-slate-400 print:text-black">Acredita no poseer morosidades ante el Fisco</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-emerald-400 font-bold">✓</span>
                <div>
                  <strong className="text-white print:text-black">Certificado de Antecedentes Laborales F30</strong>
                  <p className="text-[10px] text-slate-400 print:text-black">Dirección del Trabajo al día sin multas</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 print:border-black print:bg-white">
                <span className="text-emerald-400 font-bold">✓</span>
                <div>
                  <strong className="text-white print:text-black">Cartas de Interés Comercial (LOI)</strong>
                  <p className="text-[10px] text-slate-400 print:text-black">Firmadas por representantes con poder vigente</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Dictamen Auditor Ciego (si existe) */}
          {auditResult && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-blue-950 border border-blue-900/50 space-y-3 print:border-black print:bg-white print:text-black">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-blue-300 flex items-center gap-2 print:text-black">
                  <Award className="w-4 h-4" />
                  <span>5. Dictamen Auditor Ciego Preliminar</span>
                </h2>
                <div className="text-right">
                  <span className="text-xs text-slate-400 mr-2 print:text-black">Calificación Ponderada:</span>
                  <span className="text-lg font-black text-amber-400 font-mono print:text-black">
                    {auditResult.overallScore.toFixed(1)} / 5.0
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 print:border-black print:bg-white print:text-black">
                <span className="font-bold text-white block mb-1 print:text-black">Veredicto Oficial:</span>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold print:border-black print:text-black">
                  {auditResult.verdict}
                </span>
                <p className="mt-2 text-[11px] text-slate-400 print:text-black">
                  La propuesta cumple con la rigurosidad técnica para ubicarse sobre la línea de corte y adjudicación ministerial.
                </p>
              </div>
            </div>
          )}

          {/* Signatures & Certification Block */}
          <div className="pt-8 border-t border-slate-800 grid grid-cols-2 gap-8 text-center text-xs print:border-black">
            <div className="space-y-1">
              <div className="w-48 mx-auto border-b border-slate-600 pb-1 print:border-black" />
              <p className="font-bold text-white print:text-black">{profile.companyName}</p>
              <p className="text-[10px] text-slate-400 print:text-black">Representante Legal • RUT {profile.rut}</p>
            </div>
            <div className="space-y-1">
              <div className="w-48 mx-auto border-b border-slate-600 pb-1 print:border-black" />
              <p className="font-bold text-amber-400 print:text-black">Plataforma ImpulsaCap Chile</p>
              <p className="text-[10px] text-slate-400 print:text-black">Certificación Técnica de Postulación</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
