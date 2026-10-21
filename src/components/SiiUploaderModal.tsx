import { apiFetch } from '../utils/apiFetch';
import React, { useState, useRef, useEffect } from 'react';
import { CompanyProfile } from '../types/funds';
import { validateRut, formatRut, formatRutInput } from '../utils/rutValidator';
import { syncTaxFolderToFirestore } from '../utils/firebaseSync';
import { TaxDiagnosisView } from './TaxDiagnosisView';
import { buildSampleCarpetaText } from '../utils/sampleCarpeta';
import type { TaxDiagnosis } from '../utils/taxDiagnosis';
import { 
  FileText, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  RefreshCw, 
  Building2, 
  Calendar, 
  DollarSign, 
  ShieldCheck,
  Check,
  FileType,
  FileCheck,
  ArrowRight,
  RotateCcw
} from 'lucide-react';

const LOADING_STEPS = [
  'Leyendo los datos del contribuyente',
  'Revisando tus F29 mes a mes',
  'Revisando tus declaraciones de renta',
  'Calculando el tamaño de tu empresa',
  'Comparando con los requisitos de cada fondo'
];

interface SiiUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyProfile: (updated: Partial<CompanyProfile>) => void;
}


export const SiiUploaderModal: React.FC<SiiUploaderModalProps> = ({
  isOpen,
  onClose,
  onApplyProfile
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pasos visibles mientras se lee la carpeta (el lector demora unos segundos con 36 F29)
  useEffect(() => {
    if (!loading) { setLoadingStep(0); return; }
    const t = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 900);
    return () => clearInterval(t);
  }, [loading]);

  // Editable confirmation fields (Requirement 4)
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editRut, setEditRut] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editMonthsActive, setEditMonthsActive] = useState<string>('');
  const [editAnnualSales, setEditAnnualSales] = useState<string>('');
  const [editPeriodsFound, setEditPeriodsFound] = useState<string>('');
  const [editCompanyType, setEditCompanyType] = useState<string>('spa');

  const populateEditFields = (data: any) => {
    setParsedData(data);
    setNotice(typeof data?.aviso === 'string' ? data.aviso : null);
    setEditCompanyName(data.companyName || '');
    setEditRut(data.rut || '');
    setEditStartDate(data.startDate || '');
    setEditMonthsActive(data.monthsActive !== null && data.monthsActive !== undefined ? String(data.monthsActive) : '');
    setEditAnnualSales(data.annualSalesCLP ? String(data.annualSalesCLP) : '0');
    setEditPeriodsFound(data.periodsFound !== null && data.periodsFound !== undefined ? String(data.periodsFound) : '0');
    setEditCompanyType(data.companyType || 'spa');
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      processUploadedFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      processUploadedFile(file);
    }
  };

  const processUploadedFile = async (file: File) => {
    setIsSample(false);
    setLoading(true);
    setParsedData(null);
    setApplied(false);
    setError(null);

    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      
      if (isPdf) {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          try {
            const response = await apiFetch('/api/gemini/parse-tax-folder', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                fileBase64: base64,
                mimeType: 'application/pdf',
                fileName: file.name
              })
            });

            const contentType = response.headers.get('content-type') || '';
            let data: any = null;
            if (contentType.includes('application/json')) {
              data = await response.json();
            } else {
              const textResp = await response.text();
              console.warn('Non-JSON response from parse-tax-folder:', textResp.slice(0, 150));
              throw new Error('Hubo un problema al procesar el archivo PDF. Intenta nuevamente.');
            }

            if (!response.ok) {
              throw new Error(data?.error || 'No se pudo procesar la Carpeta Tributaria. Intenta nuevamente en unos minutos.');
            }
            populateEditFields(data);
          } catch (err: any) {
            console.error('PDF parsing error:', err);
            setParsedData(null);
            const msg = err?.message || 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.';
            if (msg.includes('Unexpected token') || msg.includes('<!doctype') || msg.includes('is not valid JSON')) {
              setError('Hubo un problema al procesar el archivo PDF. Intenta nuevamente.');
            } else {
              setError(msg);
            }
          } finally {
            setLoading(false);
          }
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = async () => {
          const text = reader.result as string;
          try {
            const response = await apiFetch('/api/gemini/parse-tax-folder', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                rawText: text,
                fileName: file.name
              })
            });

            const contentType = response.headers.get('content-type') || '';
            let data: any = null;
            if (contentType.includes('application/json')) {
              data = await response.json();
            } else {
              const textResp = await response.text();
              console.warn('Non-JSON response from parse-tax-folder text:', textResp.slice(0, 150));
              throw new Error('Hubo un problema al procesar el archivo. Intenta nuevamente.');
            }

            if (!response.ok) {
              throw new Error(data?.error || 'No se pudo procesar la Carpeta Tributaria. Intenta nuevamente en unos minutos.');
            }
            populateEditFields(data);
          } catch (err: any) {
            console.error('Text parsing error:', err);
            setParsedData(null);
            const msg = err?.message || 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.';
            if (msg.includes('Unexpected token') || msg.includes('<!doctype') || msg.includes('is not valid JSON')) {
              setError('Hubo un problema al procesar el archivo. Intenta nuevamente.');
            } else {
              setError(msg);
            }
          } finally {
            setLoading(false);
          }
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      console.error('File process error:', err);
      setParsedData(null);
      setError(err?.message || 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.');
      setLoading(false);
    }
  };

  const handleProcessText = async (textToProcess: string) => {
    if (!textToProcess.trim()) return;
    setLoading(true);
    setParsedData(null);
    setApplied(false);
    setError(null);
    try {
      const response = await apiFetch('/api/gemini/parse-tax-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: textToProcess })
      });
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.');
      }
      const data = await response.json();
      populateEditFields(data);
    } catch (err: any) {
      console.error('Process text error:', err);
      setParsedData(null);
      setError(err?.message || 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.');
    } finally {
      setLoading(false);
    }
  };

  // Requirement 4: Nada se guarda en el perfil sin que el usuario presione "Confirmar datos"
  const handleConfirmSave = async () => {
    const fileName = selectedFile ? selectedFile.name : 'Carpeta_Tributaria_SII.pdf';
    
    const salesNum = parseInt(String(editAnnualSales).replace(/\D/g, ''), 10) || 0;
    const monthsNum = editMonthsActive.trim() !== '' ? parseInt(editMonthsActive, 10) : null;
    const periodsNum = editPeriodsFound.trim() !== '' ? parseInt(editPeriodsFound, 10) : 0;
    
    let salesBracket = '';
    if (salesNum > 0) {
      if (salesNum < 60000000) salesBracket = 'menor_60m';
      else if (salesNum / 39000 < 2400) salesBracket = 'micro_200_a_2400uf';
      else if (salesNum / 39000 < 25000) salesBracket = 'pequena_2400_a_25000uf';
      else if (salesNum / 39000 < 100000) salesBracket = 'mediana_25000_a_100000uf';
      else salesBracket = 'grande_mayor_100000uf';
    } else if (periodsNum > 0) {
      salesBracket = 'sin_ventas';
    }

    const cleanRutVal = editRut.trim();
    const formattedRut = cleanRutVal && validateRut(cleanRutVal) ? formatRut(cleanRutVal) : cleanRutVal;

    const diag: TaxDiagnosis | undefined = parsedData?.diagnosis;
    const regionName = diag?.company.region
      ? (diag.company.region === 'Metropolitana' ? 'Región Metropolitana' : `Región de ${diag.company.region}`)
      : undefined;
    const firstRep = diag?.company.legalRepresentatives[0];
    onApplyProfile({
      ...(regionName ? { region: regionName } : {}),
      ...(firstRep ? { representativeName: firstRep.name, representativeRut: formatRut(firstRep.rut) } : {}),
      rut: formattedRut || undefined,
      companyName: editCompanyName.trim() || undefined,
      companyType: (editCompanyType as any) || 'spa',
      monthsActive: monthsNum,
      salesBracket: (salesBracket as any) || '',
      annualSalesCLP: salesNum,
      taxFolderUploaded: true,
      taxFolderFileName: fileName,
      taxFolderUploadDate: new Date().toLocaleDateString('es-CL'),
      taxFolderSummary: `Datos confirmados por la empresa: RUT ${formattedRut || 'S/I'} | ${editCompanyName.trim() || 'Empresa'} | Ventas $${salesNum.toLocaleString('es-CL')} CLP en ${periodsNum} periodos F29.`,
      taxFolderF29Periods: periodsNum
    });

    try {
      await syncTaxFolderToFirestore({
        fileName,
        fileSize: selectedFile?.size || 1024,
        companyRut: formattedRut || '',
        summary: `Datos confirmados: RUT ${formattedRut || 'S/I'} | ${editCompanyName.trim() || 'Empresa'}`,
        f29Periods: periodsNum
      });
    } catch (err) {
      console.warn('Could not sync tax folder to Firestore in background:', err);
    }

    setApplied(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleLoadSample = () => {
    setIsSample(true);
    setSelectedFile(null);
    handleProcessText(buildSampleCarpetaText());
  };

  const resetToUpload = () => {
    setParsedData(null);
    setSelectedFile(null);
    setInputText('');
    setIsSample(false);
    setApplied(false);
    setActiveTab('upload');
  };

  const diagnosis: TaxDiagnosis | undefined = !loading ? parsedData?.diagnosis : undefined;
  const correctionFields = (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Razón Social */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Razón Social:</label>
                <input
                  type="text"
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  placeholder="Ej: Innovaciones Tecnológicas SpA"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* RUT */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">RUT Empresa:</label>
                  {editRut && (
                    <span className={`text-[9px] font-semibold ${validateRut(editRut) ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {validateRut(editRut) ? 'Módulo 11 Válido' : 'RUT no válido'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={editRut}
                  onChange={(e) => setEditRut(formatRutInput(e.target.value))}
                  placeholder="Ej: 76.123.456-7"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 font-mono text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Fecha Inicio Actividades */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Inicio de Actividades:</label>
                <input
                  type="text"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  placeholder="Ej: 14/03/2023"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Antigüedad (meses) */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Antigüedad (meses activos):</label>
                <input
                  type="number"
                  min="0"
                  value={editMonthsActive}
                  onChange={(e) => setEditMonthsActive(e.target.value)}
                  placeholder="Ej: 14"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Ventas 12 Meses */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Ventas Últimos 12 Meses (CLP):</label>
                <input
                  type="number"
                  min="0"
                  value={editAnnualSales}
                  onChange={(e) => setEditAnnualSales(e.target.value)}
                  placeholder="Ej: 18500000"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-blue-700 font-bold text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Periodos F29 Encontrados */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Periodos F29 Encontrados:</label>
                <input
                  type="number"
                  min="0"
                  max="48"
                  value={editPeriodsFound}
                  onChange={(e) => setEditPeriodsFound(e.target.value)}
                  placeholder="Ej: 12"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className={`w-full ${diagnosis ? 'max-w-5xl' : 'max-w-xl'} rounded-3xl bg-white border border-slate-200 p-5 sm:p-7 shadow-2xl space-y-4 max-h-[94vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{diagnosis ? 'Diagnóstico tributario' : 'Diagnóstico tributario gratuito'}</h3>
              <p className="text-xs text-slate-500">
                {diagnosis
                  ? 'Calculado solo con lo que dice tu Carpeta Tributaria'
                  : 'Sube tu Carpeta Tributaria del SII y te mostramos a qué fondos calificas, tus ventas y qué regularizar antes de postular'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {diagnosis && (
              <button
                type="button"
                onClick={resetToUpload}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Subir otra carpeta
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!diagnosis && !loading && (<>
        {/* Cómo obtener la carpeta */}
        <p className="text-xs text-slate-600 leading-relaxed rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5">
          Descárgala en <strong>sii.cl</strong>: Servicios online, Situación tributaria, <strong>Carpeta tributaria electrónica</strong>. Elige la de <strong>acreditar tamaño de empresa</strong>, la regular o una personalizada con F29 y F22.
        </p>

        {/* Tab Selector */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Subir Archivo (PDF / XML)</span>
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'text'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Pegar Texto o F29</span>
          </button>
        </div>

        {/* Option 1: File Drag & Drop Upload */}
        {activeTab === 'upload' && (
          <div className="space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.xml,.txt,.csv"
              className="hidden"
            />

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-3 ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50/70' 
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/70 hover:bg-slate-50'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Upload className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">
                  Arrastra tu Carpeta Tributaria aquí o <span className="text-blue-600 underline">haz clic para examinar</span>
                </p>
                <p className="text-xs text-slate-500">
                  Formatos soportados: <strong>PDF</strong> (Carpeta para Créditos/Subsidios), <strong>XML</strong>, TXT o F29
                </p>
              </div>

              {selectedFile && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-700 shadow-xs">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-slate-900 truncate max-w-[220px]">{selectedFile.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">({Math.round(selectedFile.size / 1024)} KB)</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>¿No tienes tu carpeta a mano?</span>
              <button
                onClick={handleLoadSample}
                className="text-blue-600 hover:text-blue-700 font-semibold underline cursor-pointer"
              >
                Ver un ejemplo con una empresa ficticia
              </button>
            </div>
          </div>
        )}

        {/* Option 2: Raw Text Box */}
        {activeTab === 'text' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Texto de la Carpeta Tributaria o Formulario 29:
              </label>
              <button
                onClick={handleLoadSample}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold underline cursor-pointer"
              >
                Ver un ejemplo
              </button>
            </div>
            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Pega aquí el texto copiado de tu Carpeta Tributaria SII o los resúmenes de tu F29..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-mono leading-relaxed focus:bg-white focus:border-blue-500 focus:outline-hidden"
            />
            <div className="flex justify-end pt-1">
              <button
                onClick={() => { setIsSample(false); handleProcessText(inputText); }}
                disabled={loading || !inputText.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analizando F29...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analizar Texto con IA</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        </>)}

        {/* Error Banner with Retry */}
        {notice && !error && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => {
                setError(null);
                if (activeTab === 'upload' && selectedFile) {
                  processUploadedFile(selectedFile);
                } else if (inputText) {
                  handleProcessText(inputText);
                }
              }}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reintentar</span>
            </button>
          </div>
        )}

        {/* Loading Spinner Indicator */}
        {loading && (
          <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200 space-y-3" role="status">
            <p className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              Analizando tu carpeta tributaria
            </p>
            <ul className="space-y-1.5">
              {LOADING_STEPS.map((step, i) => (
                <li key={step} className={`flex items-center gap-2 text-sm ${i < loadingStep ? 'text-blue-900' : i === loadingStep ? 'text-blue-900 font-semibold' : 'text-blue-900/40'}`}>
                  {i < loadingStep ? <Check className="w-4 h-4 text-emerald-600" /> : <span className={`w-4 h-4 rounded-full border-2 ${i === loadingStep ? 'border-blue-600 border-t-transparent animate-spin' : 'border-blue-200'}`} />}
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Diagnóstico completo (Carpeta Tributaria Electrónica reconocida) */}
        {diagnosis && (
          <TaxDiagnosisView
            diagnosis={diagnosis}
            isSample={isSample}
            correctionForm={isSample ? undefined : correctionFields}
            onPrimaryAction={isSample ? resetToUpload : handleConfirmSave}
            primaryLabel={isSample ? 'Subir mi carpeta' : applied ? 'Datos guardados en tu perfil' : 'Guardar estos datos en mi perfil'}
            primaryDisabled={!isSample && applied}
          />
        )}

        {/* Confirmation Screen with Editable Fields (Requirement 4) */}
        {parsedData && !loading && !diagnosis && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">
                  Confirmación de Datos Extraídos
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 font-semibold">
                Revisa y edita si es necesario
              </span>
            </div>

            <p className="text-[11px] text-slate-600">
              Verifica los datos obtenidos de la Carpeta Tributaria. Nada se guardará en tu perfil hasta que presiones <strong>"Confirmar datos"</strong>.
            </p>

            {correctionFields}

            {parsedData.siiStatusObservations && (
              <p className="text-[11px] text-slate-600 italic bg-white p-2.5 rounded-lg border border-slate-200">
                💡 {parsedData.siiStatusObservations}
              </p>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  setParsedData(null);
                  setSelectedFile(null);
                  setInputText('');
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 font-medium text-xs transition-all cursor-pointer text-center"
              >
                Volver a cargar
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={applied}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-98 disabled:opacity-75"
              >
                {applied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>¡Datos Confirmados y Guardados en tu Perfil!</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirmar datos y guardar en perfil</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className={`pt-1 text-center ${diagnosis ? 'hidden' : ''}`}>
          <p className="text-[10px] text-slate-400">
            El archivo no se guarda: se procesa en el momento y solo guardamos los datos que confirmes.
          </p>
        </div>
      </div>
    </div>
  );
};
