import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware que intercepta requisições ANTES da renderização.
 * Verifica se o site está em modo manutenção e redireciona se necessário.
 * Rotas do painel, API, assets estáticos e next internals são excluídas.
 */
export async function middleware(request: NextRequest) {
   const { pathname } = request.nextUrl;

   // Ignorar rotas que não devem ser redirecionadas
   if (
      pathname.startsWith('/painel') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      pathname.includes('.')
   ) {
      return NextResponse.next();
   }

   try {
      // Construir URL absoluta para a API de status
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      const host = request.headers.get('host') || request.nextUrl.host;
      // Cache-bust: adicionar timestamp para garantir que nunca use cache
      const statusUrl = `${protocol}://${host}/api/maintenance/status?_t=${Date.now()}`;

      const res = await fetch(statusUrl, {
         method: 'GET',
         cache: 'no-store',
         headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
         },
      });

      if (res.ok) {
         const data = await res.json();
         if (data.maintenance && data.redirectUrl) {
            // Redirect 307 (temporário) para o URL cadastrado
            return NextResponse.redirect(data.redirectUrl, 307);
         }
      }
   } catch (error) {
      // Em caso de erro, não bloqueia o site — deixa passar
      console.error('Maintenance middleware error:', error);
   }

   return NextResponse.next();
}

export const config = {
   matcher: [
      /*
       * Match all request paths except:
       * - api (API routes)
       * - painel (admin panel)
       * - _next/static (static files)
       * - _next/image (image optimization)
       * - favicon.ico (favicon)
       * - Files with extensions (static assets)
       */
      '/((?!api|painel|_next/static|_next/image|favicon.ico).*)',
   ],
};
