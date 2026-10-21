import React, { useState } from 'react';
import { Wand2, Plus, Trash2, ChevronDown, ExternalLink, Lightbulb, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Ayudantes guiados del formulador para lo que más castigan los evaluadores:
 * mercado (TAM/SAM/SOM), equipo e innovación. Hacen preguntas simples, calculan y
 * escriben las respuestas del formulario. No inventan cifras: los datos los pone la persona.
 * Su estado se guarda en la misma sección (clave "_helper"), como texto JSON.
 */

type Answers = Record<string, string>;
interface HelperProps {
  answers: Answers;
  onApply: (updates: Answers) => void;
  defaultPrice?: number;
}

const clp = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;
const parseNum = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;
const fmtBig = (n: number) => {
  if (n >= 1e12) return `${(n / 1e12).toLocaleString('es-CL', { maximumFractionDigits: 1 })} billones de pesos`;
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('es-CL', { maximumFractionDigits: 1 })} mil millones de pesos`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 })} millones de pesos`;
  return clp(n);
};

function useHelperState<T>(answers: Answers, initial: T): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => {
    try { return answers._helper ? { ...initial, ...JSON.parse(answers._helper) } : initial; } catch { return initial; }
  });
  return [state, setState];
}

const Shell: React.FC<{ title: string; subtitle: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, subtitle, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-cyan-950/50 to-slate-950 overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full p-4 flex items-start justify-between gap-3 text-left cursor-pointer" aria-expanded={open}>
        <span>
          <span className="flex items-center gap-2 text-sm font-bold text-white"><Lightbulb className="w-4 h-4 text-amber-300" /> {title}</span>
          <span className="block text-xs text-slate-300 mt-0.5">{subtitle}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 mt-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </section>
  );
};

const Field: React.FC<{ n?: number; label: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ n, label, hint, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-slate-100 block">{n ? <span className="text-cyan-300 mr-1">{n}.</span> : null}{label}</label>
    {children}
    {hint && <p className="text-[11px] text-slate-400 leading-relaxed">{hint}</p>}
  </div>
);

const inputCls = 'w-full bg-slate-900 border border-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500 placeholder:text-slate-600';

const ApplyBar: React.FC<{ ready: boolean; missing?: string; onApply: () => void; applied: boolean }> = ({ ready, missing, onApply, applied }) => (
  <div className="flex flex-wrap items-center gap-3 pt-1">
    <button type="button" disabled={!ready} onClick={onApply} className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
      <Wand2 className="w-4 h-4" /> Usar en el formulario
    </button>
    {applied && <span className="text-xs text-emerald-300 inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Listo: revisa las respuestas de abajo y luego genera la sección con IA.</span>}
    {!ready && missing && <span className="text-xs text-slate-400">{missing}</span>}
  </div>
);

/* ------------------------------------------------------------------ */
/* Mercado: TAM / SAM / SOM                                            */
/* ------------------------------------------------------------------ */
export const MarketHelper: React.FC<HelperProps> = ({ answers, onApply, defaultPrice }) => {
  const [st, setSt] = useHelperState(answers, {
    customer: '', count: 0, source: '', price: defaultPrice || 0, reachPct: 20, reachWhy: '', target: 0, targetWhy: ''
  });
  const [applied, setApplied] = useState(false);
  const set = (p: Partial<typeof st>) => { setSt({ ...st, ...p }); setApplied(false); };

  const tam = st.count * st.price;
  const samCount = Math.round(st.count * st.reachPct / 100);
  const sam = samCount * st.price;
  const som = st.target * st.price;
  const share = samCount > 0 ? (st.target / samCount) * 100 : 0;
  const ready = Boolean(st.customer.trim() && st.count > 0 && st.price > 0 && st.target > 0);

  const apply = () => {
    const src = st.source.trim() ? ` (fuente: ${st.source.trim()})` : ' [COMPLETAR: fuente del dato]';
    onApply({
      archetype: st.customer.trim(),
      tam: `En Chile hay aproximadamente ${st.count.toLocaleString('es-CL')} ${st.customer.trim()}${src}. Si cada cliente pagara ${clp(st.price)} al año por nuestra solución, el mercado total (TAM) es de ${fmtBig(tam)} al año.`,
      sam: `Podemos atender al ${st.reachPct}% de ese mercado${st.reachWhy.trim() ? ` (${st.reachWhy.trim()})` : ' [COMPLETAR: por qué esa parte]'}: unos ${samCount.toLocaleString('es-CL')} clientes, equivalentes a ${fmtBig(sam)} al año (SAM).`,
      som: `Nuestra meta es conseguir ${st.target.toLocaleString('es-CL')} clientes en los próximos 12 a 24 meses.${st.targetWhy.trim() ? ` Cómo llegamos a ese número: ${st.targetWhy.trim()}.` : ' [COMPLETAR: cómo se llega a esa meta]'} Eso representa ${fmtBig(som)} al año (SOM), un ${share.toLocaleString('es-CL', { maximumFractionDigits: 1 })}% del mercado al que podemos llegar.`,
      _helper: JSON.stringify(st)
    });
    setApplied(true);
  };

  return (
    <Shell title="Ayudante: calcula el tamaño de tu mercado" subtitle="Los evaluadores piden TAM, SAM y SOM. Te guiamos con 5 preguntas y hacemos las cuentas.">
      <div className="text-xs text-slate-300 leading-relaxed grid gap-2 sm:grid-cols-3">
        <p className="p-3 rounded-xl bg-slate-900 border border-slate-800"><strong className="text-white">TAM</strong>: todos los clientes posibles en Chile × lo que pagaría cada uno al año.</p>
        <p className="p-3 rounded-xl bg-slate-900 border border-slate-800"><strong className="text-white">SAM</strong>: la parte a la que realmente puedes llegar (por zona, tipo de cliente o canal).</p>
        <p className="p-3 rounded-xl bg-slate-900 border border-slate-800"><strong className="text-white">SOM</strong>: los clientes que de verdad puedes conseguir en 1 a 2 años.</p>
      </div>

      <Field n={1} label="¿Quién te compra? Describe a tu cliente en una frase" hint="Sé específico: no 'pymes', sino 'pymes de mantención industrial con 10 a 50 trabajadores'.">
        <input className={inputCls} value={st.customer} onChange={e => set({ customer: e.target.value })} placeholder="Ej: pymes manufactureras de 10 a 200 trabajadores" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field n={2} label="¿Cuántos clientes de ese tipo hay en Chile?" hint={<>Búscalo en las estadísticas de empresas del <a className="text-cyan-300 underline" href="https://www.sii.cl" target="_blank" rel="noopener noreferrer">SII <ExternalLink className="inline w-3 h-3" /></a> (por rubro y tamaño), el <a className="text-cyan-300 underline" href="https://www.ine.gob.cl" target="_blank" rel="noopener noreferrer">INE <ExternalLink className="inline w-3 h-3" /></a>, <a className="text-cyan-300 underline" href="https://datos.gob.cl" target="_blank" rel="noopener noreferrer">datos.gob.cl <ExternalLink className="inline w-3 h-3" /></a> o tu gremio. Una estimación con fuente vale más que un número redondo sin fuente.</>}>
          <input className={inputCls} inputMode="numeric" value={st.count ? st.count.toLocaleString('es-CL') : ''} onChange={e => set({ count: parseNum(e.target.value) })} placeholder="Ej: 12.000" />
        </Field>
        <Field label="¿De dónde sacaste ese número?">
          <input className={inputCls} value={st.source} onChange={e => set({ source: e.target.value })} placeholder="Ej: SII, estadísticas de empresas por rubro 2024" />
        </Field>
      </div>

      <Field n={3} label="¿Cuánto te pagaría cada cliente al año?" hint="Precio anual por cliente. Si cobras mensual, multiplica por 12.">
        <input className={inputCls} inputMode="numeric" value={st.price ? st.price.toLocaleString('es-CL') : ''} onChange={e => set({ price: parseNum(e.target.value) })} placeholder="Ej: 1.200.000" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field n={4} label={`¿A qué parte puedes llegar? (${st.reachPct}%)`} hint="Piensa en la zona donde vendes, el tipo de cliente que atiendes o tus canales de venta.">
          <input type="range" min={1} max={100} value={st.reachPct} onChange={e => set({ reachPct: Number(e.target.value) })} className="w-full accent-cyan-400" />
        </Field>
        <Field label="¿Por qué esa parte?">
          <input className={inputCls} value={st.reachWhy} onChange={e => set({ reachWhy: e.target.value })} placeholder="Ej: partimos en la Región Metropolitana y Valparaíso" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field n={5} label="¿Cuántos clientes puedes conseguir en 12 a 24 meses?" hint="Calcúlalo con tu capacidad real: por ejemplo, un vendedor que cierra 3 clientes al mes por 18 meses = 54.">
          <input className={inputCls} inputMode="numeric" value={st.target ? st.target.toLocaleString('es-CL') : ''} onChange={e => set({ target: parseNum(e.target.value) })} placeholder="Ej: 50" />
        </Field>
        <Field label="¿Cómo llegas a ese número?">
          <input className={inputCls} value={st.targetWhy} onChange={e => set({ targetWhy: e.target.value })} placeholder="Ej: 1 vendedor cierra 3 clientes al mes y hoy tenemos 5 pilotos" />
        </Field>
      </div>

      {st.count > 0 && st.price > 0 && (
        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700"><p className="text-slate-400">TAM</p><p className="text-sm font-bold text-white">{fmtBig(tam)}</p></div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700"><p className="text-slate-400">SAM · {samCount.toLocaleString('es-CL')} clientes</p><p className="text-sm font-bold text-white">{fmtBig(sam)}</p></div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700"><p className="text-slate-400">SOM · {st.target.toLocaleString('es-CL')} clientes</p><p className="text-sm font-bold text-white">{fmtBig(som)}</p></div>
        </div>
      )}
      {st.target > 0 && samCount > 0 && share > 10 && (
        <p className="text-xs text-amber-200 flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" /> Tu meta es el {share.toFixed(0)}% del mercado al que llegas. Los evaluadores suelen ver metas sobre 5-10% como poco realistas: explica bien cómo llegarás o baja la meta.</p>
      )}
      <ApplyBar ready={ready} missing="Completa las preguntas 1, 2, 3 y 5." onApply={apply} applied={applied} />
    </Shell>
  );
};

/* ------------------------------------------------------------------ */
/* Equipo                                                              */
/* ------------------------------------------------------------------ */
interface Member { name: string; role: string; experience: string; hours: string }
export const TeamHelper: React.FC<HelperProps> = ({ answers, onApply }) => {
  const [st, setSt] = useHelperState(answers, {
    members: [{ name: '', role: '', experience: '', hours: '' }] as Member[],
    gap: '', gapPlan: ''
  });
  const [applied, setApplied] = useState(false);
  const set = (p: Partial<typeof st>) => { setSt({ ...st, ...p }); setApplied(false); };
  const setMember = (i: number, p: Partial<Member>) => set({ members: st.members.map((m, j) => (j === i ? { ...m, ...p } : m)) });
  const filled = st.members.filter(m => m.name.trim() && m.role.trim());
  const ready = filled.length > 0 && filled.every(m => m.experience.trim() && m.hours.trim());
  const roles = filled.map(m => m.role.toLowerCase()).join(' ');
  const hasTech = /(t[eé]cnic|desarroll|ingenier|cto|program|product|operacion)/.test(roles);
  const hasCommercial = /(comercial|venta|ceo|gerente|marketing|negocio|cliente)/.test(roles);

  const apply = () => {
    onApply({
      members: filled.map(m => `${m.name.trim()} (${m.role.trim()}): ${m.experience.trim()}`).join('\n'),
      dedication: filled.map(m => `${m.name.trim()}: ${m.hours.trim()} horas semanales al proyecto`).join('; ') + '.',
      skills: [
        `El equipo combina ${hasTech ? 'capacidad técnica' : ''}${hasTech && hasCommercial ? ' y ' : ''}${hasCommercial ? 'capacidad comercial' : ''}${!hasTech && !hasCommercial ? 'las capacidades descritas' : ''} para ejecutar el proyecto.`,
        st.gap.trim() ? `Brecha identificada: ${st.gap.trim()}. ${st.gapPlan.trim() ? `La cubriremos así: ${st.gapPlan.trim()}.` : '[COMPLETAR: cómo se cubrirá]'}` : ''
      ].filter(Boolean).join(' '),
      _helper: JSON.stringify(st)
    });
    setApplied(true);
  };

  return (
    <Shell title="Ayudante: presenta a tu equipo" subtitle="Los evaluadores buscan quién hace qué, con qué experiencia y cuánto tiempo le dedica. Completa una ficha por persona.">
      <div className="space-y-3">
        {st.members.map((m, i) => (
          <div key={i} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-300">Integrante {i + 1}</p>
              {st.members.length > 1 && (
                <button type="button" onClick={() => set({ members: st.members.filter((_, j) => j !== i) })} className="p-1 rounded-lg text-slate-400 hover:text-rose-300 cursor-pointer" aria-label={`Quitar integrante ${i + 1}`}><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inputCls} value={m.name} onChange={e => setMember(i, { name: e.target.value })} placeholder="Nombre" aria-label="Nombre" />
              <input className={inputCls} value={m.role} onChange={e => setMember(i, { role: e.target.value })} placeholder="Rol en el proyecto (ej: líder técnico, comercial)" aria-label="Rol en el proyecto" />
            </div>
            <input className={inputCls} value={m.experience} onChange={e => setMember(i, { experience: e.target.value })} placeholder="Experiencia que sirve para este proyecto (años, estudios, logros concretos)" aria-label="Experiencia relevante" />
            <input className={inputCls} inputMode="numeric" value={m.hours} onChange={e => setMember(i, { hours: e.target.value.replace(/[^\d]/g, '') })} placeholder="Horas por semana dedicadas al proyecto (ej: 44)" aria-label="Horas por semana" />
          </div>
        ))}
        <button type="button" onClick={() => set({ members: [...st.members, { name: '', role: '', experience: '', hours: '' }] })} className="text-xs font-bold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 cursor-pointer">
          <Plus className="w-4 h-4" /> Agregar integrante
        </button>
      </div>
      {filled.length > 0 && (!hasTech || !hasCommercial) && (
        <p className="text-xs text-amber-200 flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" /> Los evaluadores esperan un equipo con perfil {!hasTech ? 'técnico' : 'comercial'}. Si no lo tienes, indícalo como brecha y explica cómo lo cubrirás (por ejemplo, una contratación incluida en el presupuesto).</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="¿Qué capacidad le falta al equipo? (opcional)">
          <input className={inputCls} value={st.gap} onChange={e => set({ gap: e.target.value })} placeholder="Ej: experiencia en ventas a grandes empresas" />
        </Field>
        <Field label="¿Cómo la cubrirás?">
          <input className={inputCls} value={st.gapPlan} onChange={e => set({ gapPlan: e.target.value })} placeholder="Ej: contrataremos un ejecutivo comercial (incluido en el presupuesto)" />
        </Field>
      </div>
      <ApplyBar ready={ready} missing="Completa nombre, rol, experiencia y horas de cada integrante." onApply={apply} applied={applied} />
    </Shell>
  );
};

/* ------------------------------------------------------------------ */
/* Innovación y diferenciación                                         */
/* ------------------------------------------------------------------ */
const NOVELTY = [
  { id: 'mundo', label: 'Nuevo en el mundo', desc: 'No encontraste nada parecido en ningún país.' },
  { id: 'chile', label: 'Nuevo en Chile', desc: 'Existe afuera, pero no en Chile o no adaptado a Chile.' },
  { id: 'industria', label: 'Nuevo en tu industria', desc: 'Se usa en otros rubros, pero nadie lo aplica al tuyo.' },
  { id: 'mejora', label: 'Mejora importante de algo que existe', desc: 'Más barato, más rápido o mejor de forma medible.' }
];
const EVIDENCE = ['Prototipo funcionando', 'Clientes usándolo', 'Ventas', 'Pilotos', 'Cartas de interés (LOI)', 'Patente o registro'];

export const InnovationHelper: React.FC<HelperProps> = ({ answers, onApply }) => {
  const [st, setSt] = useHelperState(answers, {
    alternatives: [{ name: '', weakness: '' }, { name: '', weakness: '' }],
    unique: '', metric: '', novelty: '', evidence: [] as string[], evidenceDetail: ''
  });
  const [applied, setApplied] = useState(false);
  const set = (p: Partial<typeof st>) => { setSt({ ...st, ...p }); setApplied(false); };
  const alts = st.alternatives.filter(a => a.name.trim());
  const ready = alts.length > 0 && Boolean(st.unique.trim() && st.novelty);
  const noveltyLabel = NOVELTY.find(n => n.id === st.novelty)?.label || '';

  const apply = () => {
    const altText = alts.map(a => `${a.name.trim()}${a.weakness.trim() ? ` (${a.weakness.trim()})` : ''}`).join('; ');
    onApply({
      noveltyVsCompetitors: [
        `Hoy los clientes resuelven esto con: ${altText}.`,
        `Nuestra diferencia: ${st.unique.trim()}${st.metric.trim() ? `, lo que significa ${st.metric.trim()}` : ' [COMPLETAR: resultado medible frente a la alternativa]'}.`,
        `Grado de novedad: ${noveltyLabel.toLowerCase()}.`,
        st.evidence.length ? `Evidencia: ${st.evidence.join(', ').toLowerCase()}${st.evidenceDetail.trim() ? ` (${st.evidenceDetail.trim()})` : ''}.` : 'Evidencia: [COMPLETAR: prototipo, clientes, pilotos o cartas que respalden la solución].'
      ].join(' '),
      _helper: JSON.stringify(st)
    });
    setApplied(true);
  };

  return (
    <Shell title="Ayudante: explica qué te hace innovador" subtitle="El criterio con más peso. Compárate con lo que usan hoy tus clientes y muestra evidencia.">
      <Field n={1} label="¿Qué usan hoy tus clientes para resolver el problema y qué le falla?" hint="Incluye a la competencia, las planillas Excel, hacerlo a mano o no hacer nada.">
        <div className="space-y-2">
          {st.alternatives.map((a, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
              <input className={inputCls} value={a.name} onChange={e => set({ alternatives: st.alternatives.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder={i === 0 ? 'Ej: Consultoras' : 'Ej: Hacerlo solos'} aria-label={`Alternativa ${i + 1}`} />
              <input className={inputCls} value={a.weakness} onChange={e => set({ alternatives: st.alternatives.map((x, j) => (j === i ? { ...x, weakness: e.target.value } : x)) })} placeholder={i === 0 ? 'Ej: cobran 10-15% del fondo ganado' : 'Ej: no conocen las bases y se equivocan'} aria-label={`Qué le falla a la alternativa ${i + 1}`} />
              {st.alternatives.length > 1 && (
                <button type="button" onClick={() => set({ alternatives: st.alternatives.filter((_, j) => j !== i) })} className="p-2 rounded-lg text-slate-400 hover:text-rose-300 cursor-pointer" aria-label={`Quitar alternativa ${i + 1}`}><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          ))}
          {st.alternatives.length < 4 && (
            <button type="button" onClick={() => set({ alternatives: [...st.alternatives, { name: '', weakness: '' }] })} className="text-xs font-bold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 cursor-pointer"><Plus className="w-4 h-4" /> Agregar alternativa</button>
          )}
        </div>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field n={2} label="¿Qué haces tú que ninguna de esas alternativas hace?">
          <input className={inputCls} value={st.unique} onChange={e => set({ unique: e.target.value })} placeholder="Ej: lee la carpeta tributaria y dice a qué fondos calificas en 1 minuto" />
        </Field>
        <Field label="¿Cuánto mejor es, en números?" hint="Tiempo, costo o resultado. Si no lo has medido, pon tu mejor estimación y cómo la medirás.">
          <input className={inputCls} value={st.metric} onChange={e => set({ metric: e.target.value })} placeholder="Ej: cuesta 10 veces menos que una consultora" />
        </Field>
      </div>
      <Field n={3} label="¿Qué tan nuevo es?">
        <div className="grid gap-2 sm:grid-cols-2">
          {NOVELTY.map(n => (
            <button key={n.id} type="button" onClick={() => set({ novelty: n.id })} className={`p-3 rounded-xl border text-left cursor-pointer ${st.novelty === n.id ? 'bg-cyan-500/15 border-cyan-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'}`} aria-pressed={st.novelty === n.id}>
              <span className="text-xs font-bold block">{n.label}</span>
              <span className="text-[11px] text-slate-400">{n.desc}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field n={4} label="¿Qué evidencia tienes de que funciona o de que la quieren?">
        <div className="flex flex-wrap gap-2">
          {EVIDENCE.map(ev => {
            const on = st.evidence.includes(ev);
            return (
              <button key={ev} type="button" onClick={() => set({ evidence: on ? st.evidence.filter(x => x !== ev) : [...st.evidence, ev] })} className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer ${on ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-slate-900 border-slate-700 text-slate-300'}`} aria-pressed={on}>
                {on ? '✓ ' : ''}{ev}
              </button>
            );
          })}
        </div>
        <input className={`${inputCls} mt-2`} value={st.evidenceDetail} onChange={e => set({ evidenceDetail: e.target.value })} placeholder="Detalle: ej. 12 empresas usando la versión beta, 3 cartas firmadas" />
      </Field>
      <ApplyBar ready={ready} missing="Completa al menos una alternativa, tu diferencia y el grado de novedad." onApply={apply} applied={applied} />
    </Shell>
  );
};

/** Elige el ayudante de la sección (o ninguno). */
export const SectionHelper: React.FC<HelperProps & { sectionId: string }> = ({ sectionId, ...props }) => {
  if (sectionId === 'market') return <MarketHelper {...props} />;
  if (sectionId === 'team') return <TeamHelper {...props} />;
  if (sectionId === 'solution') return <InnovationHelper {...props} />;
  return null;
};
