"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { auth } from "@/lib/firebase";
import { Building2, Edit3, Save } from "lucide-react";

const emptyForm = {
  empresaId: "",
  nombre: "",
  nit: "",
  telefono: "",
  email: "",
  ciudad: "",
  direccion: "",
  plan: "operativo",
  estado: "activa",
  observaciones: "",
};

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function cargarEmpresas() {
    setLoading(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch("/api/admin/empresas", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudieron cargar las empresas.");
      }

      setEmpresas(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error("Error cargando empresas:", error);
      alert(error.message || "No se pudieron cargar las empresas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarEmpresas();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const resumen = useMemo(() => {
    return empresas.reduce(
      (acc, empresa) => {
        acc.total += 1;
        if (empresa.estado === "activa") acc.activas += 1;
        else acc.inactivas += 1;
        return acc;
      },
      { total: 0, activas: 0, inactivas: 0 }
    );
  }, [empresas]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "nombre" && !editingId && !current.empresaId
        ? { empresaId: slugify(value) }
        : {}),
    }));
  }

  function editarEmpresa(empresa) {
    setEditingId(empresa.empresaId || empresa.id);
    setForm({
      empresaId: empresa.empresaId || empresa.id || "",
      nombre: empresa.nombre || "",
      nit: empresa.nit || "",
      telefono: empresa.telefono || "",
      email: empresa.email || "",
      ciudad: empresa.ciudad || "",
      direccion: empresa.direccion || "",
      plan: empresa.plan || "operativo",
      estado: empresa.estado || "activa",
      observaciones: empresa.observaciones || "",
    });
  }

  function limpiarFormulario() {
    setEditingId("");
    setForm(emptyForm);
  }

  async function guardarEmpresa(event) {
    event.preventDefault();

    if (!form.nombre.trim()) {
      alert("Escribe el nombre de la empresa.");
      return;
    }

    setSaving(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sesion no disponible.");

      const response = await fetch("/api/admin/empresas", {
        method: editingId ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          id: editingId,
          empresaId: form.empresaId || slugify(form.nombre),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo guardar la empresa.");
      }

      limpiarFormulario();
      await cargarEmpresas();
    } catch (error) {
      console.error("Error guardando empresa:", error);
      alert(error.message || "No se pudo guardar la empresa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminGuard allowedRoles={["superadmin"]}>
      <AdminShell
        title="Empresas"
        subtitle="Crea empresas independientes y prepara administradores, empleados y datos aislados."
        actions={
          <a className="admin-button" href="#nueva-empresa">
            <Building2 size={18} />
            Nueva empresa
          </a>
        }
      >
        <section className="admin-grid admin-kpis">
          <article className="admin-card admin-stat-blue">
            <h3>Empresas</h3>
            <h2>{resumen.total}</h2>
            <p>Instancias registradas.</p>
          </article>
          <article className="admin-card admin-stat-green">
            <h3>Activas</h3>
            <h2>{resumen.activas}</h2>
            <p>Pueden operar.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Inactivas</h3>
            <h2>{resumen.inactivas}</h2>
            <p>No deberian operar.</p>
          </article>
        </section>

        <section className="admin-card admin-accent-card" id="nueva-empresa">
          <div className="admin-section-title">
            <div>
              <h2>{editingId ? "Editar empresa" : "Nueva empresa"}</h2>
              <p>
                El ID de empresa es el candado que separa datos, usuarios,
                inventario, cartera y rutas.
              </p>
            </div>
          </div>

          <form className="admin-form" onSubmit={guardarEmpresa}>
            <label>
              ID empresa
              <input
                disabled={Boolean(editingId)}
                placeholder="ej: distribuidora-norte"
                value={form.empresaId}
                onChange={(event) => updateField("empresaId", slugify(event.target.value))}
              />
            </label>

            <label>
              Nombre
              <input
                value={form.nombre}
                onChange={(event) => updateField("nombre", event.target.value)}
                required
              />
            </label>

            <label>
              NIT / Documento
              <input value={form.nit} onChange={(event) => updateField("nit", event.target.value)} />
            </label>

            <label>
              Telefono
              <input
                value={form.telefono}
                onChange={(event) => updateField("telefono", event.target.value)}
              />
            </label>

            <label>
              Correo
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>

            <label>
              Ciudad
              <input
                value={form.ciudad}
                onChange={(event) => updateField("ciudad", event.target.value)}
              />
            </label>

            <label>
              Direccion
              <input
                value={form.direccion}
                onChange={(event) => updateField("direccion", event.target.value)}
              />
            </label>

            <label>
              Plan
              <select value={form.plan} onChange={(event) => updateField("plan", event.target.value)}>
                <option value="operativo">Operativo</option>
                <option value="profesional">Profesional</option>
                <option value="empresarial">Empresarial</option>
                <option value="principal">Principal</option>
              </select>
            </label>

            <label>
              Estado
              <select
                value={form.estado}
                onChange={(event) => updateField("estado", event.target.value)}
              >
                <option value="activa">Activa</option>
                <option value="inactiva">Inactiva</option>
                <option value="suspendida">Suspendida</option>
              </select>
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              Observaciones
              <textarea
                rows="2"
                value={form.observaciones}
                onChange={(event) => updateField("observaciones", event.target.value)}
              />
            </label>

            <button className="admin-button" disabled={saving}>
              <Save size={18} />
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear empresa"}
            </button>

            {editingId && (
              <button className="admin-button secondary" type="button" onClick={limpiarFormulario}>
                Cancelar edicion
              </button>
            )}
          </form>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Empresas registradas</h2>
              <p>Desde aqui eliges despues la empresa al crear empleados.</p>
            </div>
            <button className="admin-button secondary" disabled={loading} onClick={cargarEmpresas}>
              {loading ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>ID</th>
                <th>Contacto</th>
                <th>Plan</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((empresa) => (
                <tr key={empresa.empresaId || empresa.id}>
                  <td>
                    <strong>{empresa.nombre}</strong>
                    <br />
                    <small>{empresa.nit || "Sin NIT"}</small>
                  </td>
                  <td>{empresa.empresaId || empresa.id}</td>
                  <td>
                    {empresa.telefono || "Sin telefono"}
                    <br />
                    <small>{empresa.email || empresa.ciudad || "Sin contacto"}</small>
                  </td>
                  <td>{empresa.plan || "operativo"}</td>
                  <td>
                    <span className="admin-pill">{empresa.estado || "activa"}</span>
                  </td>
                  <td>
                    <button
                      className="admin-icon-button"
                      onClick={() => editarEmpresa(empresa)}
                      type="button"
                    >
                      <Edit3 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && empresas.length === 0 && (
                <tr>
                  <td colSpan="6">Aun no hay empresas registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}
