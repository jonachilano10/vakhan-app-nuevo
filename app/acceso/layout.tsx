import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceso de alumno | Vakhán",
  referrer: "no-referrer",
};

export default function AccessLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
