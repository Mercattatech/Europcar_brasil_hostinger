import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
     // Mocking Europcar Promo API
     const STATIONS_MOCK = [
        {
          id: 1,
          title: "Férias em grupo?",
          discount: "-10%",
          label: "MIN OFF",
          image: "https://images.unsplash.com/photo-1542362567-b07e54358753?q=80&w=800&auto=format&fit=crop",
          url: "/frota?promo=group"
        },
        {
          id: 2,
          title: "Fim de semana Prata",
          discount: "-15%",
          label: "FINAL SEMANA",
          image: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?q=80&w=400&auto=format&fit=crop",
          url: "/frota?promo=weekend"
        },
        {
          id: 3,
          title: "Premium Exclusivo",
          discount: "-20%",
          label: "NOS LUXOS",
          image: "https://images.unsplash.com/photo-1503376760367-152e92c21255?q=80&w=400&auto=format&fit=crop",
          url: "/frota?promo=premium"
        },
        {
          id: 4,
          title: "Longa Duração",
          discount: "-30%",
          label: "MENSAL",
          image: "https://images.unsplash.com/photo-1550355291-bbee04a92027?q=80&w=400&auto=format&fit=crop",
          url: "/frota?promo=monthly"
        }
     ];

     return NextResponse.json({ promos: STATIONS_MOCK });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar Promoções' },
      { status: 500 }
    );
  }
}
