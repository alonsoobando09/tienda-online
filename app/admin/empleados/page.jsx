"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminShell from "@/app/admin/components/AdminShell";
import { useEmpleados } from "@/lib/useEmpleados";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getCurrentEmpresaId } from "@/lib/tenant";
import { diasRuta, getDiaLabel, rutasBase } from "@/lib/operacion";
import { Save, Search, Trash2, UserPlus } from "lucide-react";

const emptyForm = {
  nombre: "",
  cargo: "",
  rol: "carterista",
  uid: "",
  telefono: "",
  email: "",
  password: "",
  documento: "",
  pagoDiario: "",
  diaRuta: "martes",
  ruta: "Ruta 1",
  estado: "activo",
};

const roles = [
  { value: "admin", label: "Administrador" },
  { value: "bodega", label: "Bodega" },
  { value: "carterista", label: "Carterista" },
  { value: "ayudante", label: "Ayudante" },
];

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function number(value) {
  return Number(value) || 0;
}

function getRoleLabel(value) {
  return roles.find((role) => role.value === value)?.label || "Sin rol";
}

function getDineroFaltante(item) {
  return number(item.dineroFaltante) || Math.max(number(item.descuadreDinero) * -1, 0);
}

function getDineroSobrante(item) {
  return number(item.dineroSobrante) || Math.max(number(item.descuadreDinero), 0);
}

export default function EmpleadosPage() {
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState(() => getCurrentEmpresaId());
  const { empleados, loading } = useEmpleados(selectedEmpresaId);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [gastosRuta, setGastosRuta] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [saving, setSaving] = useState(false);

  const cargarResumenOperativo = useCallback(async () => {
    const empresaId = selectedEmpresaId;
    const [liquidacionesSnap, gastosSnap] = await Promise.all([
      getDocs(query(collection(db, "liquidaciones"), where("empresaId", "==", empresaId))),
      getDocs(query(collection(db, "gastosRuta"), where("empresaId", "==", empresaId))),
    ]);

    setLiquidaciones(
      liquidacionesSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }))
    );
    setGastosRuta(gastosSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() })));
  }, [selectedEmpresaId]);

  useEffect(() => {
    setIsSuperadmin(localStorage.getItem("userRole") === "superadmin");

    const timer = setTimeout(() => {
      cargarResumenOperativo();
    }, 0);

    return () => clearTimeout(timer);
  }, [cargarResumenOperativo, selectedEmpresaId]);

  async function cargarEmpresas() {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch("/api/admin/empresas", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (response.ok && Array.isArray(result)) {
        setEmpresas(result);
      }
    } catch (error) {
      console.error("Error cargando empresas:", error);
    }
  }

  useEffect(() => {
    if (isSuperadmin) {
      cargarEmpresas();
    }
  }, [isSuperadmin]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function editarEmpleado(empleado) {
    setEditingId(empleado.id);
    setForm({
      nombre: empleado.nombre || "",
      cargo: empleado.cargo || "",
      rol: empleado.rol || "carterista",
      uid: empleado.uid || "",
      telefono: empleado.telefono || "",
      email: empleado.email || "",
      password: "",
      documento: empleado.documento || "",
      pagoDiario: empleado.pagoDiario || "",
      diaRuta: empleado.diaRuta || "martes",
      ruta: empleado.ruta || "Ruta 1",
      estado: empleado.estado || "activo",
    });
  }

  function limpiarFormulario() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function guardarEmpleado(event) {
    event.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      id: editingId,
      uid: form.uid.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      pagoDiario: Number(form.pagoDiario) || 0,
    };

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Sesion no disponible. Ingresa nuevamente.");
      }

      const response = await fetch(
        `/api/admin/empleados?empresaId=${encodeURIComponent(selectedEmpresaId)}`,
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo guardar el empleado.");
      }

      limpiarFormulario();
    } catch (error) {
      console.error("Error guardando empleado:", error);
      alert(error.message || "No se pudo guardar el empleado.");
    } finally {
      setSaving(false);
    }
  }

  async function eliminarEmpleado(empleado) {
    if (!confirm("Eliminar este empleado del panel operativo?")) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Sesion no disponible. Ingresa nuevamente.");
      }

      const response = await fetch(
        `/api/admin/empleados?empresaId=${encodeURIComponent(selectedEmpresaId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: empleado.id }),
        }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo eliminar el empleado.");
      }
    } catch (error) {
      console.error("Error eliminando empleado:", error);
      alert(error.message || "No se pudo eliminar el empleado.");
    }
  }

  const resumen = useMemo(() => {
    return empleados.reduce(
      (acc, empleado) => {
        const rol = empleado.rol || "sin_rol";
        const activo = empleado.estado !== "inactivo";
        acc.total += 1;
        if (activo) acc.activos += 1;
        else acc.inactivos += 1;
        acc[rol] = (acc[rol] || 0) + 1;
        if (!empleado.uid) acc.sinUid += 1;
        return acc;
      },
      {
        total: 0,
        activos: 0,
        inactivos: 0,
        admin: 0,
        bodega: 0,
        carterista: 0,
        ayudante: 0,
        sinUid: 0,
      }
    );
  }, [empleados]);

  const empleadosFiltrados = useMemo(() => {
    const term = filter.trim().toLowerCase();

    return empleados
      .filter((empleado) => {
        if (roleFilter === "todos") return true;
        if (roleFilter === "activos") return empleado.estado !== "inactivo";
        if (roleFilter === "inactivos") return empleado.estado === "inactivo";
        if (roleFilter === "sin_uid") return !empleado.uid;
        return empleado.rol === roleFilter;
      })
      .filter((empleado) => {
        if (!term) return true;
        return [
          empleado.nombre,
          empleado.email,
          empleado.telefono,
          empleado.documento,
          empleado.uid,
          empleado.ruta,
          empleado.diaRuta,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
  }, [empleados, filter, roleFilter]);

  const resumenOperativo = useMemo(() => {
    const base = new Map();

    empleados.forEach((empleado) => {
      base.set(empleado.id, {
        empleado,
        rutasCarterista: 0,
        rutasAyudante: 0,
        netoCarterista: 0,
        netoAyudante: 0,
        descuentosCarterista: 0,
        descuentosAyudante: 0,
        faltantes: 0,
        descuadreDinero: 0,
        dineroFaltante: 0,
        dineroSobrante: 0,
        prestamos: 0,
        consumos: 0,
        almuerzos: 0,
      });
    });

    function findByLiquidacion(item, role) {
      const id = role === "carterista" ? item.carteristaId : item.ayudanteId;
      const name =
        role === "carterista" ? item.carteristaNombre : item.ayudanteNombre;

      return (
        base.get(id) ||
        [...base.values()].find(
          (entry) =>
            entry.empleado.nombre &&
            name &&
            entry.empleado.nombre.trim().toLowerCase() ===
              String(name).trim().toLowerCase()
        )
      );
    }

    liquidaciones.forEach((item) => {
      const carterista = findByLiquidacion(item, "carterista");
      if (carterista) {
        carterista.rutasCarterista += 1;
        carterista.netoCarterista += number(item.netoCarterista);
        carterista.descuentosCarterista += number(item.descuentosCarterista);
        carterista.faltantes += number(item.costoFaltante);
        carterista.descuadreDinero += number(item.descuadreDinero);
        carterista.dineroFaltante += getDineroFaltante(item);
        carterista.dineroSobrante += getDineroSobrante(item);
      }

      const ayudante = findByLiquidacion(item, "ayudante");
      if (ayudante) {
        ayudante.rutasAyudante += 1;
        ayudante.netoAyudante += number(item.netoAyudante);
        ayudante.descuentosAyudante += number(item.descuentosAyudante);
      }
    });

    gastosRuta.forEach((gasto) => {
      const entry =
        [...base.values()].find(
          (item) =>
            item.empleado.uid &&
            gasto.uid &&
            item.empleado.uid.trim() === String(gasto.uid).trim()
        ) ||
        [...base.values()].find(
          (item) =>
            item.empleado.nombre &&
            gasto.empleadoNombre &&
            item.empleado.nombre.trim().toLowerCase() ===
              String(gasto.empleadoNombre).trim().toLowerCase()
        );

      if (!entry) return;

      if (gasto.tipo === "prestamo") entry.prestamos += number(gasto.valor);
      else if (gasto.tipo === "consumo") entry.consumos += number(gasto.valor);
      else if (gasto.tipo === "almuerzo") entry.almuerzos += number(gasto.valor);
    });

    return [...base.values()].sort(
      (a, b) =>
        b.netoCarterista +
        b.netoAyudante -
        (a.netoCarterista + a.netoAyudante)
    );
  }, [empleados, gastosRuta, liquidaciones]);

  const resumenPlataEquipo = useMemo(() => {
    return resumenOperativo.reduce(
      (acc, item) => {
        acc.neto += item.netoCarterista + item.netoAyudante;
        acc.descuentos += item.descuentosCarterista + item.descuentosAyudante;
        acc.prestamos += item.prestamos;
        acc.consumos += item.consumos;
        acc.almuerzos += item.almuerzos;
        acc.faltantes += item.faltantes;
        acc.dineroFaltante += item.dineroFaltante;
        acc.dineroSobrante += item.dineroSobrante;
        acc.rutas += item.rutasCarterista + item.rutasAyudante;
        return acc;
      },
      {
        neto: 0,
        descuentos: 0,
        prestamos: 0,
        consumos: 0,
        almuerzos: 0,
        faltantes: 0,
        dineroFaltante: 0,
        dineroSobrante: 0,
        rutas: 0,
      }
    );
  }, [resumenOperativo]);

  return (
    <AdminGuard>
      <AdminShell
        title="Empleados"
        subtitle="Gestiona equipo, roles de acceso, pagos diarios y rutas asignadas."
        actions={
          <a className="admin-button" href="#nuevo-usuario">
            <UserPlus size={18} />
            Agregar usuario
          </a>
        }
      >
        {isSuperadmin && (
          <section className="admin-card admin-accent-card">
            <div className="admin-section-title">
              <div>
                <h2>Empresa operativa</h2>
                <p>
                  Los empleados creados aqui quedan asignados solo a esta empresa.
                </p>
              </div>
            </div>

            <div className="admin-form">
              <label>
                Empresa
                <select
                  value={selectedEmpresaId}
                  onChange={(event) => {
                    setSelectedEmpresaId(event.target.value);
                    limpiarFormulario();
                  }}
                >
                  {empresas.map((empresa) => (
                    <option key={empresa.empresaId || empresa.id} value={empresa.empresaId || empresa.id}>
                      {empresa.nombre} ({empresa.empresaId || empresa.id})
                    </option>
                  ))}
                  {!empresas.some((empresa) => (empresa.empresaId || empresa.id) === selectedEmpresaId) && (
                    <option value={selectedEmpresaId}>{selectedEmpresaId}</option>
                  )}
                </select>
              </label>
            </div>
          </section>
        )}

        <section className="admin-grid admin-kpis">
          <article className="admin-card admin-stat-green">
            <h3>Activos</h3>
            <h2>{resumen.activos}</h2>
            <p>Usuarios con acceso operativo.</p>
          </article>
          <article className="admin-card admin-stat-blue">
            <h3>Carteristas</h3>
            <h2>{resumen.carterista}</h2>
            <p>Personal de ruta principal.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <h3>Ayudantes</h3>
            <h2>{resumen.ayudante}</h2>
            <p>Apoyo en ruta.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Sin UID</h3>
            <h2>{resumen.sinUid}</h2>
            <p>No pueden iniciar sesion.</p>
          </article>
        </section>

        <section className="admin-grid admin-kpis" style={{ marginTop: 16 }}>
          <article className="admin-card admin-stat-green">
            <h3>Neto equipo</h3>
            <h2>{money.format(resumenPlataEquipo.neto)}</h2>
            <p>Carteristas + ayudantes liquidados.</p>
          </article>
          <article className="admin-card admin-stat-gold">
            <h3>Descuentos</h3>
            <h2>{money.format(resumenPlataEquipo.descuentos)}</h2>
            <p>Liquidaciones cerradas.</p>
          </article>
          <article className="admin-card admin-stat-blue">
            <h3>Prestamos / consumos</h3>
            <h2>
              {money.format(
                resumenPlataEquipo.prestamos + resumenPlataEquipo.consumos
              )}
            </h2>
            <p>Registrados durante ruta.</p>
          </article>
          <article className="admin-card admin-stat-red">
            <h3>Faltantes</h3>
            <h2>{money.format(resumenPlataEquipo.faltantes)}</h2>
            <p>Productos faltantes cargados a carteristas.</p>
          </article>
        </section>

        <section className="admin-grid admin-kpis" style={{ marginTop: 16 }}>
          <article className="admin-card admin-stat-red">
            <h3>Plata faltante</h3>
            <h2>{money.format(resumenPlataEquipo.dineroFaltante)}</h2>
            <p>Dinero que falta al cerrar rutas.</p>
          </article>
          <article className="admin-card admin-stat-green">
            <h3>Plata sobrante</h3>
            <h2>{money.format(resumenPlataEquipo.dineroSobrante)}</h2>
            <p>Sobrantes reportados sin descontar.</p>
          </article>
          <article className="admin-card">
            <h3>Almuerzos</h3>
            <h2>{money.format(resumenPlataEquipo.almuerzos)}</h2>
            <p>Gastos de ruta registrados.</p>
          </article>
          <article className="admin-card">
            <h3>Rutas liquidadas</h3>
            <h2>{resumenPlataEquipo.rutas}</h2>
            <p>Carterista y ayudante acumulados.</p>
          </article>
        </section>

        <section className="admin-card admin-accent-card" id="nuevo-usuario">
          <div className="admin-section-title">
            <div>
              <h2>{editingId ? "Editar empleado" : "Nuevo empleado"}</h2>
              <p>
                Registra personal, conecta su usuario de Firebase y define su
                permiso operativo.
              </p>
            </div>
          </div>

          <form className="admin-form" onSubmit={guardarEmpleado}>
            <label>
              Nombre
              <input
                value={form.nombre}
                onChange={(event) => updateField("nombre", event.target.value)}
                required
              />
            </label>

            <label>
              Cargo
              <input
                value={form.cargo}
                onChange={(event) => updateField("cargo", event.target.value)}
                placeholder="Carterista, ayudante, bodega..."
              />
            </label>

            <label>
              Rol de acceso
              <select
                value={form.rol}
                onChange={(event) => updateField("rol", event.target.value)}
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              UID Firebase
              <input
                value={form.uid}
                onChange={(event) => updateField("uid", event.target.value)}
                placeholder="Se llena solo si creas con correo y contraseña"
              />
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
              Contraseña inicial
              <input
                autoComplete="new-password"
                minLength={6}
                placeholder={editingId ? "Dejar vacia para no cambiarla" : "Minimo 6 caracteres"}
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
              />
            </label>

            <label>
              Documento
              <input
                value={form.documento}
                onChange={(event) => updateField("documento", event.target.value)}
              />
            </label>

            <label>
              Pago diario
              <input
                type="number"
                value={form.pagoDiario}
                onChange={(event) => updateField("pagoDiario", event.target.value)}
              />
            </label>

            <label>
              Dia de ruta
              <select
                value={form.diaRuta}
                onChange={(event) => updateField("diaRuta", event.target.value)}
              >
                {diasRuta.map((dia) => (
                  <option key={dia.value} value={dia.value}>
                    {dia.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Ruta asignada
              <select
                value={form.ruta}
                onChange={(event) => updateField("ruta", event.target.value)}
              >
                {rutasBase.map((ruta) => (
                  <option key={ruta} value={ruta}>
                    {ruta}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Estado
              <select
                value={form.estado}
                onChange={(event) => updateField("estado", event.target.value)}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </label>

            <button className="admin-button" disabled={saving}>
              {editingId ? <Save size={18} /> : <UserPlus size={18} />}
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear empleado"}
            </button>

            {editingId && (
              <button
                className="admin-button secondary"
                type="button"
                onClick={limpiarFormulario}
              >
                Cancelar edicion
              </button>
            )}

            <p className="admin-help" style={{ gridColumn: "1 / -1" }}>
              Para activar el acceso: escribe correo y contraseña inicial. El
              sistema crea el usuario en Firebase Authentication, guarda el UID
              y actualiza la coleccion usuarios con el rol correcto.
            </p>
          </form>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title">
            <div>
              <h2>Resumen de liquidacion por persona</h2>
              <p>
                Neto, descuentos, prestamos, consumos y faltantes acumulados por
                empleado.
              </p>
            </div>
            <button
              className="admin-button secondary"
              disabled={loading}
              onClick={cargarResumenOperativo}
              type="button"
            >
              Actualizar resumen
            </button>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Rol</th>
                <th>Rutas</th>
                <th>Neto</th>
                <th>Descuentos</th>
                <th>Prestamos</th>
                <th>Consumos</th>
                <th>Faltantes</th>
                <th>Falta plata</th>
                <th>Sobra plata</th>
                <th>Descuadre</th>
              </tr>
            </thead>
            <tbody>
              {resumenOperativo.map((item) => {
                const neto = item.netoCarterista + item.netoAyudante;
                const descuentos =
                  item.descuentosCarterista + item.descuentosAyudante;
                const rutas = item.rutasCarterista + item.rutasAyudante;

                return (
                  <tr key={item.empleado.id}>
                    <td>
                      <strong>{item.empleado.nombre}</strong>
                      <small>{item.empleado.ruta || "Sin ruta"}</small>
                    </td>
                    <td>{getRoleLabel(item.empleado.rol)}</td>
                    <td>
                      {rutas}
                      <small>
                        C {item.rutasCarterista} / A {item.rutasAyudante}
                      </small>
                    </td>
                    <td>{money.format(neto)}</td>
                    <td>{money.format(descuentos)}</td>
                    <td>{money.format(item.prestamos)}</td>
                    <td>{money.format(item.consumos)}</td>
                    <td>
                      <span
                        className={`debt-pill ${item.faltantes > 0 ? "rojo" : "verde"}`}
                      >
                        {money.format(item.faltantes)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`debt-pill ${
                          item.dineroFaltante > 0 ? "rojo" : "verde"
                        }`}
                      >
                        {money.format(item.dineroFaltante)}
                      </span>
                    </td>
                    <td>{money.format(item.dineroSobrante)}</td>
                    <td>{money.format(item.descuadreDinero)}</td>
                  </tr>
                );
              })}
              {!resumenOperativo.length && (
                <tr>
                  <td colSpan="11">No hay resumen operativo para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-page-header">
            <div>
              <h2>Equipo operativo</h2>
              <p>
                {empleadosFiltrados.length} visibles de {empleados.length} empleados
                registrados
              </p>
            </div>
            <div className="admin-actions">
              <select
                className="admin-select-inline"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
                <option value="sin_uid">Sin UID</option>
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <label className="admin-search">
                <Search size={17} />
                <input
                  placeholder="Buscar empleado, UID o ruta"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                />
              </label>
            </div>
          </div>

          {loading ? (
            <p>Cargando empleados...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Rol</th>
                  <th>Contacto</th>
                  <th>Ruta</th>
                  <th>Pago diario</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empleadosFiltrados.map((empleado) => (
                  <tr key={empleado.id}>
                    <td>
                      <strong>{empleado.nombre}</strong>
                      <br />
                      <small>{empleado.documento || "Sin documento"}</small>
                      <br />
                      <small>{empleado.uid ? `UID: ${empleado.uid}` : "Sin UID"}</small>
                    </td>
                    <td>
                      <span className="admin-pill">
                        {getRoleLabel(empleado.rol)}
                      </span>
                      <br />
                      <small>{empleado.cargo || "Sin cargo"}</small>
                    </td>
                    <td>
                      {empleado.telefono || "Sin telefono"}
                      <br />
                      <small>{empleado.email || "Sin correo"}</small>
                    </td>
                    <td>
                      {getDiaLabel(empleado.diaRuta)}
                      <br />
                      <small>{empleado.ruta || "Sin ruta"}</small>
                    </td>
                    <td>{money.format(empleado.pagoDiario || 0)}</td>
                    <td>
                      <span className="admin-pill">
                        {empleado.estado || "activo"}
                      </span>
                    </td>
                    <td className="admin-row-actions">
                      <button
                        className="admin-button secondary"
                        onClick={() => editarEmpleado(empleado)}
                      >
                        Editar
                      </button>
                      <button
                        className="admin-button danger"
                        onClick={() => eliminarEmpleado(empleado)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && empleadosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="7">No hay empleados con ese filtro.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </AdminShell>
    </AdminGuard>
  );
}
