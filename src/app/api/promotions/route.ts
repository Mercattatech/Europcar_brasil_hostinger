import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
export const dynamic = 'force-dynamic';

// GET /api/promotions - Public API for active promotions
export async function GET() {
  try {
    const now = new Date();
    
    const promotions = await prisma.promotion.findMany({
      where: {
        isActive: true,
        status: "ACTIVE",
        OR: [
          // No date restrictions
          { startDate: null, endDate: null },
          // Started but no end
          { startDate: { lte: now }, endDate: null },
          // No start but not ended
          { startDate: null, endDate: { gte: now } },
          // Within date range
          { startDate: { lte: now }, endDate: { gte: now } },
        ]
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        subtitle: true,
        description: true,
        discountValue: true,
        imageUrl: true,
        contractID: true,
        startDate: true,
        endDate: true,
      }
    });

    return NextResponse.json(promotions);
  } catch (e: any) {
    console.error("Error fetching public promotions:", e);
    return NextResponse.json({ error: "Erro ao carregar promoções" }, { status: 500 });
  }
}
