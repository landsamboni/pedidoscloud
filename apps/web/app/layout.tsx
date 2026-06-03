import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Self-hosted at build time by next/font — no external request at runtime.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PedidosCloud",
    template: "%s · PedidosCloud",
  },
  description: "Recibe y gestiona los pedidos de tu restaurante desde un enlace de WhatsApp.",
  applicationName: "PedidosCloud",
};

export const viewport: Viewport = {
  themeColor: "#0d9488", // teal-600 — matches the brand and mobile address bar
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}

