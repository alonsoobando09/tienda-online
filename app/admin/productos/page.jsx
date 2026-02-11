"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, DollarSign, ShoppingCart, FileText } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminPanel() {
  const [stats, setStats] = useState({
    ventasHoy: 0,
    ingresosHoy: 0,
    clientes: 0,
    pagosPendientes: 0,
  });

  const [ventas, setVentas] = useState([]);

  useEffect(() => {
    // 🔹 Simulación de carga desde API / Firebase / Supabase
    setStats({
      ventasHoy: 32,
      ingresosHoy: 1850000,
      clientes: 120,
      pagosPendientes: 8,
    });

    setVentas([
      {
        id: 1,
        cliente: "Juan Pérez",
        total: 85000,
        estado: "Pagado",
      },
      {
        id: 2,
        cliente: "María Gómez",
        total: 120000,
        estado: "Pendiente",
      },
    ]);
  }, []);

  const cards = [
    {
      title: "Ventas Hoy",
      value: stats.ventasHoy,
      icon: ShoppingCart,
    },
    {
      title: "Ingresos Hoy",
      value: `$${stats.ingresosHoy.toLocaleString()}`,
      icon: DollarSign,
    },
    {
      title: "Clientes",
      value: stats.clientes,
      icon: Users,
    },
    {
      title: "Pagos Pendientes",
      value: stats.pagosPendientes,
      icon: FileText,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Panel Admin</h1>
        <div className="flex gap-2">
          <Button>Generar PDF</Button>
          <Button variant="outline">Cerrar sesión</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="rounded-2xl shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{card.title}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                  </div>
                  <Icon className="w-8 h-8 opacity-70" />
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Tabla ventas */}
      <Card className="rounded-2xl shadow">
        <CardContent className="p-4">
          <h2 className="text-xl font-semibold mb-4">Ventas recientes</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">Total</th>
                  <th className="text-left p-2">Estado</th>
                  <th className="text-right p-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{v.cliente}</td>
                    <td className="p-2">${v.total.toLocaleString()}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          v.estado === "Pagado"
                            ? "bg-green-100"
                            : "bg-yellow-100"
                        }`}
                      >
                        {v.estado}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="outline">
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
