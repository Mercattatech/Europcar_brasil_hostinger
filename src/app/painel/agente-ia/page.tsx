'use client';

import { useState, useEffect, useRef } from 'react';

type Doc = {
  id: string;
  fileName: string;
  fileType: string;
  active: boolean;
  sizeBytes: number;
  createdAt: string;
  textPreview: string;
  charCount: number;
};

type Conversation = {
  id: string;
  sessionId: string;
  approved: boolean;
  sessionStart: string;
  preview: string;
  messageCount: number;
};

type ConvDetail = {
  id: string;
  sessionId: string;
  approved: boolean;
  sessionStart: string;
  messages: { role: string; content: string }[];
};

const TABS = ['config', 'knowledge', 'conversations'] as const;
type Tab = typeof TABS[number];

export default function AgenteIA() {
  const [activeTab, setActiveTab] = useState<Tab>('config');

  // ── Config state ────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  // ── Knowledge state ──────────────────────────────────────────────────────────
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; status: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Conversations state ──────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convTotal, setConvTotal] = useState(0);
  const [convPage, setConvPage] = useState(1);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [selectedConv, setSelectedConv] = useState<ConvDetail | null>(null);
  const [loadingConvDetail, setLoadingConvDetail] = useState(false);

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch config ─────────────────────────────────────────────────────────────
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/ai-config');
      const data = await res.json();
      setConfig(data || { isActive: true, masterPrompt: '', positivePrompt: '', negativePrompt: '' });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        showToast('Configurações salvas com sucesso!');
        fetchConfig();
      } else {
        showToast('Erro ao salvar', 'error');
      }
    } catch {
      showToast('Erro de conexão', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // ── Fetch knowledge docs ─────────────────────────────────────────────────────
  const fetchDocs = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch('/api/admin/ai-knowledge');
      const data = await res.json();
      setDocs(Array.isArray(data) ? data : []);
    } catch {
      showToast('Erro ao carregar documentos', 'error');
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadProgress([]);

    const BATCH_SIZE = 5;
    const fileArray = Array.from(files);
    const allResults: { name: string; status: string }[] = [];

    for (let i = 0; i < fileArray.length; i += BATCH_SIZE) {
      const batch = fileArray.slice(i, i + BATCH_SIZE);
      const formData = new FormData();
      batch.forEach(f => formData.append('files', f));

      try {
        const res = await fetch('/api/admin/ai-knowledge', { method: 'POST', body: formData });
        const data = await res.json();
        allResults.push(...(data.results || []));
        setUploadProgress([...allResults]);
      } catch {
        batch.forEach(f => allResults.push({ name: f.name, status: 'error' }));
        setUploadProgress([...allResults]);
      }
    }

    setUploading(false);
    const successCount = allResults.filter(r => r.status === 'success').length;
    showToast(`${successCount} de ${fileArray.length} documento(s) processado(s) com sucesso!`, successCount > 0 ? 'success' : 'error');
    fetchDocs();
  };

  const toggleDoc = async (doc: Doc) => {
    try {
      await fetch('/api/admin/ai-knowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, active: !doc.active }),
      });
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, active: !d.active } : d));
    } catch {
      showToast('Erro ao atualizar documento', 'error');
    }
  };

  const deleteDoc = async (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await fetch(`/api/admin/ai-knowledge?id=${id}`, { method: 'DELETE' });
      setDocs(prev => prev.filter(d => d.id !== id));
      showToast('Documento excluído.');
    } catch {
      showToast('Erro ao excluir documento', 'error');
    }
  };

  // ── Fetch conversations ──────────────────────────────────────────────────────
  const fetchConversations = async (page = 1) => {
    setLoadingConvs(true);
    try {
      const res = await fetch(`/api/admin/ai-conversations?page=${page}`);
      const data = await res.json();
      setConversations(data.conversations || []);
      setConvTotal(data.total || 0);
      setConvPage(page);
    } catch {
      showToast('Erro ao carregar conversas', 'error');
    } finally {
      setLoadingConvs(false);
    }
  };

  const openConversation = async (conv: Conversation) => {
    setLoadingConvDetail(true);
    try {
      // We fetch the full conversation to show messages
      // Re-fetch to get full messages (we didn't include them in list)
      const res = await fetch(`/api/admin/ai-conversations?page=1`);
      const allData = await res.json();
      // Find full conv - get raw
      // Since list doesn't have messages, get them from a detail endpoint if available
      // For now, just show what we have from the listing
      setSelectedConv({
        id: conv.id,
        sessionId: conv.sessionId,
        approved: conv.approved,
        sessionStart: conv.sessionStart,
        messages: [], // Will load from detail
      });
      // Fetch full detail
      const detailRes = await fetch(`/api/admin/ai-conversations/detail?id=${conv.id}`);
      if (detailRes.ok) {
        const detail = await detailRes.json();
        setSelectedConv(detail);
      } else {
        // fallback
        setSelectedConv({
          id: conv.id,
          sessionId: conv.sessionId,
          approved: conv.approved,
          sessionStart: conv.sessionStart,
          messages: [],
        });
      }
    } catch {
      showToast('Erro ao abrir conversa', 'error');
    } finally {
      setLoadingConvDetail(false);
    }
  };

  const approveConv = async (id: string, approved: boolean) => {
    try {
      await fetch('/api/admin/ai-conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, approved }),
      });
      setConversations(prev => prev.map(c => c.id === id ? { ...c, approved } : c));
      if (selectedConv?.id === id) setSelectedConv(prev => prev ? { ...prev, approved } : null);
      showToast(approved ? '✅ Conversa aprovada como exemplo de treinamento!' : 'Aprovação removida.');
    } catch {
      showToast('Erro ao atualizar conversa', 'error');
    }
  };

  const deleteConv = async (id: string) => {
    if (!confirm('Excluir esta conversa?')) return;
    try {
      await fetch(`/api/admin/ai-conversations?id=${id}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (selectedConv?.id === id) setSelectedConv(null);
      showToast('Conversa excluída.');
    } catch {
      showToast('Erro ao excluir conversa', 'error');
    }
  };

  // ── Load data on mount / tab change ─────────────────────────────────────────
  useEffect(() => { fetchConfig(); }, []);
  useEffect(() => {
    if (activeTab === 'knowledge') fetchDocs();
    if (activeTab === 'conversations') fetchConversations(1);
  }, [activeTab]);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loadingConfig) return <div className="p-10 text-white font-bold">Carregando...</div>;

  const totalActiveKb = docs.filter(d => d.active).reduce((sum, d) => sum + d.charCount, 0);
  const approvedCount = conversations.filter(c => c.approved).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-2xl font-bold text-sm transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Agente de IA</h1>
          <p className="text-gray-400 text-sm mt-1">Configure o comportamento, base de conhecimento e aprendizado contínuo do assistente.</p>
        </div>
        <div className="flex gap-3 text-xs text-gray-500">
          <div className="bg-gray-800 rounded-lg px-3 py-2 text-center">
            <div className="text-white font-bold text-lg">{docs.filter(d => d.active).length}</div>
            <div>Docs ativos</div>
          </div>
          <div className="bg-gray-800 rounded-lg px-3 py-2 text-center">
            <div className="text-green-400 font-bold text-lg">{conversations.filter(c => c.approved).length}</div>
            <div>Aprovados</div>
          </div>
          <div className="bg-gray-800 rounded-lg px-3 py-2 text-center">
            <div className="text-blue-400 font-bold text-lg">{convTotal}</div>
            <div>Conversas</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {([
          { id: 'config', label: '⚙️ Configuração & Master Prompt' },
          { id: 'knowledge', label: '📚 Base de Conhecimento' },
          { id: 'conversations', label: '💬 Conversas & Aprendizado' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1 — CONFIGURAÇÃO & MASTER PROMPT
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
          {/* Status toggle */}
          <div className="flex items-center justify-between bg-gray-800/50 p-4 rounded-lg">
            <div>
              <h3 className="text-white font-bold">Status do Agente no Site</h3>
              <p className="text-sm text-gray-400">Ative ou desative o balão de chat para os clientes.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={config?.isActive || false} onChange={e => setConfig({ ...config, isActive: e.target.checked })} />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          {/* Master Prompt */}
          <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-lg">⭐</span>
              <label className="block text-white font-bold text-base">Master Prompt</label>
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-bold">Instrução Principal</span>
            </div>
            <p className="text-sm text-gray-400">
              Este é o prompt principal e completo da IA. Quando preenchido, <strong className="text-white">substitui totalmente</strong> o comportamento padrão e os campos positivo/negativo abaixo. Use para definir com precisão como a IA deve se comportar, o tom de voz, as regras de negócio e o fluxo de atendimento.
            </p>
            <textarea
              rows={12}
              value={config?.masterPrompt || ''}
              onChange={e => setConfig({ ...config, masterPrompt: e.target.value })}
              className="w-full bg-gray-900 border border-yellow-500/30 rounded-lg p-3 text-white focus:border-yellow-400 outline-none text-sm font-mono leading-relaxed"
              placeholder={`Exemplo:\nVocê é Ana, assistente virtual da Europcar Brasil...\n\nREGRAS:\n- Sempre cumprimente o cliente pelo nome\n- Ofereça proteção premium em todas as reservas\n- Nunca mencione concorrentes\n...\n\nFLUXO DE ATENDIMENTO:\n1. Perguntar cidade de retirada\n2. Perguntar datas\n...`}
            />
            <p className="text-xs text-gray-600">
              {config?.masterPrompt?.length || 0} caracteres. Deixe vazio para usar o comportamento padrão + campos abaixo.
            </p>
          </div>

          {/* Positive prompt */}
          <div>
            <label className="block text-white font-bold mb-2">Comportamento Positivo <span className="text-xs text-gray-500 font-normal">(ignorado se Master Prompt estiver preenchido)</span></label>
            <p className="text-sm text-gray-400 mb-2">O que o agente DEVE fazer. Regras de negócios, dicas de venda, etc.</p>
            <textarea
              rows={4}
              value={config?.positivePrompt || ''}
              onChange={e => setConfig({ ...config, positivePrompt: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 outline-none text-sm"
              placeholder="Ex: Ofereça sempre a proteção completa Premium. Seja super educado e chame o cliente pelo nome."
            />
          </div>

          {/* Negative prompt */}
          <div>
            <label className="block text-white font-bold mb-2">Comportamento Negativo <span className="text-xs text-gray-500 font-normal">(ignorado se Master Prompt estiver preenchido)</span></label>
            <p className="text-sm text-gray-400 mb-2">O que o agente NUNCA deve fazer ou dizer.</p>
            <textarea
              rows={4}
              value={config?.negativePrompt || ''}
              onChange={e => setConfig({ ...config, negativePrompt: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-red-500 outline-none text-sm"
              placeholder="Ex: Nunca dê descontos não autorizados. Nunca prometa carros específicos, apenas categorias."
            />
          </div>

          <div className="pt-4 border-t border-gray-800 flex justify-end">
            <button type="submit" disabled={savingConfig} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-8 rounded-lg transition-colors disabled:opacity-60">
              {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2 — BASE DE CONHECIMENTO
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'knowledge' && (
        <div className="space-y-4">
          {/* Upload area */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-white font-bold text-base mb-1">Adicionar Documentos</h2>
            <p className="text-gray-400 text-sm mb-4">
              Envie PDFs, arquivos de texto ou imagens. A IA vai extrair e aprender todo o conteúdo automaticamente.
              Formatos aceitos: <strong className="text-white">PDF, TXT, MD, JPG, PNG, WEBP</strong>
            </p>

            {/* Drag and drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-green-400 bg-green-500/10' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/50'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.md,image/*"
                className="hidden"
                onChange={e => handleUpload(e.target.files)}
              />
              <div className="text-4xl mb-3">📂</div>
              <p className="text-white font-bold">Arraste os arquivos aqui ou clique para selecionar</p>
              <p className="text-gray-500 text-sm mt-1">Selecione múltiplos arquivos de uma vez (até 50 por envio)</p>
            </div>

            {/* Upload progress */}
            {(uploading || uploadProgress.length > 0) && (
              <div className="mt-4 space-y-1.5 max-h-48 overflow-y-auto">
                {uploading && <p className="text-yellow-400 text-sm font-bold animate-pulse">⏳ Processando arquivos... Aguarde, a extração pode levar alguns instantes.</p>}
                {uploadProgress.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${r.status === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    <span>{r.status === 'success' ? '✅' : '❌'}</span>
                    <span className="font-mono text-xs">{r.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          {docs.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
                <div className="text-white font-bold text-xl">{docs.length}</div>
                <div className="text-gray-400 text-xs">Total de documentos</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
                <div className="text-green-400 font-bold text-xl">{docs.filter(d => d.active).length}</div>
                <div className="text-gray-400 text-xs">Ativos na IA</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
                <div className="text-blue-400 font-bold text-xl">{(totalActiveKb / 1000).toFixed(0)}k</div>
                <div className="text-gray-400 text-xs">Caracteres injetados</div>
              </div>
            </div>
          )}

          {/* Document list */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-bold">Documentos na Base</h2>
              <button onClick={fetchDocs} className="text-gray-400 hover:text-white text-xs">↻ Atualizar</button>
            </div>

            {loadingDocs ? (
              <div className="p-8 text-center text-gray-500">Carregando documentos...</div>
            ) : docs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="text-3xl mb-2">📭</div>
                <p>Nenhum documento na base de conhecimento ainda.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {docs.map(doc => (
                  <div key={doc.id} className="flex items-start gap-3 p-4 hover:bg-gray-800/30 transition-colors">
                    <div className="text-2xl shrink-0 mt-0.5">
                      {doc.fileType === 'pdf' ? '📄' : doc.fileType === 'image' ? '🖼️' : '📝'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold text-sm truncate max-w-xs">{doc.fileName}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${doc.fileType === 'pdf' ? 'bg-red-500/20 text-red-400' : doc.fileType === 'image' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {doc.fileType.toUpperCase()}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${doc.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                          {doc.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5 truncate">{doc.textPreview}</p>
                      <div className="flex gap-3 mt-1 text-[10px] text-gray-600">
                        <span>{(doc.sizeBytes / 1024).toFixed(1)} KB</span>
                        <span>{doc.charCount.toLocaleString()} chars extraídos</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Toggle */}
                      <button
                        onClick={() => toggleDoc(doc)}
                        title={doc.active ? 'Desativar' : 'Ativar'}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-sm ${doc.active ? 'bg-green-500/20 hover:bg-red-500/20 text-green-400 hover:text-red-400' : 'bg-gray-700 hover:bg-green-500/20 text-gray-500 hover:text-green-400'}`}
                      >
                        {doc.active ? '✓' : '○'}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => deleteDoc(doc.id, doc.fileName)}
                        title="Excluir"
                        className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-red-500/20 text-gray-500 hover:text-red-400 flex items-center justify-center transition-colors text-sm"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3 — CONVERSAS & APRENDIZADO
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'conversations' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: conversation list */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold">Conversas dos Clientes</h2>
                <p className="text-gray-500 text-xs mt-0.5">Aprove as boas respostas para treinar a IA</p>
              </div>
              <span className="text-xs text-gray-500">{convTotal} total</span>
            </div>

            <div className="p-3 border-b border-gray-800 bg-green-500/5">
              <p className="text-green-400 text-xs font-bold">
                ✅ {conversations.filter(c => c.approved).length} conversa(s) aprovada(s) nesta página sendo usadas como exemplo pela IA
              </p>
            </div>

            {loadingConvs ? (
              <div className="p-8 text-center text-gray-500">Carregando conversas...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="text-3xl mb-2">💬</div>
                <p>Nenhuma conversa registrada ainda.</p>
                <p className="text-xs mt-1">As conversas aparecem automaticamente quando clientes usam o chat.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800 max-h-[600px] overflow-y-auto">
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={`p-4 cursor-pointer hover:bg-gray-800/50 transition-colors ${selectedConv?.id === conv.id ? 'bg-gray-800' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {conv.approved && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">✅ Aprovada</span>}
                          <span className="text-[10px] text-gray-500">{conv.messageCount} mensagens</span>
                        </div>
                        <p className="text-gray-300 text-sm truncate">{conv.preview || '(sem conteúdo)'}</p>
                        <p className="text-gray-600 text-[10px] mt-1">{new Date(conv.sessionStart).toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); approveConv(conv.id, !conv.approved); }}
                          title={conv.approved ? 'Remover aprovação' : 'Aprovar como exemplo de treinamento'}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${conv.approved ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400' : 'bg-gray-800 text-gray-500 hover:bg-green-500/20 hover:text-green-400'}`}
                        >
                          {conv.approved ? '✓' : '○'}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteConv(conv.id); }}
                          className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-red-500/20 text-gray-500 hover:text-red-400 flex items-center justify-center text-xs transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {convTotal > 20 && (
              <div className="p-3 border-t border-gray-800 flex justify-center gap-2">
                <button disabled={convPage === 1} onClick={() => fetchConversations(convPage - 1)} className="px-3 py-1 text-xs bg-gray-800 text-white rounded disabled:opacity-50">← Anterior</button>
                <span className="px-3 py-1 text-xs text-gray-400">Página {convPage}</span>
                <button disabled={convPage * 20 >= convTotal} onClick={() => fetchConversations(convPage + 1)} className="px-3 py-1 text-xs bg-gray-800 text-white rounded disabled:opacity-50">Próxima →</button>
              </div>
            )}
          </div>

          {/* Right: conversation detail */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="text-white font-bold">Detalhes da Conversa</h2>
            </div>
            {!selectedConv ? (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-600">
                <div>
                  <div className="text-4xl mb-3">👈</div>
                  <p>Selecione uma conversa para ver o conteúdo e aprovar como exemplo de treinamento.</p>
                </div>
              </div>
            ) : loadingConvDetail ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">Carregando...</div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="px-4 py-2 bg-gray-800/50 flex items-center justify-between gap-2 border-b border-gray-800">
                  <div className="text-xs text-gray-400">
                    <span className="font-mono">{selectedConv.sessionId.substring(0, 24)}...</span>
                    <span className="ml-2">{new Date(selectedConv.sessionStart).toLocaleString('pt-BR')}</span>
                  </div>
                  <button
                    onClick={() => approveConv(selectedConv.id, !selectedConv.approved)}
                    className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors ${selectedConv.approved ? 'bg-green-600 text-white hover:bg-red-600' : 'bg-gray-700 text-gray-300 hover:bg-green-600 hover:text-white'}`}
                  >
                    {selectedConv.approved ? '✅ Aprovada — Clique para remover' : '○ Aprovar como Treinamento'}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
                  {selectedConv.messages.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-8">Mensagens não disponíveis para esta conversa.</p>
                  ) : (
                    selectedConv.messages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-200 border border-gray-700'}`}>
                          <div className="text-[10px] font-bold mb-1 opacity-60">{m.role === 'user' ? 'CLIENTE' : 'IA'}</div>
                          <div className="whitespace-pre-wrap break-words">{m.content}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
