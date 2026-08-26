"use client";

import { useState, useEffect } from "react";

export default function PainelUsuarios() {
   const [users, setUsers] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [search, setSearch] = useState("");
   const [filterRole, setFilterRole] = useState("ALL");
   const [filterStatus, setFilterStatus] = useState("ALL");
   const [editingUser, setEditingUser] = useState<any>(null);
   const [newPassword, setNewPassword] = useState("");
   const [newName, setNewName] = useState("");
   const [saving, setSaving] = useState(false);
   
   // Create User
   const [showCreateModal, setShowCreateModal] = useState(false);
   const [createName, setCreateName] = useState("");
   const [createEmail, setCreateEmail] = useState("");
   const [createPassword, setCreatePassword] = useState("");
   const [createRole, setCreateRole] = useState("USER");

   const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
   const [historyUser, setHistoryUser] = useState<any>(null);
   const [historyData, setHistoryData] = useState<any[]>([]);
   const [historyLoading, setHistoryLoading] = useState(false);

   const showToast = (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
   };

   const fetchUsers = async () => {
      try {
         const res = await fetch("/api/admin/users");
         const data = await res.json();
         setUsers(data);
      } catch (e) {
         console.error(e);
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => { fetchUsers(); }, []);

   const filteredUsers = users.filter(u => {
      const matchSearch = !search || 
         (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
         (u.email || "").toLowerCase().includes(search.toLowerCase());
      const matchRole = filterRole === "ALL" || u.role === filterRole;
      const matchStatus = filterStatus === "ALL" || (u.status || "ACTIVE") === filterStatus;
      return matchSearch && matchRole && matchStatus;
   });

   const handleUpdateUser = async (userId: string, updates: any) => {
      setSaving(true);
      try {
         const res = await fetch(`/api/admin/users/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
         });
         if (res.ok) {
            showToast("Usuário atualizado com sucesso!");
            fetchUsers();
            setEditingUser(null);
            setNewPassword("");
            setNewName("");
         } else {
            showToast("Erro ao atualizar", "error");
         }
      } catch (e) {
         showToast("Erro de conexão", "error");
      } finally {
         setSaving(false);
      }
   };

   const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
         const res = await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: createName, email: createEmail, password: createPassword, role: createRole }),
         });
         if (res.ok) {
            showToast("Usuário criado com sucesso!");
            fetchUsers();
            setShowCreateModal(false);
            setCreateName("");
            setCreateEmail("");
            setCreatePassword("");
            setCreateRole("USER");
         } else {
            const data = await res.json();
            showToast(data.error || "Erro ao criar", "error");
         }
      } catch (e) {
         showToast("Erro de conexão", "error");
      } finally {
         setSaving(false);
      }
   };

   const handleDeleteUser = async (userId: string, email: string) => {
      if (!confirm(`Tem certeza que deseja EXCLUIR permanentemente o usuário ${email}? Esta ação não pode ser desfeita.`)) return;
      
      try {
         const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
         if (res.ok) {
            showToast("Usuário excluído com sucesso!");
            fetchUsers();
         } else {
            showToast("Erro ao excluir", "error");
         }
      } catch (e) {
         showToast("Erro de conexão", "error");
      }
   };

   const handleToggleBlock = async (user: any) => {
      const newStatus = (user.status || "ACTIVE") === "ACTIVE" ? "BLOCKED" : "ACTIVE";
      const action = newStatus === "BLOCKED" ? "BLOQUEAR" : "DESBLOQUEAR";
      if (!confirm(`Deseja ${action} o usuário ${user.email}?`)) return;
      await handleUpdateUser(user.id, { status: newStatus });
   };

   const handleToggleRole = async (user: any) => {
      const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
      if (!confirm(`Deseja alterar o papel de ${user.email} para ${newRole}?`)) return;
      await handleUpdateUser(user.id, { role: newRole });
   };

   const handleShowHistory = async (user: any) => {
      setHistoryUser(user);
      setHistoryData([]);
      setHistoryLoading(true);
      try {
         const res = await fetch(`/api/admin/reservations?search=${encodeURIComponent(user.email)}&status=ALL&limit=100`);
         const data = await res.json();
         setHistoryData(data.reservations || data || []);
      } catch (e) {
         console.error(e);
      } finally {
         setHistoryLoading(false);
      }
   };

   return (
      <div className="space-y-6">
         {/* Toast */}
         {toast && (
            <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-2xl font-bold text-sm animate-pulse ${
               toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}>
               {toast.message}
            </div>
         )}

         {/* Header */}
         <div className="flex items-center justify-between">
            <div>
               <h1 className="text-2xl font-black text-white">Gestão de Usuários</h1>
               <p className="text-gray-400 text-sm mt-1">Gerencie todos os usuários da plataforma</p>
            </div>
            <div className="flex items-center gap-3">
               <span className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold">{filteredUsers.length} usuários</span>
               <a 
                 href="/api/admin/users/export"
                 target="_blank"
                 className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
               >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                 Exportar CSV
               </a>
               <button 
                 onClick={() => setShowCreateModal(true)}
                 className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
               >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                 Criar Usuário
               </button>
            </div>
         </div>

         {/* Filters */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-4">
               {/* Search */}
               <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                     <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                     </svg>
                     <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-green-600 transition-colors"
                     />
                  </div>
               </div>
               {/* Role Filter */}
               <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-green-600">
                  <option value="ALL">Todos os papéis</option>
                  <option value="USER">Usuário</option>
                  <option value="ADMIN">Admin</option>
               </select>
               {/* Status Filter */}
               <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-green-600">
                  <option value="ALL">Todos os status</option>
                  <option value="ACTIVE">Ativos</option>
                  <option value="BLOCKED">Bloqueados</option>
               </select>
            </div>
         </div>

         {/* Users Table */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-gray-800/50 border-b border-gray-700">
                     <tr>
                        <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Usuário</th>
                        <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Papel</th>
                        <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cadastro</th>
                        <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                     {loading && (
                        <tr><td colSpan={5} className="text-center py-10">
                           <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        </td></tr>
                     )}
                     {!loading && filteredUsers.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-10 text-gray-500">Nenhum usuário encontrado.</td></tr>
                     )}
                     {!loading && filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                           <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                 <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                                    (u.status || "ACTIVE") === "BLOCKED" ? "bg-red-900/50 text-red-400" : "bg-green-900/50 text-green-400"
                                 }`}>
                                    {(u.name || u.email || "?")[0].toUpperCase()}
                                 </div>
                                 <div>
                                    <p className="font-bold text-white">{u.name || "Sem nome"}</p>
                                    <p className="text-xs text-gray-500">{u.email}</p>
                                 </div>
                              </div>
                           </td>
                           <td className="px-5 py-4">
                              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                                 u.role === "ADMIN" ? "bg-purple-500/20 text-purple-400" : "bg-gray-700 text-gray-300"
                              }`}>
                                 {u.role || "USER"}
                              </span>
                           </td>
                           <td className="px-5 py-4">
                              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded flex items-center gap-1 w-fit ${
                                 (u.status || "ACTIVE") === "ACTIVE"
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-red-500/20 text-red-400"
                              }`}>
                                 <span className={`w-1.5 h-1.5 rounded-full ${(u.status || "ACTIVE") === "ACTIVE" ? "bg-green-500" : "bg-red-500"}`}></span>
                                 {(u.status || "ACTIVE") === "ACTIVE" ? "Ativo" : "Bloqueado"}
                              </span>
                           </td>
                           <td className="px-5 py-4 text-xs text-gray-500">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString("pt-BR") : "—"}
                           </td>
                           <td className="px-5 py-4">
                              <div className="flex items-center gap-2 justify-end">
                                 {/* History */}
                                 <button onClick={() => handleShowHistory(u)} className="p-1.5 rounded-lg bg-gray-800 hover:bg-blue-900/50 text-gray-400 hover:text-blue-400 transition-colors" title="Histórico de Compras">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                 </button>
                                 {/* Edit */}
                                 <button onClick={() => { setEditingUser(u); setNewName(u.name || ""); setNewPassword(""); }} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors" title="Editar">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                 </button>
                                 {/* Toggle Role */}
                                 <button onClick={() => handleToggleRole(u)} className={`p-1.5 rounded-lg transition-colors ${u.role === "ADMIN" ? "bg-purple-900/50 hover:bg-purple-800/50 text-purple-400" : "bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-purple-400"}`} title={u.role === "ADMIN" ? "Retirar Admin" : "Tornar Admin"}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                                 </button>
                                 {/* Toggle Block */}
                                 <button onClick={() => handleToggleBlock(u)} className={`p-1.5 rounded-lg transition-colors ${(u.status || "ACTIVE") === "BLOCKED" ? "bg-yellow-900/50 hover:bg-yellow-800/50 text-yellow-400" : "bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-yellow-400"}`} title={(u.status || "ACTIVE") === "BLOCKED" ? "Desbloquear" : "Bloquear"}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={(u.status || "ACTIVE") === "BLOCKED" ? "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" : "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"}></path></svg>
                                 </button>
                                 {/* Delete */}
                                 <button onClick={() => handleDeleteUser(u.id, u.email)} className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors" title="Excluir">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                 </button>
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>

         {/* Create User Modal */}
         {showCreateModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                     <h2 className="text-lg font-black text-white">Criar Novo Usuário</h2>
                     <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                     </button>
                  </div>
                  <form onSubmit={handleCreateUser}>
                    <div className="p-6 space-y-4">
                       <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Nome Completo</label>
                          <input type="text" required value={createName} onChange={e => setCreateName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-green-600" placeholder="Nome do usuário" />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-2">E-mail</label>
                          <input type="email" required value={createEmail} onChange={e => setCreateEmail(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-green-600" placeholder="usuario@email.com" />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Senha</label>
                          <input type="password" required minLength={6} value={createPassword} onChange={e => setCreatePassword(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-green-600" placeholder="Mínimo 6 caracteres" />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Papel (Role)</label>
                          <select value={createRole} onChange={e => setCreateRole(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600">
                             <option value="USER">Usuário Comum (USER)</option>
                             <option value="ADMIN">Administrador (ADMIN)</option>
                          </select>
                       </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
                       <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 rounded-lg bg-gray-800 text-gray-300 font-bold text-sm hover:bg-gray-700 transition-colors">
                          Cancelar
                       </button>
                       <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-colors disabled:opacity-50">
                          {saving ? "Criando..." : "Criar Usuário"}
                       </button>
                    </div>
                  </form>
               </div>
            </div>
         )}

         {/* Edit User Modal */}
         {editingUser && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                     <h2 className="text-lg font-black text-white">Editar Usuário</h2>
                     <button onClick={() => { setEditingUser(null); setNewPassword(""); setNewName(""); }} className="text-gray-500 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                     </button>
                  </div>
                  <div className="p-6 space-y-5">
                     {/* User Info */}
                     <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3">
                        <div className="w-10 h-10 rounded-full bg-green-900/50 flex items-center justify-center text-green-400 font-bold">
                           {(editingUser.name || editingUser.email || "?")[0].toUpperCase()}
                        </div>
                        <div>
                           <p className="font-bold text-white">{editingUser.name || "Sem nome"}</p>
                           <p className="text-xs text-gray-500">{editingUser.email}</p>
                        </div>
                     </div>

                     {/* Change Name */}
                     <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Nome</label>
                        <input
                           type="text"
                           value={newName}
                           onChange={e => setNewName(e.target.value)}
                           className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-green-600"
                           placeholder="Nome do usuário"
                        />
                     </div>

                     {/* Change Password */}
                     <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Nova Senha</label>
                        <input
                           type="password"
                           value={newPassword}
                           onChange={e => setNewPassword(e.target.value)}
                           className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-green-600"
                           placeholder="Deixe em branco para não alterar"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">A senha será encriptada automaticamente.</p>
                     </div>

                     {/* Quick Actions */}
                     <div className="flex gap-3">
                        <button
                           onClick={() => handleUpdateUser(editingUser.id, { role: editingUser.role === "ADMIN" ? "USER" : "ADMIN" })}
                           className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-colors ${editingUser.role === "ADMIN" ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-600/30"}`}
                        >
                           {editingUser.role === "ADMIN" ? "Remover Admin" : "Tornar Admin"}
                        </button>
                        <button
                           onClick={() => handleUpdateUser(editingUser.id, { status: (editingUser.status || "ACTIVE") === "ACTIVE" ? "BLOCKED" : "ACTIVE" })}
                           className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-colors ${(editingUser.status || "ACTIVE") === "BLOCKED" ? "bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/30" : "bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30"}`}
                        >
                           {(editingUser.status || "ACTIVE") === "BLOCKED" ? "Desbloquear" : "Bloquear"}
                        </button>
                     </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
                     <button onClick={() => { setEditingUser(null); setNewPassword(""); setNewName(""); }} className="px-5 py-2.5 rounded-lg bg-gray-800 text-gray-300 font-bold text-sm hover:bg-gray-700 transition-colors">
                        Cancelar
                     </button>
                     <button
                        disabled={saving}
                        onClick={() => {
                           const updates: any = {};
                           if (newName && newName !== editingUser.name) updates.name = newName;
                           if (newPassword) updates.newPassword = newPassword;
                           if (Object.keys(updates).length === 0) { showToast("Nenhuma alteração para salvar.", "error"); return; }
                           handleUpdateUser(editingUser.id, updates);
                        }}
                        className="px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-colors disabled:opacity-50"
                     >
                        {saving ? "Salvando..." : "Salvar Alterações"}
                     </button>
                  </div>
               </div>
            </div>
         )}
         {/* History Modal */}
         {historyUser && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setHistoryUser(null)}>
               <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
                     <div>
                        <h2 className="text-lg font-black text-white">📋 Histórico de Compras</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{historyUser.name || historyUser.email} · {historyUser.email}</p>
                     </div>
                     <button onClick={() => setHistoryUser(null)} className="text-gray-500 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                  </div>
                  <div className="overflow-y-auto flex-1">
                     {historyLoading ? (
                        <div className="flex items-center justify-center py-16">
                           <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                     ) : historyData.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                           <svg className="w-12 h-12 mx-auto mb-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                           <p className="font-bold">Nenhuma reserva encontrada</p>
                           <p className="text-xs mt-1">Este usuário ainda não fez nenhuma reserva.</p>
                        </div>
                     ) : (
                        <table className="w-full text-sm text-left">
                           <thead className="bg-gray-800/60 border-b border-gray-700 sticky top-0">
                              <tr>
                                 <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase">Reserva</th>
                                 <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase">Veículo</th>
                                 <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase">Retirada</th>
                                 <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase">Valor</th>
                                 <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase">Status</th>
                                 <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase">Data</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-800/50">
                              {historyData.map((res: any) => {
                                 const parsed = (() => { try { return JSON.parse(res.customerData || '{}'); } catch { return {}; } })();
                                 const STATUS_LABELS: Record<string,string> = { CONFIRMED_PREPAID: 'Pago Online', CONFIRMED_NON_PREPAID: 'Pagar Balcão', PENDING_PIX: 'PIX Aguardando', CANCELLED: 'Cancelada', ON_REQUEST: 'Sob Consulta' };
                                 const STATUS_COLORS: Record<string,string> = { CONFIRMED_PREPAID: 'bg-green-500/20 text-green-400', CONFIRMED_NON_PREPAID: 'bg-blue-500/20 text-blue-400', PENDING_PIX: 'bg-yellow-500/20 text-yellow-400', CANCELLED: 'bg-red-500/20 text-red-400', ON_REQUEST: 'bg-purple-500/20 text-purple-400' };
                                 const pickupDate = parsed?.booking?.pickupDate || parsed?.booking?.pickupdate || '';
                                 const formattedDate = pickupDate ? `${pickupDate.slice(6,8)}/${pickupDate.slice(4,6)}/${pickupDate.slice(0,4)}` : '—';
                                 const carName = parsed?.booking?.car?.carCategoryName || parsed?.booking?.car?.name || parsed?.booking?.car?.carCategoryCode || '—';
                                 return (
                                    <tr key={res.id} className="hover:bg-gray-800/30 transition-colors">
                                       <td className="px-5 py-3">
                                          <span className="font-mono font-bold text-white text-xs">{res.resNumber || '—'}</span>
                                       </td>
                                       <td className="px-5 py-3">
                                          <span className="text-gray-300 text-xs">{carName}</span>
                                       </td>
                                       <td className="px-5 py-3 text-xs text-gray-400">{formattedDate}</td>
                                       <td className="px-5 py-3">
                                          <span className="font-bold text-green-400 text-xs">
                                             {res.amountInCents ? `R$ ${(res.amountInCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                                          </span>
                                       </td>
                                       <td className="px-5 py-3">
                                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${STATUS_COLORS[res.status] || 'bg-gray-700 text-gray-300'}`}>
                                             {STATUS_LABELS[res.status] || res.status}
                                          </span>
                                       </td>
                                       <td className="px-5 py-3 text-xs text-gray-500">
                                          {new Date(res.createdAt).toLocaleDateString('pt-BR')}
                                       </td>
                                    </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     )}
                  </div>
                  <div className="px-6 py-3 border-t border-gray-800 shrink-0 flex items-center justify-between">
                     <span className="text-xs text-gray-500">{historyData.length} reserva{historyData.length !== 1 ? 's' : ''} encontrada{historyData.length !== 1 ? 's' : ''}</span>
                     <button onClick={() => setHistoryUser(null)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-sm rounded-lg transition-colors">Fechar</button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}
