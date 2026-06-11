'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetSenhaPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) setError('Link inválido. Solicite um novo e-mail de recuperação.');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push('/'), 3000);
      } else {
        setError(data.error || 'Erro ao redefinir senha.');
      }
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7] flex flex-col items-center justify-center p-4">
      <div className="bg-[#008d36] px-6 py-3 rounded-md shadow-md mb-6">
        <img src="/logo.jpg" alt="Europcar" className="h-10 object-contain" />
      </div>

      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md border-t-4 border-[#008d36]">
        {success ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#008d36]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">Senha redefinida!</h2>
            <p className="text-gray-500 text-sm">Redirecionando para a página inicial...</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Nova senha</h1>
            <p className="text-gray-500 text-sm mb-6">Digite e confirme sua nova senha.</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 text-sm mb-4 font-bold">
                {error}
              </div>
            )}

            {!token ? (
              <Link href="/" className="block text-center text-[#008d36] font-bold hover:underline">
                ← Voltar para o início
              </Link>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nova senha</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-[#008d36] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Confirmar senha</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-[#008d36] text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#008d36] hover:bg-[#007a2d] disabled:opacity-50 text-white font-black py-3 rounded-lg transition-colors"
                >
                  {loading ? 'Salvando...' : 'Redefinir senha'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
