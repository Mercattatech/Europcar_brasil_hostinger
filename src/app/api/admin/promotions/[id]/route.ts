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

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) {
    return new NextResponse("Unauthorized", { status: 403 });
  }

  try {
    const json = await req.json();
    const promotion = await prisma.promotion.update({
       where: { id: params.id },
       data: {
          title: json.title,
          subtitle: json.subtitle,
          description: json.description,
          discountValue: json.discountValue,
          imageUrl: json.imageUrl,
          contractID: json.contractID,
          startDate: json.startDate ? new Date(json.startDate) : null,
          endDate: json.endDate ? new Date(json.endDate) : null,
          isActive: json.isActive,
          status: json.status
       }
    });

    return NextResponse.json(promotion);
  } catch (e: any) {
    console.error("Error updating promotion:", e);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) {
    return new NextResponse("Unauthorized", { status: 403 });
  }

  try {
    await prisma.promotion.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return new NextResponse("Internal server error", { status: 500 });
  }
}
