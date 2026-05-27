import "./globals.css";

import Providers from "./Providers";

import Header from "./components/Header";
import WhatsappButton from "./components/WhatsappButton";
import PosButton from "./components/PosButton";

export const metadata = {
  title: "Mi Tienda",
  description: "Pedidos online por WhatsApp",
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
