'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { isToolUIPart } from 'ai';
import ReactMarkdown from 'react-markdown';

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isLoading = status === 'streaming' || status === 'submitted';
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, status]);

  useEffect(() => {
    fetch('/api/admin/ai-config')
      .then(res => res.json())
      .then(data => setIsActive(data?.isActive ?? true))
      .catch(() => setIsActive(false));
  }, []);

  if (!isActive) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-europcar-green text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-50 hover:bg-green-700 focus:outline-none"
        aria-label="Falar com Assistente IA"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-full max-w-[360px] h-[550px] max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-gray-100 flex-shrink-0">
      
      {/* Header */}
      <div className="bg-europcar-green p-4 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1 overflow-hidden shadow-sm">
             <img src="/logo.jpg" alt="Europcar" className="w-full h-full object-contain mix-blend-multiply" />
          </div>
          <div>
             <h3 className="text-white font-bold text-sm leading-tight">Assistente Europcar</h3>
             <span className="text-green-100 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></span>
                Online agora
             </span>
          </div>
        </div>
        <button 
           onClick={() => setIsOpen(false)}
           className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 flex flex-col">
        {messages.length === 0 && (
           <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 text-europcar-green rounded-full flex items-center justify-center mx-auto mb-3">
                 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
              </div>
              <p className="text-gray-500 text-sm">Olá! Sou o assistente virtual da Europcar. Onde você gostaria de retirar o seu carro?</p>
           </div>
        )}
        
        {messages.map(m => {
          const textContent = m.parts
            .filter(p => p.type === 'text')
            .map(p => p.text)
            .join('');
          const hasPendingTool = m.parts.some(
            p => isToolUIPart(p) && p.state !== 'output-available' && p.state !== 'output-error'
          );
          return (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm text-sm ${
                m.role === 'user'
                  ? 'bg-europcar-green text-white rounded-br-none'
                  : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none prose prose-sm prose-p:leading-relaxed prose-img:rounded-xl prose-img:border prose-img:border-gray-100 prose-a:text-europcar-green prose-a:font-bold'
              }`}>
                 {/* Hide raw tool invocations from user view, unless it's a message */}
                 {hasPendingTool && !textContent ? (
                    <div className="flex items-center gap-2 text-gray-400 italic text-xs">
                       <span className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></span>
                       Buscando informações no sistema...
                    </div>
                 ) : (
                    <ReactMarkdown>{textContent}</ReactMarkdown>
                 )}
              </div>
            </div>
          );
        })}
        {(status === 'streaming' || status === 'submitted') && (
           <div className="flex justify-start">
             <div className="bg-white border border-gray-100 text-gray-500 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-gray-100 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-europcar-green focus:ring-1 focus:ring-europcar-green transition-shadow"
            disabled={status === 'streaming' || status === 'submitted'}
          />
          <button 
            type="submit" 
            disabled={status === 'streaming' || status === 'submitted' || !input.trim()}
            className="bg-europcar-green text-white p-2.5 rounded-full hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
