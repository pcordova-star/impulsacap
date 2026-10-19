export function getFirebaseAuthErrorMessage(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta registrada con este correo electrónico. Inicia sesión.';
    case 'auth/invalid-email':
      return 'El formato del correo electrónico no es válido.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres y ser más segura.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Correo electrónico o contraseña incorrectos.';
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido deshabilitada temporalmente.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Intenta nuevamente en unos minutos o restablece tu contraseña.';
    case 'auth/popup-closed-by-user':
      return 'Se cerró la ventana de autenticación de Google.';
    case 'auth/popup-blocked':
      return 'La ventana emergente de Google fue bloqueada por el navegador.';
    case 'auth/network-request-failed':
      return 'Error de conexión. Verifica tu conexión a internet.';
    case 'auth/missing-password':
      return 'Debes ingresar una contraseña.';
    default:
      return error?.message || 'Ocurrió un error al procesar tu solicitud. Intenta nuevamente.';
  }
}
