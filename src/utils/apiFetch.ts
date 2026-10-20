import { auth } from '../firebase';
import { logoutCompanyUser } from './storage';
import { requestLogin } from './authEvents';
import { requestServiceStartConfirmation } from './serviceStartEvents';

export interface ApiFetchOptions extends RequestInit {
  requireAuth?: boolean;
  /** Uso interno: evita pedir dos veces la confirmación de inicio del plan. */
  skipServiceStartConfirmation?: boolean;
}

/**
 * Wrapper over standard fetch that:
 * 1. Waits for Firebase to finish restoring session (auth.authStateReady()) before reading auth.currentUser.
 * 2. If no user after authStateReady and route is not public, throws Error("Debes iniciar sesión") without making the request.
 * 3. Automatically attaches the Firebase ID Token in Authorization: Bearer <token>.
 * 4. On 401 response, closes local session and prompts login with "Tu sesión expiró. Inicia sesión nuevamente para continuar."
 */
export async function apiFetch(input: RequestInfo | URL, init: ApiFetchOptions = {}): Promise<Response> {
  const url = typeof input === 'string' 
    ? input 
    : input instanceof URL 
      ? input.pathname 
      : (input as Request).url;

  // 1. Espera a que Firebase termine de restaurar la sesión
  if (auth.authStateReady) {
    try {
      await auth.authStateReady();
    } catch (err) {
      console.warn('Error waiting for auth.authStateReady in apiFetch:', err);
    }
  }

  const isPublicEndpoint = init.requireAuth === false ||
    url.includes('/api/gemini/instant-match') ||
    url.includes('/api/ayuda/chat');

  // Si después de eso no hay usuario, no hagas la solicitud: lanza un error "Debes iniciar sesión"
  if (!auth.currentUser && !isPublicEndpoint) {
    throw new Error('Debes iniciar sesión');
  }

  const headers = new Headers(init.headers || {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  // Attach Firebase Auth ID token if a user is logged in
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch (err) {
      console.warn('Could not retrieve Firebase ID token:', err);
    }
  }

  const { requireAuth: _requireAuth, skipServiceStartConfirmation, ...fetchInit } = init;
  const response = await fetch(input, {
    ...fetchInit,
    headers
  });

  // Primer uso de una herramienta del plan tras una compra: pedir confirmación (derecho a retracto)
  if (response.status === 409 && !skipServiceStartConfirmation) {
    let code = '';
    try {
      code = (await response.clone().json())?.code || '';
    } catch {
      code = '';
    }
    if (code === 'SERVICE_START_CONFIRMATION_REQUIRED') {
      const accepted = await requestServiceStartConfirmation();
      if (accepted) {
        const startRes = await fetch('/api/plan/iniciar-servicio', {
          method: 'POST',
          headers: { Accept: 'application/json', ...(headers.has('Authorization') ? { Authorization: headers.get('Authorization') as string } : {}) }
        });
        if (startRes.ok) {
          return apiFetch(input, { ...init, skipServiceStartConfirmation: true });
        }
      }
    }
  }

  // 4. Cuando el servidor responda 401, cierra la sesión local y pide iniciar sesión de nuevo con el mensaje
  if (response.status === 401) {
    try {
      await logoutCompanyUser();
    } catch (err) {
      console.warn('Error signing out on 401 in apiFetch:', err);
    }

    requestLogin({
      message: 'Tu sesión expiró. Inicia sesión nuevamente para continuar.',
      mode: 'login'
    });
  }

  return response;
}
