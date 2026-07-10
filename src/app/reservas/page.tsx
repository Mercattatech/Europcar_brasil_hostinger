'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Reserva {
  id: string;
  resNumber: string | null;
  status: string;
  createdAt: string;
  email?: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  pickupStation?: string;
  returnStation?: string;
  car?: string;
  total?: number;
  paymentMethod?: string;
  paymentData?: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d?: string) {
  if (!d || d.length < 8) return d || '—';
  return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
}

function formatTime(t?: string) {
  if (!t || t.length < 4) return t || '—';
  return `${t.slice(0, 2)}:${t.slice(2, 4)}`;
}

function formatIsoDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

function formatCurrency(v?: number) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  CONFIRMED_PREPAID:     { label: 'Confirmada',     color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30' },
  CONFIRMED_NON_PREPAID: { label: 'Confirmada',     color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30' },
  PENDING_PIX:           { label: 'Aguard. PIX',    color: 'text-yellow-400',  bg: 'bg-yellow-400/10 border-yellow-400/30' },
  ON_REQUEST:            { label: 'Sob Consulta',   color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/30' },
  CANCELLED:             { label: 'Cancelada',      color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/30' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, color: 'text-gray-400', bg: 'bg-gray-400/10 border-gray-400/30' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${s.color} ${s.bg}`}>
      {s.label}
    </span>
  );
}

// ─── Modal Components ─────────────────────────────────────────────────────────
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MeuPerfil() {
  const { data: session, status: sessionStatus } = useSession();

  // My reservations (logged in)
  const [reservas, setReservas]     = useState<Reserva[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  // Manual search
  const [searchNum, setSearchNum]   = useState('');
  const [searching, setSearching]   = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchError, setSearchError]   = useState('');

  // Modify modal
  const [modifyTarget, setModifyTarget]   = useState<Reserva | null>(null);
  const [modifyTime, setModifyTime]       = useState('1000');
  const [modifyDate, setModifyDate]       = useState('');
  const [modifying, setModifying]         = useState(false);
  const [modifyMsg, setModifyMsg]         = useState('');

  // Confirmation popup before modify
  const [confirmModifyTarget, setConfirmModifyTarget] = useState<Reserva | null>(null);

  const [cancelTarget, setCancelTarget]   = useState<Reserva | null>(null);
  const [cancelling, setCancelling]       = useState(false);
  const [cancelMsg, setCancelMsg]         = useState('');

  // Voucher modal
  const [voucherTarget, setVoucherTarget] = useState<Reserva | null>(null);

  // User profile
  const [activeTab, setActiveTab] = useState<'reservas'|'dados'>('reservas');
  const [profileData, setProfileData] = useState({ name: '', phone: '', city: '', cpf: '', password: '' });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // ── Load user profile ──
  const loadProfile = useCallback(async () => {
    if (!session?.user) return;
    setLoadingProfile(true);
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setProfileData({
          name: data.name || '',
          phone: data.phone || '',
          city: data.city || '',
          cpf: data.cpf || '',
          password: ''
        });
      }
    } catch (e: any) {
      console.error('Error loading profile', e);
    } finally {
      setLoadingProfile(false);
    }
  }, [session]);

  useEffect(() => {
    if (activeTab === 'dados') loadProfile();
  }, [activeTab, loadProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });
      if (res.ok) {
        setProfileMsg('✅ Dados atualizados com sucesso!');
        setProfileData(prev => ({ ...prev, password: '' }));
      } else {
        const data = await res.json();
        setProfileMsg(`❌ Erro: ${data.error || 'Falha ao atualizar dados'}`);
      }
    } catch (e: any) {
      setProfileMsg(`❌ ${e.message}`);
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Load user reservations ──
  const loadReservas = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/reservas/user');
      if (!res.ok) throw new Error('Erro ao carregar reservas');
      const data = await res.json();
      setReservas(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { loadReservas(); }, [loadReservas]);

  // ── Manual search ──
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchNum.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setSearchError('');
    try {
      const res = await fetch('/api/europcar/searchById', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resNumber: searchNum.trim() })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Reserva não encontrada');
      setSearchResult(data);
    } catch (e: any) {
      setSearchError(e.message);
    } finally {
      setSearching(false);
    }
  };

  // ── Modify ──
  const handleModify = async () => {
    if (!modifyTarget?.resNumber) return;
    setModifying(true);
    setModifyMsg('');
    try {
      const res = await fetch('/api/europcar/modifyReservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resNumber: modifyTarget.resNumber,
          pickupStationID: undefined, // will use reservation's own station
          pickupDate: modifyDate ? modifyDate.replace(/-/g, '') : modifyTarget.pickupDate,
          pickupTime: modifyTime,
          firstName: session?.user?.name?.split(' ')[0] || 'Passageiro',
          lastName:  session?.user?.name?.split(' ').slice(1).join(' ') || 'Europcar',
        })
      });
      const data = await res.json();
      if (data.success) {
        setModifyMsg('✅ Reserva modificada com sucesso!');
        setTimeout(() => { setModifyTarget(null); setModifyMsg(''); loadReservas(); }, 2000);
      } else {
        setModifyMsg(`❌ Erro: ${data.error || data.returnCode || 'Falha ao modificar'}`);
      }
    } catch (e: any) {
      setModifyMsg(`❌ ${e.message}`);
    } finally {
      setModifying(false);
    }
  };

  // ── Cancel ──
  const handleCancel = async () => {
    if (!cancelTarget?.resNumber) return;
    setCancelling(true);
    setCancelMsg('');
    try {
      const res = await fetch('/api/europcar/cancelReservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resNumber: cancelTarget.resNumber })
      });
      const data = await res.json();
      if (data.success) {
        setCancelMsg('✅ Reserva cancelada com sucesso!');
        // Update local status
        setReservas(prev => prev.map(r =>
          r.resNumber === cancelTarget.resNumber ? { ...r, status: 'CANCELLED' } : r
        ));
        setTimeout(() => { setCancelTarget(null); setCancelMsg(''); }, 2000);
      } else {
        setCancelMsg(`❌ Erro: ${data.error || data.returnCode || 'Falha ao cancelar'}`);
      }
    } catch (e: any) {
      setCancelMsg(`❌ ${e.message}`);
    } finally {
      setCancelling(false);
    }
  };

  // ── Render ──
  return (
    <>
      {/* ── Voucher Modal ─────────────────────────────────────────────────── */}
      {voucherTarget && (
        <ModalOverlay onClose={() => setVoucherTarget(null)}>
          <div className="p-6 bg-white rounded-2xl" id="print-area">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div>
                <h3 className="text-gray-900 font-black text-2xl uppercase italic text-[#008d36]">Europcar</h3>
                <p className="text-gray-500 text-sm font-bold">Comprovante de Reserva</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase font-bold">Reserva</p>
                <p className="font-mono text-xl text-gray-900 font-black">{voucherTarget.resNumber}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Retirada</p>
                    <p className="text-sm font-bold text-gray-900">{formatDate(voucherTarget.pickupDate)}</p>
                    <p className="text-xs text-gray-600 truncate">{voucherTarget.pickupStation || 'Europcar Station'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Devolução</p>
                    <p className="text-sm font-bold text-gray-900">{formatDate(voucherTarget.returnDate)}</p>
                    <p className="text-xs text-gray-600 truncate">{voucherTarget.returnStation || voucherTarget.pickupStation || 'Europcar Station'}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400">Veículo Selecionado</p>
                <p className="text-sm font-bold text-gray-900">{voucherTarget.car || 'Veículo Standard'}</p>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400">Pagamento</p>
                <div className="flex justify-between items-end">
                  <p className="text-sm font-bold text-gray-900">
                    {voucherTarget.paymentMethod === 'PIX' ? 'PIX' : 
                     voucherTarget.paymentMethod === 'CREDIT' ? 'Cartão de Crédito' : 
                     voucherTarget.paymentMethod === 'VOUCHER' ? 'Voucher ETO' : 
                     'No Balcão'}
                  </p>
                  <p className="text-lg font-black text-[#008d36]">{formatCurrency(voucherTarget.total)}</p>
                </div>
              </div>

              <div className="bg-green-50 text-green-800 p-3 rounded-lg text-xs font-medium border border-green-200 text-center">
                Apresente este comprovante no balcão da Europcar junto com seu documento e CNH.
              </div>
            </div>

            <div className="flex gap-3 mt-6 print:hidden">
              <button onClick={() => setVoucherTarget(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-xl transition-colors text-sm">
                Fechar
              </button>
              <button
                onClick={() => {
                  const printContent = document.getElementById('print-area')?.innerHTML;
                  if (!printContent) return;
                  const originalContent = document.body.innerHTML;
                  document.body.innerHTML = printContent;
                  window.print();
                  document.body.innerHTML = originalContent;
                  window.location.reload();
                }}
                className="flex-1 bg-[#008d36] hover:bg-[#007a2d] text-white font-bold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                🖨️ Imprimir PDF
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Confirm Modify Popup ──────────────────────────────────────────── */}
      {confirmModifyTarget && (
        <ModalOverlay onClose={() => setConfirmModifyTarget(null)}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Atenção — Alteração de Reserva</h3>
                <p className="text-gray-400 text-sm">Nº {confirmModifyTarget.resNumber}</p>
              </div>
            </div>

            <div className="bg-amber-900/20 border border-amber-600/30 rounded-xl p-4 mb-5 space-y-3">
              <p className="text-amber-200 text-sm leading-relaxed">
                <strong>⚠️ Ao confirmar a alteração:</strong>
              </p>
              <ul className="text-amber-200/90 text-sm space-y-2 list-none">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>Seu ticket atual será <strong>automaticamente cancelado</strong> e <strong>100% renovado</strong> com as novas informações da alteração.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>Caso já tenha realizado o pagamento, o valor pago será <strong>reembolsado em até 30 dias</strong> — prazo solicitado pela operadora de crédito para processar o estorno.</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-800/60 rounded-xl p-4 mb-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Nº da Reserva</span>
                <span className="text-white font-mono font-bold">{confirmModifyTarget.resNumber}</span>
              </div>
              {confirmModifyTarget.car && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Veículo</span>
                  <span className="text-white">{confirmModifyTarget.car}</span>
                </div>
              )}
              {confirmModifyTarget.pickupDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Retirada atual</span>
                  <span className="text-white">{formatDate(confirmModifyTarget.pickupDate)}</span>
                </div>
              )}
              {confirmModifyTarget.total != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Valor pago</span>
                  <span className="text-emerald-400 font-bold">{formatCurrency(confirmModifyTarget.total)}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModifyTarget(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-xl transition-colors text-sm"
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  setConfirmModifyTarget(null);
                  window.location.href = '/';
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                Entendi, fazer nova reserva
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modify Modal ─────────────────────────────────────────────────── */}
      {modifyTarget && (
        <ModalOverlay onClose={() => setModifyTarget(null)}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Modificar Reserva</h3>
                <p className="text-gray-400 text-sm">Nº {modifyTarget.resNumber}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nova data de retirada</label>
                <input
                  type="date"
                  value={modifyDate || (modifyTarget.pickupDate
                    ? `${modifyTarget.pickupDate.slice(0,4)}-${modifyTarget.pickupDate.slice(4,6)}-${modifyTarget.pickupDate.slice(6,8)}`
                    : '')}
                  onChange={e => setModifyDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Novo horário de retirada</label>
                <select
                  value={modifyTime}
                  onChange={e => setModifyTime(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                >
                  {['0800','0900','1000','1100','1200','1300','1400','1500','1600','1700','1800'].map(t =>
                    <option key={t} value={t}>{t.slice(0,2)}:{t.slice(2)}</option>
                  )}
                </select>
              </div>
            </div>

            {modifyMsg && (
              <p className={`mt-4 text-sm text-center font-medium ${modifyMsg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>
                {modifyMsg}
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModifyTarget(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-xl transition-colors text-sm">
                Cancelar
              </button>
              <button
                onClick={handleModify}
                disabled={modifying}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                {modifying ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Salvando...</> : 'Salvar Alteração'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Cancel Modal ─────────────────────────────────────────────────── */}
      {cancelTarget && (
        <ModalOverlay onClose={() => setCancelTarget(null)}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Cancelar Reserva</h3>
                <p className="text-gray-400 text-sm">Nº {cancelTarget.resNumber}</p>
              </div>
            </div>

            <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 mb-5">
              <p className="text-red-300 text-sm">
                Você está prestes a cancelar esta reserva. <strong>Esta ação não pode ser desfeita.</strong> Políticas de cancelamento da Europcar podem se aplicar.
              </p>
            </div>

            <div className="bg-gray-800/60 rounded-xl p-4 mb-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Nº da Reserva</span>
                <span className="text-white font-mono font-bold">{cancelTarget.resNumber}</span>
              </div>
              {cancelTarget.car && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Veículo</span>
                  <span className="text-white">{cancelTarget.car}</span>
                </div>
              )}
              {cancelTarget.pickupDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Retirada</span>
                  <span className="text-white">{formatDate(cancelTarget.pickupDate)}</span>
                </div>
              )}
            </div>

            {cancelMsg && (
              <p className={`mb-4 text-sm text-center font-medium ${cancelMsg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>
                {cancelMsg}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setCancelTarget(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-xl transition-colors text-sm">
                Voltar
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                {cancelling ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Cancelando...</> : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Page ─────────────────────────────────────────────────────────── */}
      <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        {/* Header */}
        <div className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 py-5">
            <div className="flex items-center gap-4 mb-6">
              <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-black text-white">Meu Perfil</h1>
                <p className="text-gray-400 text-sm">Consulte seu histórico, altere reservas e edite seus dados</p>
              </div>
            </div>

            {/* Tabs */}
            {sessionStatus === 'authenticated' && (
              <div className="flex gap-6">
                <button
                  onClick={() => setActiveTab('reservas')}
                  className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'reservas' ? 'border-[#008d36] text-[#008d36]' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                  Histórico de Compras
                </button>
                <button
                  onClick={() => setActiveTab('dados')}
                  className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'dados' ? 'border-[#008d36] text-[#008d36]' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                  Meus Dados
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">

          {/* ── Section 1: User reservations ─────────────────────────────── */}
          {sessionStatus === 'authenticated' && activeTab === 'reservas' && (
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-xl">📋</span> Meu Histórico de Compras
                </h2>
                <button onClick={loadReservas} className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Atualizar
                </button>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {error && (
                <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-red-300 text-sm">{error}</div>
              )}

              {!loading && !error && reservas.length === 0 && (
                <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="w-14 h-14 rounded-2xl bg-gray-700/50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-gray-400 font-medium">Nenhuma reserva encontrada</p>
                  <p className="text-gray-600 text-sm mt-1">Suas reservas aparecerão aqui após a confirmação.</p>
                </div>
              )}

              {!loading && reservas.length > 0 && (
                <div className="grid gap-4">
                  {reservas.map(r => {
                    const isCancelled = r.status === 'CANCELLED';
                    return (
                      <div
                        key={r.id}
                        className={`bg-white/5 border rounded-2xl p-5 transition-all ${isCancelled ? 'border-white/5 opacity-60' : 'border-white/10 hover:border-white/20'}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap mb-3">
                              <span className="font-mono font-bold text-white text-lg">
                                {r.resNumber || '—'}
                              </span>
                              <StatusBadge status={r.status} />
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Data da Reserva</p>
                                <p className="text-gray-200 font-medium">{formatIsoDate(r.createdAt)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Retirada (Data e Hora)</p>
                                <p className="text-gray-200 font-medium">{r.pickupDate ? formatDate(r.pickupDate) : '—'} {r.pickupTime ? formatTime(r.pickupTime) : ''}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Trecho</p>
                                <p className="text-gray-200 font-medium truncate" title={`${r.pickupStation || '—'} → ${r.returnStation || '—'}`}>
                                  {r.pickupStation || '—'} → {r.returnStation || '—'}
                                </p>
                              </div>
                              {r.total != null && (
                                <div>
                                  <p className="text-gray-500 text-xs mb-0.5">Total</p>
                                  <p className="text-emerald-400 font-bold">{formatCurrency(r.total)}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {!isCancelled && r.resNumber && (
                            <div className="flex flex-col gap-2 shrink-0">
                              <button
                                onClick={() => setVoucherTarget(r)}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg transition-all"
                              >
                                📄 Comprovante
                              </button>
                              <button
                                onClick={() => setConfirmModifyTarget(r)}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-lg transition-all"
                              >
                                ✏️ Modificar
                              </button>
                              <button
                                onClick={() => { setCancelTarget(r); setCancelMsg(''); }}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-bold rounded-lg transition-all"
                              >
                                ❌ Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {sessionStatus === 'authenticated' && activeTab === 'dados' && (
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
                <span className="text-xl">👤</span> Atualizar Meus Dados
              </h2>
              {loadingProfile ? (
                 <div className="flex items-center justify-center py-10">
                   <div className="w-6 h-6 border-2 border-[#008d36] border-t-transparent rounded-full animate-spin" />
                 </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="space-y-4 max-w-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Nome Completo</label>
                      <input type="text" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-[#008d36] focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">E-mail</label>
                      <input type="email" value={session?.user?.email || ''} disabled className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-gray-500 text-sm cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Telefone</label>
                      <input type="text" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-[#008d36] focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">CPF</label>
                      <input type="text" value={profileData.cpf} onChange={e => setProfileData({...profileData, cpf: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-[#008d36] focus:outline-none transition-colors" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Cidade</label>
                      <input type="text" value={profileData.city} onChange={e => setProfileData({...profileData, city: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-[#008d36] focus:outline-none transition-colors" />
                    </div>
                    <div className="md:col-span-2 mt-4 pt-4 border-t border-white/10">
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Nova Senha <span className="text-gray-500 font-normal">(deixe em branco para não alterar)</span></label>
                      <input type="password" placeholder="••••••••" value={profileData.password} onChange={e => setProfileData({...profileData, password: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-[#008d36] focus:outline-none transition-colors" />
                    </div>
                  </div>

                  {profileMsg && (
                    <p className={`mt-4 text-sm font-medium ${profileMsg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>
                      {profileMsg}
                    </p>
                  )}

                  <div className="pt-4">
                    <button type="submit" disabled={savingProfile} className="bg-[#008d36] hover:bg-[#007a2d] disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2">
                      {savingProfile ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : 'Salvar Alterações'}
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}

          {/* ── Section 2: Manual search ──────────────────────────────────── */}
          {activeTab === 'reservas' && (
            <section>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
              <span className="text-xl">🔍</span> Buscar reserva por número
            </h2>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <form onSubmit={handleSearch} className="flex gap-3">
                <input
                  id="searchResNumber"
                  type="text"
                  placeholder="Ex: 1201272521"
                  value={searchNum}
                  onChange={e => setSearchNum(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={searching || !searchNum.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
                >
                  {searching ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : null}
                  Buscar
                </button>
              </form>

              {searchError && (
                <div className="mt-4 bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-red-300 text-sm">{searchError}</div>
              )}

              {searchResult && (
                <div className="mt-5 bg-gray-800/60 border border-gray-700 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-white text-xl">{searchResult.resNumber}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      searchResult.cancelled ? 'bg-red-400/10 border-red-400/30 text-red-400' :
                      searchResult.confirmed ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400' :
                      searchResult.onRequest ? 'bg-blue-400/10 border-blue-400/30 text-blue-400' :
                      'bg-gray-400/10 border-gray-400/30 text-gray-400'
                    }`}>
                      {searchResult.cancelled ? 'Cancelada' : searchResult.confirmed ? 'Confirmada' : searchResult.onRequest ? 'Sob Consulta' : searchResult.statusCode}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs">Status XRS: <span className="text-gray-300 font-mono">{searchResult.statusCode}</span></p>
                  {searchResult.warnings?.length > 0 && (
                    <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3">
                      {searchResult.warnings.map((w: any, i: number) => (
                        <p key={i} className="text-yellow-300 text-xs">{w.msg || JSON.stringify(w)}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
          )}

          {/* ── Not logged in CTA ─────────────────────────────────────────── */}
          {sessionStatus === 'unauthenticated' && (
            <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-2xl p-6 text-center">
              <p className="text-emerald-300 font-medium mb-3">Faça login para ver todas as suas reservas automaticamente</p>
              <Link href="/api/auth/signin" className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
                Entrar na conta
              </Link>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
