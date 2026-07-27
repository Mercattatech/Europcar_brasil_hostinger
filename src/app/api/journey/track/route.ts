import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId,
      userId,
      step,
      // Step 1 data
      pickupStation,
      pickupStationName,
      returnStation,
      returnStationName,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime,
      country,
      contractID,
      // Step 2 data
      selectedCar,
      selectedCarName,
      carPrice,
      // Step 3 data
      selectedExtras,
      // Step 4 data
      paymentMethod,
      // Step 5 data
      resNumber,
      status,
    } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    // Get user agent and IP
    const userAgent = req.headers.get("user-agent") || undefined;
    const forwarded = req.headers.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") || undefined;

    // Try to find existing journey for this session
    const existing = await prisma.customerJourney.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });

    // Build update data based on step
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (userId) updateData.userId = userId;
    if (userAgent) updateData.userAgent = userAgent;
    if (ipAddress) updateData.ipAddress = ipAddress;

    // Step 1: Search
    if (step >= 1) {
      if (pickupStation !== undefined) updateData.pickupStation = pickupStation;
      if (pickupStationName !== undefined) updateData.pickupStationName = pickupStationName;
      if (returnStation !== undefined) updateData.returnStation = returnStation;
      if (returnStationName !== undefined) updateData.returnStationName = returnStationName;
      if (pickupDate !== undefined) updateData.pickupDate = pickupDate;
      if (returnDate !== undefined) updateData.returnDate = returnDate;
      if (pickupTime !== undefined) updateData.pickupTime = pickupTime;
      if (returnTime !== undefined) updateData.returnTime = returnTime;
      if (country !== undefined) updateData.country = country;
      if (contractID !== undefined) updateData.contractID = contractID;
    }

    // Step 2: Vehicle Selection
    if (step >= 2) {
      if (selectedCar !== undefined) updateData.selectedCar = selectedCar;
      if (selectedCarName !== undefined) updateData.selectedCarName = selectedCarName;
      if (carPrice !== undefined) updateData.carPrice = carPrice;
    }

    // Step 3: Extras
    if (step >= 3) {
      if (selectedExtras !== undefined) updateData.selectedExtras = selectedExtras;
    }

    // Step 4: Checkout
    if (step >= 4) {
      if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    }

    // Step 5: Completed
    if (step >= 5) {
      if (resNumber !== undefined) updateData.resNumber = resNumber;
    }

    // Always update currentStep to the highest step reached
    if (step && (!existing || step > existing.currentStep)) {
      updateData.currentStep = step;
    }

    // Update status
    if (status === "COMPLETED") {
      updateData.status = "COMPLETED";
    } else if (status === "ABANDONED") {
      updateData.status = "ABANDONED";
      updateData.abandonedAt = `Etapa ${step}`;
    }

    let journey;

    if (existing) {
      journey = await prisma.customerJourney.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      journey = await prisma.customerJourney.create({
        data: {
          sessionId,
          userId: userId || undefined,
          currentStep: step || 1,
          status: status || "IN_PROGRESS",
          userAgent: userAgent || undefined,
          ipAddress: ipAddress || undefined,
          ...updateData,
        },
      });
    }

    return NextResponse.json({ success: true, journeyId: journey.id });
  } catch (error: any) {
    console.error("[Journey Track Error]", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
