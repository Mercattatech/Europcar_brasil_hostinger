import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];

async function checkAdmin() {
   const session = await getServerSession(authOptions);
   if (!session?.user?.email) return false;
   if (ADMIN_EMAILS.includes(session.user.email)) return true;
   const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
   return dbUser?.role === 'ADMIN';
}

export async function GET() {
  try {
    const promotions = await prisma.promotion.findMany({
       orderBy: { createdAt: "desc" }
    });
    return NextResponse.json(promotions);
  } catch (e) {
    return new NextResponse("Internal server error", { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await checkAdmin())) {
    return new NextResponse("Unauthorized", { status: 403 });
  }

  try {
    const json = await req.json();
    const promotion = await prisma.promotion.create({
       data: {
          title: json.title,
          subtitle: json.subtitle || null,
          description: json.description,
          discountValue: json.discountValue,
          imageUrl: json.imageUrl,
          contractID: json.contractID || null,
          startDate: json.startDate ? new Date(json.startDate) : null,
          endDate: json.endDate ? new Date(json.endDate) : null,
          isActive: json.isActive !== undefined ? json.isActive : true,
          status: json.status || "ACTIVE"
       }
    });

    return NextResponse.json(promotion);
  } catch (e: any) {
    console.error("Error creating promotion:", e);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
