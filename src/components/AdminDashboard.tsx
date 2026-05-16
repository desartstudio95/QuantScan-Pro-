import React, { useState, useEffect } from 'react';
import { Users, ShieldCheck, Search, Loader2, Settings, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, orderBy, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { ImageUploader } from './ImageUploader';

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  isPremium: boolean;
  isAdmin: boolean;
  analysisLimit?: number;
  plan?: 'basic' | 'pro' | 'elite' | 'lifetime';
  isApproved?: boolean;
  subscriptionStartsAt?: number;
  subscriptionEndsAt?: number | null;
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
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

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

    const settingsRef = doc(db, 'settings', 'app');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setMaintenanceMode(docSnap.data().maintenanceMode || false);
        setMaintenanceMessage(docSnap.data().maintenanceMessage || '');
      }
    }, (error) => {
      console.warn("Failed to listen to settings:", error);
    });

    return () => {
      unsub();
      unsubTestimonials();
      unsubSettings();
    };
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const settingsRef = doc(db, 'settings', 'app');
      // Using setDoc with merge to create it if it doesn't exist
      await setDoc(settingsRef, {
        maintenanceMode,
        maintenanceMessage
      }, { merge: true });
      alert('Configurações salvas com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar as configurações.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleApproval = async (user: any) => {
    try {
      const updates: any = { isApproved: !user.isApproved };
      
      // Se estiver aprovando pela primeira vez (ou não tem data), define o início e fim
      if (!user.isApproved && !user.subscriptionStartsAt) {
        updates.subscriptionStartsAt = Date.now();
        if (user.plan !== 'lifetime') {
          updates.subscriptionEndsAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 dias
        }
      }

      await updateDoc(doc(db, 'users', user.uid), updates).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, 'users/' + user.uid);
        throw err;
      });
    } catch (err) {
      console.error("Failed to update user approval status", err);
      alert('Falha ao atualizar status de aprovação. Verifique as permissões de Admin.');
    }
  };

  const handlePlanChange = async (user: any, newPlan: 'basic' | 'experimental' | 'pro' | 'elite' | 'lifetime') => {
    let limit = 8;
    let isPremium = false;

    if (newPlan === 'experimental') {
      limit = 3;
      isPremium = false;
    } else if (newPlan === 'pro') {
      limit = 15;
      isPremium = true;
    } else if (newPlan === 'elite' || newPlan === 'lifetime') {
      limit = 999999; // Represents unlimited
      isPremium = true;
    }

    const updates: any = {
      plan: newPlan,
      analysisLimit: limit,
      isPremium
    };

    // Atualiza a validade se mudar o plano
    if (newPlan === 'lifetime') {
      updates.subscriptionEndsAt = null; // Lifetime não expira
    } else if (newPlan === 'experimental') {
      // Experimental dura 14 dias
      if (user.isApproved) {
        updates.subscriptionEndsAt = Date.now() + 14 * 24 * 60 * 60 * 1000;
      }
    } else {
      // Se não tinha data de fim e já estava aprovado, define 30 dias a partir de agora
      if (user.isApproved && !user.subscriptionEndsAt) {
        updates.subscriptionEndsAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      }
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), updates).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, 'users/' + user.uid);
        throw err;
      });
    } catch (err) {
      console.error("Failed to update user plan", err);
      alert('Falha ao atualizar plano do usuário.');
    }
  };

  const handleRenewSubscription = async (user: any) => {
    try {
      const now = Date.now();
      const currentEnd = user.subscriptionEndsAt || now;
      // Retoma do momento atual se já expirou, ou adiciona ao fim atual se ainda está ativo
      const newEnd = (currentEnd > now ? currentEnd : now) + 30 * 24 * 60 * 60 * 1000;
      
      await updateDoc(doc(db, 'users', user.uid), {
        subscriptionEndsAt: newEnd
      }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, 'users/' + user.uid);
        throw err;
      });
      alert('Assinatura renovada com sucesso por 30 dias!');
    } catch (err) {
      console.error("Failed to renew user", err);
      alert('Falha ao renovar assinatura.');
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

      <div className="glass-card p-6 space-y-4 border-l-4 border-l-brand-red mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="text-zinc-400" size={20} />
          <h3 className="font-black uppercase tracking-widest text-zinc-300 text-sm">Configurações do Sistema</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className={maintenanceMode ? "text-brand-red" : "text-zinc-500"} size={18} />
                <span className="text-sm font-bold text-white uppercase tracking-wider">Modo de Manutenção</span>
              </div>
              <button 
                onClick={() => setMaintenanceMode(!maintenanceMode)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  maintenanceMode ? "bg-brand-red" : "bg-zinc-700"
                )}
              >
                <span className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  maintenanceMode ? "translate-x-6" : "translate-x-1"
                )} />
              </button>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              O modo de manutenção bloqueia o acesso ao aplicativo para todos os usuários comuns, exibindo uma tela de aviso. Somente administradores poderão acessar a plataforma.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
              Mensagem de Manutenção (Opcional)
            </label>
            <textarea
              placeholder="Ex: Estamos realizando melhorias..."
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-red text-sm min-h-[80px]"
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              disabled={!maintenanceMode}
            />
          </div>
        </div>

        <button 
          onClick={handleSaveSettings}
          disabled={savingSettings}
          className="mt-6 w-full md:w-auto px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          Salvar Configurações
        </button>
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
                <th className="p-4 text-center">Assinatura</th>
                <th className="p-4 text-center">Ações</th>
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
                      onClick={() => handleToggleApproval(user)}
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
                      onChange={(e) => handlePlanChange(user, e.target.value as 'experimental' | 'basic' | 'pro' | 'elite' | 'lifetime')}
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-black tracking-widest focus:outline-none focus:border-brand-red/50 cursor-pointer"
                    >
                      <option value="experimental">Exp (2 Sem)</option>
                      <option value="basic">Básico</option>
                      <option value="pro">Premium (Pro)</option>
                      <option value="elite">Elite</option>
                      <option value="lifetime">Lifetime</option>
                    </select>
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-sm font-mono font-bold text-white">
                      {user.analysisLimit === 999999 ? 'Ilimitado' : user.analysisLimit ?? 8}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {user.plan === 'lifetime' ? (
                      <span className="text-[10px] font-black text-brand-red uppercase tracking-widest">Vitalício</span>
                    ) : user.subscriptionEndsAt ? (
                      <div className="flex flex-col items-center justify-center">
                        <span className={cn(
                          "text-[10px] font-bold font-mono",
                          user.subscriptionEndsAt < Date.now() ? "text-brand-red" : 
                          user.subscriptionEndsAt < Date.now() + 3*24*60*60*1000 ? "text-orange-500" : "text-zinc-400"
                        )}>
                          {user.subscriptionEndsAt < Date.now() ? "Expirado" : "Vence"}: {new Date(user.subscriptionEndsAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-600 font-bold">-</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {user.plan !== 'lifetime' && user.isApproved && (
                      <button
                        onClick={() => handleRenewSubscription(user)}
                        className="px-3 py-1 bg-white/10 hover:bg-brand-red/20 text-white hover:text-brand-red border border-white/10 hover:border-brand-red/30 rounded text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Renovar
                      </button>
                    )}
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
