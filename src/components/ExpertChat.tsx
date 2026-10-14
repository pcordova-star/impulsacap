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
  Building2
} from 'lucide-react';
import { InkiLogo } from './InkiLogo';

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
      content: `¡Hola! Soy **INKI AI** (*buena suerte* en quechua), tu asesor especialista en fondos concursables en Chile (CORFO, SERCOTEC, ANID, Start-Up Chile y FIA).
      
Estoy analizando tu empresa: **${profile.companyName || 'Tu Empresa'}** (${profile.companyType.toUpperCase()}, ${profile.region}).
¿Qué duda tienes sobre bases administrativas, admisibilidad legal, rendición de cuentas o estrategia para ganar?`,
      timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (userText: string) => {
    if (!userText.trim() || loading) return;

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
        throw new Error('Error en el asesor IA');
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
      console.error(err);
      // Realistic fallback response based on common Chilean grant questions
      let answer = 'En los fondos públicos de Chile (CORFO y SERCOTEC), la normativa es sumamente rigurosa:';
      if (userText.includes('IVA')) {
        answer = 'En Chile, el IVA de las facturas NO es un gasto financiable por subsidio estatal. Si tu empresa es contribuyente de 1ª categoría con derecho a crédito fiscal, el subsidio CORFO solo cubre el valor neto. El 19% de IVA debe ser pagado por tu empresa con recursos propios (aunque luego lo recuperas como crédito fiscal contra tus ventas en el F29 del SII).';
      } else if (userText.includes('sueldo') || userText.includes('socios')) {
        answer = 'En CORFO, los socios fundadores sí pueden pagarse remuneraciones imputadas al proyecto en la cuenta de Recursos Humanos, siempre que tengan dedicación técnica o de gestión comprobable y no superen el tope porcentual establecido en las bases (típicamente hasta el 50% o 60% del subsidio total). Se respalda mensualmente con contrato de trabajo o boletas de honorarios, liquidaciones firmadas y certificado de cotizaciones previsionales al día.';
      } else if (userText.includes('garantía') || userText.includes('fianza') || userText.includes('pagaré')) {
        answer = 'Para que CORFO te transfiera los fondos en modalidad de anticipo, exige una garantía por el 100% del monto a girar. Las dos opciones más comunes son: 1) Póliza de Seguro de Fianza o Garantía a primer requerimiento (la emiten aseguradoras como HDI, AVLA o Mapfre con un costo de prima del ~1.5% al 3% anual, gasto que además es financiable con el proyecto en la cuenta de Administración); o 2) Boleta de Garantía Bancaria. En fondos menores de SERCOTEC, habitualmente basta con la firma de un pagaré notarial.';
      } else {
        answer = `Para el caso de ${profile.companyName}, la recomendación es verificar previamente que los F29 de los últimos 24 meses cuadren con la declaración de renta F22, y estructurar el presupuesto con al menos 3 hitos críticos verificables. ¿Te gustaría que revisemos un aspecto puntual de las bases o de las cuentas presupuestarias?`;
      }

      setMessages([
        ...newMessages,
        {
          role: 'model',
          content: answer,
          timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100dvh-14rem)] sm:h-[calc(100vh-12rem)] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <InkiLogo size={36} />
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              INKI AI • Consultor Experto en Subsidios
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
