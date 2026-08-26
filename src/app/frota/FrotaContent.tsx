'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function FrotaContent() {
  const searchParams = useSearchParams();
  const pickup = searchParams.get('pickup') || 'GRUT01';
  const dateStr = searchParams.get('date') || '20261201';
  
  const [loading, setLoading] = useState(false);
  const [carros, setCarros] = useState<any[]>([]);

  useEffect(() => {
     // Simulando a busca real ao carregar a página vindo da Home
     const fetchCarros = async () => {
         setLoading(true);
         try {
             // Mockando uma response (Em um cenário real, viria do state/context da Home)
             // Vamos simular a chamada para getMultipleRates com os ACRISS retornados pelo getCarCategories
             
             // Imagine que o getCarCategories retornou [ECMR, CFMR]
             const acrissCodes = ['ECMR', 'CFMR'];
             
             const res = await fetch('/api/europcar/getMultipleRates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                   pickupStation: pickup, 
                   pickupDate: dateStr, 
                   returnDate: dateStr, 
                   acrissCodes 
                })
             });
             const data = await res.json();
             console.log("Rates Recebidos (XRS):", data);
             
             // Setando o grid mockado para testes visuais baseados na resposta
             setCarros([
                 { acriss: 'ECMR', nome: 'Econômico (ECMR)', modelo: 'Fiat Argo', preco: 15000, rateId: 'RATE_ID_MOCK_1' },
                 { acriss: 'CFMR', nome: 'SUV Compacto (CFMR)', modelo: 'Citroen C4 Cactus', preco: 28000, rateId: 'RATE_ID_MOCK_2' }
             ]);
             
         } catch(err) {
             console.error(err);
         } finally {
             setLoading(false);
         }
     };
     fetchCarros();
  }, [pickup, dateStr]);

  const handleSelecionar = (carro: any) => {
      // O fluxo normal redirecionaria para a tela de Checkout passando o RateID
      alert(`Preparar Checkout para o veículo: ${carro.modelo} (Rate: ${carro.rateId}). Redirecionando para portal Cielo 3.0... /checkout`);
      window.location.href = `/checkout?rateId=${carro.rateId}&acriss=${carro.acriss}&price=${carro.preco}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Nossa Frota Disponível</h1>
        <p className="text-lg text-gray-600 mb-12">
          Veículos retornados pela Europcar XRS para a data {dateStr} em {pickup}.
        </p>

        {loading ? (
           <div className="text-center py-20 text-europcar-green font-bold text-xl animate-pulse">
               Consultando sistema global XRS...
           </div>
        ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {carros.map((carro, index) => (
             <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-xl transition-all flex flex-col">
               <div className="h-48 bg-gray-200 relative flex items-center justify-center text-gray-400">
                  <span className="z-10 bg-white/50 px-3 py-1 rounded">MediaAssets: {carro.acriss}.jpg</span>
               </div>
               <div className="p-6 flex-1 flex flex-col">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-xs font-bold text-europcar-green uppercase tracking-wider">{carro.nome}</span>
                      <h3 className="text-xl font-bold text-gray-900 mt-1">{carro.modelo} ou Similar</h3>
                    </div>
                 </div>
                 <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div>
                        <span className="text-sm text-gray-500">Total Previsto</span>
                        <p className="text-2xl font-black text-gray-900">R$ {(carro.preco / 100).toFixed(2)}</p>
                    </div>
                    <button onClick={() => handleSelecionar(carro)} className="w-1/2 border-2 text-center border-europcar-green bg-europcar-green text-white font-bold py-3 rounded-lg hover:bg-europcar-dark transition-colors">
                       Selecionar
                    </button>
                 </div>
               </div>
             </div>
            ))}
           </div>
        )}
      </div>
    </div>
  )
}
