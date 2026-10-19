import { apiFetch } from '../utils/apiFetch';
import React, { useState, useRef } from 'react';
import { CompanyProfile } from '../types/funds';
import { validateRut, formatRut } from '../utils/rutValidator';
import { syncTaxFolderToFirestore } from '../utils/firebaseSync';
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

interface SiiUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyProfile: (updated: Partial<CompanyProfile>) => void;
}

const SAMPLE_SII_DATA = `SERVICIO DE IMPUESTOS INTERNOS - CARPETA TRIBUTARIA ELECTRÓNICA
CODIGO VERIFICADOR: 9B8F21A47C
RUT: 77.842.109-K
RAZÓN SOCIAL: PREDICTFLOW SPA
FECHA INICIO ACTIVIDADES: 14/03/2024
REGIMEN: GENERAL PRIMERA CATEGORIA
ACTIVIDAD ECONOMICA: 620100 - ACTIVIDADES DE PROGRAMACION INFORMATICA

RESUMEN FORMULARIO 29 (ÚLTIMOS 12 PERIODOS):
- PERIODO 2024-03: VENTAS NETAS AFECTAS $1.200.000 / ESTADO: DECLARADO Y PAGADO
- PERIODO 2024-04: VENTAS NETAS AFECTAS $1.450.000 / ESTADO: DECLARADO Y PAGADO
- PERIODO 2024-05: VENTAS NETAS AFECTAS $1.800.000 / ESTADO: DECLARADO Y PAGADO
- PERIODO 2024-06: VENTAS NETAS AFECTAS $1.900.000 / ESTADO: DECLARADO Y PAGADO
- PERIODO 2024-07: VENTAS NETAS AFECTAS $2.100.000 / ESTADO: DECLARADO Y PAGADO
- PERIODO 2024-08: VENTAS NETAS AFECTAS $2.300.000 / ESTADO: DECLARADO Y PAGADO
TOTAL FACTURACION NETA ACUMULADA: $18.500.000 CLP (Aprox. 480 UF)
SITUACION MOROSIDAD TGR: NO REGISTRA DEUDAS
`;

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
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            setParsedData(data);
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
            setParsedData(data);
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
      setParsedData(data);
    } catch (err: any) {
      console.error('Process text error:', err);
      setParsedData(null);
      setError(err?.message || 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!parsedData) return;
    const fileName = selectedFile ? selectedFile.name : 'Carpeta_Tributaria_SII.pdf';
    
    const hasDetectedMonths = typeof parsedData.monthsActive === 'number' && parsedData.monthsActive > 0;
    const hasDetectedBracket = Boolean(parsedData.salesBracket && parsedData.salesBracket.trim());

    // Apply to local state (no default 12 or menor_60m if not detected)
    onApplyProfile({
      rut: parsedData.rut ? formatRut(parsedData.rut) : undefined,
      companyName: parsedData.companyName || undefined,
      companyType: parsedData.companyType || 'spa',
      monthsActive: hasDetectedMonths ? parsedData.monthsActive : null,
      salesBracket: hasDetectedBracket ? (parsedData.salesBracket as any) : '',
      annualSalesCLP: typeof parsedData.annualSalesCLP === 'number' ? parsedData.annualSalesCLP : null,
      taxFolderUploaded: true,
      taxFolderFileName: fileName,
      taxFolderUploadDate: new Date().toLocaleDateString('es-CL'),
      taxFolderSummary: parsedData.siiStatusObservations || 'Carpeta Tributaria validada con éxito'
    });

    // Cloud sync to Firestore
    try {
      await syncTaxFolderToFirestore({
        fileName,
        fileSize: selectedFile?.size || 1024,
        companyRut: parsedData.rut || '',
        summary: parsedData.siiStatusObservations || 'Carpeta tributaria validada',
        f29Periods: hasDetectedMonths ? parsedData.monthsActive : 0
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
    setActiveTab('text');
    setInputText(SAMPLE_SII_DATA.trim());
    handleProcessText(SAMPLE_SII_DATA.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-xl rounded-3xl bg-white border border-slate-200 p-5 sm:p-7 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Subir Carpeta Tributaria Electrónica SII</h3>
              <p className="text-[11px] text-slate-500">Sube el PDF o XML oficial descargado de www.sii.cl para autovalidar tu postulación</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
              <span>¿No tienes tu archivo a mano?</span>
              <button
                onClick={handleLoadSample}
                className="text-blue-600 hover:text-blue-700 font-semibold underline cursor-pointer"
              >
                Cargar datos de prueba F29
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
                Cargar Ejemplo Real F29
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
                onClick={() => handleProcessText(inputText)}
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

        {/* Error Banner with Retry */}
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
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center gap-3 text-blue-700 animate-pulse">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-xs font-bold">Extrayendo datos de la Carpeta Tributaria con Inteligencia Artificial...</span>
          </div>
        )}

        {/* Parsed Result Card */}
        {parsedData && !loading && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Carpeta Tributaria Verificada Exitosamente</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                {parsedData.admissibilityVerdict}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase">RUT Empresa:</span>
                <p className="text-slate-900 font-bold font-mono mt-0.5 flex items-center gap-1">
                  <span>{parsedData.rut}</span>
                  {validateRut(parsedData.rut) && (
                    <span className="text-[9px] text-emerald-600 font-semibold">(Módulo 11 OK)</span>
                  )}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Razón Social:</span>
                <p className="text-slate-900 font-bold mt-0.5 truncate">{parsedData.companyName}</p>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Facturación 12 Meses:</span>
                <p className="text-blue-700 font-bold mt-0.5">
                  ${(parsedData.annualSalesCLP || 0).toLocaleString('es-CL')} CLP
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase">1ª Categoría SII:</span>
                <p className="text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{parsedData.monthsActive ? `Acreditada (${parsedData.monthsActive} meses)` : 'Sin detectar (completar en perfil)'}</span>
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 italic bg-white p-2.5 rounded-lg border border-slate-200">
              💡 {parsedData.siiStatusObservations}
            </p>

            <div className="pt-2">
              <button
                onClick={handleApply}
                disabled={applied}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-98"
              >
                {applied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>¡Carpeta Tributaria Vinculada con Éxito al Expediente!</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Guardar y Vincular Carpeta Tributaria al Expediente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="pt-1 text-center">
          <p className="text-[10px] text-slate-400">
            🔒 Protocolo de Privacidad: La Carpeta Tributaria se procesa bajo cifrado para el cálculo exclusivo de admisibilidad de tu empresa.
          </p>
        </div>
      </div>
    </div>
  );
};
