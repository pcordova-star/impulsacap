import React, { useState } from 'react';
import { ChileanFund } from '../types/funds';
import { 
  ShieldCheck, 
  Coins, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  ArrowRight,
  Calculator,
  Building2,
  FileText
} from 'lucide-react';

interface GuaranteesCalculatorProps {
  fund: ChileanFund;
}

export const GuaranteesCalculator: React.FC<GuaranteesCalculatorProps> = ({ fund }) => {
  const [advancePct, setAdvancePct] = useState<number>(80); // Corfo standard is 80% or 100%
  const [guaranteeType, setGuaranteeType] = useState<'poliza' | 'boleta'>('poliza');
  const [insuranceRate, setInsuranceRate] = useState<number>(2.0); // 1.5% to 2.5% typical in Chile

  const subsidyCLP = fund.maxSubsidyCLP;
  const advanceAmountCLP = Math.round(subsidyCLP * (advancePct / 100));
  
  // Cost calculations
  const polizaCostCLP = Math.round(advanceAmountCLP * (insuranceRate / 100));
  const boletaFrozenCapitalCLP = advanceAmountCLP; // 100% frozen in bank account

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Simulador de Garantías y Anticipo de Fondos</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                100% Operativo
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Cómo cobrar el subsidio sin congelar tu capital de trabajo ante {fund.agency}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 block font-semibold">Subsidio Adjudicado</span>
          <span className="text-lg font-black text-cyan-400 font-mono">{fund.subsidyFormatted}</span>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Advance Percentage Slider */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">Porcentaje de Anticipo Solicitado</span>
            <span className="font-bold text-cyan-400 font-mono">{advancePct}% del subsidio</span>
          </div>
          <input
            type="range"
            min="50"
            max="100"
            step="10"
            value={advancePct}
            onChange={(e) => setAdvancePct(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>50% (Mínimo)</span>
            <span>80% (Estándar Corfo)</span>
            <span>100% (Total)</span>
          </div>
        </div>

        {/* Guarantee Type Selector */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <span className="block text-xs font-semibold text-slate-300">Instrumento de Garantía</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setGuaranteeType('poliza')}
              className={`p-2 rounded-xl text-xs font-bold transition-all ${
                guaranteeType === 'poliza'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              ✓ Póliza de Fianza (Recomendado)
            </button>
            <button
              onClick={() => setGuaranteeType('boleta')}
              className={`p-2 rounded-xl text-xs font-bold transition-all ${
                guaranteeType === 'boleta'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Boleta Bancaria
            </button>
          </div>
        </div>
      </div>

      {/* Comparison Results Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Póliza de Seguro de Fianza (Smart Way) */}
        <div className={`p-4 rounded-2xl border transition-all ${
          guaranteeType === 'poliza'
            ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/30'
            : 'bg-slate-950/60 border-slate-800 opacity-70'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Opción Inteligente: Póliza de Fianza</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              No inmoviliza caja
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Anticipo recibido en cuenta:</span>
              <strong className="text-white font-mono">${advanceAmountCLP.toLocaleString('es-CL')} CLP</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Costo de prima (~{insuranceRate}%):</span>
              <strong className="text-emerald-400 font-mono">${polizaCostCLP.toLocaleString('es-CL')} CLP</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Capital congelado en banco:</span>
              <strong className="text-emerald-300 font-mono">$0 CLP</strong>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-400 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
            💡 Las aseguradoras chilenas (Mapfre, Unnio, Magallanes) emiten pólizas electrónicas a la orden de CORFO/SERCOTEC en 48 horas con el RUT de tu empresa.
          </p>
        </div>

        {/* Boleta Bancaria Tradicional (Painful Way) */}
        <div className={`p-4 rounded-2xl border transition-all ${
          guaranteeType === 'boleta'
            ? 'bg-amber-950/20 border-amber-500/40 shadow-lg ring-1 ring-amber-500/30'
            : 'bg-slate-950/60 border-slate-800 opacity-70'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Opción Tradicional: Boleta Bancaria</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Alto costo de caja
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Anticipo recibido en cuenta:</span>
              <strong className="text-white font-mono">${advanceAmountCLP.toLocaleString('es-CL')} CLP</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Comisión bancaria de emisión:</span>
              <strong className="text-slate-300 font-mono">~$180.000 CLP</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Capital congelado en depósito a plazo:</span>
              <strong className="text-amber-400 font-mono font-bold">
                ${boletaFrozenCapitalCLP.toLocaleString('es-CL')} CLP (100%)
              </strong>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-amber-300/80 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
            ⚠️ El banco te obligará a dejar en garantía el 100% del dinero en un depósito a plazo fijo hasta que CORFO apruebe el finiquito de cuentas (12 a 18 meses).
          </p>
        </div>
      </div>

      {/* Official Rendition Guide */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          <span>Pasos de Rendición Mensual ante {fund.agency}</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-bold text-cyan-400 block mb-1">1. Registro de Compras (SII)</span>
            <p className="text-[11px] text-slate-300">
              Descarga tus facturas y boletas del sistema electrónico del SII. Solo se rinde el monto neto (sin IVA).
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-bold text-cyan-400 block mb-1">2. Comprobantes de Pago</span>
            <p className="text-[11px] text-slate-300">
              Comprobantes de transferencia electrónica desde la cuenta bancaria de la empresa al proveedor.
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-bold text-cyan-400 block mb-1">3. Plataforma de Rendición</span>
            <p className="text-[11px] text-slate-300">
              Carga digital de antecedentes en el sistema oficial de rendición de cuentas de {fund.agency}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
