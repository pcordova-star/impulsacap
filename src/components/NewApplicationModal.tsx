import React, { useState, useMemo } from 'react';
import { ChileanFund, CompanyProfile, getFundVisibleStatus } from '../types/funds';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { ApplicationItem } from '../types/application';
import { 
  X, 
  Search, 
  Filter, 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Sparkles,
  ExternalLink,
  Archive,
  Info,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';

interface NewApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CompanyProfile;
  activeApplications: ApplicationItem[];
  funds?: ChileanFund[];
  onCreateApplication: (fundId: string) => Promise<{ ok: boolean; application?: ApplicationItem; error?: string; limitReached?: boolean }>;
  onOpenExistingApplication: (appId: string) => void;
  onArchiveApplication: (appId: string) => Promise<{ ok: boolean }>;
}

interface InadmissibilityWarning {
  fund: ChileanFund;
  reasons: string[];
}

export const NewApplicationModal: React.FC<NewApplicationModalProps> = ({
  isOpen,
  onClose,
  profile,
  activeApplications,
  funds = CHILEAN_FUNDS,
  onCreateApplication,
  onOpenExistingApplication,
  onArchiveApplication
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [agencyFilter, setAgencyFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todas');
  
  // Modals inside for warnings or limits
  const [warningFund, setWarningFund] = useState<InadmissibilityWarning | null>(null);
  const [existingAppConflict, setExistingAppConflict] = useState<{ fund: ChileanFund; app: ApplicationItem } | null>(null);
  const [showLimitNotice, setShowLimitNotice] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Check if user has reached the 3 active postulations limit
  const isAtLimit = activeApplications.length >= 3;

  // Filter and sort funds: Recommended funds first
  const filteredFunds = useMemo(() => {
    return funds.filter(fund => {
      const matchesSearch = 
        fund.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fund.agency.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fund.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fund.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesAgency = agencyFilter === 'todos' || fund.agency === agencyFilter;

      const visibleStatus = getFundVisibleStatus(fund).toLowerCase();
      const matchesStatus = statusFilter === 'todas' || 
        (statusFilter === 'abierta' && visibleStatus === 'abierta') ||
        (statusFilter === 'proxima' && visibleStatus === 'próxima') ||
        (statusFilter === 'cerrada' && visibleStatus === 'cerrada');

      return matchesSearch && matchesAgency && matchesStatus;
    }).sort((a, b) => {
      // Prioritize recommended funds
      const aIsRec = isRecommended(a, profile);
      const bIsRec = isRecommended(b, profile);
      if (aIsRec && !bIsRec) return -1;
      if (!aIsRec && bIsRec) return 1;
      return 0;
    });
  }, [searchQuery, agencyFilter, statusFilter, profile]);

  function isRecommended(fund: ChileanFund, p: CompanyProfile): boolean {
    const typeOk = fund.beneficiaryTypes.includes(p.companyType);
    const trlOk = !p.trlStage || fund.trlEligible.includes(p.trlStage);
    const salesOk = !p.salesBracket || fund.salesBracketsEligible.includes(p.salesBracket);
    return typeOk && trlOk && salesOk;
  }

  // Check admissibility differences
  function checkRequirements(fund: ChileanFund, p: CompanyProfile): string[] {
    const discrepancies: string[] = [];

    // Sales bracket
    if (p.salesBracket && !fund.salesBracketsEligible.includes(p.salesBracket)) {
      const salesMap: Record<string, string> = {
        'sin_ventas': 'Sin ventas ($0)',
        'menor_60m': 'Ventas menores a $60M',
        'micro_200_a_2400uf': 'Micro (200 a 2.400 UF)',
        'pequena_2400_a_25000uf': 'Pequeña (2.400 a 25.000 UF)',
        'mediana_25000_a_100000uf': 'Mediana (25.000 a 100.000 UF)',
        'grande_mayor_100000uf': 'Grande (> 100.000 UF)'
      };
      const userSales = salesMap[p.salesBracket] || p.salesBracket;
      discrepancies.push(`Este fondo exige: "${fund.salesRequirement}", y tus antecedentes tributarios registran: "${userSales}".`);
    }

    // Company type
    if (p.companyType && !fund.beneficiaryTypes.includes(p.companyType)) {
      const typeMap: Record<string, string> = {
        'persona_natural': 'Persona Natural con Giro',
        'spa': 'SpA (Sociedad por Acciones)',
        'srl': 'S.R.L. (Responsabilidad Limitada)',
        'eirl': 'E.I.R.L.',
        'sa': 'Sociedad Anónima (S.A.)',
        'sin_iniciar': 'Sin Inicio de Actividades'
      };
      const userType = typeMap[p.companyType] || p.companyType;
      discrepancies.push(`Este fondo solo admite postulantes de tipo: ${fund.beneficiaryTypes.join(', ')}, mientras que tu empresa está registrada como: "${userType}".`);
    }

    // TRL Stage
    if (p.trlStage && !fund.trlEligible.includes(p.trlStage)) {
      const trlMap: Record<string, string> = {
        'idea_concepto': 'Idea / Concepto (TRL 1-2)',
        'prototipo_lab': 'Prototipo de Laboratorio (TRL 3-4)',
        'mvp_validado': 'MVP Validado en Entorno Relevante (TRL 5-6)',
        'primeras_ventas': 'Primeras Ventas Comerciales (TRL 7-8)',
        'escalamiento_global': 'Escalamiento e Internacionalización (TRL 9)'
      };
      const userTrl = trlMap[p.trlStage] || p.trlStage;
      discrepancies.push(`Este fondo exige madurez tecnológica: "${fund.trlRange}", y tu proyecto se encuentra en: "${userTrl}".`);
    }

    return discrepancies;
  }

  // User clicked to select a fund
  const handleSelectFund = async (fund: ChileanFund, forceProceed: boolean = false) => {
    // 1. Check if application already exists for this fund (Requirement 9)
    const existing = activeApplications.find(a => a.fundId === fund.id);
    if (existing) {
      setExistingAppConflict({ fund, app: existing });
      return;
    }

    // 2. Check 3-postulation plan limit (Requirement 11)
    if (isAtLimit) {
      setShowLimitNotice(true);
      return;
    }

    // 3. Check requirements & admissibility discrepancies (Requirement 8)
    if (!forceProceed) {
      const discrepancies = checkRequirements(fund, profile);
      if (discrepancies.length > 0) {
        setWarningFund({ fund, reasons: discrepancies });
        return;
      }
    }

    // 4. Create the application
    setSubmitting(true);
    try {
      const res = await onCreateApplication(fund.id);
      if (res.ok) {
        onClose();
      } else if (res.limitReached) {
        setShowLimitNotice(true);
      } else if (res.error) {
        alert(res.error);
      }
    } finally {
      setSubmitting(false);
      setWarningFund(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-blue-100 text-blue-700">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Nueva Postulación a Fondos
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Elige el fondo concursable al que deseas postular. Puedes gestionar hasta 3 postulaciones activas simultáneas con tu Plan Semestral.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Plan Limit Banner if at 3 applications */}
        {isAtLimit && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between gap-3 text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Límite alcanzado:</strong> Tienes 3 de 3 postulaciones activas simultáneas. Para iniciar una nueva postulación, debes archivar una de las actuales.
              </span>
            </div>
            <button
              onClick={() => setShowLimitNotice(true)}
              className="text-amber-900 font-bold underline hover:text-amber-950 shrink-0 cursor-pointer"
            >
              Gestionar cupos
            </button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-12 gap-3 shrink-0">
          {/* Search Box */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por fondo, organismo (CORFO, SERCOTEC...) o palabras clave"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>

          {/* Agency Filter */}
          <div className="sm:col-span-3">
            <select
              value={agencyFilter}
              onChange={(e) => setAgencyFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 cursor-pointer"
            >
              <option value="todos">Todos los organismos</option>
              <option value="CORFO">CORFO</option>
              <option value="SERCOTEC">SERCOTEC</option>
              <option value="ANID">ANID</option>
              <option value="START-UP CHILE">START-UP CHILE</option>
              <option value="FIA">FIA</option>
            </select>
          </div>

          {/* Call Status Filter */}
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 cursor-pointer"
            >
              <option value="todas">Cualquier estado</option>
              <option value="abierta">Convocatoria Abierta</option>
              <option value="proxima">Próxima Convocatoria</option>
              <option value="cerrada">Cerrada</option>
            </select>
          </div>
        </div>

        {/* Funds List Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
          {filteredFunds.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No encontramos fondos para esa búsqueda</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Prueba ajustando los filtros de organismo o buscando términos más generales como "Semilla" o "I+D".
              </p>
              <button
                onClick={() => { setSearchQuery(''); setAgencyFilter('todos'); setStatusFilter('todas'); }}
                className="px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl cursor-pointer"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            filteredFunds.map(fund => {
              const recommended = isRecommended(fund, profile);
              const visibleStatus = getFundVisibleStatus(fund);
              const alreadyActive = activeApplications.some(a => a.fundId === fund.id);

              return (
                <div
                  key={fund.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    recommended 
                      ? 'bg-gradient-to-r from-blue-50/50 via-white to-white border-blue-200 hover:border-blue-300 hover:shadow-md' 
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-mono text-[10px] font-bold tracking-wider">
                          {fund.agency}
                        </span>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          visibleStatus === 'Abierta' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : visibleStatus === 'Próxima'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {visibleStatus}
                        </span>

                        {recommended && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            Recomendado para tu perfil
                          </span>
                        )}

                        {alreadyActive && (
                          <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                            Ya activa en tu panel
                          </span>
                        )}
                      </div>

                      {/* Fund Title & Subtitle */}
                      <div>
                        <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {fund.name}
                        </h4>
                        <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                          {fund.summary}
                        </p>
                      </div>

                      {/* Specs pills */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                        <span>Subsidio: <strong className="text-emerald-700 font-mono font-bold">{fund.subsidyFormatted}</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>Hasta <strong className="text-slate-700">{fund.maxCoFinancePct}% cofinanciamiento</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>Cierre: <strong className="text-slate-700">{fund.closeDate || 'Ventanilla continua / Por definir'}</strong></span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="shrink-0 flex items-center gap-2">
                      {alreadyActive ? (
                        <button
                          onClick={() => {
                            const app = activeApplications.find(a => a.fundId === fund.id);
                            if (app) onOpenExistingApplication(app.id);
                            onClose();
                          }}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
                        >
                          <span>Abrir activa</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          disabled={submitting}
                          onClick={() => handleSelectFund(fund)}
                          className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                            recommended 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          <span>Formular a este fondo</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Mostrando {filteredFunds.length} fondos concursables oficiales</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* WARNING MODAL: Requisitos & Inadmisibilidad (Requirement 8) */}
      {warningFund && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-amber-300 shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="p-2.5 rounded-2xl bg-amber-100 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Aviso de Calce y Requisitos</h3>
                <p className="text-xs text-slate-500">Bases concursables de {warningFund.fund.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Detectamos que los datos actuales de tu empresa y carpeta tributaria presentan discrepancias con las bases oficiales de este fondo:
            </p>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 text-xs text-amber-900">
              {warningFund.reasons.map((reason, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Puedes corregir los datos de tu empresa en el perfil o postular de todas formas si tu proyecto contempla una figura admisible.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                onClick={() => setWarningFund(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Volver y elegir otro
              </button>
              <button
                onClick={() => handleSelectFund(warningFund.fund, true)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Postular igual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFLICT MODAL: Existing application for this fund (Requirement 9) */}
      {existingAppConflict && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-blue-200 shadow-2xl w-full max-w-md p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
              <Info className="w-6 h-6" />
            </div>
            
            <h3 className="text-base font-bold text-slate-900">
              Ya tienes una postulación activa para este fondo
            </h3>

            <p className="text-xs text-slate-600">
              Tu postulación a <strong>{existingAppConflict.fund.name}</strong> ya se encuentra en preparación. No es necesario crear un duplicado.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setExistingAppConflict(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onOpenExistingApplication(existingAppConflict.app.id);
                  setExistingAppConflict(null);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Abrir postulación existente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAN LIMIT MODAL (Requirement 11) */}
      {showLimitNotice && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-slate-900">
              <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700 shrink-0">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Límite de Postulaciones Simultáneas</h3>
                <p className="text-xs text-slate-500">Plan Semestral: Máximo 3 postulaciones activas</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tu plan incluye hasta 3 postulaciones simultáneas en preparación. Para iniciar una nueva postulación, puedes <strong>archivar</strong> una de las postulaciones que ya no utilices. Archivar libera el cupo de inmediato y conserva todos tus datos resguardados por si deseas reactivarla más adelante.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              ¿Trabajas con varias empresas o necesitas más cupos?{' '}
              <a href="mailto:contacto@impulsacap.cl?subject=Plan%20para%20consultoras" className="text-blue-700 font-semibold underline underline-offset-2">Escríbenos</a>{' '}
              y te armamos un plan a tu medida.
            </p>

            <div className="space-y-2 border border-slate-200 rounded-2xl p-3 bg-slate-50">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Tus 3 postulaciones activas actuales:
              </span>
              {activeApplications.map((app) => (
                <div key={app.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-800 truncate">{app.fundName}</p>
                    <p className="text-[10px] text-slate-400">Creada el {new Date(app.createdAt).toLocaleDateString('es-CL')}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await onArchiveApplication(app.id);
                      setShowLimitNotice(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 cursor-pointer transition-colors"
                  >
                    Archivar y liberar
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowLimitNotice(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
