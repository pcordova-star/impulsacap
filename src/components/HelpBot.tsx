import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, ArrowRight, RefreshCw, AlertCircle, UserRound, CheckCircle2, ArrowLeft } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';
import { CompanyUser } from '../types/funds';
import { showToast } from '../utils/toast';

interface HelpBotProps {
  currentUser: CompanyUser | null;
  onNavigateTab: (tab: string) => void;
  onOpenAuthModal: (mode?: 'login' | 'register') => void;
  /** Sección actual de la app, para dar contexto a la solicitud de soporte */
  currentSection?: string;
}

interface BotMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  isExpertRedirect?: boolean;
  needsHuman?: boolean;
}

const SUPPORT_EMAIL = 'contacto@impulsacap.cl';

/** Respuestas inmediatas a las dudas más comunes (alineadas con server/supportKnowledge.ts). */
const QUICK_ANSWERS: Record<string, string> = {
  '¿Cómo funciona ImpulsaCap?':
    'Te acompañamos en 3 etapas:\n1. Encuentra tu fondo: diagnóstico de 5 preguntas y monitor de convocatorias (gratis).\n2. Revisa si cumples: sube tu carpeta tributaria y ve a qué fondos calificas (gratis).\n3. Prepara tu postulación con el Plan Semestral: redacción con IA, cartas, auditoría simulada y expediente PDF.\nLa postulación final la envías tú en el portal del fondo.',
  '¿Qué incluye el plan y cuánto cuesta?':
    'El Plan Semestral cuesta $39.990 (IVA incluido) y tu primera compra tiene 50% de descuento: $19.990. Es un pago único por 6 meses, sin renovación automática. Es para 1 empresa con hasta 3 postulaciones activas a la vez, e incluye redacción con IA, cartas y documentos, auditoría simulada, expediente PDF y asesor experto.',
  '¿Cómo obtengo mi carpeta tributaria?':
    '1. Entra a sii.cl con tu RUT y clave.\n2. Ve a Servicios online > Situación tributaria > Carpeta tributaria electrónica.\n3. Elige "Acreditar tamaño de empresa", la regular o una personalizada con F29 y F22, y descárgala en PDF.\n4. Súbela en ImpulsaCap desde tu postulación (paso 1) o desde "Mi empresa".',
  'Pagué y no veo mi plan activo':
    'Normalmente se activa en segundos. Recarga la página y revisa "Mi empresa" > "Mi Plan y Suscripción". Si después de unos minutos sigue sin activarse, toca "Hablar con una persona" y déjanos el número de operación de Mercado Pago para revisarlo.'
};

const now = () => new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

export const HelpBot: React.FC<HelpBotProps> = ({ currentUser, onNavigateTab, onOpenAuthModal, currentSection }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'ticket'>('chat');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [messages, setMessages] = useState<BotMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: '¡Hola! Soy el asistente de ImpulsaCap. Te ayudo con tu cuenta, el plan, los pagos, la carpeta tributaria o cualquier duda sobre cómo usar la plataforma.',
      timestamp: now()
    }
  ]);

  // Formulario de solicitud a una persona
  const [ticketEmail, setTicketEmail] = useState(currentUser?.email || '');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSending, setTicketSending] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser?.email && !ticketEmail) setTicketEmail(currentUser.email);
  }, [currentUser?.email]);

  useEffect(() => {
    if (isOpen && view === 'chat') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, loading, view]);

  const historyForApi = () =>
    messages
      .filter(m => m.id !== 'welcome')
      .slice(-8)
      .map(m => ({ role: m.sender === 'user' ? 'user' : 'bot', text: m.text }));

  const handleQuick = (question: string) => {
    setErrorMsg(null);
    setMessages(prev => [
      ...prev,
      { id: `user_${Date.now()}`, sender: 'user', text: question, timestamp: now() },
      { id: `bot_${Date.now() + 1}`, sender: 'bot', text: QUICK_ANSWERS[question], timestamp: now() }
    ]);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    if (trimmed.length > 500) {
      setErrorMsg('El mensaje no puede superar los 500 caracteres.');
      return;
    }
    setErrorMsg(null);
    const history = historyForApi();
    setMessages(prev => [...prev, { id: `user_${Date.now()}`, sender: 'user', text: trimmed, timestamp: now() }]);
    setInput('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/ayuda/chat', {
        method: 'POST',
        requireAuth: false,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages(prev => [...prev, {
          id: `bot_${Date.now()}`,
          sender: 'bot',
          text: data.error || 'No pude responder en este momento.',
          timestamp: now(),
          needsHuman: true
        }]);
        return;
      }
      setMessages(prev => [...prev, {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: data.reply || 'No tengo esa información. Si quieres, te comunico con una persona.',
        timestamp: now(),
        isExpertRedirect: Boolean(data.isExpertRedirect),
        needsHuman: Boolean(data.needsHuman)
      }]);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const openTicket = () => {
    const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user')?.text || '';
    if (!ticketMessage) setTicketMessage(lastUserMsg);
    setTicketError(null);
    setView('ticket');
  };

  const sendTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ticketEmail.trim())) {
      setTicketError('Ingresa un correo válido para poder responderte.');
      return;
    }
    if (ticketMessage.trim().length < 5) {
      setTicketError('Cuéntanos un poco más sobre tu consulta.');
      return;
    }
    setTicketSending(true);
    try {
      const res = await apiFetch('/api/soporte/ticket', {
        method: 'POST',
        requireAuth: false,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ticketEmail.trim(),
          name: currentUser?.representativeName || '',
          message: ticketMessage.trim(),
          page: currentSection || '',
          conversation: historyForApi()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ticketId) throw new Error(data.error || `No pudimos enviar tu solicitud. Escríbenos a ${SUPPORT_EMAIL}.`);
      setMessages(prev => [...prev, {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: `Listo, recibimos tu solicitud #${data.ticketId}. Te responderemos a ${ticketEmail.trim()} lo antes posible; también te enviamos una confirmación a ese correo.`,
        timestamp: now()
      }]);
      setTicketMessage('');
      setView('chat');
      showToast({ id: `ticket-${data.ticketId}`, level: 'success', title: `Solicitud #${data.ticketId} enviada`, message: 'Te responderemos por correo.' });
    } catch (err: any) {
      setTicketError(err?.message || `No pudimos enviar tu solicitud. Escríbenos a ${SUPPORT_EMAIL}.`);
    } finally {
      setTicketSending(false);
    }
  };

  const humanButton = (
    <button
      type="button"
      onClick={openTicket}
      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer"
    >
      <UserRound className="w-3.5 h-3.5" />
      Hablar con una persona
    </button>
  );

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Ayuda"
          aria-label="Abrir ayuda"
          className="fixed bottom-20 md:bottom-6 right-3.5 sm:right-6 z-40 flex items-center justify-center gap-2 p-3 sm:px-3.5 sm:py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xl shadow-slate-900/30 active:scale-95 transition-all cursor-pointer border border-slate-700/80 group"
        >
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <span className="hidden sm:inline tracking-tight text-xs font-semibold">Ayuda</span>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end p-3 sm:p-6 bg-slate-950/20 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          <div
            role="dialog"
            aria-label="Ayuda de ImpulsaCap"
            className="w-full sm:w-[400px] max-h-[80vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {view === 'ticket' ? (
                  <button type="button" onClick={() => setView('chat')} aria-label="Volver al chat" className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 cursor-pointer">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold leading-tight">{view === 'ticket' ? 'Hablar con una persona' : 'Ayuda'}</h3>
                  <p className="text-[11px] text-slate-400">{view === 'ticket' ? 'Te respondemos por correo' : 'Responde al instante, a cualquier hora'}</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} aria-label="Cerrar ayuda" className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {view === 'chat' ? (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  {messages.map(m => {
                    const isBot = m.sender === 'bot';
                    return (
                      <div key={m.id} className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}>
                        <div className={`max-w-[88%] rounded-2xl p-3 leading-relaxed ${isBot ? 'bg-white border border-slate-200 text-slate-800' : 'bg-blue-600 text-white'}`}>
                          <p className="whitespace-pre-line text-[13px]">{m.text}</p>
                          {m.isExpertRedirect && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100">
                              <button
                                onClick={() => { setIsOpen(false); if (currentUser) onNavigateTab('my-applications'); else onOpenAuthModal('login'); }}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                              >
                                {currentUser ? 'Ir a Mis postulaciones' : 'Iniciar sesión o registrarme'}
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          {m.needsHuman && <div className="mt-2.5 pt-2 border-t border-slate-100">{humanButton}</div>}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 px-1">{m.timestamp}</span>
                      </div>
                    );
                  })}

                  {loading && (
                    <div className="flex items-center gap-2 text-slate-500 text-xs p-2 bg-white rounded-xl border border-slate-200 w-fit">
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                      Escribiendo…
                    </div>
                  )}
                  {errorMsg && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {messages.length <= 3 && (
                    <div className="pt-1 space-y-1.5">
                      <p className="text-[11px] text-slate-500">Preguntas frecuentes</p>
                      {Object.keys(QUICK_ANSWERS).map(q => (
                        <button
                          key={q}
                          onClick={() => handleQuick(q)}
                          className="block w-full text-left px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-xs text-slate-700 font-medium cursor-pointer"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-3 bg-white border-t border-slate-200 space-y-2">
                  <form onSubmit={handleSend} className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={500}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Escribe tu pregunta…"
                      aria-label="Tu pregunta"
                      className="flex-1 px-3 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-hidden focus:bg-white focus:border-blue-500 placeholder:text-slate-400"
                    />
                    <button type="submit" disabled={!input.trim() || loading} aria-label="Enviar" className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white cursor-pointer shrink-0">
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                  <button type="button" onClick={openTicket} className="w-full text-center text-xs text-slate-500 hover:text-slate-800 cursor-pointer">
                    ¿Prefieres hablar con una persona? <span className="font-semibold underline underline-offset-2">Déjanos tu consulta</span>
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={sendTicket} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  Cuéntanos qué necesitas y te responderemos por correo. Si es sobre un pago, incluye el número de operación de Mercado Pago.
                </p>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700">Tu correo</span>
                  <input
                    type="email"
                    required
                    value={ticketEmail}
                    onChange={(e) => setTicketEmail(e.target.value)}
                    placeholder="nombre@empresa.cl"
                    className="w-full px-3 py-2.5 text-sm rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700">Tu consulta</span>
                  <textarea
                    required
                    rows={5}
                    maxLength={2000}
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    placeholder="Por ejemplo: pagué el plan y no aparece activo. Número de operación: 123456789."
                    className="w-full px-3 py-2.5 text-sm rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-blue-500 leading-relaxed"
                  />
                </label>
                <p className="text-[11px] text-slate-500">Adjuntaremos esta conversación con el asistente para no pedirte lo mismo dos veces.</p>
                {ticketError && (
                  <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5" role="alert">{ticketError}</p>
                )}
                <button
                  type="submit"
                  disabled={ticketSending}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold cursor-pointer disabled:opacity-60"
                >
                  {ticketSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {ticketSending ? 'Enviando…' : 'Enviar consulta'}
                </button>
                <p className="text-[11px] text-slate-500 text-center">También puedes escribir a {SUPPORT_EMAIL}</p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
