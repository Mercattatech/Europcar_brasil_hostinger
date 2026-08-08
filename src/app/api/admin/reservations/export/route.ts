import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];

async function checkAdmin() {
   const session = await getServerSession(authOptions);
   if (!session?.user?.email) return false;
   if (ADMIN_EMAILS.includes(session.user.email)) return true;
   const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
   return dbUser?.role === 'ADMIN';
}

const OP_STATUS_LABELS: Record<string, string> = {
   R: "On Request",
   S: "Sold",
   CF: "Confirmed",
   CC: "Cancelled",
   CP: "Cancelled Prepaid",
   CO: "Checked Out",
   TD: "Turn Down",
   NS: "No Show",
};

const STATUS_LABELS: Record<string, string> = {
   CONFIRMED_PREPAID: "Pago Online",
   PENDING_PIX: "PIX Pendente",
   CONFIRMED_NON_PREPAID: "Pagar no Balcão",
   CANCELLED: "Cancelada",
};

function formatDateBR(dateStr?: string): string {
   if (!dateStr || dateStr.length < 8) return "";
   return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
}

function formatTimeBR(timeStr?: string): string {
   if (!timeStr || timeStr.length < 4) return "";
   return `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`;
}

function escapeCSV(val: any): string {
   if (val === null || val === undefined) return "";
   let str = String(val);
   // Neutralize leading =, +, -, @ to prevent CSV/formula injection when opened in Excel
   if (/^[=+\-@]/.test(str)) str = `'${str}`;
   if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
   }
   return str;
}

export async function GET(req: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const { searchParams } = new URL(req.url);
      const type = searchParams.get('type') || 'operational'; // operational | financial
      const opStatusFilter = searchParams.get('operationalStatus');
      const statusFilter = searchParams.get('status');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      // Build where clause
      const where: any = {};

      if (statusFilter && statusFilter !== 'ALL') {
         where.status = statusFilter;
      }
      if (opStatusFilter && opStatusFilter !== 'ALL') {
         where.operationalStatus = opStatusFilter;
      }
      if (startDate || endDate) {
         where.createdAt = {};
         if (startDate) where.createdAt.gte = new Date(startDate);
         if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            where.createdAt.lte = end;
         }
      }

      const reservations = await prisma.localReservation.findMany({
         where,
         orderBy: { createdAt: 'desc' },
      });

      let csv = "";

      if (type === "financial") {
         // RELATÓRIO FINANCEIRO
         const headers = [
            "Código Reserva",
            "Data Reserva",
            "Horário Reserva",
            "Data Retirada",
            "Horário Retirada",
            "Data Devolução",
            "Horário Devolução",
            "Valor Net (EUR)",
            "Comissão",
            "Valor Total (BRL)",
            "Valor Pago Previamente",
            "Valor Pago Balcão",
            "Tipo Pagamento",
            "Câmbio",
            "Moeda",
            "País Retirada",
            "Cidade Retirada",
            "Estação Retirada",
            "País Devolução",
            "Cidade Devolução",
            "Estação Devolução",
            "Categoria Veículo",
            "Nome Cliente",
            "Telefone",
            "Email",
            "CPF",
            "Código Desconto",
            "CID",
            "Status Operacional",
            "Status Pagamento",
         ];

         csv = headers.join(",") + "\n";

         for (const res of reservations) {
            let parsed: any = {};
            try {
               parsed = typeof res.customerData === "string" ? JSON.parse(res.customerData) : res.customerData;
            } catch (e) {}

            const booking = parsed?.booking || {};
            const car = booking?.car || {};
            const isPrepaid = res.status === "CONFIRMED_PREPAID";
            const totalBRL = res.amountInCents
               ? (res.amountInCents / 100).toFixed(2)
               : car?.totalRateInBookingCurrency
               ? parseFloat(car.totalRateInBookingCurrency).toFixed(2)
               : "";
            const totalEUR = car?.totalRateEstimate
               ? parseFloat(car.totalRateEstimate).toFixed(2)
               : "";

            const row = [
               res.resNumber || "",
               new Date(res.createdAt).toLocaleDateString("pt-BR"),
               new Date(res.createdAt).toLocaleTimeString("pt-BR"),
               formatDateBR(booking?.pickupDate),
               formatTimeBR(booking?.pickupTime),
               formatDateBR(booking?.returnDate),
               formatTimeBR(booking?.returnTime),
               totalEUR,
               "", // Comissão - a ser preenchido manualmente se necessário
               totalBRL,
               isPrepaid ? totalBRL : "",
               !isPrepaid && res.status !== "CANCELLED" ? totalBRL : "",
               STATUS_LABELS[res.status] || res.status,
               car?.exchangeRate ? parseFloat(car.exchangeRate).toFixed(4) : "",
               car?.exchangeRate ? "EUR/BRL" : "",
               booking?.country || "BR",
               booking?.pickupCity || "",
               booking?.pickupStation || "",
               booking?.country || "BR",
               booking?.returnCity || "",
               booking?.returnStation || booking?.pickupStation || "",
               car?.carCategorySample || car?.carCategoryName || car?.carCategoryCode || "",
               `${parsed?.nome || ""} ${parsed?.sobrenome || ""}`.trim(),
               parsed?.telefone || "",
               parsed?.email || "",
               parsed?.cpf || "",
               parsed?.contractID || booking?.contractID || "",
               parsed?.customer?.loyaltyProgramId || parsed?.loyaltyProgramId || "",
               OP_STATUS_LABELS[(res as any).operationalStatus] || (res as any).operationalStatus || "R",
               STATUS_LABELS[res.status] || res.status,
            ];

            csv += row.map(escapeCSV).join(",") + "\n";
         }
      } else {
         // RELATÓRIO OPERACIONAL
         const headers = [
            "Código Reserva",
            "Status Operacional",
            "Código Status",
            "Status Pagamento",
            "Data Criação",
            "Data Retirada",
            "Data Devolução",
            "Dias",
            "Nome Cliente",
            "Email",
            "CPF",
            "Telefone",
            "Veículo",
            "Categoria",
            "Estação Retirada",
            "Estação Devolução",
            "Valor (BRL)",
         ];

         csv = headers.join(",") + "\n";

         for (const res of reservations) {
            let parsed: any = {};
            try {
               parsed = typeof res.customerData === "string" ? JSON.parse(res.customerData) : res.customerData;
            } catch (e) {}

            const booking = parsed?.booking || {};
            const car = booking?.car || {};
            const opStatus = (res as any).operationalStatus || "R";

            const row = [
               res.resNumber || "",
               OP_STATUS_LABELS[opStatus] || opStatus,
               opStatus,
               STATUS_LABELS[res.status] || res.status,
               new Date(res.createdAt).toLocaleDateString("pt-BR") + " " + new Date(res.createdAt).toLocaleTimeString("pt-BR"),
               formatDateBR(booking?.pickupDate) + (booking?.pickupTime ? " " + formatTimeBR(booking.pickupTime) : ""),
               formatDateBR(booking?.returnDate) + (booking?.returnTime ? " " + formatTimeBR(booking.returnTime) : ""),
               booking?.days || "",
               `${parsed?.nome || ""} ${parsed?.sobrenome || ""}`.trim(),
               parsed?.email || "",
               parsed?.cpf || "",
               parsed?.telefone || "",
               car?.carCategorySample || car?.carCategoryName || "",
               car?.carCategoryCode || "",
               booking?.pickupStation || "",
               booking?.returnStation || booking?.pickupStation || "",
               res.amountInCents
                  ? (res.amountInCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                  : "",
            ];

            csv += row.map(escapeCSV).join(",") + "\n";
         }
      }

      // BOM for Excel compatibility with UTF-8
      const bom = "\uFEFF";
      const fileName = type === "financial"
         ? `relatorio_financeiro_${new Date().toISOString().slice(0, 10)}.csv`
         : `relatorio_operacional_${new Date().toISOString().slice(0, 10)}.csv`;

      return new Response(bom + csv, {
         headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${fileName}"`,
         },
      });
   } catch (error: any) {
      console.error("Error exporting reservations:", error);
      return NextResponse.json({ error: "Erro ao exportar" }, { status: 500 });
   }
}
