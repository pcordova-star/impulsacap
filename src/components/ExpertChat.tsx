import React, { useState, useRef, useEffect } from 'react';
import { CompanyProfile, ChileanFund } from '../types/funds';
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
  AlertCircle
} from 'lucide-react';
import { ImpulsaCapLogo } from './ImpulsaCapLogo';

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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      content: `¡Hola! Soy **ImpulsaCap AI** , tu asesor especialista en fondos concursables en Chile (CORFO, SERCOTEC, ANID, Start-Up Chile y FIA).
      
Estoy analizando tu empresa: **${profile.companyName || 'Tu Empresa'}** (${profile.companyType.toUpperCase()}, ${profile.region}).
¿Qué duda tienes sobre bases administrativas, admisibilidad legal, rendición de cuentas o estrategia para ganar?`,
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
    if (!userText.trim() || loading) return;

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
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          companyProfile: profile,
          currentFund: currentFund || null
        })
      });

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
    <div className="h-[calc(100dvh-14rem)] sm:h-[calc(100vh-12rem)] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ImpulsaCapLogo size={36} />
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              ImpulsaCap AI • Consultor Experto en Subsidios
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </h3>
            <p className="text-xs text-slate-400">
              Especializado en CORFO, SERCOTEC, ANID, Ley de I+D y Rendición de Cuentas
            </p>
          </div>
        </div>

        {currentFund && (
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-cyan-300 border border-blue-500/20 hidden sm:inline-block">
            Foco: {currentFund.name}
          </span>
        )}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((m, idx) => {
          const isAI = m.role === 'model';
          return (
            <div
              key={idx}
              className={`flex items-start gap-3 ${isAI ? 'justify-start' : 'justify-end'}`}
            >
              {isAI && (
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 text-cyan-300 mt-1">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                  isAI
                    ? 'bg-slate-950 border border-slate-800 text-slate-200'
                    : 'bg-blue-600 text-white font-medium shadow-md shadow-blue-600/20'
                }`}
              >
                {m.content}
                <span
                  className={`block text-[10px] mt-2 text-right ${
                    isAI ? 'text-slate-500' : 'text-blue-200'
                  }`}
                >
                  {m.timestamp}
                </span>
              </div>

              {!isAI && (
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3 text-xs text-slate-400 p-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Consultando bases administrativas y normativas de Chile...</span>
          </div>
        )}
        {chatError && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center justify-between gap-3 text-xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{chatError}</span>
              </div>
              {failedText && (
                <button
                  onClick={() => {
                    const txt = failedText;
                    setChatError(null);
                    setFailedText(null);
                    handleSend(txt);
                  }}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reintentar</span>
                </button>
              )}
            </div>
          )}
          {chatError && (
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center justify-between gap-3 text-xs animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reintentar</span>
                  </button>
                )}
              </div>
            )}
            <div ref={scrollRef} />
      </div>

      {/* Frequently Asked Question Pills */}
      <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 text-xs">
          <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
            Preguntas habituales:
          </span>
          {FREQUENT_QUESTIONS.map((q, qIdx) => (
            <button
              key={qIdx}
              onClick={() => handleSend(q)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 hover:text-white whitespace-nowrap transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregúntale al especialista sobre bases, F29, garantías, sueldos o rendición..."
            className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs sm:text-sm focus:border-cyan-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            <span>Enviar</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
