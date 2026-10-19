import { auth } from '../firebase';

/**
 * Wrapper over standard fetch that automatically attaches the Firebase ID Token
 * in the Authorization header (Bearer <token>) when a user is signed in.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
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

  return fetch(input, {
    ...init,
    headers
  });
}
