import Link from "next/link";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  MapPinned,
  PackageCheck,
  Route,
  ShieldCheck,
  Smartphone,
  Truck,
  Users,
} from "lucide-react";
import PwaInstallCard from "@/app/components/PwaInstallCard";
import RoleGuard from "@/app/components/RoleGuard";
import SignOutButton from "@/app/components/SignOutButton";
import { ROLES } from "@/lib/permissions";

const modules = [
  {
    title: "Administracion",
    description: "Dashboard, cartera, empleados, reportes, auditoria y permisos.",
    href: "/admin",
    icon: BarChart3,
  },
  {
    title: "Usuarios y empleados",
    description: "Crear correos, contraseñas, roles, rutas y permisos de acceso.",
    href: "/admin/empleados",
    icon: Users,
  },
  {
    title: "Bodega",
    description: "Compras, proveedores, inventario, despachos y recepciones.",
    href: "/admin/despachos",
    icon: Boxes,
  },
  {
    title: "Carterista",
    description: "Ruta del dia, clientes, facturas, gastos y ubicacion.",
    href: "/carterista",
    icon: Route,
  },
];

const capabilities = [
  { label: "Multiempresa aislada por empresa_id", icon: ShieldCheck },
  { label: "Tablet, celular y computador", icon: Smartphone },
  { label: "Clientes, rutas y cartera", icon: Users },
  { label: "Despachos y recepciones", icon: Truck },
  { label: "Inventario y kardex", icon: PackageCheck },
  { label: "Liquidaciones y reportes", icon: ClipboardList },
  { label: "GPS de carteristas", icon: MapPinned },
];

export const metadata = {
  title: "App operativa",
};

export default function OperationalAppPage() {
  return (
    <RoleGuard
      allowedRoles={[
        ROLES.SUPERADMIN,
        ROLES.ADMIN,
        ROLES.BODEGA,
        ROLES.CARTERISTA,
        ROLES.AYUDANTE,
      ]}
    >
      <main className="pc-app-gateway">
        <section className="pc-app-hero">
          <div>
            <p className="home-eyebrow">Proveedor Central App</p>
            <h1>Sistema operativo multiempresa</h1>
            <p>
              Una app interna para trabajar bodega, rutas, clientes, cartera,
              despachos, compras, inventario, GPS, liquidaciones y reportes desde
              computador, tablet o celular.
            </p>
            <div className="pc-app-actions">
              <Link className="home-button primary" href="/admin">
                Entrar administrador
              </Link>
              <Link className="home-button whatsapp" href="/carterista">
                Entrar carterista
              </Link>
              <SignOutButton className="pc-signout-button app" label="Cerrar sesion" />
            </div>
            <PwaInstallCard />
          </div>
          <div className="pc-app-device" aria-hidden="true">
            <span>PC</span>
            <strong>Ruta activa</strong>
            <small>Clientes · Stock · Cobros · GPS</small>
          </div>
        </section>

        <section className="pc-app-modules" aria-label="Modulos principales">
          {modules.map((module) => {
            const Icon = module.icon;

            return (
              <Link className="pc-app-module" href={module.href} key={module.title}>
                <Icon size={24} />
                <strong>{module.title}</strong>
                <span>{module.description}</span>
              </Link>
            );
          })}
        </section>

        <section className="pc-app-capabilities">
          {capabilities.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label}>
                <Icon size={18} />
                <span>{item.label}</span>
              </div>
            );
          })}
        </section>
      </main>
    </RoleGuard>
  );
}
