"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Calculator,
  ClipboardList,
  FileText,
  Home,
  HandCoins,
  Map,
  Package,
  PackageCheck,
  PackageOpen,
  Receipt,
  ShoppingCart,
  UserRoundPlus,
  Users,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/productos", label: "Productos", icon: Package },
  { href: "/admin/clientes", label: "Clientes", icon: UserRoundPlus },
  { href: "/admin/rutas", label: "Rutas", icon: Map },
  { href: "/admin/despachos", label: "Despachos", icon: PackageCheck },
  { href: "/admin/recepciones", label: "Recepcion", icon: PackageOpen },
  { href: "/admin/liquidaciones", label: "Liquidacion", icon: HandCoins },
  { href: "/admin/reportes", label: "Reportes", icon: ClipboardList },
  { href: "/admin/inventario", label: "Inventario", icon: Boxes },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/admin/facturas", label: "Facturas", icon: FileText },
  { href: "/admin/ventas", label: "Ventas", icon: Receipt },
  { href: "/admin/contabilidad", label: "Contable", icon: Calculator },
  { href: "/admin/empleados", label: "Empleados", icon: Users },
];

export default function AdminShell({ title, subtitle, actions, children }) {
  const pathname = usePathname();

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
          {navItems.map((item) => {
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

        <Link className="admin-store-link" href="/">
          <Home size={17} />
          Ver tienda
        </Link>
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
