"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import AdminLoginForm from "@/components/auth/AdminLoginForm";

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com", "admin@mercatta.com.br"];

const sidebarLinks = [
   { href: "/painel", label: "Dashboard", icon: "📊" },
   { href: "/painel/usuarios", label: "Gestão de Usuários", icon: "👥" },
   { href: "/painel/reservas", label: "Reservas", icon: "📋" },
   { href: "/painel/comissoes", label: "Comissões", icon: "💰" },
   { href: "/painel/promocoes", label: "Promoções", icon: "🏷️" },
   { href: "/painel/extras", label: "Extras & Proteções", icon: "🛡️" },
   { href: "/painel/config", label: "Config Pagamento", icon: "💳" },
   { href: "/painel/config-email", label: "E-mails Automáticos", icon: "✉️" },
   { href: "/painel/manutencao", label: "Modo Manutenção", icon: "🚧" },
   { href: "/painel/logs-xrs", label: "XRS Debugger", icon: "🔍" },
   { href: "/painel/logs", label: "Logs Cielo", icon: "📄" },
];

export default function PainelLayout({ children }: { children: React.ReactNode }) {
   const { data: session, status } = useSession();
   const pathname = usePathname();
   const [sidebarOpen, setSidebarOpen] = useState(true);
   const [showLoginModal, setShowLoginModal] = useState(false);
   const [authorized, setAuthorized] = useState(false);
   const [checking, setChecking] = useState(true);

   useEffect(() => {
      if (status === "loading") return;
      if (!session?.user?.email) {
         setChecking(false);
         return;
      }
      // Check admin
      if (ADMIN_EMAILS.includes(session.user.email)) {
         setAuthorized(true);
         setChecking(false);
         return;
      }
      if ((session.user as any).role === "ADMIN") {
         setAuthorized(true);
         setChecking(false);
         return;
      }
      setChecking(false);
   }, [session, status]);

   if (status === "loading" || checking) {
      return (
         <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="text-center">
               <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
               <p className="text-gray-400 font-medium">Verificando acesso...</p>
            </div>
         </div>
      );
   }

   if (!session?.user) {
      return <AdminLoginForm />;
   }

   if (!authorized) {
      return (
         <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="bg-gray-900 border border-red-900/50 rounded-2xl p-10 text-center max-w-md w-full shadow-2xl">
               <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path>
                  </svg>
               </div>
               <h1 className="text-2xl font-black text-white mb-2">Acesso Negado</h1>
               <p className="text-gray-400 text-sm mb-4">Sua conta ({session.user.email}) não possui permissão de administrador.</p>
               <button onClick={() => signOut({ callbackUrl: "/" })} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                  Sair
               </button>
            </div>
         </div>
      );
   }

   return (
      <div className="flex h-screen bg-gray-950 overflow-hidden">
         {/* Sidebar */}
         <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-300 shrink-0`}>
            {/* Logo */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
               {sidebarOpen && (
                  <Link href="/" className="flex items-center gap-2">
                     <div className="bg-green-600 px-2 py-1 rounded">
                        <img src="/logo.jpg" alt="Europcar" className="h-6 object-contain" />
                     </div>
                  </Link>
               )}
               <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={sidebarOpen ? "M11 19l-7-7 7-7m8 14l-7-7 7-7" : "M13 5l7 7-7 7M5 5l7 7-7 7"}></path>
                  </svg>
               </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
               {sidebarOpen && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-3 mb-3">Menu Principal</p>}
               {sidebarLinks.map(link => {
                  const isActive = pathname === link.href;
                  return (
                     <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                           isActive
                              ? "bg-green-600/15 text-green-500 border border-green-600/30"
                              : "text-gray-400 hover:text-white hover:bg-gray-800/80"
                        }`}
                     >
                        <span className="text-lg shrink-0">{link.icon}</span>
                        {sidebarOpen && <span>{link.label}</span>}
                     </Link>
                  );
               })}

            </nav>

            {/* User Info */}
            <div className="p-3 border-t border-gray-800">
               <div className={`flex items-center ${sidebarOpen ? 'gap-3' : 'justify-center'} px-2 py-2`}>
                  <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                     {(session.user.name || session.user.email || "A")[0].toUpperCase()}
                  </div>
                  {sidebarOpen && (
                     <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{session.user.name || "Admin"}</p>
                        <p className="text-[11px] text-gray-500 truncate">{session.user.email}</p>
                     </div>
                  )}
               </div>
               {sidebarOpen && (
                  <button onClick={() => signOut({ callbackUrl: "/" })} className="w-full mt-2 text-xs font-bold text-gray-500 hover:text-red-400 py-2 rounded-lg hover:bg-gray-800 transition-all">
                     Sair da conta
                  </button>
               )}
            </div>
         </aside>

         {/* Main Content */}
         <main className="flex-1 flex flex-col overflow-hidden">
            {/* Top Bar */}
            <header className="h-16 bg-gray-900/50 backdrop-blur-xl border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
               <div className="flex items-center gap-3">
                  <h1 className="text-white font-bold text-lg">Painel Administrativo</h1>
                  <span className="text-[10px] bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase">Admin</span>
               </div>
               <div className="flex items-center gap-4">
                  <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors font-medium" target="_blank">
                     Ver site →
                  </Link>
               </div>
            </header>

            {/* Page Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-950">
               {children}
            </div>
         </main>
      </div>
   );
}
