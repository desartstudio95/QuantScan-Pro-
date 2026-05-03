/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AnalysisView } from './components/AnalysisView';
import { SignalHistory } from './components/SignalHistory';
import { DashboardStats } from './components/DashboardStats';
import { PlansView } from './components/PlansView';
import { AdminDashboard } from './components/AdminDashboard';
import { LandingPage } from './components/LandingPage';
import { ProfileView } from './components/ProfileView';
import { NotificationManager } from './components/NotificationManager';
import { TrendingUp, ShieldAlert, Ghost, Mail, Lock, UserPlus, LogIn, Loader2, ArrowLeft, User as UserIcon, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, sendEmailVerification, sendPasswordResetEmail, User, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('scan');
  
      // Auth & View State
  const [isSecretAdminRoute, setIsSecretAdminRoute] = useState(() => window.location.pathname === '/fxbros-admin' || window.location.hash === '#/fxbros-admin');
  const [showAuth, setShowAuth] = useState(isSecretAdminRoute);
  const [isLogin, setIsLogin] = useState(true);
  const [showVerification, setShowVerification] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [unauthView, setUnauthView] = useState<'hero' | 'plans'>('hero');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.emailVerified) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef).catch(err => {
            handleFirestoreError(err, OperationType.GET, 'users/' + currentUser.uid);
            throw err;
          });
          
          let data = {
             uid: currentUser.uid,
             email: currentUser.email,
             name: currentUser.displayName || 'User',
             isAdmin: currentUser.email === "fxbrosinvestments00@gmail.com",
             isPremium: false,
             plan: 'basic' as const,
             analysisLimit: 8,
             isApproved: currentUser.email === "fxbrosinvestments00@gmail.com"
          };

          if (userSnap.exists()) {
            data = { ...data, ...userSnap.data() };
            if (!data.isApproved && !data.isAdmin) {
              await signOut(auth);
              setAuthError('Sua conta foi criada. Aguarde aprovação manual do administrador.');
              setShowAuth(true);
              setIsLogin(true);
              setUser(null);
              setUserData(null);
              setLoading(false);
              return;
            }
            setUserData(data);
          } else {
            await setDoc(userRef, data).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, 'users/' + currentUser.uid);
              throw err;
            });
            if (!data.isApproved && !data.isAdmin) {
              await signOut(auth);
              setAuthError('Sua conta foi criada. Aguarde aprovação manual do administrador.');
              setShowAuth(true);
              setIsLogin(true);
              setUser(null);
              setUserData(null);
              setLoading(false);
              return;
            }
            setUserData(data);
          }
        } catch (err) {
          console.error("Firestore user initialization error:", err);
          // Set minimal data to allow UI to render, but it might be limited due to rules
          setUserData({ isPremium: false, isAdmin: currentUser.email === "fxbrosinvestments00@gmail.com", isApproved: false });
        }

        setUser(currentUser);
        setUnauthView('hero');
        setShowAuth(false);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isAdmin = user?.email === "fxbrosinvestments00@gmail.com" || userData?.isAdmin;

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const targetEmail = email.toLowerCase() === 'admin' ? 'fxbrosinvestments00@gmail.com' : email;
      await sendPasswordResetEmail(auth, targetEmail);
      setResetEmailSent(true);
    } catch (error: any) {
      console.error(error);
      setAuthError('Falha ao enviar e-mail de recuperação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);

    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      if (isLogin) {
        const targetEmail = email.toLowerCase() === 'admin' ? 'fxbrosinvestments00@gmail.com' : email;
        const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
        if (!userCredential.user.emailVerified) {
          try {
            await sendEmailVerification(userCredential.user);
          } catch (e) {
            console.error("Verification email send error:", e);
          }
          await signOut(auth);
          setVerificationEmail(email);
          setShowVerification(true);
        }
      } else {
        if (password !== repeatPassword) {
          setAuthError('Passwords do not match.');
          setIsSubmitting(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        try {
          await setDoc(doc(db, 'users', userCredential.user.uid), {
             uid: userCredential.user.uid,
             email: userCredential.user.email,
             name: name,
             isAdmin: userCredential.user.email === "fxbrosinvestments00@gmail.com",
             isPremium: false,
             plan: 'basic',
             analysisLimit: 8,
             isApproved: userCredential.user.email === "fxbrosinvestments00@gmail.com"
          });
        } catch (e) {
          console.error("Failed to write new user to DB", e);
        }
        try {
          await sendEmailVerification(userCredential.user);
        } catch (e) {
          console.error("Verification email send error:", e);
        }
        await signOut(auth);
        setVerificationEmail(email);
        setShowVerification(true);
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      if (isLogin) {
        setAuthError('Email or Password Incorrect');
      } else {
        if (error.code === 'auth/email-already-in-use') {
          setAuthError('User already exists. Sign in?');
          setIsLogin(true);
        } else {
          setAuthError('Failed to register.');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setShowAuth(false);
    setUnauthView('hero');
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-brand-dark gap-6">
        <img 
          src="https://i.ibb.co/9BwbV3M/FXBROS-WORLD-3.png" 
          alt="Logo" 
          className="w-24 h-24 object-contain animate-pulse"
        />
        <div className="w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    if (!showAuth) {
      if (unauthView === 'hero') {
        return <LandingPage onGetStarted={() => setShowAuth(true)} onViewPlans={() => setUnauthView('plans')} />;
      }
      return (
        <div className="min-h-screen">
          <PlansView 
            isUnauthenticated={true} 
            onGetStarted={() => setShowAuth(true)} 
            onBack={() => setUnauthView('hero')} 
          />
        </div>
      );
    }

    return (
      <main className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-6 selection:bg-brand-red selection:text-white relative overflow-hidden">
        {/* Background Image for Login */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img 
            src="https://i.ibb.co/BRvFhtp/Chat-GPT-Image-28-de-abr-de-2026-12-49-43.png" 
            alt="Login Background" 
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/40 via-brand-dark/20 to-brand-dark" />
        </div>

        <div className="max-w-[400px] w-full space-y-6 relative z-10">
          <button 
            onClick={() => setShowAuth(false)}
            className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold transition-colors mb-4"
          >
            <ArrowLeft size={16} /> VOLTAR PARA O INÍCIO
          </button>

          <div className="text-center space-y-2">
            <div className="mx-auto w-24 h-24 flex items-center justify-center mb-2">
              <img 
                src="https://i.ibb.co/9BwbV3M/FXBROS-WORLD-3.png" 
                alt="Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <div className="space-y-0.5">
              <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">
                {isSecretAdminRoute ? <>FXBROS <span className="text-brand-red">ADMIN</span></> : <>QUANT<span className="text-brand-red">SCAN</span></>}
              </h1>
              <p className="text-zinc-500 font-medium text-[10px] leading-tight">
                {isSecretAdminRoute ? "Acesso Restrito" : "Acesse a inteligência institucional Pro."}
              </p>
            </div>
          </div>

          <motion.div 
            key={showVerification ? 'verify' : showForgotPassword ? 'forgot' : isLogin ? 'login' : 'register'}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-5 md:p-6 space-y-5 border-zinc-800/50"
          >
            {showVerification ? (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Mail size={32} className="text-brand-red" />
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                  We have sent you a verification email to <span className="font-bold text-white">{verificationEmail}</span>. Verify it and log in.
                </p>
                <button 
                  onClick={() => {
                    setShowVerification(false);
                    setIsLogin(true);
                    setEmail('');
                    setPassword('');
                  }}
                  className="w-full bg-brand-red text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-brand-red/90 transition-all active:scale-95 text-base red-glow"
                >
                  LOGIN
                </button>
              </div>
            ) : showForgotPassword ? (
              resetEmailSent ? (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Mail size={32} className="text-brand-red" />
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                    We sent you a password change link to <span className="font-bold text-white">{email}</span>.
                  </p>
                  <button 
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmailSent(false);
                      setIsLogin(true);
                      setAuthError(null);
                    }}
                    className="w-full bg-brand-red text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-brand-red/90 transition-all active:scale-95 text-base red-glow"
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center space-y-2 mb-6">
                    <h3 className="text-xl font-black italic uppercase text-white tracking-tighter">Recuperar Senha</h3>
                    <p className="text-xs text-zinc-400 font-medium">Digite seu e-mail para receber o link de redefinição.</p>
                  </div>
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">E-mail</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                        <input 
                          type="text" 
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="seu@email.com"
                          className="w-full bg-brand-dark/50 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-brand-red/50 transition-colors"
                          autoCapitalize="none"
                        />
                      </div>
                    </div>
                    {authError && (
                      <p className="text-brand-red text-[10px] font-bold text-center">{authError}</p>
                    )}
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-brand-red text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-brand-red/90 transition-all active:scale-95 text-base disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Get Reset Link'}
                    </button>
                  </form>
                  <button 
                    onClick={() => {
                      setShowForgotPassword(false);
                      setAuthError(null);
                    }}
                    className="w-full py-3.5 text-zinc-400 hover:text-white text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={14} /> Voltar
                  </button>
                </div>
              )
            ) : (
              <>
                {!isSecretAdminRoute && (
                  <div className="flex bg-brand-dark p-1 rounded-lg border border-white/5">
                    <button 
                      onClick={() => { setIsLogin(true); setAuthError(null); }}
                      className={`flex-1 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-tighter transition-all ${isLogin ? 'bg-brand-red text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Login
                    </button>
                    <button 
                      onClick={() => { setIsLogin(false); setAuthError(null); }}
                      className={`flex-1 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-tighter transition-all ${!isLogin ? 'bg-brand-red text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Cadastro
                    </button>
                  </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                  {!isLogin && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Nome Completo</label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                        <input 
                          type="text" 
                          required={!isLogin}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Seu Nome"
                          className="w-full bg-brand-dark/50 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-brand-red/50 transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                      <input 
                        type="text" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full bg-brand-dark/50 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-brand-red/50 transition-colors"
                        autoCapitalize="none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Senha</label>
                      {isLogin && (
                        <button 
                          type="button" 
                          onClick={() => {
                            setShowForgotPassword(true);
                            setAuthError(null);
                            setResetEmailSent(false);
                          }} 
                          className="text-[10px] uppercase font-black tracking-widest text-zinc-400 hover:text-brand-red transition-colors"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-brand-dark/50 border border-white/5 rounded-xl py-3 pl-10 pr-10 text-white text-sm focus:outline-none focus:border-brand-red/50 transition-colors"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {!isLogin && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Repetir Senha</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                        <input 
                          type={showConfirmPassword ? "text" : "password"} 
                          required={!isLogin}
                          value={repeatPassword}
                          onChange={(e) => setRepeatPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-brand-dark/50 border border-white/5 rounded-xl py-3 pl-10 pr-10 text-white text-sm focus:outline-none focus:border-brand-red/50 transition-colors"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {isLogin && (
                    <div className="flex items-center gap-2 mt-2 ml-1">
                       <input 
                         type="checkbox" 
                         id="remember"
                         checked={rememberMe}
                         onChange={(e) => setRememberMe(e.target.checked)}
                         className="w-3.5 h-3.5 rounded bg-brand-dark/50 border border-white/10 accent-brand-red cursor-pointer"
                       />
                       <label htmlFor="remember" className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest cursor-pointer hover:text-zinc-300">
                         Mantenha-me logado
                       </label>
                    </div>
                  )}

                  {authError && (
                    <p className="text-brand-red text-[10px] font-bold text-center">{authError}</p>
                  )}

                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-brand-red text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-brand-red/90 transition-all active:scale-95 text-base disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <>
                        {isLogin ? 'ENTRAR' : 'CADASTRAR'}
                        {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                      </>
                    )}
                  </button>
                  {authError && !isLogin && authError.includes('aprov') && (
                     <p className="text-zinc-400 text-[10px] text-center mt-2">Após o cadastro, aguarde a aprovação manual.</p>
                  )}
                </form>
              </>
            )}
          </motion.div>
          
          <div className="flex items-center justify-center gap-6 pt-4 opacity-25">
            <div className="flex items-center gap-2 text-[8px] uppercase font-black tracking-widest text-zinc-600">
               <ShieldAlert size={10} />
               Secure Auth
            </div>
            <div className="flex items-center gap-2 text-[8px] uppercase font-black tracking-widest text-zinc-600">
               <Ghost size={10} />
               IA Logic
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark text-white flex flex-col md:flex-row pb-20 md:pb-0 relative overflow-hidden">
      <NotificationManager />
      {/* Background Image for App */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img 
          src="https://i.ibb.co/YFQNMsjX/7eaead9a-0cd4-48d7-8f10-b32d98256e6f.png" 
          alt="App Background" 
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/40 via-brand-dark/20 to-brand-dark" />
      </div>

      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} user={user} />
      
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 flex flex-col">
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between p-8 pb-4 max-w-6xl w-full mx-auto">
          <div className="space-y-1">
            <span className="block text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-1">Olá Humano, Bem-Vindo</span>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">
              {activeTab === 'scan' && 'Scanner de IA'}
              {activeTab === 'history' && 'Histórico de Sinais'}
              {activeTab === 'stats' && 'Performance & Dados'}
              {activeTab === 'profile' && 'Perfil do Usuário'}
              {activeTab === 'admin' && 'Painel Administrativo'}
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
               <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
               Servidor Live • Latência 24ms
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={handleLogout} className="glass-card !p-2 text-zinc-500 hover:text-white transition-all">
              <LogIn size={20} className="rotate-180" />
            </button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-12 md:pt-4">
          <header className="flex justify-between items-center mb-6 md:hidden">
             <div className="flex items-center gap-2">
                <img 
                  src="https://i.ibb.co/9BwbV3M/FXBROS-WORLD-3.png" 
                  alt="Logo" 
                  className="w-12 h-12 object-contain"
                  referrerPolicy="no-referrer"
                />
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 tracking-widest uppercase font-bold">Olá Humano, Bem-Vindo</span>
                  <div className="font-black italic text-xl tracking-tighter uppercase leading-none">QUANT<span className="text-brand-red">SCAN</span></div>
                </div>
             </div>
             <button onClick={handleLogout} className="text-zinc-500 hover:text-white p-2">
               <LogIn size={18} className="rotate-180" />
             </button>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {activeTab === 'scan' && <AnalysisView userData={userData} />}
              {activeTab === 'history' && <SignalHistory />}
              {activeTab === 'stats' && <DashboardStats />}
              {activeTab === 'profile' && <ProfileView user={user} userData={userData} onUpdate={setUserData} onDeleted={handleLogout} />}
              {activeTab === 'admin' && isAdmin && <AdminDashboard />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

