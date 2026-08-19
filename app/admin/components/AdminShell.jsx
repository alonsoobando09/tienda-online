"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bug,
  Boxes,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  HandCoins,
  History,
  Map,
  Package,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { canAccessRole } from "@/lib/permissions";
import SignOutButton from "@/app/components/SignOutButton";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3, roles: ["admin"] },
  { href: "/admin/productos", label: "Productos", icon: Package, roles: ["admin"] },
  { href: "/admin/proveedores", label: "Proveedores", icon: Truck, roles: ["admin"] },
  { href: "/admin/clientes", label: "Clientes", icon: UserRoundPlus, roles: ["admin"] },
  { href: "/admin/cartera", label: "Cartera", icon: CreditCard, roles: ["admin"] },
  { href: "/admin/rutas", label: "Rutas", icon: Map, roles: ["admin"] },
  { href: "/admin/gestiones", label: "Gestiones", icon: ClipboardCheck, roles: ["admin"] },
  { href: "/admin/mapa", label: "Mapa", icon: Map, roles: ["admin"] },
  {
    href: "/admin/autorizaciones",
    label: "Autorizaciones",
    icon: ShieldCheck,
    roles: ["admin"],
  },
  {
    href: "/admin/despachos",
    label: "Despachos",
    icon: PackageCheck,
    roles: ["admin", "bodega"],
  },
  {
    href: "/admin/compras",
    label: "Compras",
    icon: PackagePlus,
    roles: ["admin", "bodega"],
  },
  {
    href: "/admin/recepciones",
    label: "Recepcion",
    icon: PackageOpen,
    roles: ["admin", "bodega"],
  },
  { href: "/admin/liquidaciones", label: "Liquidacion", icon: HandCoins, roles: ["admin"] },
  { href: "/admin/reportes", label: "Reportes", icon: ClipboardList, roles: ["admin"] },
  { href: "/admin/auditoria", label: "Auditoria", icon: History, roles: ["admin"] },
  { href: "/admin/errores", label: "Errores", icon: Bug, roles: ["admin"] },
  { href: "/admin/cuentas-pagar", label: "Por pagar", icon: CreditCard, roles: ["admin"] },
  { href: "/admin/inventario", label: "Inventario", icon: Boxes, roles: ["admin", "bodega"] },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart, roles: ["admin"] },
  { href: "/admin/facturas", label: "Facturas", icon: FileText, roles: ["admin"] },
  { href: "/admin/ventas", label: "Ventas", icon: Receipt, roles: ["admin"] },
  { href: "/admin/contabilidad", label: "Contable", icon: Calculator, roles: ["admin"] },
  { href: "/admin/empleados", label: "Empleados", icon: Users, roles: ["admin"] },
];

export default function AdminShell({ title, subtitle, actions, children }) {
  const pathname = usePathname();
  const [role] = useState(() => {
    if (typeof window === "undefined") return "admin";
    return localStorage.getItem("userRole") || "admin";
  });

  const visibleNavItems = navItems.filter((item) => canAccessRole(role, item.roles));

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-logo-mark">PC</div>
          <div>
            <strong>Proveedor Central</strong>
            <span>Panel operativo</span>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Administración">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/admin"
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <Link
                className={`admin-nav-item ${active ? "active" : ""}`}
                href={item.href}
                key={item.href}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <SignOutButton className="admin-store-link as-button" label="Cerrar sesion" />
      </aside>

      <section className="admin-content">
        <header className="admin-page-header admin-topbar">
          <div>
            <p className="admin-eyebrow">Administración</p>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="admin-actions">{actions}</div>}
        </header>

        {children}
      </section>
    </div>
  );
}
