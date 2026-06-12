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
  { id: 'ATUALIZA_DADOS', label: 'Atualização de Perfil' },
  { id: 'RESET_SENHA', label: 'Reset de Senha' },
  { id: 'FALHA_PAGAMENTO', label: 'Falha no Pagamento (PIX/Cartão/Etc)' }
];

export default function ConfigEmailPage() {
  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [triggers, setTriggers] = useState<Record<string, string>>({});
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resApi, resFrom, resTpl] = await Promise.all([
        fetch('/api/admin/config?key=RESEND_API_KEY').then(r => r.json()),
        fetch('/api/admin/config?key=RESEND_FROM_EMAIL').then(r => r.json()),
        fetch('/api/admin/email-templates').then(r => r.json())
      ]);
      if (resApi.value) setApiKey(resApi.value);
      if (resFrom.value) setFromEmail(resFrom.value);
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
      await Promise.all([
        fetch('/api/admin/config', { method: 'POST', body: JSON.stringify({ key: 'RESEND_API_KEY', value: apiKey }) }),
        fetch('/api/admin/config', { method: 'POST', body: JSON.stringify({ key: 'RESEND_FROM_EMAIL', value: fromEmail }) }),
        fetch('/api/admin/email-templates', { method: 'POST', body: JSON.stringify({ templates, triggers }) })
      ]);
      setMsg('✅ Configurações salvas com sucesso!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('❌ Erro ao salvar.');
    } finally {
      setSaving(false);
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
      ['link', 'image'],
      ['clean']
    ],
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">✉️ Configurações de E-mail (Resend)</h1>
          <p className="text-gray-400 text-sm mt-1">Configure o remetente, desenhe seus e-mails e defina quando enviá-los.</p>
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
          
          {/* Coluna Esquerda: Chaves e Mapeamentos */}
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-4">Credenciais Resend</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">API Key</label>
                  <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="re_XXXXXXX" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">E-mail Remetente (Verificado)</label>
                  <input type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="reservas@seu-dominio.com.br" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-4">Gatilhos (Triggers)</h2>
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

          {/* Coluna Direita: Construtor de Templates */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Meus Templates</h2>
              <button onClick={addTemplate} className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors">
                + Novo Template
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
                <p className="text-gray-500">Nenhum template criado.</p>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl flex overflow-hidden min-h-[600px]">
                
                {/* Lista de Templates */}
                <div className="w-1/3 border-r border-gray-800 bg-gray-900/50 flex flex-col">
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
                    <div className="flex justify-end gap-2 mb-4">
                      <button onClick={() => duplicateTemplate(activeTemplate.id)} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-bold transition-colors">Duplicar</button>
                      <button onClick={() => deleteTemplate(activeTemplate.id)} className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs font-bold transition-colors">Excluir</button>
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
                         <label className="block text-xs font-medium text-gray-400 mb-1">Conteúdo HTML</label>
                         <div className="text-[10px] text-gray-500 mb-2 p-2 bg-gray-800/50 rounded">
                           <strong>Variáveis disponíveis:</strong> {'{{NOME}}'}, {'{{NUMERO_RESERVA}}'}, {'{{VALOR}}'}, {'{{LINK_RESET}}'}, {'{{PIX_COPIA_COLA}}'}, {'{{CARRO}}'}, {'{{DATA_RETIRADA}}'}
                         </div>
                         <div className="bg-white rounded-lg overflow-hidden text-black quill-wrapper">
                            {/* @ts-ignore */}
                            <ReactQuill theme="snow" modules={modules} value={activeTemplate.html} onChange={(content) => updateActiveTemplate('html', content)} />
                         </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
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
