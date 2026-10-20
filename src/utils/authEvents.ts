export type LoginRequestOptions = {
  message?: string;
  mode?: 'login' | 'register';
  onSuccess?: () => void | Promise<void>;
};

type LoginRequestListener = (options: LoginRequestOptions) => void;

const listeners = new Set<LoginRequestListener>();
let pendingPostLoginAction: (() => void | Promise<void>) | null = null;

export function onRequestLogin(listener: LoginRequestListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestLogin(options: LoginRequestOptions = {}): void {
  if (options.onSuccess) {
    pendingPostLoginAction = options.onSuccess;
  }
  listeners.forEach((listener) => {
    try {
      listener(options);
    } catch (e) {
      console.warn('Error in login request listener:', e);
    }
  });
}

export async function executePendingPostLoginAction(): Promise<void> {
  if (pendingPostLoginAction) {
    const action = pendingPostLoginAction;
    pendingPostLoginAction = null;
    try {
      await action();
    } catch (err) {
      console.error('Error executing post-login action:', err);
    }
  }
}

export function clearPendingPostLoginAction(): void {
  pendingPostLoginAction = null;
}
