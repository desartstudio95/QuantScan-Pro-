import React, { useState, useEffect } from 'react';
import { Users, ShieldCheck, Search, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { ImageUploader } from './ImageUploader';

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
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [testUser, setTestUser] = useState('');
  const [testText, setTestText] = useState('');
  const [testImageUrls, setTestImageUrls] = useState<string[]>([]);
  const [submittingTestimonial, setSubmittingTestimonial] = useState(false);

  const handleCreateTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testUser.trim() || !testText.trim() || !auth.currentUser) return;
    setSubmittingTestimonial(true);
    try {
      await addDoc(collection(db, 'testimonials'), {
        userId: auth.currentUser.uid,
        userName: testUser,
        text: testText,
        timestamp: Date.now(),
        imageUrls: testImageUrls
      });
      setTestUser('');
      setTestText('');
      setTestImageUrls([]);
      alert('Resultado postado com sucesso!');
    } catch(err) {
      console.error(err);
      alert('Erro ao postar');
    } finally {
      setSubmittingTestimonial(false);
    }
  };

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

    const q = query(collection(db, 'testimonials'), orderBy('timestamp', 'desc'));
    const unsubTestimonials = onSnapshot(q, (snapshot) => {
      setTestimonials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
       console.error("Testimonials fetch error:", error);
    });

    return () => {
      unsub();
      unsubTestimonials();
    };
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

  const handleDeleteTestimonial = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este resultado?')) return;
    try {
      await deleteDoc(doc(db, 'testimonials', id));
      alert('Resultado removido com sucesso!');
    } catch (err) {
      console.error("Failed to delete testimonial", err);
      alert('Erro ao remover resultado.');
    }
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-red/50 w-full md:w-64 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <form onSubmit={handleCreateTestimonial} className="glass-card p-6 space-y-4">
        <h3 className="font-black uppercase tracking-widest text-brand-red text-sm">Postar Resultado como Admin</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
                type="text"
                placeholder="Nome do Usuário"
                className="bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-red"
                value={testUser}
                onChange={(e) => setTestUser(e.target.value)}
            />
            <div className="space-y-1">
                <ImageUploader onUpload={setTestImageUrls} />
                {testImageUrls.length > 0 && <p className="text-xs text-green-500">{testImageUrls.length} imagem(ns) carregada(s)!</p>}
            </div>
        </div>
        <textarea
            placeholder="Texto do Resultado"
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-red"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
        />
        <button 
            disabled={submittingTestimonial}
            type="submit" 
            className="bg-brand-red text-white py-2 px-4 rounded-lg font-bold hover:bg-opacity-90 disabled:opacity-50 w-full"
        >
            {submittingTestimonial ? 'Postando...' : 'Postar Resultado'}
        </button>
      </form>

      {testimonials.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-black uppercase tracking-widest text-brand-red text-sm">Resultados Postados</h3>
          <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-none snap-x">
             {testimonials.map(t => (
               <div key={t.id} className="min-w-[250px] w-[250px] bg-white/5 border border-white/10 rounded-lg p-4 space-y-3 shrink-0 snap-center relative group flex flex-col">
                  {t.imageUrls && t.imageUrls.length > 0 && (
                    <img src={t.imageUrls[0]} className="w-full h-24 object-cover rounded bg-black/20" alt="Result" referrerPolicy="no-referrer" />
                  )}
                  <p className="text-xs text-zinc-300 italic flex-grow">"{t.text}"</p>
                  <p className="text-[10px] text-brand-red font-bold uppercase">— {t.userName}</p>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDeleteTestimonial(t.id)} className="bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded" title="Remover">
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </div>
               </div>
             ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 size={32} className="text-brand-red animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Carregando usuários...</p>
        </div>
      ) : (
        <div className="glass-card !p-0 overflow-x-auto">
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
                      <div className="w-10 h-10 rounded-xl bg-brand-red/10 overflow-hidden shrink-0 border border-white/10 group-hover:border-brand-red/30 transition-colors">
                        <img 
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                          alt={user.name} 
                          className="w-full h-full object-cover"
                        />
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
