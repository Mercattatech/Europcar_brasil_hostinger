import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Europcar Brasil - Aluguel de Carros",
  description: "Plataforma oficial Europcar Brasil para aluguel e reservas de carros.",
};

import AuthProvider from "@/components/auth/AuthProvider";
import Footer from "@/components/Footer";
import MaintenanceGuard from "@/components/MaintenanceGuard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>
          <MaintenanceGuard />
          {children}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
