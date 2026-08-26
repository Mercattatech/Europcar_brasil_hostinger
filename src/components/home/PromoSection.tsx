"use client";
import { useState, useEffect } from "react";

interface Promotion {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  discountValue?: number;
  imageUrl?: string;
  contractID?: string;
  startDate?: string;
  endDate?: string;
}

export default function PromoSection() {
  const [promos, setPromos] = useState<Promotion[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
    fetch("/api/promotions", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPromos(data);
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
  }, []);

  if (promos.length === 0) return null;

  const formatDate = (d?: string) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-1 h-8 bg-[#008d36] rounded-full"></div>
        <div>
          <h2 className="text-2xl font-black text-gray-900">
            Ofertas Especiais
          </h2>
          <p className="text-sm text-gray-500 font-medium">
            Promoções exclusivas da rede Europcar
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {promos.map((promo) => (
          <a
            href={promo.contractID ? `/?contractID=${promo.contractID}#search` : "#"}
            key={promo.id}
            className="group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-[#008d36]/30 flex flex-col"
          >
            {/* Image */}
            <div className="relative h-44 overflow-hidden bg-gray-100">
              {promo.imageUrl ? (
                <img
                  src={promo.imageUrl}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  alt={promo.title}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#008d36] to-[#00b347] flex items-center justify-center">
                  <svg className="w-16 h-16 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
                  </svg>
                </div>
              )}

              {/* Discount badge */}
              {promo.discountValue && promo.discountValue > 0 && (
                <div className="absolute top-3 left-3 bg-[#e3000b] text-white font-black text-base px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1">
                  <span>-{promo.discountValue}%</span>
                </div>
              )}

              {/* Date range badge */}
              {(promo.startDate || promo.endDate) && (
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded font-bold">
                  {formatDate(promo.startDate)} → {formatDate(promo.endDate) || "∞"}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4 flex flex-col flex-1">
              <h3 className="font-black text-gray-900 text-sm uppercase leading-tight mb-1">
                {promo.title}
              </h3>
              {promo.subtitle && (
                <p className="text-xs text-gray-500 font-medium mb-2">
                  {promo.subtitle}
                </p>
              )}
              {promo.description && (
                <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-3">
                  {promo.description}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between">
                {promo.contractID && (
                  <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">
                    Código: {promo.contractID}
                  </span>
                )}
                <span className="text-xs font-bold text-[#008d36] group-hover:underline ml-auto">
                  Ver oferta →
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
