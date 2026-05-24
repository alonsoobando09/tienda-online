"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isAdminUser } from "@/lib/isAdminUser";
import { getLoginErrorMessage } from "@/lib/authErrors";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("alriver1995zit@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const normalizedEmail = email.trim().toLowerCase();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setErrorMessage("");

    try {
      setLoading(true);

      const { user } = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );

      const isAdmin = await isAdminUser(user);

      if (!isAdmin) {
        localStorage.removeItem("admin");
        localStorage.removeItem("adminEmail");
        setErrorMessage("Tu usuario existe, pero no tiene permisos de administrador.");
        return;
      }

      localStorage.setItem("admin", "true");
      localStorage.setItem("adminEmail", user.email || "");
      router.push("/admin");
    } catch (error) {
      console.error(error);
      setErrorMessage(getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setMessage("");
    setErrorMessage("");

    if (!normalizedEmail) {
      setErrorMessage("Escribe tu correo para enviarte la recuperación.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setMessage("Te enviamos un correo para restablecer la contraseña.");
    } catch (error) {
      console.error(error);
      setErrorMessage(getLoginErrorMessage(error));
    }
  };

  return (
    <main style={{ padding: 40 }}>
      <h1>Login Administrador</h1>

      <form
        onSubmit={handleLogin}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: 360,
        }}
      >
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {errorMessage && (
          <p style={{ color: "#b42318", margin: 0 }}>{errorMessage}</p>
        )}

        {message && <p style={{ color: "#137333", margin: 0 }}>{message}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Ingresar"}
        </button>

        <button type="button" onClick={resetPassword} disabled={loading}>
          Recuperar contraseña
        </button>
      </form>
    </main>
  );
}
