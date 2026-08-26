import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const TAG_KEYS = [
   'google_analytics_id',
   'google_tag_manager_id',
   'custom_head_scripts',
   'custom_body_scripts',
];

// Force dynamic rendering — this route must query the DB at runtime
export const dynamic = 'force-dynamic';

// GET — Endpoint público para carregar as tags de tracking
// Usado pelo componente GoogleTags no layout
export async function GET() {
   try {
      const configs = await prisma.contentBlock.findMany({
         where: { key: { in: TAG_KEYS } }
      });

      const result: Record<string, string> = {};
      for (const key of TAG_KEYS) {
         const found = configs.find(c => c.key === key);
         result[key] = found?.value_ptBR || '';
      }

      return NextResponse.json(result, {
         headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
         }
      });
   } catch (error: any) {
      console.error('Tags public API error:', error?.message || error);
      // Return empty values so the component doesn't break
      const empty: Record<string, string> = {};
      TAG_KEYS.forEach(k => empty[k] = '');
      return NextResponse.json(empty);
   }
}

