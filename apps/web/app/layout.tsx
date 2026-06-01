import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pedidos de almuerzo",
  description: "Demo para recibir pedidos de restaurantes pequeños",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

