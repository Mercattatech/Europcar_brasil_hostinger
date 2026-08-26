"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * MaintenanceGuard — Fallback client-side que verifica modo manutenção.
 * O middleware server-side cuida do redirecionamento principal.
 * Este componente garante redirecionamento em navegações SPA (client-side).
 */
export default function MaintenanceGuard() {
   const pathname = usePathname();
   const [redirecting, setRedirecting] = useState(false);

   useEffect(() => {
      // Não redirecionar se estiver no painel ou em rotas de API
      if (pathname.startsWith("/painel") || pathname.startsWith("/api")) {
         return;
      }

      let cancelled = false;

      const checkMaintenance = async () => {
         try {
            const res = await fetch(`/api/maintenance/status?_t=${Date.now()}`, {
               cache: "no-store",
               headers: { "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache" },
            });
            const data = await res.json();

            if (!cancelled && data.maintenance && data.redirectUrl) {
               setRedirecting(true);
               // Pequeno delay para mostrar indicador visual
               setTimeout(() => {
                  window.location.replace(data.redirectUrl);
               }, 100);
            }
         } catch (err) {
            // Em caso de erro, não bloqueia o site
            console.error("Maintenance check failed:", err);
         }
      };

      checkMaintenance();

      return () => {
         cancelled = true;
      };
   }, [pathname]);

   // Se estiver redirecionando, mostra tela de loading
   if (redirecting) {
      return (
         <div
            style={{
               position: "fixed",
               inset: 0,
               zIndex: 99999,
               background: "#1a1a1a",
               display: "flex",
               alignItems: "center",
               justifyContent: "center",
               flexDirection: "column",
               gap: "16px",
            }}
         >
            <div
               style={{
                  width: 40,
                  height: 40,
                  border: "4px solid #008d36",
                  borderTop: "4px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
               }}
            />
            <p style={{ color: "#999", fontSize: 14, fontFamily: "Inter, sans-serif" }}>
               Redirecionando...
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
         </div>
      );
   }

   return null;
}
