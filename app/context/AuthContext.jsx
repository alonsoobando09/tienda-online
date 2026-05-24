"use client";

import { createContext, useContext } from "react";

const AuthContext = createContext();

const defaultUser = {
  role: "admin",
  name: "Administrador",
};

export function AuthProvider({ children }) {
  return (
    <AuthContext.Provider value={{ user: defaultUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
