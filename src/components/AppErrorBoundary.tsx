import React from 'react';

/** Si algo de la pantalla falla, se muestra un aviso con salida en vez de una página en blanco. */
function reportError(message: string, stack?: string) {
  try {
    const body = JSON.stringify({ message: String(message).slice(0, 500), stack: String(stack || '').slice(0, 2000), url: location.pathname, ua: navigator.userAgent.slice(0, 200) });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/metrics/error', new Blob([body], { type: 'application/json' }));
    else fetch('/api/metrics/error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch { /* sin efecto */ }
}

/** Después de publicar una versión nueva, las piezas viejas de la app ya no existen: se recarga una vez. */
export function isChunkLoadError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \d+ failed/i.test(msg);
}
export function reloadOnceForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem('impulsacap_reload_at') || 0);
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem('impulsacap_reload_at', String(Date.now()));
  } catch { /* sin almacenamiento: se recarga igual */ }
  location.reload();
  return true;
}

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: any, info: any) {
    if (isChunkLoadError(error) && reloadOnceForNewVersion()) return;
    reportError(error?.message || String(error), `${error?.stack || ''}\n${info?.componentStack || ''}`);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 440, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Impulsa<span style={{ color: '#059669' }}>Cap</span></p>
          <h1 style={{ fontSize: 18, color: '#0f172a', margin: '14px 0 8px' }}>Algo no cargó bien</h1>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: 0 }}>Tu información está guardada. Vuelve a cargar la página; si se repite, escríbenos a contacto@impulsacap.cl.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => location.reload()} style={{ padding: '10px 18px', borderRadius: 12, border: 0, background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Volver a cargar</button>
            <button type="button" onClick={() => { location.href = '/'; }} style={{ padding: '10px 18px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer' }}>Ir al inicio</button>
          </div>
        </div>
      </div>
    );
  }
}

/** Errores fuera de React (promesas sin manejar) y piezas viejas después de publicar */
export function installGlobalErrorHandlers() {
  window.addEventListener('vite:preloadError', (e: any) => {
    e?.preventDefault?.();
    reloadOnceForNewVersion();
  });
  window.addEventListener('unhandledrejection', (e: any) => {
    const r = e?.reason;
    if (isChunkLoadError(r)) { reloadOnceForNewVersion(); return; }
  });
  window.addEventListener('error', (e: any) => {
    if (e?.error && !isChunkLoadError(e.error)) reportError(e.error?.message || e.message, e.error?.stack);
  });
}
