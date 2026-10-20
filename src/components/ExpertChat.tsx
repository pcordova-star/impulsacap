import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CompanyProfile, ChileanFund } from '../types/funds';
import { apiFetch } from '../utils/apiFetch';
import { usePlan } from '../hooks/usePlan';
import { PlanPaywallCard } from './PlanPaywallCard';
import { 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  HelpCircle, 
  RefreshCw,
  Lightbulb,
  Building2,
  RotateCcw,
  AlertCircle,
  Lock,
  Award
} from 'lucide-react';

interface ExpertChatProps {
  profile: CompanyProfile;
  currentFund?: ChileanFund | null;
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

const FREQUENT_QUESTIONS = [
  '¿Cómo justificar el sueldo de los socios en la cuenta de Recursos Humanos?',
  '¿Qué pasa con el IVA de las compras en CORFO y SERCOTEC?',
  '¿Cómo se garantiza el subsidio? ¿Piden pagaré o póliza de fianza?',
  '¿Cómo opera el beneficio tributario del 35% de la Ley de I+D (Ley 20.241)?',
  '¿Qué requisitos debe cumplir una empresa para el +10% de Bono Mujer?',
  '¿Cómo se rinde una factura electrónica ante el sistema de rendición de Corfo?'
];

export const ExpertChat: React.FC<ExpertChatProps> = ({ profile, currentFund }) => {
  const { hasActivePlan, loading: planLoading } = usePlan();

  // Welcome message omitting empty fields or "Tu Empresa" (Requirement 3)
  const initialWelcomeMessage = useMemo(() => {
    let companyPart = '';
    const rawName = profile?.companyName?.trim() || '';
    const isGenericName = !rawName || 
      rawName.toLowerCase() === 'tu empresa' || 
      rawName.toLowerCase() === 'mi empresa' ||
      rawName.toLowerCase() === 'empresa sin registrar';
    const name = isGenericName ? '' : rawName;

    const details: string[] = [];
    if (profile?.companyType && profile.companyType !== 'sin_iniciar') {
      details.push(profile.companyType.toUpperCase());
    }
    const reg = profile?.region?.trim() || '';
    if (reg && !reg.toLowerCase().includes('no especificada') && !reg.toLowerCase().includes('selecciona')) {
      details.push(reg);
    }

    if (name) {
      const detailsSuffix = details.length > 0 ? ` (${details.join(', ')})` : '';
      companyPart = `\nEstoy analizando tu empresa: **${name}**${detailsSuffix}.`;
    }

    let fundPart = '';
    if (currentFund?.name) {
      fundPart = `\nFondo activo de postulación: **${currentFund.name}** (${currentFund.agency}).`;
    }

    return `¡Hola! Soy **ImpulsaCap AI**, tu asesor especialista en fondos concursables en Chile (CORFO, SERCOTEC, ANID, Start-Up Chile y FIA).${companyPart}${fundPart}\n\n¿Qué duda tienes sobre bases administrativas, admisibilidad legal, rendición de cuentas o estrategia para ganar?`;
  }, [profile, currentFund]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      role: 'model',
      content: initialWelcomeMessage,
      timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (userText: string) => {
    if (!userText.trim() || loading || !hasActivePlan) return;

    setChatError(null);
    setFailedText(null);

    const newMessages: ChatMessage[] = [
      ...messages,
      {
        role: 'user',
        content: userText,
        timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
      }
    ];

    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await apiFetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          companyProfile: profile,
          currentFund: currentFund || null
        })
      });

      if (response.status === 402) {
        setChatError('Tu plan no cuenta con acceso activo al Asesor Experto.');
        setLoading(false);
        return;
      }

      if (response.status === 429) {
        const errJson = await response.json().catch(() => ({}));
        setChatError(errJson.error || 'Has alcanzado el límite de consultas por minuto. Espera un momento.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.');
      }

      const data = await response.json();
      setMessages([
        ...newMessages,
        {
          role: 'model',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setChatError(err?.message || 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.');
      setFailedText(userText);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[560px] sm:h-[620px] max-h-[calc(100dvh-200px)] min-h-[400px] rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs">
      {/* Header Bar - Light Professional Institutional Style */}
      <div className="p-4 sm:p-5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Asesor Experto en Fondos
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>En Línea</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Consultor especializado en bases administrativas de CORFO, SERCOTEC y ANID
            </p>
          </div>
        </div>

        {currentFund && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <Award className="w-3.5 h-3.5 text-blue-600" />
            <span className="truncate max-w-[200px]">{currentFund.name}</span>
          </span>
        )}
      </div>

      {/* Messages Stream with Internal Scroll */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50">
        {messages.map((m, idx) => {
          const isAI = m.role === 'model';
          return (
            <div
              key={idx}
              className={`flex items-start gap-3 ${isAI ? 'justify-start' : 'justify-end'}`}
            >
              {isAI && (
                <div className="w-8 h-8 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 text-blue-600 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                  isAI
                    ? 'bg-white border border-slate-200 text-slate-800 shadow-2xs'
                    : 'bg-blue-600 text-white font-medium shadow-xs'
                }`}
              >
                {m.content}
                <span
                  className={`block text-[10px] mt-2 text-right ${
                    isAI ? 'text-slate-400' : 'text-blue-200'
                  }`}
                >
                  {m.timestamp}
                </span>
              </div>

              {!isAI && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-white mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3 text-xs text-slate-500 p-3 bg-white rounded-2xl border border-slate-200 w-fit">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span>Consultando bases administrativas y normativas oficiales...</span>
          </div>
        )}

        {chatError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{chatError}</span>
            </div>
            {failedText && (
              <button
                type="button"
                onClick={() => {
                  const txt = failedText;
                  setChatError(null);
                  setFailedText(null);
                  handleSend(txt);
                }}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reintentar</span>
              </button>
            )}
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Bottom Area: Plan Verifying / Paywall Card / Input Box (Requirement 3) */}
      {planLoading ? (
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
          <span>Verificando tu plan…</span>
        </div>
      ) : !hasActivePlan ? (
        /* PlanPaywallCard rendered IN PLACE of the input box before user types */
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200">
          <PlanPaywallCard 
            compact 
            highlightText="El Asesor Experto está disponible exclusivamente para usuarios con el Plan Semestral activo."
          />
        </div>
      ) : (
        /* Authenticated Active Plan: Quick Questions + Input Form */
        <div className="bg-white border-t border-slate-200">
          {/* Frequently Asked Question Pills */}
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200/80 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 text-xs">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                Preguntas frecuentes:
              </span>
              {FREQUENT_QUESTIONS.map((q, qIdx) => (
                <button
                  key={qIdx}
                  onClick={() => handleSend(q)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-[11px] text-slate-600 hover:text-slate-900 whitespace-nowrap transition-all cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input Box */}
          <div className="p-3 sm:p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              className="flex items-center gap-2 sm:gap-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregúntale al especialista sobre bases, F29, garantías, sueldos o rendición..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm focus:border-blue-500 focus:bg-white focus:outline-hidden placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-all disabled:opacity-40 cursor-pointer flex items-center gap-2 shrink-0"
              >
                <span>Enviar</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
