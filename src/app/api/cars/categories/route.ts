import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Cache responses for 1 hour to prevent overloading the database
export const revalidate = 3600;

export async function GET() {
  try {
    const overrides = await (prisma as any).carCategoryOverride.findMany();
    return NextResponse.json(overrides, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error: any) {
    console.error("Car categories GET error:", error.message);
    return NextResponse.json([]);
  }
}
