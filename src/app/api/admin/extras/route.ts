import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const extras = await prisma.extra.findMany({
       orderBy: { createdAt: "desc" }
    });
    return NextResponse.json(extras);
  } catch (e) {
    return new NextResponse("Internal server error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const bypassEmails = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];
    
    if (!session || !session.user || !session.user.email) {
       return new NextResponse("Unauthorized", { status: 403 });
    }
    
    if (!bypassEmails.includes(session.user.email)) {
       const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
       if (!dbUser || dbUser.role?.toUpperCase() !== "ADMIN") {
          return new NextResponse("Unauthorized", { status: 403 });
       }
    }

    const json = await req.json();
    const extra = await prisma.extra.create({
       data: {
          name: json.name,
          description: json.description,
          pricePerDay: json.pricePerDay,
          type: json.type,
          active: json.active !== undefined ? json.active : true,
          imageUrl: json.imageUrl
       }
    });

    return NextResponse.json(extra);
  } catch (e) {
    return new NextResponse("Internal server error", { status: 500 });
  }
}
