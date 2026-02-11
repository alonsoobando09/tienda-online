import "./globals.css";
import { CartProvider } from "./context/CartContext";
import WhatsappButton from "./components/WhatsappButton";
import Header from "./components/Header";

export const metadata = {
  title: "Mi Tienda",
  description: "Pedidos online por WhatsApp",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <CartProvider>

          <Header />

          {children}

          <WhatsappButton />

        </CartProvider>
      </body>
    </html>
  );
}
