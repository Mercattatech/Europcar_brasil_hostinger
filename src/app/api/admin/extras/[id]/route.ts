import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/checkAdmin";
import prisma from "@/lib/prisma";
export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await checkAdmin())) {
       return new NextResponse("Unauthorized", { status: 403 });
    }

    const json = await req.json();
    const extra = await prisma.extra.update({
       where: { id: params.id },
       data: {
          name: json.name,
          description: json.description,
          pricePerDay: json.pricePerDay,
          type: json.type,
          active: json.active,
          imageUrl: json.imageUrl
       }
    });

    return NextResponse.json(extra);
  } catch (e) {
    return new NextResponse("Internal server error", { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await checkAdmin())) {
       return new NextResponse("Unauthorized", { status: 403 });
    }

    await prisma.extra.delete({
       where: { id: params.id }
    });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return new NextResponse("Internal server error", { status: 500 });
  }
}
