"use client";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const router = useRouter();

  const login = async () => {
    await signInWithEmailAndPassword(auth, email, pass);
    router.push("/");
  };

  return (
    <main style={{ padding: 40 }}>
      <h1>🔐 Iniciar sesión</h1>

      <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <input
        placeholder="Contraseña"
        type="password"
        onChange={e => setPass(e.target.value)}
      />

      <button onClick={login}>Entrar</button>
    </main>
  );
}
