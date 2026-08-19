"use client";

import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function SignOutButton({ className = "pc-signout-button", label = "Salir" }) {
  const router = useRouter();

  const handleSignOut = async () => {
    localStorage.removeItem("admin");
    localStorage.removeItem("adminEmail");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("empresaId");
    await signOut(auth);
    router.replace("/login");
  };

  return (
    <button className={className} onClick={handleSignOut} type="button">
      <LogOut size={17} />
      <span>{label}</span>
    </button>
  );
}
