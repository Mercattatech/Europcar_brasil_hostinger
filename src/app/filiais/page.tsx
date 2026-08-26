export default function Filiais() {
  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Filiais Europcar</h1>
        <p className="text-lg text-gray-600 mb-12">
          Encontre a estação mais próxima de você. No Brasil e em mais de 140 países (Via Integração XRS).
        </p>

        <div className="flex flex-col md:flex-row gap-8">
          
          <div className="md:w-1/3 order-2 md:order-1 flex flex-col gap-4">
             {/* Lista de Filiais Mock (No futuro virá do getStations e do CityStationOverrides CMS) */}
             <div className="bg-white p-6 rounded-xl shadow-sm border border-europcar-green">
                <h3 className="text-xl font-bold text-gray-900">São Paulo - Aeroporto de Guarulhos</h3>
                <p className="text-sm text-gray-500 mt-1">Código Estação: GRUT01</p>
                <p className="text-gray-600 mt-4">Rodovia Hélio Smidt, s/nº - Terminal 2</p>
                <div className="mt-4 flex gap-4">
                    <button className="text-europcar-green font-bold hover:underline">Ver no Mapa</button>
                    <button className="text-europcar-green font-bold hover:underline">Reservar Aqui</button>
                </div>
             </div>

             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 opacity-70">
                <h3 className="text-xl font-bold text-gray-900">Rio de Janeiro - Aeroporto do Galeão</h3>
                <p className="text-sm text-gray-500 mt-1">Código Estação: GIGT01</p>
                <p className="text-gray-600 mt-4">Av. Vinte de Janeiro, s/nº - Terminal 2</p>
                <div className="mt-4 flex gap-4">
                    <button className="text-gray-500 font-bold hover:underline">Ver no Mapa</button>
                    <button className="text-gray-500 font-bold hover:underline">Reservar Aqui</button>
                </div>
             </div>
          </div>

          <div className="md:w-2/3 order-1 md:order-2">
             <div className="bg-gray-200 h-[500px] rounded-2xl w-full flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=2074&auto=format&fit=crop')] bg-cover bg-center opacity-50"></div>
                <div className="absolute inset-0 bg-gray-900/10"></div>
                <div className="relative z-10 bg-white/90 backdrop-blur-sm p-4 rounded-lg font-bold text-gray-800 shadow-xl border border-white/20">
                  🗺️ Mapa Interativo em Construção
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  )
}
