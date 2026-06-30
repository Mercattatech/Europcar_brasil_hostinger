"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * MaintenanceGuard — Componente que verifica se o site está em modo manutenção.
 * Se ativo, redireciona o visitante para a URL cadastrada no painel.
 * Rotas /painel e /api são excluídas para que o admin continue acessível.
 */
export default function MaintenanceGuard() {
   const pathname = usePathname();

   useEffect(() => {
      // Não redirecionar se estiver no painel ou em rotas de API
      if (pathname.startsWith("/painel") || pathname.startsWith("/api")) {
         return;
      }

      const checkMaintenance = async () => {
         try {
            const res = await fetch("/api/maintenance/status", { cache: "no-store" });
            const data = await res.json();

            if (data.maintenance && data.redirectUrl) {
               window.location.href = data.redirectUrl;
            }
         } catch (err) {
            // Em caso de erro, não bloqueia o site
            console.error("Maintenance check failed:", err);
         }
      };

      checkMaintenance();
   }, [pathname]);

   return null; // Componente invisível
}
