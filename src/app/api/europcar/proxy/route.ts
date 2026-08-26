import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
export const dynamic = 'force-dynamic';

// Este Route Handler agirá como um BFF (Backend For Frontend),
// ocultando as credenciais (que devem vir do Prisma/XRSConfig) do navegador do cliente.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { xmlRequest } = body;

    // Em produção, nós buscaríamos as credenciais chamando o Prisma:
    // const config = await prisma.xRSConfig.findFirst();
    // if (!config) throw new Error("Credenciais não configuradas no CMS");
    
    // Para mock temporário de arquitetura:
    const mockConfig = {
      callerCode: 'DEMO_CODE',
      password: 'DEMO_PASSWORD'
    };

    const xrsResponse = await callXRS(xmlRequest, mockConfig);

    return NextResponse.json(xrsResponse);

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro interno no BFF XRS' },
      { status: 500 }
    );
  }
}
