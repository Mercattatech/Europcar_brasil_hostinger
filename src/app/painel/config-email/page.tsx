"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';

// Usamos dynamic para desabilitar SSR no editor (ele depende do window/document)
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

type Template = {
  id: string;
  name: string;
  subject: string;
  html: string;
};

const TRIGGERS = [
  { id: 'RESERVA_SUCESSO', label: 'Reserva Confirmada (Sucesso)' },
  { id: 'CANCELAMENTO', label: 'Cancelamento de Reserva' },
  { id: 'RESERVA_ALTERADA', label: 'Reserva Alterada / Modificada' },
  { id: 'ATUALIZA_DADOS', label: 'Atualização de Perfil' },
  { id: 'RESET_SENHA', label: 'Reset de Senha' },
  { id: 'FALHA_PAGAMENTO', label: 'Falha no Pagamento (PIX/Cartão/Etc)' }
];

export default function ConfigEmailPage() {
  // ─── Provider / Resend ─────────────────────────
  const [emailProvider, setEmailProvider] = useState<'RESEND' | 'SMTP'>('RESEND');
  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');

  // ─── SMTP ──────────────────────────────────────
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  
  // ─── Templates & Triggers ─────────────────────
  const [templates, setTemplates] = useState<Template[]>([]);
  const [triggers, setTriggers] = useState<Record<string, string>>({});
  
  // ─── UI State ─────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('html');
  const [showPreview, setShowPreview] = useState(false);

  // ─── Test Email ───────────────────────────────
  const [testEmail, setTestEmail] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState('');

  // ─── Template Preview Test ────────────────────
  const [previewTestEmail, setPreviewTestEmail] = useState('');
  const [previewTrigger, setPreviewTrigger] = useState('RESERVA_SUCESSO');
  const [previewTestLoading, setPreviewTestLoading] = useState(false);
  const [previewTestResult, setPreviewTestResult] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const keys = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'EMAIL_PROVIDER', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE'];
      const configPromises = keys.map(k => fetch(`/api/admin/config?key=${k}`).then(r => r.json()));
      const tplPromise = fetch('/api/admin/email-templates').then(r => r.json());
      
      const [resApiKey, resFrom, resProvider, resSmtpHost, resSmtpPort, resSmtpUser, resSmtpPass, resSmtpSecure, resTpl] = await Promise.all([...configPromises, tplPromise]);

      if (resApiKey.value) setApiKey(resApiKey.value);
      if (resFrom.value) setFromEmail(resFrom.value);
      if (resProvider.value) setEmailProvider(resProvider.value === 'SMTP' ? 'SMTP' : 'RESEND');
      if (resSmtpHost.value) setSmtpHost(resSmtpHost.value);
      if (resSmtpPort.value) setSmtpPort(resSmtpPort.value);
      if (resSmtpUser.value) setSmtpUser(resSmtpUser.value);
      if (resSmtpPass.value) setSmtpPass(resSmtpPass.value);
      if (resSmtpSecure.value === 'true') setSmtpSecure(true);

      if (resTpl.templates) {
         setTemplates(resTpl.templates);
         if (resTpl.templates.length > 0) setActiveTemplateId(resTpl.templates[0].id);
      }
      if (resTpl.triggers) setTriggers(resTpl.triggers);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveSettings = async () => {
    setSaving(true);
    setMsg('');
    try {
      const configPairs = [
        { key: 'RESEND_API_KEY', value: apiKey },
        { key: 'RESEND_FROM_EMAIL', value: fromEmail },
        { key: 'EMAIL_PROVIDER', value: emailProvider },
        { key: 'SMTP_HOST', value: smtpHost },
        { key: 'SMTP_PORT', value: smtpPort },
        { key: 'SMTP_USER', value: smtpUser },
        { key: 'SMTP_PASS', value: smtpPass },
        { key: 'SMTP_SECURE', value: smtpSecure ? 'true' : 'false' },
      ];

      await Promise.all([
        ...configPairs.map(c => fetch('/api/admin/config', { method: 'POST', body: JSON.stringify(c) })),
        fetch('/api/admin/email-templates', { method: 'POST', body: JSON.stringify({ templates, triggers }) })
      ]);
      setMsg('✅ Configurações salvas com sucesso!');
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setMsg('❌ Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      setTestResult('❌ Informe um e-mail válido.');
      return;
    }
    setTestLoading(true);
    setTestResult('');
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail })
      });
      const data = await res.json();
      if (data.success) {
        setTestResult(`✅ ${data.message}`);
      } else {
        setTestResult(`❌ ${data.error || 'Falha ao enviar.'}`);
      }
    } catch (e) {
      setTestResult('❌ Erro de rede ao testar.');
    } finally {
      setTestLoading(false);
      setTimeout(() => setTestResult(''), 8000);
    }
  };

  const handlePreviewTemplateEmail = async () => {
    if (!previewTestEmail || !previewTestEmail.includes('@')) {
      setPreviewTestResult('❌ Informe um e-mail válido.');
      return;
    }
    setPreviewTestLoading(true);
    setPreviewTestResult('');
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: previewTestEmail, trigger: previewTrigger, useTemplate: true })
      });
      const data = await res.json();
      if (data.success) {
        setPreviewTestResult(`✅ E-mail de teste enviado via ${data.provider || 'provedor'}`);
      } else {
        setPreviewTestResult(`❌ ${data.error || 'Falha ao enviar.'}`);
      }
    } catch (e) {
      setPreviewTestResult('❌ Erro de rede ao testar.');
    } finally {
      setPreviewTestLoading(false);
      setTimeout(() => setPreviewTestResult(''), 8000);
    }
  };

  const addTemplate = () => {
    const newId = Date.now().toString();
    const newTpl: Template = {
      id: newId,
      name: 'Novo Template',
      subject: 'Assunto do E-mail',
      html: '<p>Escreva seu e-mail aqui...</p>'
    };
    setTemplates([...templates, newTpl]);
    setActiveTemplateId(newId);
  };

  const duplicateTemplate = (id: string) => {
    const tpl = templates.find(t => t.id === id);
    if (!tpl) return;
    const newId = Date.now().toString();
    const newTpl: Template = { ...tpl, id: newId, name: tpl.name + ' (Cópia)' };
    setTemplates([...templates, newTpl]);
    setActiveTemplateId(newId);
  };

  const deleteTemplate = (id: string) => {
    if (!confirm('Excluir este template?')) return;
    const newTpls = templates.filter(t => t.id !== id);
    setTemplates(newTpls);
    if (activeTemplateId === id) {
      setActiveTemplateId(newTpls.length > 0 ? newTpls[0].id : null);
    }
    // Remove trigger mappings for this template
    const newTriggers = { ...triggers };
    for (const key in newTriggers) {
      if (newTriggers[key] === id) delete newTriggers[key];
    }
    setTriggers(newTriggers);
  };

  const updateActiveTemplate = (field: keyof Template, value: string) => {
    setTemplates(prev => prev.map(t => t.id === activeTemplateId ? { ...t, [field]: value } : t));
  };

  const activeTemplate = templates.find(t => t.id === activeTemplateId);

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ],
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">✉️ Configurações de E-mail</h1>
          <p className="text-gray-400 text-sm mt-1">Configure o provedor de envio, SMTP, desenhe seus e-mails e defina quando enviá-los.</p>
        </div>
        <button onClick={saveSettings} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2">
           {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : '💾 Salvar Tudo'}
        </button>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl font-bold ${msg.includes('✅') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ═══ Coluna Esquerda: Configuração + Gatilhos ═══ */}
          <div className="space-y-6">

            {/* Seletor de Provedor */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">🔌 Provedor de E-mail</h2>
              <p className="text-xs text-gray-500 mb-3">Escolha qual provedor será usado para enviar os e-mails. Se SMTP falhar, o sistema usa Resend como fallback automaticamente.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setEmailProvider('RESEND')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${
                    emailProvider === 'RESEND'
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  Resend.com
                </button>
                <button
                  onClick={() => setEmailProvider('SMTP')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${
                    emailProvider === 'SMTP'
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  SMTP Genérico
                </button>
              </div>
              {emailProvider === 'SMTP' && (
                <div className="mt-3 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-xs text-blue-400">⚡ Se o SMTP falhar, o sistema tentará enviar automaticamente via Resend.</p>
                </div>
              )}
            </div>

            {/* Credenciais Resend */}
            <div className={`bg-gray-900 border rounded-xl p-5 transition-all ${emailProvider === 'RESEND' ? 'border-emerald-500/50' : 'border-gray-800'}`}>
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${emailProvider === 'RESEND' ? 'bg-emerald-500' : 'bg-gray-600'}`}/>
                Resend.com
                {emailProvider === 'RESEND' && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">ATIVO</span>}
                {emailProvider === 'SMTP' && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">FALLBACK</span>}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">API Key</label>
                  <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="re_XXXXXXX" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">E-mail Remetente (Verificado)</label>
                  <input type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="reservas@seu-dominio.com.br" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                  <p className="text-[10px] text-gray-600 mt-1">Este e-mail é usado como remetente para ambos os provedores (SMTP e Resend).</p>
                </div>
              </div>
            </div>

            {/* Configuração SMTP */}
            <div className={`bg-gray-900 border rounded-xl p-5 transition-all ${emailProvider === 'SMTP' ? 'border-blue-500/50' : 'border-gray-800'}`}>
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${emailProvider === 'SMTP' ? 'bg-blue-500' : 'bg-gray-600'}`}/>
                SMTP Genérico
                {emailProvider === 'SMTP' && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">ATIVO</span>}
              </h2>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Host</label>
                    <input type="text" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Porta</label>
                    <input type="text" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Usuário / E-mail</label>
                  <input type="text" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="usuario@dominio.com" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Senha</label>
                  <input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="••••••••" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => setSmtpSecure(!smtpSecure)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smtpSecure ? 'bg-blue-600' : 'bg-gray-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${smtpSecure ? 'translate-x-6' : 'translate-x-1'}`}/>
                  </button>
                  <label className="text-xs text-gray-400 font-medium">SSL/TLS (porta 465)</label>
                </div>
              </div>
            </div>

            {/* Testar Configuração */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">🧪 Testar Configuração</h2>
              <p className="text-xs text-gray-500 mb-3">Salve as configurações acima primeiro, depois envie um e-mail de teste para verificar.</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                />
                <button
                  onClick={handleTestEmail}
                  disabled={testLoading}
                  className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  {testLoading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : '📤 Enviar Teste'}
                </button>
              </div>
              {testResult && (
                <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-bold ${testResult.includes('✅') ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {testResult}
                </div>
              )}
            </div>

            {/* Testar Template com Dados Reais */}
            <div className="bg-gray-900 border border-purple-500/30 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                🎨 Testar Template com Dados de Exemplo
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Envia um e-mail usando o template configurado para o gatilho escolhido, com dados de exemplo. Veja exatamente como o cliente vai receber.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Gatilho / Situação</label>
                  <select
                    value={previewTrigger}
                    onChange={e => setPreviewTrigger(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    {TRIGGERS.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={previewTestEmail}
                    onChange={e => setPreviewTestEmail(e.target.value)}
                    placeholder="destinatario@email.com"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={handlePreviewTemplateEmail}
                    disabled={previewTestLoading}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    {previewTestLoading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : '🚀 Enviar Preview'}
                  </button>
                </div>
              </div>
              {previewTestResult && (
                <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-bold ${previewTestResult.includes('✅') ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {previewTestResult}
                </div>
              )}
            </div>

            {/* Gatilhos (Triggers) */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">⚡ Gatilhos (Triggers)</h2>
              <p className="text-xs text-gray-500 mb-4">Selecione qual template enviar em cada situação. Deixe vazio para não enviar e-mail.</p>
              <div className="space-y-4">
                {TRIGGERS.map(trig => (
                  <div key={trig.id}>
                    <label className="block text-xs font-medium text-gray-300 mb-1">{trig.label}</label>
                    <select
                      value={triggers[trig.id] || ''}
                      onChange={e => setTriggers({ ...triggers, [trig.id]: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Não enviar</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ Coluna Direita: Construtor de Templates ═══ */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">📝 Meus Templates</h2>
              <button onClick={addTemplate} className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors">
                + Novo Template
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
                <p className="text-gray-500">Nenhum template criado.</p>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl flex overflow-hidden min-h-[700px]">
                
                {/* Lista de Templates */}
                <div className="w-1/3 border-r border-gray-800 bg-gray-900/50 flex flex-col overflow-y-auto max-h-[700px]">
                  {templates.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setActiveTemplateId(t.id)}
                      className={`p-4 cursor-pointer border-b border-gray-800 transition-colors ${activeTemplateId === t.id ? 'bg-gray-800 border-l-4 border-l-emerald-500' : 'hover:bg-gray-800/50 border-l-4 border-l-transparent'}`}
                    >
                      <p className="font-bold text-sm text-white truncate">{t.name}</p>
                      <p className="text-xs text-gray-500 truncate mt-1">{t.subject}</p>
                    </div>
                  ))}
                </div>

                {/* Editor */}
                {activeTemplate ? (
                  <div className="w-2/3 p-5 flex flex-col h-full overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
                        <button
                          onClick={() => setEditorMode('html')}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${editorMode === 'html' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                          {'</>'}  HTML
                        </button>
                        <button
                          onClick={() => setEditorMode('visual')}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${editorMode === 'visual' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                          ✏️ Visual
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowPreview(true)}
                          className="px-3 py-1 bg-purple-900/30 hover:bg-purple-900/50 text-purple-400 rounded text-xs font-bold transition-colors"
                        >
                          👁 Preview
                        </button>
                        <button onClick={() => duplicateTemplate(activeTemplate.id)} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-bold transition-colors">Duplicar</button>
                        <button onClick={() => deleteTemplate(activeTemplate.id)} className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs font-bold transition-colors">Excluir</button>
                      </div>
                    </div>

                    <div className="space-y-4 flex-1">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Nome de controle</label>
                        <input type="text" value={activeTemplate.name} onChange={e => updateActiveTemplate('name', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Assunto do E-mail</label>
                        <input type="text" value={activeTemplate.subject} onChange={e => updateActiveTemplate('subject', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                      </div>
                      
                      <div className="pt-2">
                         <label className="block text-xs font-medium text-gray-400 mb-1">
                           {editorMode === 'visual' ? 'Conteúdo (Editor Visual)' : 'Conteúdo (Código HTML)'}
                         </label>
                         <div className="text-[10px] text-gray-500 mb-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 space-y-2">
                         <p className="font-bold text-gray-400 text-[11px] mb-1">📋 Variáveis disponíveis — copie e cole no template:</p>
                         <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                           <div>
                             <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">👤 Cliente</p>
                             {['{{NOME}}','{{SOBRENOME}}','{{EMAIL}}','{{TELEFONE}}','{{CPF}}'].map(v => (
                               <p key={v} className="font-mono text-emerald-400 cursor-pointer hover:text-emerald-300" title="Clique para copiar"
                                 onClick={() => navigator.clipboard?.writeText(v)}>{v}</p>
                             ))}
                           </div>
                           <div>
                             <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">📋 Reserva</p>
                             {['{{NUMERO_RESERVA}}','{{VALOR_TOTAL}}','{{FORMA_PAGAMENTO}}'].map(v => (
                               <p key={v} className="font-mono text-blue-400 cursor-pointer hover:text-blue-300" title="Clique para copiar"
                                 onClick={() => navigator.clipboard?.writeText(v)}>{v}</p>
                             ))}
                           </div>
                           <div className="mt-2">
                             <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">🚗 Veículo</p>
                             {['{{CARRO}}','{{CATEGORIA_CARRO}}'].map(v => (
                               <p key={v} className="font-mono text-yellow-400 cursor-pointer hover:text-yellow-300" title="Clique para copiar"
                                 onClick={() => navigator.clipboard?.writeText(v)}>{v}</p>
                             ))}
                           </div>
                           <div className="mt-2">
                             <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">📅 Datas e Locais</p>
                             {['{{DATA_RETIRADA}}','{{HORARIO_RETIRADA}}','{{LOCAL_RETIRADA}}','{{DATA_DEVOLUCAO}}','{{HORARIO_DEVOLUCAO}}','{{LOCAL_DEVOLUCAO}}'].map(v => (
                               <p key={v} className="font-mono text-purple-400 cursor-pointer hover:text-purple-300" title="Clique para copiar"
                                 onClick={() => navigator.clipboard?.writeText(v)}>{v}</p>
                             ))}
                           </div>
                           <div className="mt-2">
                             <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">🛡️ Extras e Proteções</p>
                             {['{{LISTA_PROTECOES}}','{{LISTA_EXTRAS}}'].map(v => (
                               <p key={v} className="font-mono text-orange-400 cursor-pointer hover:text-orange-300" title="Clique para copiar"
                                 onClick={() => navigator.clipboard?.writeText(v)}>{v}</p>
                             ))}
                           </div>
                           <div className="mt-2">
                             <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">🔧 Outros</p>
                             {['{{LINK_RESET}}','{{PIX_COPIA_COLA}}','{{ERRO}}'].map(v => (
                               <p key={v} className="font-mono text-gray-400 cursor-pointer hover:text-gray-300" title="Clique para copiar"
                                 onClick={() => navigator.clipboard?.writeText(v)}>{v}</p>
                             ))}
                           </div>
                         </div>
                         <p className="text-[9px] text-gray-600 pt-1 border-t border-gray-700">💡 Clique em qualquer variável para copiar. As listas (proteções/extras) são formatadas em múltiplas linhas.</p>
                       </div>

                         {editorMode === 'visual' ? (
                           <>
                             <div className="mb-2 px-3 py-2.5 bg-amber-500/15 border border-amber-500/40 rounded-lg flex gap-2 items-start">
                               <span className="text-amber-400 text-base mt-0.5">⚠️</span>
                               <div>
                                 <p className="text-amber-300 font-bold text-[11px] mb-0.5">Atenção: O editor visual remove estilos e estruturas de tabela</p>
                                 <p className="text-amber-400/80 text-[10px] leading-relaxed">
                                   Para templates HTML profissionais (com inline styles, tabelas, logos), use sempre o modo <strong className="text-amber-300">{'</>'} HTML</strong>.
                                   O editor visual é indicado apenas para textos simples — ao colar HTML complexo aqui, a formatação será perdida ao salvar.
                                 </p>
                               </div>
                             </div>
                             <div className="bg-white rounded-lg overflow-hidden text-black quill-wrapper">
                               {/* @ts-ignore */}
                               <ReactQuill theme="snow" modules={modules} value={activeTemplate.html} onChange={(content) => updateActiveTemplate('html', content)} />
                             </div>
                           </>
                         ) : (
                           <div className="relative">
                             <textarea
                               value={activeTemplate.html}
                               onChange={e => updateActiveTemplate('html', e.target.value)}
                               spellCheck={false}
                               className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-green-400 text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
                               style={{ minHeight: '400px', tabSize: 2 }}
                               placeholder="Cole aqui seu código HTML para e-mails profissionais..."
                             />
                             <div className="absolute top-2 right-2 text-[10px] text-gray-600 font-mono bg-gray-900 px-2 py-0.5 rounded">HTML</div>
                           </div>
                         )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Modal de Preview HTML ═══ */}
      {showPreview && activeTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Preview do E-mail</h3>
                <p className="text-xs text-gray-500 mt-0.5">{activeTemplate.subject}</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-1 bg-gray-100">
              <iframe
                srcDoc={activeTemplate.html}
                className="w-full h-full min-h-[500px] bg-white rounded border border-gray-200"
                sandbox="allow-same-origin"
                title="Email Preview"
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Styles for Quill in dark mode context */}
      <style dangerouslySetInnerHTML={{__html: `
        .quill-wrapper .ql-toolbar { border: none; border-bottom: 1px solid #e5e7eb; background: #f3f4f6; }
        .quill-wrapper .ql-container { border: none; min-height: 300px; font-family: inherit; font-size: 14px; }
      `}} />
    </div>
  );
}
