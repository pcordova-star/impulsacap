import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  HelpCircle, 
  ArrowRight, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';
import { CompanyUser } from '../types/funds';

interface HelpBotProps {
  currentUser: CompanyUser | null;
  onNavigateTab: (tab: string) => void;
  onOpenAuthModal: (mode?: 'login' | 'register') => void;
}

interface BotMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  isExpertRedirect?: boolean;
}

const STATIC_FAQS: Record<string, string> = {
  '¿Cómo funciona ImpulsaCap?':
    'ImpulsaCap te guía paso a paso para preparar postulaciones ganadoras a fondos del Estado (CORFO, SERCOTEC, etc.). Subes tu Carpeta Tributaria del SII para validar requisitos, formulas tu proyecto con Inteligencia Artificial, estructuras el presupuesto por cuentas aprobadas, simulas la evaluación de un comité con el Auditor Ciego y descargas tu expediente listo para copiar a e-CORFO.',
  '¿Qué incluye el Plan Semestral y cuánto cuesta?':
    'El Plan Semestral tiene un precio normal de $39.990 CLP, con 50% de descuento en tu primera compra quedando en $19.990 CLP. Incluye 6 meses de acceso completo para hasta 3 postulaciones simultáneas: formulador técnico con IA, simulación de auditoría ciega, generador de cartas de interés (LOI), expediente consolidado en PDF y asesor experto por postulación.',
  '¿Cómo pago y qué pasa después?':
    'El pago se realiza mediante Mercado Pago (tarjetas de crédito, débito o Webpay). Es un pago único: no tiene renovación automática ni cobros recurrentes. Una vez procesado el pago, tu cuenta se activa inmediatamente y desbloquea todas las herramientas premium en tu bóveda empresarial.',
  '¿Qué hacen con mis datos?':
    'Tu privacidad está protegida. La Carpeta Tributaria y los antecedentes de tu empresa se procesan bajo cifrado con el único fin de calcular la admisibilidad y redactar tu propuesta. No compartimos tus datos con terceros ni los utilizamos para entrenar modelos públicos.'
};

export const HelpBot: React.FC<HelpBotProps> = ({
  currentUser,
  onNavigateTab,
  onOpenAuthModal
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [messages, setMessages] = useState<BotMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: '¡Hola! Soy el Robot de Ayuda de ImpulsaCap 🤖. Puedo orientarte sobre el funcionamiento del sistema, la Hoja de Ruta, planes y cómo subir tus documentos.',
      timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const handleSelectFaq = (question: string) => {
    const answer = STATIC_FAQS[question];
    if (!answer) return;

    setErrorMsg(null);
    const now = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    
    setMessages(prev => [
      ...prev,
      {
        id: `user_${Date.now()}`,
        sender: 'user',
        text: question,
        timestamp: now
      },
      {
        id: `bot_${Date.now() + 1}`,
        sender: 'bot',
        text: answer,
        timestamp: now
      }
    ]);
  };

  const handleSendFreeText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    if (trimmed.length > 500) {
      setErrorMsg('El mensaje no puede superar los 500 caracteres.');
      return;
    }

    setErrorMsg(null);
    const now = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    
    const userMsg: BotMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: now
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/ayuda/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo obtener respuesta del servicio de ayuda.');
      }

      const botReply: BotMessage = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: data.reply || 'No tengo información sobre eso en este momento. Te sugiero escribir a soporte.',
        timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        isExpertRedirect: Boolean(data.isExpertRedirect)
      };

      setMessages(prev => [...prev, botReply]);
    } catch (err: any) {
      console.warn('HelpBot error:', err);
      setErrorMsg(err?.message || 'Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón flotante: en móvil solo un círculo con el ícono del robot (sin texto), en escritorio con texto */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Ayuda sobre la plataforma"
          aria-label="Ayuda sobre la plataforma"
          className="fixed bottom-20 md:bottom-6 right-3.5 sm:right-6 z-40 flex items-center justify-center gap-2 p-3 sm:px-3.5 sm:py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xl shadow-slate-900/30 active:scale-95 transition-all cursor-pointer border border-slate-700/80 group"
        >
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <span className="hidden sm:inline tracking-tight text-xs font-semibold">Ayuda</span>
        </button>
      )}

      {/* Modal / Panel Compacto de Ayuda */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-end justify-end p-4 sm:p-6 bg-slate-950/20 backdrop-blur-2xs animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div 
            className="w-[calc(100vw-32px)] sm:w-[380px] max-h-[70vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-zoom-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold leading-tight flex items-center gap-1.5">
                    <span>Robot de Ayuda</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Soporte y guía de ImpulsaCap
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Cerrar ayuda"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Area de Mensajes con Scroll Interno */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50 text-xs">
              {messages.map((m) => {
                const isBot = m.sender === 'bot';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl p-3 leading-relaxed ${
                        isBot
                          ? 'bg-white border border-slate-200 text-slate-800 shadow-2xs'
                          : 'bg-blue-600 text-white font-medium'
                      }`}
                    >
                      <p className="whitespace-pre-line text-xs">{m.text}</p>

                      {/* Botón de redirección si es una consulta sobre fondos/postulaciones */}
                      {m.isExpertRedirect && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100">
                          {currentUser ? (
                            <button
                              onClick={() => {
                                setIsOpen(false);
                                onNavigateTab('my-applications');
                              }}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                            >
                              <span>Ir a Mis postulaciones</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setIsOpen(false);
                                onOpenAuthModal('login');
                              }}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                            >
                              <span>Iniciar sesión / Registrarse</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 px-1">
                      {m.timestamp}
                    </span>
                  </div>
                );
              })}

              {loading && (
                <div className="flex items-center gap-2 text-slate-500 text-[11px] p-2 bg-white rounded-xl border border-slate-200/80 w-fit">
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                  <span>Consultando información...</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 4 Preguntas Frecuentes Rápidas */}
              <div className="pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Preguntas frecuentes:
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {Object.keys(STATIC_FAQS).map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectFaq(q)}
                      className="text-left px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-[11px] text-slate-700 font-medium transition-all cursor-pointer shadow-2xs"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensaje final de contacto a soporte */}
              <div className="pt-3 border-t border-slate-200/80 text-center">
                <p className="text-[10px] text-slate-500">
                  ¿Necesitas ayuda de una persona? Escríbenos a <strong>[CORREO_SOPORTE]</strong>
                </p>
              </div>

              <div ref={messagesEndRef} />
            </div>

            {/* Input para preguntas libres - Siempre visible */}
            <div className="p-3 bg-white border-t border-slate-200">
              <form onSubmit={handleSendFreeText} className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={500}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escribe tu consulta sobre la plataforma..."
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-hidden focus:bg-white focus:border-blue-500 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-all cursor-pointer shrink-0"
                  title="Enviar consulta"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
              <div className="flex justify-between items-center px-1 mt-1 text-[9px] text-slate-400">
                <span>Solo consultas sobre la plataforma</span>
                <span>{input.length}/500</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
