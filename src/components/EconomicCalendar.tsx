import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import axios from 'axios';

interface EventProps {
    id: string;
    date: string;
    time: string;
    currency: string;
    title: string;
    impact: 'High' | 'Medium' | 'Low' | string;
    actual?: string;
    forecast?: string;
    previous?: string;
}

export const EconomicCalendar = () => {
    const [events, setEvents] = useState<EventProps[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        const fetchEvents = async () => {
            try {
                // Request pure JSON data
                const response = await axios.get('/api/economic_calendar');
                if (response.data && response.data.success) {
                    const mappedEvents = response.data.data.map((item: any, i: number) => {
                        const eventDate = new Date(item.date);
                        return {
                            id: String(i),
                            date: eventDate.toISOString().split('T')[0],
                            time: eventDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                            currency: item.country,
                            title: item.title,
                            impact: item.impact,
                            forecast: item.forecast,
                            previous: item.previous
                        };
                    });
                    setEvents(mappedEvents.sort((a: any, b: any) => {
                        if (a.date === b.date) {
                            return a.time.localeCompare(b.time);
                        }
                        return a.date.localeCompare(b.date);
                    }));
                } else {
                    setError("Dados indísponíveis no momento.");
                }
            } catch (err) {
                console.error(err);
                setError("Não foi possível carregar o calendário económico ao vivo.");
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    const getImpactColor = (impact: string) => {
        switch(impact) {
            case 'High': return 'text-brand-red border-brand-red/20 bg-brand-red/10';
            case 'Medium': return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10';
            case 'Low': return 'text-green-500 border-green-500/20 bg-green-500/10';
            case 'Holiday': return 'text-purple-500 border-purple-500/20 bg-purple-500/10';
            default: return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 h-full flex flex-col">
            <header className="flex-shrink-0">
                <h1 className="text-xl font-black italic tracking-tighter text-white flex items-center gap-3 uppercase">
                    <CalendarIcon size={20} className="text-brand-red" />
                    Calendário Econômico
                </h1>
                <p className="text-zinc-500 mt-1 text-[10px] font-medium leading-none">Acompanhe eventos de alto impacto no mercado em tempo real.</p>
            </header>

            <div className="bg-[#0a0000] border border-white/5 rounded-2xl p-6 shadow-xl flex-1 overflow-hidden flex flex-col">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-red mb-3" />
                        <span className="text-sm font-semibold tracking-wide uppercase">Sincronizando feed institucional...</span>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-brand-red">
                        <AlertCircle className="w-8 h-8 mb-3 opacity-80" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto h-full flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 text-[9px] uppercase tracking-widest text-zinc-500 font-black">
                                    <th className="pb-3 px-4 font-bold">Date & Time</th>
                                    <th className="pb-3 px-4 font-bold">Cur</th>
                                    <th className="pb-3 px-4 font-bold">Impact</th>
                                    <th className="pb-3 px-4 font-bold">Event</th>
                                    <th className="pb-3 px-4 font-bold text-right">Actual</th>
                                    <th className="pb-3 px-4 font-bold text-right">Forecast</th>
                                    <th className="pb-3 px-4 font-bold text-right">Previous</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((event) => (
                                    <tr key={event.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                                        <td className="py-4 px-4 text-xs font-mono text-zinc-400 whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <CalendarIcon size={10} className="text-zinc-600" />
                                                    {new Date(event.date).toLocaleDateString()}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock size={10} className="text-zinc-600" />
                                                    {event.time}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-xs font-black text-white">{event.currency}</td>
                                        <td className="py-4 px-4">
                                            <span className={cn("px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border", getImpactColor(event.impact))}>
                                                {event.impact}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-sm font-semibold text-white truncate max-w-[200px] md:max-w-none">{event.title}</td>
                                        <td className="py-4 px-4 text-xs font-mono text-white text-right">{event.actual || '-'}</td>
                                        <td className="py-4 px-4 text-xs font-mono text-zinc-400 text-right">{event.forecast || '-'}</td>
                                        <td className="py-4 px-4 text-xs font-mono text-zinc-500 text-right">{event.previous || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {events.length === 0 && (
                            <div className="text-center text-zinc-500 mt-10 text-xs">Nenhum evento económico restante esta semana.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

