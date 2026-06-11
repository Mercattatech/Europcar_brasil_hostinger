import { Resend } from "resend";


interface BookingConfirmationData {
  toEmail: string;
  customerName: string;
  resNumber: string;
  carName: string;
  pickupStation: string;
  returnStation: string;
  pickupDate: string;
  returnDate: string;
  paymentMethod: string;
  totalBRL?: number;
  isOnRequest?: boolean;
}

function formatXRSDate(d: string): string {
  if (!d || d.length < 8) return d || '—';
  return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
}

function paymentLabel(method: string): string {
  const map: Record<string, string> = {
    BALCAO: 'Pagamento no Balcão',
    PIX: 'PIX',
    CREDIT: 'Cartão de Crédito',
    VOUCHER: 'Voucher ETO (Faturado)',
  };
  return map[method] || method;
}

export async function sendBookingConfirmation(data: BookingConfirmationData) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const {
    toEmail, customerName, resNumber, carName,
    pickupStation, returnStation, pickupDate, returnDate,
    paymentMethod, totalBRL, isOnRequest,
  } = data;

  const statusColor = isOnRequest ? '#f59e0b' : '#008d36';
  const statusLabel = isOnRequest ? 'Aguardando Confirmação' : 'Confirmada ✓';
  const title = isOnRequest ? 'Sua solicitação foi recebida!' : 'Reserva Confirmada!';
  const subtitle = isOnRequest
    ? 'Sua reserva está em análise. Você receberá uma confirmação em até 8 horas úteis.'
    : 'Obrigado por escolher a Europcar. Apresente o número abaixo no balcão de retirada.';

  try {
    await resend.emails.send({
      from: "Europcar Brasil <reservas@europcar.com.br>",
      to: toEmail,
      subject: `${isOnRequest ? '🕐 Reserva em análise' : '✅ Reserva confirmada'} — Europcar Brasil`,
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#008d36;padding:28px 32px;text-align:center;">
      <div style="font-size:32px;font-weight:900;font-style:italic;color:#fff;letter-spacing:-1px;">Europcar</div>
      <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;">europcar.com.br</div>
    </div>

    <!-- Hero -->
    <div style="background:${statusColor};padding:20px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">${title}</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">${subtitle}</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">

      <p style="color:#374151;font-size:15px;margin-top:0;">Olá, <strong>${customerName}</strong>!</p>

      <!-- Reservation Number -->
      <div style="background:#f9fafb;border:2px solid ${statusColor};border-radius:10px;padding:20px;text-align:center;margin:20px 0;">
        <div style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Número da Reserva</div>
        <div style="font-size:36px;font-weight:900;color:${statusColor};letter-spacing:3px;">${resNumber}</div>
        <div style="display:inline-block;margin-top:8px;background:${statusColor};color:#fff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;">${statusLabel}</div>
      </div>

      <!-- Details Table -->
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tbody>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;width:140px;">Veículo</td>
            <td style="padding:12px 0;color:#111827;font-size:13px;font-weight:bold;">${carName}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;">Retirada</td>
            <td style="padding:12px 0;color:#111827;font-size:13px;">${pickupStation} · ${formatXRSDate(pickupDate)}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;">Devolução</td>
            <td style="padding:12px 0;color:#111827;font-size:13px;">${returnStation} · ${formatXRSDate(returnDate)}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;">Pagamento</td>
            <td style="padding:12px 0;color:#111827;font-size:13px;">${paymentLabel(paymentMethod)}</td>
          </tr>
          ${totalBRL && totalBRL > 0 ? `
          <tr>
            <td style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;">Total</td>
            <td style="padding:12px 0;color:#008d36;font-size:15px;font-weight:900;">R$ ${totalBRL.toFixed(2).replace('.', ',')}</td>
          </tr>
          ` : ''}
        </tbody>
      </table>

      ${isOnRequest ? `
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;margin:20px 0;">
        <strong style="color:#92400e;font-size:13px;">⏳ Reserva Sob Consulta</strong>
        <p style="color:#92400e;font-size:13px;margin:4px 0 0;">
          Um ou mais itens desta reserva precisam de confirmação pela estação Europcar. 
          Você será contatado em até 8 horas úteis.
        </p>
      </div>
      ` : `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:20px 0;">
        <strong style="color:#166534;font-size:13px;">📋 Lembre-se</strong>
        <p style="color:#166534;font-size:13px;margin:4px 0 0;">
          Apresente o número da reserva no balcão de retirada. 
          Traga também seu documento de identidade e CNH válida.
        </p>
      </div>
      `}

      <p style="color:#6b7280;font-size:13px;">
        Você pode visualizar e gerenciar sua reserva em <a href="https://europcar.com.br/reservas" style="color:#008d36;font-weight:bold;">europcar.com.br/reservas</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        © 2025 Europcar Brasil · Todos os direitos reservados<br/>
        Este é um e-mail automático, por favor não responda.
      </p>
    </div>

  </div>
</body>
</html>
      `,
    });

    console.log(`[email] Booking confirmation sent to ${toEmail} — resNumber: ${resNumber}`);
  } catch (error: any) {
    // Non-blocking: log but don't throw — reservation is already confirmed
    console.error(`[email] Failed to send booking confirmation to ${toEmail}:`, error.message);
  }
}
