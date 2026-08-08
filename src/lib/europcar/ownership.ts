import prisma from '@/lib/prisma';

/** Returns the customer email tied to a local reservation, or null if not found. */
export async function getReservationOwnerEmail(resNumber: string): Promise<string | null> {
  const reservation = await prisma.localReservation.findUnique({ where: { resNumber } });
  if (!reservation?.customerData) return null;
  const customerData = typeof reservation.customerData === 'string'
    ? JSON.parse(reservation.customerData)
    : (reservation.customerData as any);
  return customerData?.email || null;
}
