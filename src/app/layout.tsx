import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Europcar Brasil - Aluguel de Carros",
  description: "Plataforma oficial Europcar Brasil para aluguel e reservas de carros.",
  icons: {
    icon: [
      { url: "https://www.europcar.com/favicon.ico", sizes: "any" },
      { url: "https://www.europcar.com/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "https://www.europcar.com/apple-touch-icon.png",
  },
};

import AuthProvider from "@/components/auth/AuthProvider";
import Footer from "@/components/Footer";
import MaintenanceGuard from "@/components/MaintenanceGuard";
import GoogleTags from "@/components/GoogleTags";
import AIChatWidget from "@/components/chat/AIChatWidget";

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
          <GoogleTags />
          {children}
          <Footer />
          <AIChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
