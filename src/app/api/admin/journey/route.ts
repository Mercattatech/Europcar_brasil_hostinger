import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const status = searchParams.get("status") || "";
    const step = searchParams.get("step") || "";
    const station = searchParams.get("station") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const search = searchParams.get("search") || "";

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (step) {
      where.currentStep = parseInt(step);
    }

    if (station) {
      where.OR = [
        { pickupStation: { contains: station, mode: "insensitive" } },
        { pickupStationName: { contains: station, mode: "insensitive" } },
      ];
    }

    if (startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { ...where.createdAt, lte: end };
    }

    if (search) {
      where.OR = [
        ...(where.OR || []),
        { pickupStationName: { contains: search, mode: "insensitive" } },
        { selectedCarName: { contains: search, mode: "insensitive" } },
        { resNumber: { contains: search, mode: "insensitive" } },
        { sessionId: { contains: search, mode: "insensitive" } },
      ];
    }

    const [journeys, total] = await Promise.all([
      prisma.customerJourney.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customerJourney.count({ where }),
    ]);

    return NextResponse.json({
      journeys,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("[Journey List Error]", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
