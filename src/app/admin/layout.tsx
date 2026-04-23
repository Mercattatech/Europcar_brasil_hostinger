import "./cms.css"; // We'll add custom styles if needed, though Tailwind does the heavy lifting
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import Link from "next/link";
import prisma from "@/lib/prisma";
import AdminLoginForm from "@/components/auth/AdminLoginForm";

export default async function CMSLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.email) {
    return <AdminLoginForm />;
  }

  const bypassEmails = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com", "admin@mercatta.com.br"];
  
  if (bypassEmails.includes(session.user.email)) {
     // Force bypass for these admin emails unconditionally!
     // We skip DB check to ensure you never get blocked.
  } else {
    // Regular check DB directly to avoid stale JWT issues
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email as string }
    });

    if (!dbUser || dbUser.role?.toUpperCase() !== "ADMIN") {
      return <AdminLoginForm />;
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-gray-900 text-white flex flex-col pt-6 shadow-xl relative z-10">
        <div className="text-2xl font-bold mb-8 px-6 text-[#008d36] tracking-wide">
          Europcar<span className="text-white">CMS</span>
        </div>
        
        <nav className="flex-1 flex flex-col gap-2 px-4 overflow-y-auto pb-4">
           
           <div className="text-xs uppercase text-gray-400 font-bold mt-4 px-4 mb-1">New Features</div>
           
           <Link href="/admin/promotions" className="hover:bg-gray-800 px-4 py-2 rounded transition-colors font-medium">Promoções Home</Link>
           <Link href="/admin/extras" className="hover:bg-gray-800 px-4 py-2 rounded transition-colors font-medium">Extras & Proteções</Link>
           
           <div className="h-px bg-gray-700 my-2"></div>
           <h3 className="text-[10px] font-bold text-gray-500 mb-3 px-4 uppercase tracking-widest">System</h3>
        <ul className="space-y-2">
          <li>
            <Link href="/admin/users" className="block px-4 py-2 hover:bg-gray-800 hover:text-white rounded text-sm text-gray-400 font-medium">
              Controle de Usuários
            </Link>
          </li>
          <li>
            <Link href="/admin/config/cielo" className="block px-4 py-2 hover:bg-gray-800 hover:text-white rounded text-sm text-gray-400 font-medium">
              API Config (XRS/Cielo)
            </Link>
          </li>
          <li>
            <Link href="/admin/reservations" className="block px-4 py-2 hover:bg-gray-800 hover:text-white rounded text-sm text-gray-400 font-medium">
              Transações & Reservas
            </Link>
          </li>
          <li>
            <Link href="/admin/logs" className="block px-4 py-2 hover:bg-gray-800 hover:text-white rounded text-sm text-gray-400 font-medium">
              System Logs
            </Link>
          </li>
        </ul>
        </nav>

        <div className="p-4 border-t border-gray-800 mt-auto">
           <Link href="/" className="block text-center text-sm font-bold bg-gray-800 hover:bg-gray-700 w-full py-2 rounded transition-colors">Voltar ao site</Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative">
        <header className="bg-white border-b border-gray-200 h-16 px-8 flex items-center justify-between shrink-0">
          <h1 className="text-gray-900 font-bold">Painel Administrativo</h1>
          <div className="text-sm font-bold text-gray-500">Olá, {session.user?.name || session.user?.email}</div>
        </header>
        <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
          {children}
        </div>
      </main>
    </div>
  )
}
