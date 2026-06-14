"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import RoleGuard from "@/app/components/RoleGuard";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  getDebtColor,
  getDiaLabel,
  getTodayRouteDay,
  money,
  rutasBase,
  sortClientesByRoute,
} from "@/lib/operacion";
import { getUserProfile } from "@/lib/authRoles";
import {
  LocateFixed,
  MessageCircle,
  Plus,
  ReceiptText,
  Search,
  CheckCircle2,
  Trash2,
  UserX,
  CircleX,
  X,
} from "lucide-react";

const emptyForm = {
  nombre: "",
  telefono: "",
  direccion: "",
  local: "",
  deudaActual: "",
  diasDeuda: "0",
  ordenVisita: "",
  insertarDespuesDe: "",
};

const emptyPago = {
  abonoDeudaAnterior: "",
  pagoProductosHoy: "",
  observaciones: "",
};

const emptyGasto = {
  persona: "carterista",
  tipo: "almuerzo",
  valor: "",
  descripcion: "",
};

function getProductPrices(producto) {
  const sugerido = Number(producto.precioDetal || producto.precio || 0);
  const minimo = Number(producto.precioMinimo || producto.precioMayor || sugerido);
  const maximo = Number(producto.precioMaximo || producto.precioPacaDetal || sugerido);

  return {
    minimo: Math.min(minimo, sugerido || minimo),
    sugerido,
    maximo: Math.max(maximo, sugerido || maximo),
  };
}

function getRouteVisitState(cliente, today) {
  const isRisk =
    cliente.estadoCliente === "riesgo_perdida" ||
    cliente.estadoCliente === "perdido" ||
    Boolean(cliente.riesgoPerdida) ||
    Boolean(cliente.perdido);

  if (isRisk) return "riesgo_perdida";

  if (cliente.estadoVisitaFecha !== today) return "pendiente";

  return cliente.estadoVisita || "pendiente";
}

const visitStateOrder = {
  riesgo_perdida: 0,
  pendiente: 1,
  no_encontrado: 2,
  visitado: 3,
};

const visitStateLabels = {
  pendiente: "Pendiente",
  visitado: "Visitado",
  no_encontrado: "No disponible",
  riesgo_perdida: "Riesgo",
};

function CarteristaContent() {
  const todayRouteDay = getTodayRouteDay();
  const today = new Date().toISOString().slice(0, 10);
  const [profile, setProfile] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [gastosRuta, setGastosRuta] = useState([]);
  const [ruta, setRuta] = useState("Ruta 1");
  const [form, setForm] = useState(emptyForm);
  const [gastoForm, setGastoForm] = useState(emptyGasto);
  const [filter, setFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [productFilter, setProductFilter] = useState("");
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [saleItems, setSaleItems] = useState([]);
  const [pago, setPago] = useState(emptyPago);
  const [ultimaFactura, setUltimaFactura] = useState(null);
  const [autorizacion, setAutorizacion] = useState(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [sendingLocation, setSendingLocation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const nextProfile = await getUserProfile(user);
      setProfile(nextProfile);

      if (!nextProfile.isAdmin && nextProfile.uid) {
        const today = new Date().toISOString().slice(0, 10);
        const snap = await getDocs(collection(db, "autorizacionesRuta"));
        const activeAuthorization = snap.docs
          .map((docu) => ({ id: docu.id, ...docu.data() }))
          .find(
            (item) =>
              item.uid === nextProfile.uid &&
              item.fecha === today &&
              item.estado === "activa"
          );

        setAutorizacion(activeAuthorization || null);

        if (activeAuthorization?.ruta) {
          setRuta(activeAuthorization.ruta);
          return;
        }
      }

      if (!nextProfile.isAdmin && nextProfile.ruta) {
        setRuta(nextProfile.ruta);
      }
    });

    return () => unsubscribe();
  }, []);

  const assignedDay = profile?.isAdmin
    ? todayRouteDay
    : autorizacion?.diaRuta
      ? autorizacion.diaRuta
      : profile?.diaRuta === todayRouteDay
      ? todayRouteDay
      : "";
  const assignedRoute = profile?.isAdmin
    ? ruta
    : autorizacion?.ruta || profile?.ruta || ruta;
  const canWorkToday = Boolean(assignedDay && assignedRoute);

  async function cargarDatos(showLoading = true) {
    if (showLoading) setLoading(true);
    const [clientesSnap, productosSnap, gastosSnap] = await Promise.all([
      getDocs(collection(db, "clientes")),
      getDocs(collection(db, "productos")),
      getDocs(collection(db, "gastosRuta")),
    ]);
    setClientes(
      sortClientesByRoute(
        clientesSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() }))
      )
    );
    setProductos(productosSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() })));
    setGastosRuta(gastosSnap.docs.map((docu) => ({ id: docu.id, ...docu.data() })));
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarDatos(false);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const clientesRutaBase = useMemo(() => {
    return clientes
      .filter(
        (cliente) =>
          cliente.diaRuta === assignedDay && cliente.ruta === assignedRoute
      )
      .map((cliente) => ({
        ...cliente,
        estadoVisitaHoy: getRouteVisitState(cliente, today),
      }))
      .sort((a, b) => {
        const estadoA = visitStateOrder[a.estadoVisitaHoy] ?? 9;
        const estadoB = visitStateOrder[b.estadoVisitaHoy] ?? 9;

        if (estadoA !== estadoB) return estadoA - estadoB;

        return Number(a.ordenVisita || 0) - Number(b.ordenVisita || 0);
      });
  }, [assignedDay, assignedRoute, clientes, today]);

  const resumenRuta = useMemo(() => {
    return clientesRutaBase.reduce(
      (acc, cliente) => {
        const estado = cliente.estadoVisitaHoy || "pendiente";
        acc.total += 1;
        acc[estado] = (acc[estado] || 0) + 1;
        return acc;
      },
      {
        total: 0,
        pendiente: 0,
        visitado: 0,
        no_encontrado: 0,
        riesgo_perdida: 0,
      }
    );
  }, [clientesRutaBase]);

  const clientesRuta = useMemo(() => {
    const term = filter.trim().toLowerCase();

    return clientesRutaBase
      .filter((cliente) => {
        if (estadoFilter === "todos") return true;
        return cliente.estadoVisitaHoy === estadoFilter;
      })
      .filter((cliente) => {
        if (!term) return true;
        return [cliente.nombre, cliente.telefono, cliente.direccion, cliente.local]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
  }, [clientesRutaBase, estadoFilter, filter]);

  const productosFiltrados = useMemo(() => {
    const term = productFilter.trim().toLowerCase();
    if (!term) return productos.slice(0, 8);

    return productos
      .filter((producto) =>
        [producto.nombre, producto.sku, producto.categoria]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      )
      .slice(0, 14);
  }, [productFilter, productos]);

  const resumenVenta = useMemo(() => {
    const totalProductos = saleItems.reduce(
      (acc, item) => acc + (Number(item.precio) || 0) * (Number(item.cantidad) || 0),
      0
    );
    const deudaAnterior = Number(selectedCliente?.deudaActual) || 0;
    const abonoAnterior = Number(pago.abonoDeudaAnterior) || 0;
    const pagoHoy = Number(pago.pagoProductosHoy) || 0;
    const deudaViejaRestante = Math.max(deudaAnterior - abonoAnterior, 0);
    const fiadoHoy = Math.max(totalProductos - pagoHoy, 0);
    const deudaFinal = deudaViejaRestante + fiadoHoy;

    return {
      totalProductos,
      deudaAnterior,
      abonoAnterior,
      pagoHoy,
      deudaViejaRestante,
      fiadoHoy,
      deudaFinal,
    };
  }, [pago.abonoDeudaAnterior, pago.pagoProductosHoy, saleItems, selectedCliente]);

  const productosCantidadInvalida = useMemo(
    () =>
      saleItems.filter((item) => {
        const cantidad = Number(item.cantidad) || 0;
        return cantidad <= 0;
      }),
    [saleItems]
  );

  const productosPrecioInvalido = useMemo(
    () =>
      saleItems.filter((item) => {
        const precio = Number(item.precio) || 0;
        const minimo = Number(item.minimo) || 0;
        const maximo = Number(item.maximo) || 0;

        return precio < minimo || precio > maximo;
      }),
    [saleItems]
  );

  const bloqueosVenta = useMemo(() => {
    const errores = [];

    if (productosCantidadInvalida.length > 0) {
      errores.push("Hay productos con cantidad cero o invalida.");
    }

    if (productosPrecioInvalido.length > 0) {
      errores.push("Hay productos con precio fuera del rango permitido.");
    }

    if (resumenVenta.abonoAnterior < 0 || resumenVenta.pagoHoy < 0) {
      errores.push("Los pagos y abonos no pueden ser negativos.");
    }

    if (resumenVenta.abonoAnterior > resumenVenta.deudaAnterior) {
      errores.push("El abono de deuda anterior no puede superar la deuda actual.");
    }

    if (resumenVenta.pagoHoy > resumenVenta.totalProductos) {
      errores.push("El pago de productos de hoy no puede superar el total vendido hoy.");
    }

    return errores;
  }, [productosCantidadInvalida.length, productosPrecioInvalido.length, resumenVenta]);

  const gastosRutaActual = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return gastosRuta
      .filter(
        (gasto) =>
          gasto.fecha === today &&
          gasto.diaRuta === assignedDay &&
          gasto.ruta === assignedRoute
      )
      .sort((a, b) => String(b.createdAt?.seconds || "").localeCompare(String(a.createdAt?.seconds || "")));
  }, [assignedDay, assignedRoute, gastosRuta]);

  const resumenGastosRuta = useMemo(() => {
    return gastosRutaActual.reduce(
      (acc, gasto) => {
        const valor = Number(gasto.valor) || 0;
        const persona = gasto.persona === "ayudante" ? "ayudante" : "carterista";

        acc.total += valor;

        if (gasto.tipo === "almuerzo") acc[persona].almuerzo += valor;
        else if (gasto.tipo === "prestamo") acc[persona].prestamo += valor;
        else if (gasto.tipo === "consumo") acc[persona].consumo += valor;
        else acc.otros += valor;

        return acc;
      },
      {
        total: 0,
        otros: 0,
        carterista: { almuerzo: 0, prestamo: 0, consumo: 0 },
        ayudante: { almuerzo: 0, prestamo: 0, consumo: 0 },
      }
    );
  }, [gastosRutaActual]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePago(field, value) {
    setPago((current) => ({ ...current, [field]: value }));
  }

  function updateGasto(field, value) {
    setGastoForm((current) => ({ ...current, [field]: value }));
  }

  async function registrarGastoRuta(e) {
    e.preventDefault();

    if (!canWorkToday) {
      alert("Hoy no hay ruta activa. Pide autorizacion al administrador.");
      return;
    }

    const valor = Number(gastoForm.valor) || 0;
    if (valor <= 0) {
      alert("Escribe un valor mayor a cero.");
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "gastosRuta"), {
        uid: profile?.uid || "",
        empleadoNombre: profile?.nombre || "",
        empleadoRol: profile?.role || "",
        fecha: new Date().toISOString().slice(0, 10),
        diaRuta: assignedDay,
        ruta: assignedRoute,
        persona: gastoForm.persona,
        tipo: gastoForm.tipo,
        valor,
        descripcion: gastoForm.descripcion.trim(),
        estado: "registrado",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setGastoForm(emptyGasto);
      await cargarDatos(false);
    } catch (error) {
      console.error("Error guardando gasto de ruta:", error);
      alert("No se pudo guardar el gasto.");
    } finally {
      setSaving(false);
    }
  }

  async function enviarUbicacion() {
    setLocationMessage("");

    if (!navigator.geolocation) {
      setLocationMessage("Este dispositivo no permite leer ubicacion.");
      return;
    }

    if (!profile?.uid) {
      setLocationMessage("No se encontro el usuario de ruta.");
      return;
    }

    setSendingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const fecha = new Date().toISOString().slice(0, 10);

          await addDoc(collection(db, "ubicacionesRuta"), {
            uid: profile.uid,
            empleadoNombre: profile.nombre || "",
            empleadoRol: profile.role || "",
            fecha,
            diaRuta: assignedDay,
            ruta: assignedRoute,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: serverTimestamp(),
          });

          setLocationMessage("Ubicacion enviada al administrador.");
        } catch (error) {
          console.error("Error guardando ubicacion:", error);
          setLocationMessage("No se pudo guardar la ubicacion.");
        } finally {
          setSendingLocation(false);
        }
      },
      () => {
        setLocationMessage("Permiso de ubicacion rechazado o no disponible.");
        setSendingLocation(false);
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    );
  }

  function seleccionarCliente(cliente) {
    setSelectedCliente(cliente);
    setSaleItems([]);
    setPago(emptyPago);
    setUltimaFactura(null);
  }

  async function agregarCliente(e) {
    e.preventDefault();
    if (!canWorkToday) {
      alert("Hoy no hay ruta activa. Pide autorizacion al administrador.");
      return;
    }

    setSaving(true);

    try {
      const selected = clientesRutaBase.find(
        (cliente) => cliente.id === form.insertarDespuesDe
      );
      const ordenManual = Number(form.ordenVisita) || 0;
      let ordenVisita = clientesRutaBase.length + 1;

      if (ordenManual) {
        ordenVisita = Math.min(Math.max(ordenManual, 1), clientesRutaBase.length + 1);
      } else if (selected) {
        ordenVisita = Number(selected.ordenVisita || 0) + 1;
      }

      const deudaActual = Number(form.deudaActual) || 0;
      const diasDeuda = deudaActual > 0 ? Number(form.diasDeuda) || 1 : 0;
      const batch = writeBatch(db);

      clientesRutaBase
        .filter((cliente) => Number(cliente.ordenVisita || 0) >= ordenVisita)
        .forEach((cliente) => {
          batch.update(doc(db, "clientes", cliente.id), {
            ordenVisita: Number(cliente.ordenVisita || 0) + 1,
            updatedAt: serverTimestamp(),
          });
        });

      const clienteRef = doc(collection(db, "clientes"));

      batch.set(clienteRef, {
        ...form,
        diaRuta: assignedDay,
        ruta: assignedRoute,
        ordenVisita,
        insertarDespuesDe: "",
        deudaActual,
        diasDeuda,
        semaforoDeuda: getDebtColor(diasDeuda),
        creadoPorCarterista: true,
        pendienteRevisionOrden: Boolean(form.ordenVisita || form.insertarDespuesDe),
        carteristaId: profile?.uid || "",
        carteristaNombre: profile?.nombre || "",
        solicitudBorrado: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      setForm(emptyForm);
      await cargarDatos();
    } catch (error) {
      console.error("Error agregando cliente:", error);
      alert("No se pudo agregar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function solicitarBorrado(cliente) {
    if (!confirm(`Marcar ${cliente.nombre} para revision de borrado?`)) return;

    await updateDoc(doc(db, "clientes", cliente.id), {
      solicitudBorrado: true,
      solicitudBorradoFecha: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await cargarDatos();
  }

  async function marcarVisita(cliente, estadoVisita) {
    const fecha = new Date().toISOString().slice(0, 10);
    const riesgoPerdida = estadoVisita === "riesgo_perdida";
    const clienteAtendido = estadoVisita === "visitado";
    const clienteEnRiesgoAntes =
      cliente.estadoCliente === "riesgo_perdida" ||
      cliente.estadoCliente === "perdido" ||
      Boolean(cliente.riesgoPerdida) ||
      Boolean(cliente.perdido);
    const nextEstadoCliente = riesgoPerdida
      ? "riesgo_perdida"
      : clienteAtendido
        ? "activo"
        : cliente.estadoCliente || "activo";
    const nextRiesgoPerdida = riesgoPerdida
      ? true
      : clienteAtendido
        ? false
        : Boolean(cliente.riesgoPerdida);
    const nextPerdido = clienteAtendido || riesgoPerdida ? false : Boolean(cliente.perdido);
    const batch = writeBatch(db);

    batch.update(doc(db, "clientes", cliente.id), {
      estadoVisita,
      estadoVisitaFecha: fecha,
      estadoCliente: nextEstadoCliente,
      riesgoPerdida: nextRiesgoPerdida,
      perdido: nextPerdido,
      riesgoPerdidaFecha: riesgoPerdida ? serverTimestamp() : cliente.riesgoPerdidaFecha || null,
      recuperadoFecha: clienteAtendido && clienteEnRiesgoAntes ? serverTimestamp() : cliente.recuperadoFecha || null,
      ultimaGestionRuta: serverTimestamp(),
      ultimoCarteristaGestion: profile?.nombre || "",
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(collection(db, "gestionesRuta")), {
      clienteId: cliente.id,
      clienteNombre: cliente.nombre || "",
      telefono: cliente.telefono || "",
      diaRuta: assignedDay,
      ruta: assignedRoute,
      fecha,
      estadoAnterior: cliente.estadoVisita || "pendiente",
      estadoVisita,
      estadoClienteAnterior: cliente.estadoCliente || "activo",
      estadoCliente: nextEstadoCliente,
      carteristaId: profile?.uid || "",
      carteristaNombre: profile?.nombre || "",
      deudaActual: Number(cliente.deudaActual) || 0,
      createdAt: serverTimestamp(),
    });

    if (riesgoPerdida || (clienteAtendido && clienteEnRiesgoAntes)) {
      batch.set(doc(collection(db, "movimientosCartera")), {
        clienteId: cliente.id,
        clienteNombre: cliente.nombre || "",
        telefono: cliente.telefono || "",
        diaRuta: assignedDay,
        ruta: assignedRoute,
        carteristaId: profile?.uid || "",
        carteristaNombre: profile?.nombre || "",
        deudaAnterior: Number(cliente.deudaActual) || 0,
        nuevaDeuda: Number(cliente.deudaActual) || 0,
        diasDeuda: Number(cliente.diasDeuda) || 0,
        tipo: riesgoPerdida ? "riesgo_perdida_ruta" : "cliente_recuperado_ruta",
        nota: riesgoPerdida
          ? "Carterista marco riesgo de perder la plata"
          : "Carterista encontro y atendio cliente en riesgo",
        estadoCliente: nextEstadoCliente,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();

    setClientes((current) =>
      current.map((item) =>
        item.id === cliente.id
          ? {
              ...item,
              estadoVisita,
              estadoVisitaFecha: fecha,
              estadoVisitaHoy: getRouteVisitState(
                {
                  ...item,
                  estadoVisita,
                  estadoVisitaFecha: fecha,
                  estadoCliente: nextEstadoCliente,
                  riesgoPerdida: nextRiesgoPerdida,
                  perdido: nextPerdido,
                },
                fecha
              ),
              estadoCliente: nextEstadoCliente,
              riesgoPerdida: nextRiesgoPerdida,
              perdido: nextPerdido,
              ultimoCarteristaGestion: profile?.nombre || "",
            }
          : item
      )
    );
    setSelectedCliente((current) =>
      current?.id === cliente.id
        ? {
            ...current,
            estadoVisita,
            estadoVisitaFecha: fecha,
            estadoCliente: nextEstadoCliente,
            riesgoPerdida: nextRiesgoPerdida,
            perdido: nextPerdido,
            ultimoCarteristaGestion: profile?.nombre || "",
          }
        : current
    );
  }

  function agregarProducto(producto, precioTipo = "sugerido") {
    if (!selectedCliente) {
      alert("Selecciona primero el cliente al que le vas a vender.");
      return;
    }

    if (!canWorkToday) {
      alert("Hoy no hay ruta activa. Pide autorizacion al administrador.");
      return;
    }

    const prices = getProductPrices(producto);
    const precio = prices[precioTipo] || prices.sugerido;

    setSaleItems((current) => {
      const exists = current.find((item) => item.productoId === producto.id);

      if (exists) {
        return current.map((item) =>
          item.productoId === producto.id
            ? { ...item, cantidad: Number(item.cantidad || 0) + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          sku: producto.sku || "",
          cantidad: 1,
          precio,
          precioTipo,
          minimo: prices.minimo,
          sugerido: prices.sugerido,
          maximo: prices.maximo,
        },
      ];
    });
  }

  function updateSaleItem(productoId, field, value) {
    setSaleItems((current) =>
      current.map((item) =>
        item.productoId === productoId
          ? {
              ...item,
              [field]:
                field === "cantidad"
                  ? Math.max(Number(value) || 0, 0)
                  : field === "precio"
                    ? Number(value) || 0
                    : value,
            }
          : item
      )
    );
  }

  function cambiarPrecio(item, precioTipo) {
    const precio = Number(item[precioTipo]) || Number(item.precio) || 0;
    updateSaleItem(item.productoId, "precioTipo", precioTipo);
    updateSaleItem(item.productoId, "precio", precio);
  }

  function eliminarProducto(productoId) {
    setSaleItems((current) => current.filter((item) => item.productoId !== productoId));
  }

  async function guardarFactura() {
    if (!selectedCliente) {
      alert("Selecciona un cliente.");
      return;
    }
    if (!saleItems.length && resumenVenta.abonoAnterior <= 0) {
      alert("Agrega productos o registra un abono.");
      return;
    }
    if (!canWorkToday) {
      alert("Hoy no hay ruta activa. Pide autorizacion al administrador.");
      return;
    }
    if (bloqueosVenta.length > 0) {
      alert(`Corrige antes de guardar:\n${bloqueosVenta.join("\n")}`);
      return;
    }
    if (productosPrecioInvalido.length > 0) {
      const nombres = productosPrecioInvalido
        .map(
          (item) =>
            `${item.nombre}: permitido entre ${money(item.minimo)} y ${money(item.maximo)}`
        )
        .join("\n");

      alert(`Hay precios fuera del rango permitido:\n${nombres}`);
      return;
    }

    setSaving(true);

    try {
      const facturaPayload = {
        tipo: "ruta",
        fecha: new Date().toISOString().slice(0, 10),
        diaRuta: assignedDay,
        ruta: assignedRoute,
        carteristaId: profile?.uid || "",
        carteristaNombre: profile?.nombre || "",
        clienteId: selectedCliente.id,
        clienteNombre: selectedCliente.nombre || "",
        telefono: selectedCliente.telefono || "",
        direccion: selectedCliente.direccion || "",
        items: saleItems.map((item) => ({
          ...item,
          cantidad: Number(item.cantidad) || 0,
          precio: Number(item.precio) || 0,
          subtotal: (Number(item.cantidad) || 0) * (Number(item.precio) || 0),
        })),
        deudaAnterior: resumenVenta.deudaAnterior,
        abonoDeudaAnterior: resumenVenta.abonoAnterior,
        totalProductos: resumenVenta.totalProductos,
        pagoProductosHoy: resumenVenta.pagoHoy,
        fiadoHoy: resumenVenta.fiadoHoy,
        deudaFinal: resumenVenta.deudaFinal,
        observaciones: pago.observaciones.trim(),
        estado: "guardada",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const facturaRef = await addDoc(collection(db, "facturasRuta"), facturaPayload);

      const diasDeuda = resumenVenta.deudaFinal > 0 ? 1 : 0;
      if (
        resumenVenta.abonoAnterior > 0 ||
        resumenVenta.fiadoHoy > 0 ||
        pago.observaciones.trim()
      ) {
        await addDoc(collection(db, "movimientosCartera"), {
          clienteId: selectedCliente.id,
          clienteNombre: selectedCliente.nombre || "",
          telefono: selectedCliente.telefono || "",
          diaRuta: assignedDay,
          ruta: assignedRoute,
          facturaRutaId: facturaRef.id,
          carteristaId: profile?.uid || "",
          carteristaNombre: profile?.nombre || "",
          abono: resumenVenta.abonoAnterior,
          ventaDia: resumenVenta.totalProductos,
          pagoProductosHoy: resumenVenta.pagoHoy,
          fiadoHoy: resumenVenta.fiadoHoy,
          deudaAnterior: resumenVenta.deudaAnterior,
          nuevaDeuda: resumenVenta.deudaFinal,
          diasDeuda,
          nota: pago.observaciones.trim(),
          tipo: resumenVenta.abonoAnterior > 0 ? "abono_ruta" : "visita_ruta",
          createdAt: serverTimestamp(),
        });
      }

      await updateDoc(doc(db, "clientes", selectedCliente.id), {
        deudaActual: resumenVenta.deudaFinal,
        diasDeuda,
        semaforoDeuda: getDebtColor(diasDeuda),
        estadoVisita: "visitado",
        estadoVisitaFecha: facturaPayload.fecha,
        estadoCliente: "activo",
        riesgoPerdida: false,
        perdido: false,
        ultimaNotaCartera: pago.observaciones.trim(),
        ultimoAbono: resumenVenta.abonoAnterior,
        ultimoMovimientoCartera: serverTimestamp(),
        ultimaVisita: serverTimestamp(),
        ultimaGestionRuta: serverTimestamp(),
        ultimoCarteristaGestion: profile?.nombre || "",
        updatedAt: serverTimestamp(),
      });

      if (
        selectedCliente.estadoCliente === "riesgo_perdida" ||
        selectedCliente.estadoCliente === "perdido" ||
        selectedCliente.riesgoPerdida ||
        selectedCliente.perdido
      ) {
        await addDoc(collection(db, "movimientosCartera"), {
          clienteId: selectedCliente.id,
          clienteNombre: selectedCliente.nombre || "",
          telefono: selectedCliente.telefono || "",
          diaRuta: assignedDay,
          ruta: assignedRoute,
          facturaRutaId: facturaRef.id,
          carteristaId: profile?.uid || "",
          carteristaNombre: profile?.nombre || "",
          deudaAnterior: resumenVenta.deudaAnterior,
          nuevaDeuda: resumenVenta.deudaFinal,
          diasDeuda,
          tipo: "cliente_recuperado_ruta",
          nota: "Cliente en riesgo/perdido fue atendido y facturado en ruta",
          estadoCliente: "activo",
          createdAt: serverTimestamp(),
        });
      }

      const facturaGuardada = { id: facturaRef.id, ...facturaPayload };
      setUltimaFactura(facturaGuardada);
      setSelectedCliente((current) => ({
        ...current,
        deudaActual: resumenVenta.deudaFinal,
        diasDeuda,
        semaforoDeuda: getDebtColor(diasDeuda),
        estadoVisita: "visitado",
        estadoVisitaFecha: facturaPayload.fecha,
        estadoCliente: "activo",
        riesgoPerdida: false,
        perdido: false,
      }));
      setSaleItems([]);
      setPago(emptyPago);
      await cargarDatos(false);
    } catch (error) {
      console.error("Error guardando factura:", error);
      alert("No se pudo guardar la factura.");
    } finally {
      setSaving(false);
    }
  }

  const whatsappUrl = useMemo(() => {
    if (!ultimaFactura?.telefono) return "";

    const lines = [
      `Proveedor Central`,
      `Factura ruta ${ultimaFactura.fecha}`,
      `Cliente: ${ultimaFactura.clienteNombre}`,
      `Ruta: ${ultimaFactura.ruta}`,
      "",
      ...ultimaFactura.items.map(
        (item) =>
          `${item.nombre} x${item.cantidad} - ${money(item.subtotal)}`
      ),
      "",
      `Deuda anterior: ${money(ultimaFactura.deudaAnterior)}`,
      `Abono anterior: ${money(ultimaFactura.abonoDeudaAnterior)}`,
      `Productos de hoy: ${money(ultimaFactura.totalProductos)}`,
      `Pago hoy: ${money(ultimaFactura.pagoProductosHoy)}`,
      `Total queda debiendo: ${money(ultimaFactura.deudaFinal)}`,
      "",
      "Muchas gracias por su compra.",
    ];

    const phone = String(ultimaFactura.telefono).replace(/\D/g, "");
    return `https://wa.me/57${phone.slice(-10)}?text=${encodeURIComponent(
      lines.join("\n")
    )}`;
  }, [ultimaFactura]);

  return (
    <main className="route-app">
      <section className="route-hero">
        <div>
          <p className="home-eyebrow">Modo carterista</p>
          <h1>Ruta de {getDiaLabel(assignedDay) || "hoy"}</h1>
          <p>
            {profile?.isAdmin
              ? "Vista de administrador para revisar o probar rutas."
              : `${profile?.nombre || "Usuario"} - ${assignedRoute || "sin ruta asignada"}`}
          </p>
        </div>
        {profile?.isAdmin ? (
          <select value={ruta} onChange={(e) => setRuta(e.target.value)}>
            {rutasBase.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        ) : (
          <div className="route-hero-actions">
            <div className="route-assigned-pill">
              {assignedRoute || "Sin ruta"}
            </div>
            <button
              className="route-location-button"
              disabled={sendingLocation || !canWorkToday}
              onClick={enviarUbicacion}
              type="button"
            >
              <LocateFixed size={17} />
              {sendingLocation ? "Enviando..." : "Ubicacion"}
            </button>
          </div>
        )}
      </section>

      {locationMessage && (
        <section className="route-card route-info">{locationMessage}</section>
      )}

      {!canWorkToday && (
        <section className="route-card route-alert">
          Hoy no tienes ruta activa con este usuario. Revisa que el empleado
          tenga dia de ruta y ruta asignada en Admin &gt; Empleados.
        </section>
      )}

      {autorizacion && (
        <section className="route-card route-info">
          Autorizacion especial activa: {getDiaLabel(autorizacion.diaRuta)} -{" "}
          {autorizacion.ruta}. {autorizacion.motivo || ""}
        </section>
      )}

      <section className="route-grid">
        <form className="route-card route-form" onSubmit={agregarCliente}>
          <h2>Agregar cliente del dia</h2>
          <input
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) => updateField("nombre", e.target.value)}
            required
          />
          <input
            placeholder="Telefono"
            value={form.telefono}
            onChange={(e) => updateField("telefono", e.target.value)}
          />
          <input
            placeholder="Direccion"
            value={form.direccion}
            onChange={(e) => updateField("direccion", e.target.value)}
          />
          <input
            placeholder="Local o referencia"
            value={form.local}
            onChange={(e) => updateField("local", e.target.value)}
          />
          <input
            min="0"
            placeholder="Deuda inicial"
            type="number"
            value={form.deudaActual}
            onChange={(e) => updateField("deudaActual", e.target.value)}
          />
          <input
            min="0"
            placeholder="Dias de deuda"
            type="number"
            value={form.diasDeuda}
            onChange={(e) => updateField("diasDeuda", e.target.value)}
          />
          <input
            min="1"
            placeholder="Orden de visita"
            type="number"
            value={form.ordenVisita}
            onChange={(e) => updateField("ordenVisita", e.target.value)}
          />
          <select
            value={form.insertarDespuesDe}
            onChange={(e) => updateField("insertarDespuesDe", e.target.value)}
          >
            <option value="">Agregar al final</option>
            {clientesRutaBase.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                Debajo de #{cliente.ordenVisita || "-"} {cliente.nombre}
              </option>
            ))}
          </select>
          <button disabled={saving || !canWorkToday} type="submit">
            <Plus size={18} />
            {saving ? "Guardando..." : "Agregar cliente"}
          </button>
        </form>

        <section className="route-card">
          <div className="route-toolbar">
            <div>
              <h2>Clientes de la ruta</h2>
              <p>
                {clientesRuta.length} visibles de {resumenRuta.total} clientes
              </p>
            </div>
            <select
              className="route-status-filter"
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendientes</option>
              <option value="visitado">Visitados</option>
              <option value="no_encontrado">No disponibles</option>
              <option value="riesgo_perdida">Riesgo</option>
            </select>
            <label>
              <Search size={17} />
              <input
                placeholder="Buscar"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
          </div>

          <div className="route-status-strip">
            <button
              className={estadoFilter === "pendiente" ? "active" : ""}
              onClick={() => setEstadoFilter("pendiente")}
              type="button"
            >
              Pendientes <strong>{resumenRuta.pendiente}</strong>
            </button>
            <button
              className={estadoFilter === "visitado" ? "active" : ""}
              onClick={() => setEstadoFilter("visitado")}
              type="button"
            >
              Visitados <strong>{resumenRuta.visitado}</strong>
            </button>
            <button
              className={estadoFilter === "no_encontrado" ? "active" : ""}
              onClick={() => setEstadoFilter("no_encontrado")}
              type="button"
            >
              No disponibles <strong>{resumenRuta.no_encontrado}</strong>
            </button>
            <button
              className={estadoFilter === "riesgo_perdida" ? "active" : ""}
              onClick={() => setEstadoFilter("riesgo_perdida")}
              type="button"
            >
              Riesgo <strong>{resumenRuta.riesgo_perdida}</strong>
            </button>
          </div>

          {loading ? (
            <p>Cargando clientes...</p>
          ) : clientesRuta.length === 0 ? (
            <p>No hay clientes con ese filtro.</p>
          ) : (
            <div className="route-client-list">
              {clientesRuta.map((cliente) => (
                <article
                  className={`route-client-card ${
                    selectedCliente?.id === cliente.id ? "active" : ""
                  } route-status-${cliente.estadoVisitaHoy || "pendiente"}`}
                  key={cliente.id}
                >
                  <button
                    className="route-client-main"
                    onClick={() => seleccionarCliente(cliente)}
                    type="button"
                  >
                    <strong>#{cliente.ordenVisita || "-"} {cliente.nombre}</strong>
                    <span>{cliente.direccion || "Sin direccion"}</span>
                  </button>
                  <span>{cliente.telefono || "Sin telefono"}</span>
                  <span>Debe: {money(cliente.deudaActual || 0)}</span>
                  <span className="route-visit-status">
                    {visitStateLabels[cliente.estadoVisitaHoy] || "Pendiente"}
                  </span>
                  <div className="route-client-actions">
                    <button
                      className="route-action-ok"
                      aria-label="Cliente encontrado y atendido"
                      onClick={() => marcarVisita(cliente, "visitado")}
                      title="Encontrado y atendido"
                      type="button"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <button
                      className="route-action-muted"
                      aria-label="Cliente no disponible temporalmente"
                      onClick={() => marcarVisita(cliente, "no_encontrado")}
                      title="No esta: casa, descanso, vacaciones"
                      type="button"
                    >
                      <UserX size={16} />
                    </button>
                    <button
                      className="route-action-risk"
                      aria-label="Cliente en riesgo de perder cartera"
                      onClick={() => marcarVisita(cliente, "riesgo_perdida")}
                      title="Riesgo de perder la plata"
                      type="button"
                    >
                      <CircleX size={16} />
                    </button>
                  </div>
                  <button
                    aria-label="Solicitar revision para borrar cliente"
                    onClick={() => solicitarBorrado(cliente)}
                    title="Solicitar revision para borrar"
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="route-card route-expenses">
        <div className="route-toolbar">
          <div>
            <h2>Gastos y prestamos de ruta</h2>
            <p>Registra almuerzos, prestamos y consumos antes de liquidar.</p>
          </div>
          <strong>{money(resumenGastosRuta.total)}</strong>
        </div>

        <div className="route-expense-grid">
          <form className="route-form" onSubmit={registrarGastoRuta}>
            <select
              value={gastoForm.persona}
              onChange={(e) => updateGasto("persona", e.target.value)}
            >
              <option value="carterista">Carterista</option>
              <option value="ayudante">Ayudante</option>
            </select>
            <select
              value={gastoForm.tipo}
              onChange={(e) => updateGasto("tipo", e.target.value)}
            >
              <option value="almuerzo">Almuerzo</option>
              <option value="prestamo">Prestamo</option>
              <option value="consumo">Producto consumido</option>
              <option value="gasolina">Gasolina</option>
              <option value="otro">Otro</option>
            </select>
            <input
              min="0"
              placeholder="Valor"
              type="number"
              value={gastoForm.valor}
              onChange={(e) => updateGasto("valor", e.target.value)}
            />
            <input
              placeholder="Detalle"
              value={gastoForm.descripcion}
              onChange={(e) => updateGasto("descripcion", e.target.value)}
            />
            <button disabled={saving || !canWorkToday} type="submit">
              <ReceiptText size={18} />
              Registrar
            </button>
          </form>

          <div className="liquidation-lines">
            <span>Carterista almuerzo</span>
            <strong>{money(resumenGastosRuta.carterista.almuerzo)}</strong>
            <span>Carterista prestamos</span>
            <strong>{money(resumenGastosRuta.carterista.prestamo)}</strong>
            <span>Carterista consumos</span>
            <strong>{money(resumenGastosRuta.carterista.consumo)}</strong>
            <span>Ayudante almuerzo</span>
            <strong>{money(resumenGastosRuta.ayudante.almuerzo)}</strong>
            <span>Ayudante prestamos</span>
            <strong>{money(resumenGastosRuta.ayudante.prestamo)}</strong>
            <span>Ayudante consumos</span>
            <strong>{money(resumenGastosRuta.ayudante.consumo)}</strong>
            <span>Otros ruta</span>
            <strong>{money(resumenGastosRuta.otros)}</strong>
          </div>
        </div>

        {gastosRutaActual.length > 0 && (
          <div className="route-expense-list">
            {gastosRutaActual.slice(0, 8).map((gasto) => (
              <span key={gasto.id}>
                {gasto.persona} - {gasto.tipo}: {money(gasto.valor)}{" "}
                {gasto.descripcion ? `(${gasto.descripcion})` : ""}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="sale-workspace">
        <article className="route-card">
          <div className="route-toolbar">
            <div>
              <h2>Visita y factura</h2>
              <p>
                {selectedCliente
                  ? `${selectedCliente.nombre} - deuda actual ${money(
                      selectedCliente.deudaActual || 0
                    )}`
                  : "Selecciona un cliente de la ruta"}
              </p>
            </div>
            {ultimaFactura && whatsappUrl && (
              <a className="admin-button" href={whatsappUrl} target="_blank">
                <MessageCircle size={18} />
                Enviar factura
              </a>
            )}
          </div>

          {selectedCliente ? (
            <div className="selected-client-banner">
              <div>
                <span>Cliente seleccionado</span>
                <strong>
                  #{selectedCliente.ordenVisita || "-"} {selectedCliente.nombre}
                </strong>
                <small>
                  {selectedCliente.direccion || "Sin direccion"} · Debe{" "}
                  {money(selectedCliente.deudaActual || 0)}
                </small>
              </div>
            </div>
          ) : (
            <div className="selected-client-banner empty">
              Selecciona un cliente antes de agregar productos.
            </div>
          )}

          <div className="sale-grid">
            <div className="sale-products">
              <label className="sale-search">
                <Search size={17} />
                <input
                  placeholder="Buscar producto"
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                />
              </label>

              <div className="sale-product-list">
                {productosFiltrados.map((producto) => (
                    <div className="sale-product-row" key={producto.id}>
                      <div>
                        <strong>{producto.nombre}</strong>
                        <small>{producto.sku || producto.categoria || "Producto"}</small>
                      </div>
                      <div className="price-dots">
                        <button
                          aria-label="Agregar con precio minimo"
                          className="green"
                          onClick={() => agregarProducto(producto, "minimo")}
                          title="Precio minimo"
                          type="button"
                        />
                        <button
                          aria-label="Agregar con precio sugerido"
                          className="yellow"
                          onClick={() => agregarProducto(producto, "sugerido")}
                          title="Precio sugerido"
                          type="button"
                        />
                        <button
                          aria-label="Agregar con precio maximo"
                          className="red"
                          onClick={() => agregarProducto(producto, "maximo")}
                          title="Precio maximo"
                          type="button"
                        />
                      </div>
                    </div>
                ))}
              </div>
            </div>

            <div className="sale-ticket">
              <h3>Productos dejados</h3>
              {saleItems.map((item) => (
                <div
                  className={`sale-ticket-row ${
                    productosPrecioInvalido.some(
                      (invalidItem) => invalidItem.productoId === item.productoId
                    ) ||
                    productosCantidadInvalida.some(
                      (invalidItem) => invalidItem.productoId === item.productoId
                    )
                      ? "invalid-price"
                      : ""
                  }`}
                  key={item.productoId}
                >
                  <div>
                    <strong>{item.nombre}</strong>
                    <small>
                      Rango permitido: {money(item.minimo)} - {money(item.maximo)}
                    </small>
                    <div className="price-dots compact">
                      {["minimo", "sugerido", "maximo"].map((tipo) => (
                        <button
                          className={
                            tipo === "minimo"
                              ? "green"
                              : tipo === "sugerido"
                                ? "yellow"
                                : "red"
                          }
                          key={tipo}
                          onClick={() => cambiarPrecio(item, tipo)}
                          type="button"
                        />
                      ))}
                    </div>
                  </div>
                  <input
                    min="1"
                    type="number"
                    value={item.cantidad}
                    onChange={(e) =>
                      updateSaleItem(item.productoId, "cantidad", e.target.value)
                    }
                  />
                  <input
                    min={item.minimo}
                    max={item.maximo}
                    type="number"
                    value={item.precio}
                    onChange={(e) =>
                      updateSaleItem(item.productoId, "precio", e.target.value)
                    }
                  />
                  <strong>{money((Number(item.precio) || 0) * (Number(item.cantidad) || 0))}</strong>
                  <button onClick={() => eliminarProducto(item.productoId)} type="button">
                    <X size={16} />
                  </button>
                </div>
              ))}

              {productosPrecioInvalido.length > 0 && (
                <div className="route-card route-alert">
                  Hay productos con precio fuera del rango permitido. Corrige el
                  precio antes de guardar la factura.
                </div>
              )}

              {bloqueosVenta.length > 0 && (
                <div className="route-card route-alert">
                  <strong>Revisa la venta antes de guardar</strong>
                  <ul className="route-alert-list">
                    {bloqueosVenta.map((mensaje) => (
                      <li key={mensaje}>{mensaje}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="sale-payment-grid">
                <label>
                  Abono deuda anterior
                  <input
                    type="number"
                    value={pago.abonoDeudaAnterior}
                    onChange={(e) => updatePago("abonoDeudaAnterior", e.target.value)}
                  />
                </label>
                <label>
                  Pago productos hoy
                  <input
                    type="number"
                    value={pago.pagoProductosHoy}
                    onChange={(e) => updatePago("pagoProductosHoy", e.target.value)}
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  Observaciones
                  <textarea
                    rows="2"
                    value={pago.observaciones}
                    onChange={(e) => updatePago("observaciones", e.target.value)}
                  />
                </label>
              </div>

              <div className="sale-summary">
                <span>Deuda anterior</span>
                <strong>{money(resumenVenta.deudaAnterior)}</strong>
                <span>Total productos hoy</span>
                <strong>{money(resumenVenta.totalProductos)}</strong>
                <span>Fiado hoy</span>
                <strong>{money(resumenVenta.fiadoHoy)}</strong>
                <span>Total queda debiendo</span>
                <strong>{money(resumenVenta.deudaFinal)}</strong>
              </div>

              <button
                className="admin-button"
                disabled={saving || !selectedCliente || bloqueosVenta.length > 0}
                onClick={guardarFactura}
                type="button"
              >
                {saving ? "Guardando..." : "Guardar factura"}
              </button>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

export default function CarteristaPage() {
  return (
    <RoleGuard allowedRoles={["admin", "carterista", "ayudante"]}>
      <CarteristaContent />
    </RoleGuard>
  );
}
