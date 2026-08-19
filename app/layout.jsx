import "./globals.css";

import Providers from "./Providers";

import Header from "./components/Header";
import WhatsappButton from "./components/WhatsappButton";
import PosButton from "./components/PosButton";

export const metadata = {
  title: {
    default: "Proveedor Central",
    template: "%s | Proveedor Central",
  },
  description:
    "Tienda virtual y sistema operativo multiempresa para bodega, rutas, cartera, inventario y despachos.",
  manifest: "/manifest.webmanifest",
  applicationName: "Proveedor Central",
  appleWebApp: {
    capable: true,
    title: "Proveedor Central",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#062819",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          <Header />
          <main>
            {children}
          </main>
          <WhatsappButton />
          <PosButton />
        </Providers>
      </body>
    </html>
  );
}
