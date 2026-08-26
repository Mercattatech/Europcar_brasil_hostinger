'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function CheckoutContent() {
  const searchParams = useSearchParams();
  const rateId = searchParams.get('rateId');
  const acriss = searchParams.get('acriss');
  const price = searchParams.get('price'); // Vem em centavos
  
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [cartao, setCartao] = useState('');

  const handlePayment = async (e: React.FormEvent) => {
     e.preventDefault();
     setLoading(true);

     try {
        console.log("Iniciando fluxo de cobrança segura Cielo 3.0 & Book Europcar");

        // 1. Processar Pagamento Cielo (Antifraude)
        const cieloRes = await fetch('/api/cielo/processar3ds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amountInCents: price,
                merchantOrderId: crypto.randomUUID(),
                customerData: { Name: nome, Identity: cpf }
            })
        });
        
        const cieloData = await cieloRes.json();
        
        if (cieloData.success) {
           console.log("Cielo aprovada. Redirecionar para 3DS Challenge ou seguir fluxo:", cieloData.redirectUrl);
           // Simulação: Se 3DS não exigir desafio para esse bin, chamar Book XRS

           // 2. Gravar Reserva XP (Europcar)
           const xrsRes = await fetch('/api/europcar/bookReservation', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                   rateId,
                   acrissCategory: acriss,
                   driverData: { firstName: nome.split(' ')[0], lastName: nome.split(' ')[1] || '', email: 'teste@cielo.com' },
                   paymentData: { paid: true }
               })
           });

           const xrsData = await xrsRes.json();
           
           if(xrsData.success) {
              alert(`Sucesso! Carro reservado. Localizador Europcar: ${xrsData.resNumber}`);
              window.location.href = `/reservas?res=${xrsData.resNumber}`;
           }

        } else {
           alert("Pagamento recusado pela Cielo Antifraude. Verifique os dados.");
        }

     } catch(err) {
         console.error(err);
         alert("Erro no checkout.");
     } finally {
         setLoading(false);
     }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout Seguro (Cielo 3DS)</h1>
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8">
           
           <div className="md:w-1/2 border-r border-gray-100 pr-8">
               <h3 className="text-xl font-bold mb-4">Resumo da Reserva</h3>
               <p className="text-gray-500">Veículo: <span className="font-bold text-gray-800">{acriss}</span></p>
               <p className="text-gray-500 mb-6">Total a Pagar: <span className="text-2xl font-black text-gray-900 block mt-2">R$ {((Number(price)||0) / 100).toFixed(2)}</span></p>
               <div className="bg-yellow-50 p-4 rounded-lg text-sm text-yellow-800">
                  Transação protegida com Anti-Fraude e Autenticação 3DS 2.2 do seu banco emissor.
               </div>
           </div>

           <form onSubmit={handlePayment} className="md:w-1/2 space-y-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome no Cartão</label>
                  <input required value={nome} onChange={e => setNome(e.target.value)} type="text" className="w-full p-2 border border-gray-300 rounded focus:ring-europcar-green" />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF do Condutor Principal</label>
                  <input required value={cpf} onChange={e => setCpf(e.target.value)} type="text" className="w-full p-2 border border-gray-300 rounded focus:ring-europcar-green" />
              </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número do Cartão de Crédito</label>
                  <input required value={cartao} onChange={e => setCartao(e.target.value)} maxLength={16} placeholder="**** **** **** ****" type="text" className="w-full p-2 border border-gray-300 rounded focus:ring-europcar-green" />
              </div>

              <button disabled={loading} type="submit" className="w-full mt-4 bg-europcar-green text-white font-bold py-3 rounded-lg hover:bg-europcar-dark disabled:opacity-50">
                  {loading ? 'Processando (Zero Auth)...' : 'Pagar e Reservar'}
              </button>
           </form>

        </div>

      </div>
    </div>
  )
}
