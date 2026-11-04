import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthLinkForwarder from "@/components/AuthLinkForwarder";

export const metadata: Metadata = {
  title: "Lagerstyring",
  description: "Lagerbeholdning, plassering og utlån av eventutstyr",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body>
        <AuthLinkForwarder />
        {children}
      </body>
    </html>
  );
}
