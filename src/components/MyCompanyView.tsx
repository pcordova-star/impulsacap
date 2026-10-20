import React, { useState } from 'react';
import { CompanyProfile, CompanyUser, CompanyType, SalesBracket } from '../types/funds';
import { validateRut, formatRut } from '../utils/rutValidator';
import { 
  Building2, 
  FileText, 
  User, 
  Phone, 
  Mail, 
  ShieldCheck, 
  Upload, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Sparkles,
  Lock,
  LogOut,
  Calendar,
  DollarSign
} from 'lucide-react';

interface MyCompanyViewProps {
  profile: CompanyProfile;
  currentUser: CompanyUser | null;
  onUpdateProfile: (updated: CompanyProfile) => void;
  onOpenSiiModal: () => void;
  onLogout: () => void;
}

export const MyCompanyView: React.FC<MyCompanyViewProps> = ({
  profile,
  currentUser,
  onUpdateProfile,
  onOpenSiiModal,
  onLogout
}) => {
  // Local form state initialized from profile & currentUser
  const [companyName, setCompanyName] = useState(profile.companyName || currentUser?.companyName || '');
  const [rut, setRut] = useState(profile.rut || currentUser?.rut || '');
  const [companyType, setCompanyType] = useState<CompanyType>(profile.companyType || 'spa');
  const [sector, setSector] = useState(profile.sector || 'Tecnología e Innovación');
  const [region, setRegion] = useState(profile.region || 'Región Metropolitana');
  const [salesBracket, setSalesBracket] = useState<SalesBracket>(profile.salesBracket || 'sin_ventas');
  const [isFemaleLed, setIsFemaleLed] = useState<boolean>(profile.isFemaleLed || false);
  const [femaleEquityPct, setFemaleEquityPct] = useState<number>(profile.femaleEquityPct || 0);

  // Representative state
  const [representativeName, setRepresentativeName] = useState(currentUser?.representativeName || profile.representativeName || '');
  const [representativeRut, setRepresentativeRut] = useState(currentUser?.representativeRut || profile.representativeRut || '');
  const [representativeEmail, setRepresentativeEmail] = useState(currentUser?.email || '');
  const [representativePhone, setRepresentativePhone] = useState(currentUser?.phone || '');

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated: CompanyProfile = {
      ...profile,
      companyName: companyName.trim() || 'Mi Empresa',
      rut: rut.trim(),
      companyType,
      sector: sector.trim(),
      region: region.trim(),
      salesBracket,
      isFemaleLed,
      femaleEquityPct: isFemaleLed ? (femaleEquityPct || 100) : 0,
      representativeName: representativeName.trim(),
      representativeRut: representativeRut.trim()
    };
    onUpdateProfile(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const isCompanyRutValid = rut ? validateRut(rut) : true;
  const isRepRutValid = representativeRut ? validateRut(representativeRut) : true;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-8">
      {/* 1. Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-50/70 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[10px] font-bold tracking-wider uppercase">
                BÓVEDA EMPRESARIAL
              </span>
              {currentUser && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Sesión Segura</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {companyName || 'Mi Empresa'}
            </h1>

            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Gestiona el perfil de tu empresa, tus antecedentes tributarios del SII y los datos del representante legal para formular y validar tus postulaciones.
            </p>
          </div>

          {currentUser && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 2. Carpeta Tributaria SII Section (Requirement 1) */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Carpeta Tributaria Electrónica SII (F29)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Acredita inicio de actividades en 1ª categoría y facturación de los últimos periodos ante CORFO
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenSiiModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{profile.taxFolderUploaded ? 'Actualizar Carpeta Tributaria' : 'Subir Carpeta Tributaria (PDF/XML)'}</span>
            </button>
          </div>

          {profile.taxFolderUploaded ? (
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Carpeta Tributaria Verificada y Vinculada</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-700 font-bold">
                  {profile.taxFolderUploadDate || 'Reciente'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-white border border-emerald-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Archivo:</span>
                  <p className="font-semibold text-slate-900 truncate mt-0.5" title={profile.taxFolderFileName}>
                    {profile.taxFolderFileName || 'Carpeta_SII.pdf'}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-emerald-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Periodos F29:</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {profile.taxFolderF29Periods || 12} meses declarados
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-emerald-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Ventas 12 Meses:</span>
                  <p className="font-bold text-blue-700 mt-0.5">
                    ${(profile.annualSalesCLP || 0).toLocaleString('es-CL')} CLP
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-emerald-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Antigüedad SII:</span>
                  <p className="font-bold text-emerald-700 mt-0.5">
                    {profile.monthsActive ? `${profile.monthsActive} meses` : 'Acreditada'}
                  </p>
                </div>
              </div>

              {profile.taxFolderSummary && (
                <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-emerald-100">
                  💡 {profile.taxFolderSummary}
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-bold">Aún no has subido tu Carpeta Tributaria Electrónica</p>
                  <p className="text-[11px] text-amber-800">
                    Sube el PDF que descargas gratis desde www.sii.cl para autovalidar ventas y requisitos excluyentes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenSiiModal}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0 text-center"
              >
                Subir con IA
              </button>
            </div>
          )}
        </div>

        {/* 3. Identificación y Perfil de la Empresa */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Perfil de la Empresa
              </h3>
              <p className="text-[11px] text-slate-500">
                Datos constitutivos y características del negocio
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Razón Social */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Razón Social</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ej: Innovaciones Tecnológicas SpA"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden font-semibold"
              />
            </div>

            {/* RUT */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">RUT Empresa</label>
                {rut && (
                  <span className={`text-[10px] font-bold ${isCompanyRutValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isCompanyRutValid ? '✓ Válido Módulo 11' : '⚠ RUT inválido'}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={rut}
                onChange={(e) => setRut(formatRut(e.target.value))}
                placeholder="77.123.456-K"
                className={`w-full px-3.5 py-2 rounded-xl bg-slate-50 border text-slate-900 font-mono font-semibold focus:bg-white focus:outline-hidden ${
                  rut && isCompanyRutValid ? 'border-emerald-400' : 'border-slate-300 focus:border-blue-500'
                }`}
              />
            </div>

            {/* Tipo de Sociedad */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Tipo de Sociedad</label>
              <select
                value={companyType}
                onChange={(e) => setCompanyType(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden font-medium cursor-pointer"
              >
                <option value="spa">Sociedad por Acciones (SpA)</option>
                <option value="srl">Sociedad de Resp. Ltda. (SRL)</option>
                <option value="eirl">Empresa Individual (EIRL)</option>
                <option value="sa">Sociedad Anónima (S.A.)</option>
                <option value="persona_natural">Persona Natural con Giro 1ª Categoría</option>
                <option value="sin_iniciar">Sin Inicio de Actividades ante el SII</option>
              </select>
            </div>

            {/* Tramo de Ventas */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Tramo de Ventas (Últimos 12 Meses)</label>
              <select
                value={salesBracket}
                onChange={(e) => setSalesBracket(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden font-medium cursor-pointer"
              >
                <option value="sin_ventas">Sin Ventas ($0)</option>
                <option value="menor_60m">Menor a $60.000.000 CLP</option>
                <option value="micro_200_a_2400uf">Microempresa (200 a 2.400 UF)</option>
                <option value="pequena_2400_a_25000uf">Pequeña Empresa (2.400 a 25.000 UF)</option>
                <option value="mediana_25000_a_100000uf">Mediana Empresa (25.000 a 100.000 UF)</option>
                <option value="grande_mayor_100000uf">Gran Empresa (&gt; 100.000 UF)</option>
              </select>
            </div>

            {/* Sector */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Sector Económico</label>
              <input
                type="text"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Ej: Software, Biotecnología, Agroalimentos, Minería"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Región */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Región de Ejecución</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Ej: Región de Valparaíso, Metropolitana, Biobío"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Liderazgo Femenino */}
          <div className="p-3.5 rounded-2xl bg-pink-50/50 border border-pink-200 space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
              <input
                type="checkbox"
                checked={isFemaleLed}
                onChange={(e) => setIsFemaleLed(e.target.checked)}
                className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 border-slate-300"
              />
              <span>Empresa liderada por mujeres (Bono de Género CORFO / SERCOTEC)</span>
            </label>
            {isFemaleLed && (
              <div className="flex items-center gap-2 pl-6">
                <span className="text-slate-600 text-[11px]">Porcentaje accionario o de participación femenina:</span>
                <input
                  type="number"
                  min="51"
                  max="100"
                  value={femaleEquityPct || 100}
                  onChange={(e) => setFemaleEquityPct(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded-lg border border-pink-300 text-slate-900 font-bold text-center"
                />
                <span className="text-slate-600 text-[11px]">%</span>
              </div>
            )}
          </div>
        </div>

        {/* 4. Datos del Representante Legal (Requirement 1) */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Representante Legal
              </h3>
              <p className="text-[11px] text-slate-500">
                Persona natural facultada con poder notarial para firmar convenios y recibir subsidios estatales
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Nombre Representante */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Nombre Completo</label>
              <input
                type="text"
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
                placeholder="Ej: Carolina Andrea Sepúlveda Ríos"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            {/* RUT Representante */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">RUT Personal</label>
                {representativeRut && (
                  <span className={`text-[10px] font-bold ${isRepRutValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isRepRutValid ? '✓ Válido Módulo 11' : '⚠ RUT inválido'}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={representativeRut}
                onChange={(e) => setRepresentativeRut(formatRut(e.target.value))}
                placeholder="15.123.456-7"
                className={`w-full px-3.5 py-2 rounded-xl bg-slate-50 border text-slate-900 font-mono font-semibold focus:bg-white focus:outline-hidden ${
                  representativeRut && isRepRutValid ? 'border-emerald-400' : 'border-slate-300 focus:border-blue-500'
                }`}
              />
            </div>

            {/* Correo Electrónico */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Correo Electrónico de Contacto</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={representativeEmail}
                  onChange={(e) => setRepresentativeEmail(e.target.value)}
                  placeholder="contacto@miempresa.cl"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Teléfono */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Teléfono / WhatsApp</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={representativePhone}
                  onChange={(e) => setRepresentativePhone(e.target.value)}
                  placeholder="+56 9 8765 4321"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 5. Save Button Bar */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div>
            {savedSuccess && (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>¡Datos de la empresa guardados correctamente!</span>
              </span>
            )}
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Datos de Mi Empresa</span>
          </button>
        </div>
      </form>
    </div>
  );
};
