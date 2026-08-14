import React from 'react';
import { getStations } from '@/lib/europcar/xrsClient';
import styles from './stations.module.css';

// Server component (Next.js 13+)
// force-dynamic (não static): evita chamar a API real da Europcar durante o
// build — em servidores com pouca RAM isso soma memória/rede desnecessárias
// bem na fase mais pesada do build ("Creating an optimized production build").
export const dynamic = 'force-dynamic';

async function fetchBrazilStations() {
  try {
    const stations = await getStations('BR');
    return stations;
  } catch (e) {
    console.error('Erro ao buscar estações:', e);
    return [];
  }
}

export default async function StationsPage() {
  const stations = await fetchBrazilStations();

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Estações Europcar no Brasil</h1>
      {stations.length === 0 ? (
        <p className={styles.message}>Nenhuma estação encontrada.</p>
      ) : (
        <ul className={styles.list}>
          {stations.map((s) => (
            <li key={s.stationCode} className={styles.card}>
              <h2 className={styles.stationName}>{s.stationName}</h2>
              <p className={styles.code}>Código: {s.stationCode}</p>
              <p className={styles.prestige}>Prestígio: {s.prestige}</p>
              <p className={styles.truck}>Caminhão disponível: {s.truckAvailable}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
