import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Video, Square, RotateCcw, Download, Play, Pause, Minus, Plus, CheckCircle2 } from 'lucide-react';

/**
 * Grabador de pitch con teleprompter. Todo ocurre en el navegador: la cámara y el video nunca
 * salen del dispositivo (no se sube nada a ImpulsaCap). Al terminar se descarga el archivo.
 *
 * - El guion se desplaza a la velocidad necesaria para leerlo en el tiempo que pide el fondo.
 * - La grabación se corta sola al llegar al máximo (ej. 40 s Corfo, 90 s Start-Up Chile).
 * - Graba en MP4 cuando el navegador lo permite (Safari, Chrome reciente); si no, en WebM.
 */

/** Deja solo lo que se lee en voz alta: sin marcas de tiempo, títulos ni comillas */
export function scriptToRead(raw: string): string {
  const text = String(raw || '');
  const afterGuion = text.match(/GUI[OÓ]N[^\n]*\n([\s\S]+)/i)?.[1] ?? text;
  return afterGuion
    .split('\n')
    .map(l => l.replace(/^\s*\[\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\]\s*[A-ZÁÉÍÓÚÑ ()/]+:?\s*/u, '').trim())
    .filter(l => l && !/^(T[ÍI]TULO|GUI[OÓ]N|DURACI[OÓ]N)\b/i.test(l))
    .map(l => l.replace(/^["“”]+|["“”]+$/g, '').trim())
    .filter(Boolean)
    .join('\n\n');
}

function pickMime(): { mime: string; ext: 'mp4' | 'webm' } {
  const MR: any = (window as any).MediaRecorder;
  const candidates: { mime: string; ext: 'mp4' | 'webm' }[] = [
    // MP4 con H.264: se abre en cualquier equipo (Windows, Mac, celulares)
    { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { mime: 'video/mp4;codecs=avc1,mp4a', ext: 'mp4' },
    { mime: 'video/mp4;codecs=h264,aac', ext: 'mp4' },
    // Si no hay H.264, WebM (YouTube y Drive lo aceptan) antes que un MP4 con otro códec
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
    { mime: 'video/mp4', ext: 'mp4' }
  ];
  for (const c of candidates) { try { if (MR?.isTypeSupported?.(c.mime)) return c; } catch { /* sigue */ } }
  return { mime: '', ext: 'webm' };
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export const PitchRecorder: React.FC<{
  open: boolean;
  onClose: () => void;
  script: string;
  maxSeconds: number;
  fundName: string;
  /** Se llama cuando la persona descargó su video (para ofrecer marcarlo como listo) */
  onDownloaded?: () => void;
}> = ({ open, onClose, script, maxSeconds, fundName, onDownloaded }) => {
  const [text, setText] = useState(() => scriptToRead(script));
  const [editing, setEditing] = useState(false);
  const [phase, setPhase] = useState<'setup' | 'countdown' | 'recording' | 'review'>('setup');
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [fontSize, setFontSize] = useState(28);
  const [speedAdj, setSpeedAdj] = useState(1);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const fmtRef = useRef(pickMime());

  useEffect(() => { if (open) { setText(scriptToRead(script)); setPhase('setup'); setDownloaded(false); } }, [open, script]);

  const words = useMemo(() => text.split(/\s+/).filter(Boolean).length, [text]);
  const wordsPerSec = words / Math.max(5, maxSeconds - 2);
  const tooLong = words > maxSeconds * 2.6; // ~2,5 palabras por segundo es un ritmo cómodo

  // Cámara: se pide al abrir y se apaga al cerrar
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Tu navegador no permite usar la cámara. Prueba con Chrome, Edge o Safari actualizados.');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      } catch (e: any) {
        const name = e?.name || '';
        setError(name === 'NotAllowedError'
          ? 'No diste permiso para usar la cámara y el micrófono. Actívalo en el candado de la barra de direcciones y vuelve a abrir el grabador.'
          : name === 'NotFoundError' ? 'No encontramos una cámara o micrófono en este equipo.' : (e?.message || 'No pudimos abrir la cámara.'));
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      try { recRef.current?.state === 'recording' && recRef.current.stop(); } catch { /* sin efecto */ }
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  // Desplazamiento del guion + cronómetro + corte automático (con refs: el bucle no ve el estado nuevo)
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const posRef = useRef(0);
  const lastRef = useRef(0);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { speedRef.current = speedAdj; }, [speedAdj]);
  const tick = (now: number) => {
    const secs = (now - startRef.current) / 1000;
    setElapsed(secs);
    const box = scrollRef.current;
    const dt = lastRef.current ? (now - lastRef.current) / 1000 : 0;
    lastRef.current = now;
    if (box && !pausedRef.current) {
      const max = Math.max(0, box.scrollHeight - box.clientHeight);
      // Recorre todo el texto en (máximo − 2 s) a velocidad 100%
      posRef.current = Math.min(max, posRef.current + (max / Math.max(5, maxSeconds - 2)) * speedRef.current * dt);
      box.scrollTop = posRef.current;
    }
    if (secs >= maxSeconds) { stop(); return; }
    rafRef.current = requestAnimationFrame(tick);
  };

  const begin = () => {
    if (!streamRef.current) return;
    setPhase('countdown'); setCount(3);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    let n = 3;
    const iv = setInterval(() => {
      n -= 1; setCount(n);
      if (n <= 0) {
        clearInterval(iv);
        try {
          chunksRef.current = [];
          const { mime } = fmtRef.current;
          const rec = new MediaRecorder(streamRef.current!, mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000 } : undefined);
          rec.ondataavailable = e => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
          rec.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || 'video/webm' });
            setBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
            setPhase('review');
          };
          rec.start(500);
          recRef.current = rec;
          startRef.current = performance.now();
          lastRef.current = 0; posRef.current = 0;
          setElapsed(0); setPaused(false);
          setPhase('recording');
          rafRef.current = requestAnimationFrame(tick);
        } catch (e: any) {
          setError('Tu navegador no permite grabar video aquí. Prueba con Chrome o Safari actualizados.');
          setPhase('setup');
        }
      }
    }, 1000);
  };

  function stop() {
    cancelAnimationFrame(rafRef.current);
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); } catch { /* sin efecto */ }
  }

  const download = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `pitch-${slug(fundName) || 'postulacion'}.${fmtRef.current.ext}`;
    document.body.appendChild(a); a.click(); a.remove();
    setDownloaded(true);
    onDownloaded?.();
  };

  if (!open) return null;
  const remaining = Math.max(0, Math.ceil(maxSeconds - elapsed));

  return (
    <div className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pitch-rec-title">
      <div className="w-full max-w-4xl max-h-[96dvh] overflow-y-auto rounded-3xl bg-slate-950 border border-slate-800 p-4 sm:p-5 space-y-3 text-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="pitch-rec-title" className="text-lg font-black text-white">Graba tu pitch con teleprompter</h2>
            <p className="text-xs text-slate-400">{fundName} · máximo {maxSeconds} segundos. El video se graba en tu equipo: no lo subimos a ningún lado.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={() => { stop(); onClose(); }} className="p-2 rounded-xl hover:bg-slate-800 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {error && <p className="text-sm text-rose-200 bg-rose-950/50 border border-rose-500/40 rounded-xl p-3">{error}</p>}

        {phase !== 'review' && (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
            <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover -scale-x-100" />
            {/* Teleprompter arriba, cerca de la cámara, para que la mirada no se vaya */}
            <div className="absolute inset-x-0 top-0 h-[48%] bg-gradient-to-b from-black/85 via-black/70 to-transparent">
              <div ref={scrollRef} className="h-full overflow-hidden px-6 sm:px-12 pt-4">
                <p className="text-white font-semibold leading-snug whitespace-pre-line text-center drop-shadow" style={{ fontSize }}>
                  {text || 'Escribe tu guion para que aparezca aquí.'}
                  {'\n\n\n\n'}
                </p>
              </div>
            </div>
            {phase === 'countdown' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="text-7xl font-black text-white">{count}</span>
              </div>
            )}
            {phase === 'recording' && (
              <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 text-white text-sm font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" /> Grabando · quedan {remaining} s
              </div>
            )}
          </div>
        )}

        {phase === 'review' && blobUrl && (
          <div className="space-y-2">
            <video ref={reviewRef} src={blobUrl} controls playsInline className="w-full rounded-2xl bg-black aspect-video" />
            <p className="text-xs text-slate-400">Revísalo antes de descargarlo. Si no te gustó, vuelve a grabar las veces que quieras.</p>
          </div>
        )}

        {/* Controles */}
        {phase === 'setup' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-slate-400">Letra</span>
              <button type="button" aria-label="Letra más chica" onClick={() => setFontSize(f => Math.max(16, f - 4))} className="p-1.5 rounded-lg bg-slate-800 cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
              <button type="button" aria-label="Letra más grande" onClick={() => setFontSize(f => Math.min(56, f + 4))} className="p-1.5 rounded-lg bg-slate-800 cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
              <span className="text-slate-400 ml-2">Velocidad</span>
              <button type="button" aria-label="Más lento" onClick={() => setSpeedAdj(v => Math.max(0.6, +(v - 0.1).toFixed(1)))} className="p-1.5 rounded-lg bg-slate-800 cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
              <span className="font-mono">{Math.round(speedAdj * 100)}%</span>
              <button type="button" aria-label="Más rápido" onClick={() => setSpeedAdj(v => Math.min(1.6, +(v + 0.1).toFixed(1)))} className="p-1.5 rounded-lg bg-slate-800 cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => setEditing(e => !e)} className="ml-auto font-bold text-cyan-300 underline cursor-pointer">{editing ? 'Listo' : 'Editar el guion'}</button>
            </div>
            {editing && (
              <textarea aria-label="Guion para el teleprompter" value={text} onChange={e => setText(e.target.value)} rows={6} className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" />
            )}
            <p className={`text-xs ${tooLong ? 'text-amber-300' : 'text-slate-400'}`}>
              {words} palabras · unas {wordsPerSec.toFixed(1).replace('.', ',')} por segundo{tooLong ? '. Es mucho para el tiempo: acorta el guion o se cortará antes de terminar.' : ''}
            </p>
            <ul className="text-xs text-slate-400 list-disc pl-4 space-y-0.5">
              <li>Pon el celular o computador a la altura de los ojos, con luz de frente y sin ruido de fondo.</li>
              <li>Mira la cámara: el texto está arriba para que la mirada no se baje.</li>
              <li>Habla tranquilo. Si te equivocas, vuelve a grabar.</li>
            </ul>
            <button type="button" disabled={!!error || !text.trim()} onClick={begin} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black cursor-pointer disabled:opacity-50">
              <Video className="w-5 h-5" /> Empezar a grabar
            </button>
          </div>
        )}

        {phase === 'recording' && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={stop} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-slate-900 font-black cursor-pointer"><Square className="w-4 h-4" /> Terminar</button>
            <button type="button" onClick={() => setPaused(p => !p)} className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 text-white font-bold cursor-pointer">
              {paused ? <><Play className="w-4 h-4" /> Seguir el texto</> : <><Pause className="w-4 h-4" /> Detener el texto</>}
            </button>
          </div>
        )}

        {phase === 'review' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={download} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black cursor-pointer"><Download className="w-4 h-4" /> Descargar mi video</button>
              <button type="button" onClick={() => { setPhase('setup'); setDownloaded(false); }} className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 text-white font-bold cursor-pointer"><RotateCcw className="w-4 h-4" /> Grabar de nuevo</button>
            </div>
            {downloaded && <p className="text-sm text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Descargado ({fmtRef.current.ext.toUpperCase()}).</p>}
            <div className="text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
              <p className="font-bold text-white">Cómo entregarlo en la postulación</p>
              <p>La mayoría de los fondos pide un <strong>enlace</strong>, no el archivo. Súbelo a YouTube como <strong>"No listado"</strong> (o a Google Drive con acceso "Cualquier persona con el enlace") y pega ese enlace en el formulario del portal. Revisa que se abra en una ventana de incógnito. Después márcalo como listo en Documentos.</p>
              {fmtRef.current.ext === 'webm' && <p className="text-slate-400">Tu navegador lo grabó en WebM: YouTube y Drive lo aceptan sin problema.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
