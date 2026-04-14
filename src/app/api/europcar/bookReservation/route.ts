import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import prisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      carCategory, rateId,
      pickupStation, returnStation,
      pickupDate, returnDate,
      pickupTime, returnTime,
      driverData, paymentData, contractID
    } = body;

    if (!carCategory || !rateId) {
      return NextResponse.json({ error: 'carCategory e rateId são obrigatórios' }, { status: 400 });
    }

    // Build contractID attribute if promotion is active
    const contractAttr = contractID ? ` contractID="${contractID}" type="C"` : '';

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${carCategory}" rateId="${rateId}" prepaidMode="NP"${contractAttr}>
        <checkout stationID="${pickupStation}" date="${pickupDate}" time="${pickupTime || '1000'}"/>
        <checkin stationID="${returnStation || pickupStation}" date="${returnDate}" time="${returnTime || '1000'}"/>
        <equipmentList/>
      </reservation>
      <driver countryOfResidence="BR"
              firstName="${driverData?.firstName || 'Test'}"
              lastName="${driverData?.lastName || 'Client'}"
              title="${driverData?.title || 'MR'}"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
      password: process.env.XRS_PASSWORD || 'DEMO',
      action: 'bookReservation',
      sourceFile: 'bookReservation/route.ts'
    };

    const xrsResponse = await callXRS(xmlRequest, config);

    // Extract reservation number from response
    const resNumber =
      xrsResponse?.message?.serviceResponse?.reservation?.$?.resNumber ||
      xrsResponse?.serviceResponse?.reservation?.$?.resNumber ||
      null;

    // Save local reservation record
    if (paymentData) {
      await prisma.localReservation.create({
        data: {
          resNumber: resNumber || `LOCAL_${Date.now()}`,
          merchantOrderId: paymentData.merchantOrderId || `ORDER_${Date.now()}`,
          customerData: JSON.stringify({
            ...driverData,
            contractID: contractID || null,
            carCategory,
          }),
          status: paymentData.paid ? 'CONFIRMED_PREPAID' : 'CONFIRMED_NON_PREPAID'
        }
      });
    }

    return NextResponse.json({
      success: true,
      resNumber,
      raw: xrsResponse
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar XRS bookReservation' },
      { status: 500 }
    );
  }
}
