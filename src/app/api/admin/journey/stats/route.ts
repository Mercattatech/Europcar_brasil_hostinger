import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const where: any = {};

    if (startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { ...where.createdAt, lte: end };
    }

    // Total sessions
    const totalSessions = await prisma.customerJourney.count({ where });

    // Count per step (how many reached each step)
    const [step1, step2, step3, step4, step5] = await Promise.all([
      prisma.customerJourney.count({ where: { ...where, currentStep: { gte: 1 } } }),
      prisma.customerJourney.count({ where: { ...where, currentStep: { gte: 2 } } }),
      prisma.customerJourney.count({ where: { ...where, currentStep: { gte: 3 } } }),
      prisma.customerJourney.count({ where: { ...where, currentStep: { gte: 4 } } }),
      prisma.customerJourney.count({ where: { ...where, currentStep: { gte: 5 } } }),
    ]);

    // Status counts
    const [completed, abandoned, inProgress] = await Promise.all([
      prisma.customerJourney.count({ where: { ...where, status: "COMPLETED" } }),
      prisma.customerJourney.count({ where: { ...where, status: "ABANDONED" } }),
      prisma.customerJourney.count({ where: { ...where, status: "IN_PROGRESS" } }),
    ]);

    // Top pickup stations (top 10)
    const allJourneys = await prisma.customerJourney.findMany({
      where: { ...where, pickupStationName: { not: null } },
      select: { pickupStationName: true, pickupStation: true },
    });

    const stationCounts: Record<string, { name: string; code: string; count: number }> = {};
    allJourneys.forEach((j) => {
      const key = j.pickupStation || j.pickupStationName || "Unknown";
      if (!stationCounts[key]) {
        stationCounts[key] = {
          name: j.pickupStationName || key,
          code: j.pickupStation || "",
          count: 0,
        };
      }
      stationCounts[key].count++;
    });

    const topStations = Object.values(stationCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Conversion rate
    const conversionRate = totalSessions > 0 ? ((completed / totalSessions) * 100).toFixed(1) : "0";

    // Abandonment by step
    const abandonedJourneys = await prisma.customerJourney.findMany({
      where: { ...where, status: { in: ["IN_PROGRESS", "ABANDONED"] } },
      select: { currentStep: true },
    });

    const abandonByStep: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    abandonedJourneys.forEach((j) => {
      if (j.currentStep >= 1 && j.currentStep <= 4) {
        abandonByStep[j.currentStep]++;
      }
    });

    // Today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySessions = await prisma.customerJourney.count({
      where: { createdAt: { gte: todayStart } },
    });
    const todayCompleted = await prisma.customerJourney.count({
      where: { createdAt: { gte: todayStart }, status: "COMPLETED" },
    });

    return NextResponse.json({
      funnel: {
        step1,
        step2,
        step3,
        step4,
        step5,
      },
      statusCounts: {
        completed,
        abandoned,
        inProgress,
      },
      topStations,
      conversionRate,
      abandonByStep,
      totalSessions,
      today: {
        sessions: todaySessions,
        completed: todayCompleted,
      },
    });
  } catch (error: any) {
    console.error("[Journey Stats Error]", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
