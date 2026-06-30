import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET — Endpoint público para verificar status de manutenção
// Usado pelo middleware e pelo frontend
export async function GET() {
   try {
      const config = await prisma.maintenanceConfig.findFirst({
         where: { isActive: true },
         orderBy: { updatedAt: 'desc' }
      });

      if (!config) {
         return NextResponse.json({ maintenance: false });
      }

      // Se tem returnDate e já passou, desativa automaticamente
      if (config.returnDate && new Date(config.returnDate) <= new Date()) {
         await prisma.maintenanceConfig.update({
            where: { id: config.id },
            data: { isActive: false }
         });
         return NextResponse.json({ maintenance: false });
      }

      return NextResponse.json({
         maintenance: true,
         redirectUrl: config.redirectUrl,
         returnDate: config.returnDate,
         reason: config.reason,
      });
   } catch (error: any) {
      console.error('Maintenance status error:', error);
      // Em caso de erro, não bloqueia o site
      return NextResponse.json({ maintenance: false });
   }
}
