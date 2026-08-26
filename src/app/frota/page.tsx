'use client';

import { Suspense } from 'react';
import FrotaContent from './FrotaContent';

export default function NossaFrota() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-20 flex justify-center items-center font-bold text-europcar-green">Carregando XRS...</div>}>
       <FrotaContent />
    </Suspense>
  )
}
