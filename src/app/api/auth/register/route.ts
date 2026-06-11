import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { name, email, password, phone, city, cpf } = await req.json();

    if (!name || !email || !password) {
      return new NextResponse("Dados insuficientes", { status: 400 });
    }

    const exist = await prisma.user.findUnique({ where: { email } });
    if (exist) {
      return new NextResponse("E-mail já está em uso", { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // New users are ALWAYS USER — never ADMIN
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "USER",
        phone: phone || null,
        city: city || null,
        cpf: cpf || null,
      },
    });

    return NextResponse.json({ id: user.id, name: user.name, email: user.email });
  } catch (error: any) {
    console.error("ERRO NO CADASTRO", error);
    return new NextResponse("Erro interno no servidor", { status: 500 });
  }
}
