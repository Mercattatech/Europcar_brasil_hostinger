"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

interface LoginModalProps {
  onClose: () => void;
  onLoginSuccess?: () => void;
}

// Country dial codes for phone selector
const COUNTRIES = [
  { code: "BR", flag: "🇧🇷", dial: "+55", label: "Brasil" },
  { code: "US", flag: "🇺🇸", dial: "+1",  label: "EUA" },
  { code: "PT", flag: "🇵🇹", dial: "+351", label: "Portugal" },
  { code: "AR", flag: "🇦🇷", dial: "+54", label: "Argentina" },
  { code: "CL", flag: "🇨🇱", dial: "+56", label: "Chile" },
  { code: "CO", flag: "🇨🇴", dial: "+57", label: "Colômbia" },
  { code: "MX", flag: "🇲🇽", dial: "+52", label: "México" },
  { code: "DE", flag: "🇩🇪", dial: "+49", label: "Alemanha" },
  { code: "FR", flag: "🇫🇷", dial: "+33", label: "França" },
  { code: "GB", flag: "🇬🇧", dial: "+44", label: "Reino Unido" },
  { code: "ES", flag: "🇪🇸", dial: "+34", label: "Espanha" },
  { code: "IT", flag: "🇮🇹", dial: "+39", label: "Itália" },
];

function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

export default function LoginModal({ onClose, onLoginSuccess }: LoginModalProps) {
  const [view, setView] = useState<"login" | "register" | "forgot">("login");

  // Login
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  // Register extras
  const [name, setName]         = useState("");
  const [dialCode, setDialCode] = useState("+55");
  const [phoneNum, setPhoneNum] = useState("");
  const [city, setCity]         = useState("");
  const [cpf, setCpf]           = useState("");

  // Forgot
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent]   = useState(false);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  const resetForm = () => { setError(""); setSuccess(""); };

  // ─── Login ────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
    } else {
      onLoginSuccess ? onLoginSuccess() : (onClose(), window.location.reload());
    }
  };

  // ─── Register ─────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const phone = phoneNum.trim() ? `${dialCode} ${phoneNum.trim()}` : "";
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, phone, city, cpf }),
      });
      if (!res.ok) {
        setError((await res.text()) || "Erro ao realizar cadastro.");
        setLoading(false);
        return;
      }
      setSuccess("Conta criada! Fazendo login...");
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result?.error) {
        onLoginSuccess ? onLoginSuccess() : (onClose(), window.location.reload());
      } else {
        setView("login");
      }
    } catch {
      setError("Erro interno ao criar conta.");
      setLoading(false);
    }
  };

  // ─── Forgot Password ──────────────────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotSent(true);
    } catch {
      setError("Erro ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-black">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        <div className="flex justify-center mb-5">
          <div className="w-12 h-12 bg-[#008d36] flex items-center justify-center font-black text-white text-2xl italic rounded-lg">E</div>
        </div>

        {/* ── Titles ── */}
        <h2 className="text-xl font-black text-gray-900 mb-5 text-center">
          {view === "login" ? "Acesse sua conta" : view === "register" ? "Crie sua conta" : "Recuperar senha"}
        </h2>

        {error && <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-lg text-sm mb-4 font-bold text-center">{error}</div>}
        {success && <div className="bg-green-50 text-green-700 border border-green-200 p-3 rounded-lg text-sm mb-4 font-bold text-center">{success}</div>}

        {/* ────────────────────── LOGIN ────────────────────── */}
        {view === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">E-mail</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-[#008d36] text-sm" placeholder="seu@email.com"/>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Senha</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-[#008d36] text-sm" placeholder="••••••••"/>
            </div>
            <div className="text-right">
              <button type="button" onClick={() => { setView("forgot"); resetForm(); }}
                className="text-xs text-[#008d36] hover:underline font-bold">
                Esqueci minha senha
              </button>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-[#008d36] hover:bg-[#007a2d] text-white font-bold py-3.5 rounded-lg transition-colors text-base disabled:opacity-50">
              {loading ? "Acessando..." : "Fazer login"}
            </button>
          </form>
        )}

        {/* ────────────────────── REGISTER ────────────────────── */}
        {view === "register" && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Nome completo *</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:border-[#008d36] text-sm" placeholder="Seu nome completo"/>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">E-mail *</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:border-[#008d36] text-sm" placeholder="seu@email.com"/>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Celular *</label>
              <div className="flex gap-2">
                <select value={dialCode} onChange={e => setDialCode(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-2.5 outline-none focus:border-[#008d36] text-sm bg-white shrink-0">
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.dial}>{c.flag} {c.dial}</option>
                  ))}
                </select>
                <input type="tel" required value={phoneNum} onChange={e => setPhoneNum(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:border-[#008d36] text-sm" placeholder="(11) 99999-9999"/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Cidade de origem *</label>
              <input type="text" required value={city} onChange={e => setCity(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:border-[#008d36] text-sm" placeholder="São Paulo"/>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">CPF *</label>
              <input type="text" required value={cpf} onChange={e => setCpf(maskCPF(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:border-[#008d36] text-sm" placeholder="000.000.000-00" maxLength={14}/>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Senha *</label>
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:border-[#008d36] text-sm" placeholder="Mínimo 6 caracteres"/>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-[#008d36] hover:bg-[#007a2d] text-white font-bold py-3.5 rounded-lg transition-colors text-base disabled:opacity-50 mt-2">
              {loading ? "Criando conta..." : "Cadastrar-se"}
            </button>
          </form>
        )}

        {/* ────────────────────── FORGOT PASSWORD ────────────────────── */}
        {view === "forgot" && (
          <>
            {forgotSent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-[#008d36]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </div>
                <p className="text-gray-700 font-bold mb-1">E-mail enviado!</p>
                <p className="text-gray-500 text-sm">Verifique sua caixa de entrada para o link de recuperação.</p>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <p className="text-gray-500 text-sm">Informe seu e-mail cadastrado e enviaremos um link para criar uma nova senha.</p>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">E-mail</label>
                  <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-[#008d36] text-sm" placeholder="seu@email.com"/>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-[#008d36] hover:bg-[#007a2d] text-white font-bold py-3.5 rounded-lg transition-colors disabled:opacity-50">
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </button>
              </form>
            )}
          </>
        )}

        {/* ── Footer links ── */}
        <div className="mt-5 text-center text-sm text-gray-600">
          {view === "login" && (
            <>Ainda não tem conta? <button onClick={() => { setView("register"); resetForm(); }} className="font-bold text-[#008d36] hover:underline">Cadastre-se</button></>
          )}
          {view === "register" && (
            <>Já tem uma conta? <button onClick={() => { setView("login"); resetForm(); }} className="font-bold text-[#008d36] hover:underline">Faça login</button></>
          )}
          {view === "forgot" && (
            <button onClick={() => { setView("login"); resetForm(); setForgotSent(false); }} className="font-bold text-[#008d36] hover:underline">
              ← Voltar ao login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
