export function getLoginErrorMessage(error) {
  const code = error?.code;

  if (
    code === "auth/invalid-credential" ||
    code === "auth/user-not-found" ||
    code === "auth/wrong-password"
  ) {
    return "Correo o contraseña incorrectos. Verifica que el usuario exista en Firebase Authentication y que estes usando la contraseña creada alli.";
  }

  if (code === "auth/invalid-email") {
    return "El correo no tiene un formato valido.";
  }

  if (code === "auth/too-many-requests") {
    return "Demasiados intentos fallidos. Espera unos minutos y vuelve a intentar.";
  }

  if (code === "auth/operation-not-allowed") {
    return "El inicio de sesion por correo y contraseña no esta habilitado en Firebase Authentication.";
  }

  return "No se pudo iniciar sesion. Revisa las credenciales e intenta nuevamente.";
}
