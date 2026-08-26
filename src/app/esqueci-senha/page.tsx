'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const d = await res.json();
        setError(d.error || 'Erro ao enviar e-mail.');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7] flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="bg-[#008d36] px-6 py-3 rounded-md shadow-md mb-6">
        <img src="/logo.jpg" alt="Europcar" className="h-10 object-contain" />
      </div>

      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md border-t-4 border-[#008d36]">
        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#008d36]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">E-mail enviado!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Se o e-mail <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir sua senha em instantes.
            </p>
            <p className="text-xs text-gray-400 mb-6">Verifique também a pasta de spam/lixo eletrônico.</p>
            <Link href="/" className="inline-block text-[#008d36] font-bold hover:underline text-sm">
              ← Voltar para o início
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-black text-gray-900 mb-1">Esqueci minha senha</h1>
              <p className="text-gray-500 text-sm">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 text-sm mb-4 font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-[#008d36] text-sm transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#008d36] hover:bg-[#007a2d] disabled:opacity-50 text-white font-black py-3 rounded-lg transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Enviando...
                  </span>
                ) : 'Enviar link de redefinição'}
              </button>
            </form>

            <div className="mt-5 text-center">
              <Link href="/" className="text-sm text-gray-500 hover:text-[#008d36] transition-colors">
                ← Voltar para o login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
