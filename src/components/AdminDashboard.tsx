import React, { useState, useEffect } from 'react';
import { Users, ShieldCheck, Search, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  isPremium: boolean;
  isAdmin: boolean;
  analysisLimit?: number;
  plan?: 'basic' | 'pro' | 'elite';
  isApproved?: boolean;
}

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList: UserProfile[] = [];
      snapshot.forEach(doc => {
        usersList.push(doc.data() as UserProfile);
      });
      setUsers(usersList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleToggleApproval = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isApproved: !currentStatus
      }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, 'users/' + userId);
        throw err;
      });
    } catch (err) {
      console.error("Failed to update user approval status", err);
      alert('Falha ao atualizar status de aprovação. Verifique as permissões de Admin.');
    }
  };

  const handlePlanChange = async (userId: string, newPlan: 'basic' | 'pro' | 'elite') => {
    let limit = 8;
    let isPremium = false;

    if (newPlan === 'pro') {
      limit = 15;
      isPremium = true;
    } else if (newPlan === 'elite') {
      limit = 999999; // Represents unlimited
      isPremium = true;
    }

    try {
      await updateDoc(doc(db, 'users', userId), {
        plan: newPlan,
        analysisLimit: limit,
        isPremium
      }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, 'users/' + userId);
        throw err;
      });
    } catch (err) {
      console.error("Failed to update user plan", err);
      alert('Falha ao atualizar plano do usuário.');
    }
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
            <ShieldCheck size={24} className="text-brand-red" />
            Painel Admin
          </h2>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Gerenciamento de Clientes</p>
        </div>
        
        <div className="relative group">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-brand-red transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar usuário..." 
            className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-red/50 w-64 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 size={32} className="text-brand-red animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Carregando usuários...</p>
        </div>
      ) : (
        <div className="glass-card !p-0 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-white/5 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <th className="p-4">Usuário</th>
                <th className="p-4 text-center">Aprovação</th>
                <th className="p-4 text-center">Plano</th>
                <th className="p-4 text-center">Limite Diário</th>
                <th className="p-4 text-center">Admin</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-red/10 flex items-center justify-center text-brand-red text-sm font-black italic shrink-0">
                        {user.name?.charAt(0) || user.email?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex flex-col truncate min-w-0">
                        <span className="text-sm font-bold text-white leading-none mb-1 truncate">{user.name}</span>
                        <span className="text-[10px] text-zinc-500 font-medium truncate">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => handleToggleApproval(user.uid, !!user.isApproved)}
                      className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                        user.isApproved 
                          ? "bg-green-500/20 text-green-500 border border-green-500/30" 
                          : "bg-orange-500/20 text-orange-500 border border-orange-500/30 hover:bg-orange-500/30"
                      )}
                    >
                      {user.isApproved ? 'Aprovado' : 'Aguardando'}
                    </button>
                  </td>
                  <td className="p-4 text-center">
                    <select 
                      value={user.plan || 'basic'}
                      onChange={(e) => handlePlanChange(user.uid, e.target.value as 'basic' | 'pro' | 'elite')}
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-black tracking-widest focus:outline-none focus:border-brand-red/50 cursor-pointer"
                    >
                      <option value="basic">Básico</option>
                      <option value="pro">Premium (Pro)</option>
                      <option value="elite">Elite</option>
                    </select>
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-sm font-mono font-bold text-white">
                      {user.analysisLimit === 999999 ? 'Ilimitado' : user.analysisLimit ?? 8}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {user.isAdmin && (
                      <span className="bg-brand-red/20 text-brand-red px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-brand-red/20">
                        Admin
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredUsers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
              <Users size={48} strokeWidth={1} className="mb-4 opacity-20" />
              <p className="text-xs font-black uppercase tracking-widest">Nenhum usuário encontrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
