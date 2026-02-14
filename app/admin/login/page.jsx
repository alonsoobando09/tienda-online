"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginAdmin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const login = () => {
    if (
      email === "admin@proveedor.com" &&
      pass === "123456"
    ) {
      localStorage.setItem("admin", "true");
      router.push("/admin");
    } else {
      alert("Datos incorrectos");
    }
  };

  return (
    <main style={{ padding: 40 }}>
      <h1>🔐 Login Admin</h1>

      <input
        placeholder="Correo"
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Contraseña"
        onChange={(e) => setPass(e.target.value)}
      />

      <button onClick={login}>
        Ingresar
      </button>
    </main>
  );
}
