import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Vakhán Center App",
  description: "Panel de entrenador y app de alumnos para Vakhán Center",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-vakhan-black text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
