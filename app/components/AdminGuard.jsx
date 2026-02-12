"use client";

export default function AdminGuard({ children }) {
  // Luego conectamos auth real
  const isAdmin = true;

  if (!isAdmin) {
    return (
      <div style={{ padding: 40 }}>
        <h2>⛔ Acceso denegado</h2>
      </div>
    );
  }

  return children;
}
