import React from 'react';
import { LayoutDashboard, History, PieChart, Info, LogOut, CreditCard, ShieldCheck, User } from 'lucide-react';
import { cn } from '../lib/utils';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdmin?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, isAdmin }) => {
  const mainTabs = [
    { id: 'scan', label: 'Scan IA', icon: LayoutDashboard },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'stats', label: 'Estatísticas', icon: PieChart },
  ];

  const accountTabs = [
    { id: 'plans', label: 'Planos', icon: CreditCard },
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  if (isAdmin) {
    accountTabs.push({ id: 'admin', label: 'Admin', icon: ShieldCheck });
  }

  const allTabs = [...mainTabs, ...accountTabs]; // For mobile rendering

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 md:translate-x-0 md:static md:w-64 md:h-screen md:flex-col glass-card !p-4 flex items-center md:items-stretch gap-1.5 z-50">
      <div className="hidden md:flex items-center gap-3 p-3 mb-6 w-full border-b border-white/5 pb-6">
        <img 
          src="https://i.ibb.co/9BwbV3M/FXBROS-WORLD-3.png" 
          alt="Logo" 
          className="w-16 h-16 object-contain drop-shadow-[0_0_15px_rgba(255,0,0,0.2)]"
          referrerPolicy="no-referrer"
        />
        <div className="flex flex-col">
          <span className="font-black italic text-xl tracking-tighter uppercase leading-none">
            QUANT<span className="text-brand-red">SCAN</span>
          </span>
          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] mt-1">IA TRADER</span>
        </div>
      </div>

      {/* Mobile view */}
      <div className="flex md:hidden gap-2 w-full justify-around">
        {allTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "p-3 rounded-xl transition-all duration-300 flex items-center gap-3 group relative",
              activeTab === tab.id 
                ? "text-brand-red" 
                : "text-zinc-500"
            )}
          >
            {activeTab === tab.id && (
              <span className="absolute inset-0 bg-brand-red/10 rounded-xl" />
            )}
            <tab.icon size={20} className={cn(activeTab === tab.id ? "scale-110" : "group-hover:scale-110 transition-transform")} />
            <span className="hidden leading-none text-[9px] font-black uppercase tracking-tighter">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Desktop view */}
      <div className="hidden md:flex flex-col flex-1 w-full gap-6">
        {/* Main Section */}
        <div className="flex flex-col gap-1 w-full">
          <div className="px-3 mb-1 text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em]">Menu Principal</div>
          {mainTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "p-3 rounded-xl transition-all duration-300 flex items-center gap-3 w-full group",
                activeTab === tab.id 
                  ? "bg-brand-red text-white red-glow" 
                  : "text-zinc-500 hover:text-white hover:bg-white/5"
              )}
            >
              <tab.icon size={20} className={cn(activeTab === tab.id ? "scale-110" : "group-hover:scale-110 transition-transform")} />
              <span className="text-[11px] font-black uppercase tracking-widest transition-all">
                {tab.label}
              </span>
            </button>
          ))}
        </div>

        {/* Account Section */}
        <div className="flex flex-col gap-1 w-full mt-auto mb-2">
          <div className="px-3 mb-1 text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em]">Conta & Ajuda</div>
          {accountTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "p-3 rounded-xl transition-all duration-300 flex items-center gap-3 w-full group",
                activeTab === tab.id 
                  ? "bg-brand-red text-white red-glow" 
                  : "text-zinc-500 hover:text-white hover:bg-white/5"
              )}
            >
              <tab.icon size={20} className={cn(activeTab === tab.id ? "scale-110" : "group-hover:scale-110 transition-transform")} />
              <span className="text-[11px] font-black uppercase tracking-widest transition-all">
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};
