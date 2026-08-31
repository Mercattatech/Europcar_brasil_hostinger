import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { executeXRSBooking } from '@/lib/europcar/bookXRS';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/reservas/reenviar-xrs
 *
 * Reenvia uma reserva ao GreenWay (Europcar XRS) manualmente.
 * Util quando o pagamento foi aprovado na Cielo mas o bookReservation
 * falhou (rateId expirado, timeout, erro de rede, etc.).
 *
 * NAO altera nenhuma estrutura de pagamento -- apenas chama
 * o executeXRSBooking() com os dados ja salvos no banco local.
 *
 * Body: { reservationId: string }
 */
export async function POST(request: Request) {
  try {
    // -- Autenticacao: apenas admins podem reenviar ao XRS --
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
    }
    const userRole = (session.user as any).role;
    if (userRole !== 'ADMIN' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    const body = await request.json();
    const { reservationId } = body;

    if (!reservationId) {
      return NextResponse.json({ error: 'reservationId e obrigatorio.' }, { status: 400 });
    }

    // -- Buscar reserva no banco local --
    const reservaLocal = await prisma.localReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservaLocal) {
      return NextResponse.json({ error: 'Reserva nao encontrada.' }, { status: 404 });
    }

    // -- Evitar duplo reenvio se ja tem resNumber valido --
    // Se ja existe um resNumber real (nao vazio, nao igual ao merchantOrderId),
    // nao reenviar para nao criar reserva duplicada no GreenWay.
    if (
      reservaLocal.resNumber &&
      reservaLocal.resNumber !== reservaLocal.merchantOrderId &&
      reservaLocal.resNumber.length > 5
    ) {
      return NextResponse.json({
        success: false,
        error: `Reserva ja possui resNumber no GreenWay: ${reservaLocal.resNumber}. Reenvio cancelado para evitar duplicata.`,
        resNumber: reservaLocal.resNumber,
      }, { status: 409 });
    }

    // -- Parsear dados salvos no banco --
    let parsedData: any = {};
    try {
      parsedData = typeof reservaLocal.customerData === 'string'
        ? JSON.parse(reservaLocal.customerData as string)
        : (reservaLocal.customerData || {});
    } catch (e) {
      return NextResponse.json({ error: 'Falha ao parsear customerData da reserva.' }, { status: 500 });
    }

    const bookingData = parsedData.booking;
    if (!bookingData) {
      return NextResponse.json({ error: 'Dados de reserva (booking) nao encontrados no registro salvo.' }, { status: 400 });
    }

    // -- Determinar o metodo de pagamento original --
    // Usa o paymentMethod persistido (novo campo) ou infere pelo status do banco
    const paymentMethod =
      parsedData.paymentMethod ||
      (reservaLocal.status === 'PENDING_PIX' ? 'PIX' :
       reservaLocal.status === 'CONFIRMED_NON_PREPAID' ? 'BALCAO' : 'PIX');

    console.log(`[reenviar-xrs] Admin ${session.user.email} reenviando reserva ${reservaLocal.merchantOrderId} ao GreenWay | metodo: ${paymentMethod}`);

    // -- Chamar executeXRSBooking -- faz refresh de rateId via getQuote --
    // O bookXRS.ts ja renova o rateId internamente antes do bookReservation,
    // entao mesmo que o rateId original esteja expirado, o reenvio vai funcionar.
    let europcarResNumber: string | null = null;
    let isOnRequest = false;
    let onRequestItems: any[] = [];

    try {
      const result = await executeXRSBooking({
        bookingData,
        customerData: parsedData,
        paymentData: {
          method: paymentMethod,
          amountInCents: reservaLocal.amountInCents,
          merchantOrderId: reservaLocal.merchantOrderId,
        },
        xrsEquipment: bookingData.xrsEquipment || parsedData.xrsEquipment || [],
        xrsInsurances: bookingData.xrsInsurances || parsedData.xrsInsurances || [],
      });
      europcarResNumber = result.resNumber;
      isOnRequest = result.isOnRequest;
      onRequestItems = result.onRequestItems || [];
    } catch (xrsErr: any) {
      console.error(`[reenviar-xrs] Erro ao chamar executeXRSBooking:`, xrsErr.message);
      return NextResponse.json({
        success: false,
        error: `Falha ao enviar ao GreenWay: ${xrsErr.message}`,
      }, { status: 502 });
    }

    if (!europcarResNumber) {
      return NextResponse.json({
        success: false,
        error: 'GreenWay nao retornou numero de reserva. Verifique os logs XRS.',
      }, { status: 502 });
    }

    // -- Atualizar banco local com o resNumber do GreenWay --
    const newStatus = isOnRequest
      ? 'ON_REQUEST'
      : (paymentMethod === 'PIX' || paymentMethod === 'CREDIT' ? 'CONFIRMED_PREPAID' : reservaLocal.status);

    // Persiste tambem o paymentMethod e cieloPaymentId no JSON para visibilidade no painel
    let updatedCustomerData = parsedData;
    try {
      updatedCustomerData = {
        ...parsedData,
        paymentMethod,
        cieloPaymentId: parsedData.cieloPaymentId || parsedData.paymentId || null,
        xrsReenvioAdmin: session.user.email,  // auditoria: quem fez o reenvio
        xrsReenvioAt: new Date().toISOString(),
      };
    } catch (_) { /* mantém parsedData original */ }

    await prisma.localReservation.update({
      where: { id: reservaLocal.id },
      data: {
        resNumber: europcarResNumber,
        status: newStatus,
        customerData: JSON.stringify(updatedCustomerData),
      },
    });

    console.log(`[reenviar-xrs] Sucesso: resNumber ${europcarResNumber} (${isOnRequest ? 'ON REQUEST' : 'CONFIRMADO'}) | Reserva ID: ${reservaLocal.id}`);

    return NextResponse.json({
      success: true,
      resNumber: europcarResNumber,
      isOnRequest,
      onRequestItems,
      newStatus,
    });

  } catch (error: any) {
    console.error('[reenviar-xrs] Erro inesperado:', error.message);
    return NextResponse.json({ error: 'Erro interno: ' + error.message }, { status: 500 });
  }
}
