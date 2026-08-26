import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amountInCents, customerData, merchantOrderId } = body;
    
    // Regra do Arquiteto (Cielo Pix):
    // "Implemente a geração de QR Code enviando "Type": "Pix" e exiba a string 'Copia e Cola'"
    
    const PaymentPayloadPix = {
        Type: "Pix",
        Amount: amountInCents,
    };

    console.log(`[LogsCielo] [INFO] Solicitando Geração QRCode PIX - Pedido: ${merchantOrderId}`);

    // Emulação Resposta Cielo Pix
    const cieloResponseMock = {
       Payment: {
           Status: 12, // Pending via PIX
           Amount: amountInCents,
           QrCodeBase64Image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", // Mock de QrCode
           QrCodeString: "00020126580014br.gov.bcb.pix0136europcar@exemplo.com.br..." // PIX Copia Cola
       }
    };

    return NextResponse.json({ 
       success: true, 
       qrCodeImage: cieloResponseMock.Payment.QrCodeBase64Image,
       qrCodeString: cieloResponseMock.Payment.QrCodeString
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar PIX Cielo' },
      { status: 500 }
    );
  }
}
