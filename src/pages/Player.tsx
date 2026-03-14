import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { 
  format, subDays, subMonths, startOfDay, endOfDay, 
  isWithinInterval, startOfMonth, endOfMonth, startOfYear, endOfYear,
  eachDayOfInterval, eachMonthOfInterval, isSameDay, isSameMonth
} from 'date-fns';
import { fr } from 'date-fns/locale';
import Markdown from 'react-markdown';
import { 
  Trophy, History, LayoutDashboard, TrendingUp, 
  Calendar, ChevronRight, ChevronLeft, Wallet, Check,
  Clock, CheckSquare, CloudSun, Newspaper, Timer,
  MessageSquare, MonitorPlay, Pause
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PlaylistItem {
  id: number;
  type: 'image' | 'video' | 'web' | 'stream' | 'menu' | 'tasks';
  url: string;
  duration: number;
  order_index: number;
  loop?: boolean;
  layout_config?: string;
  schedule?: string;
}

interface MenuData {
  title: string;
  background?: string;
  accentColor?: string;
  content: {
    categories: {
      id: string;
      name: string;
      dishes: {
        id: string;
        name: string;
        ingredients: string[];
        image: string;
      }[];
    }[];
  };
}

// Composant pour afficher un menu
const MenuView = ({ menuId, layoutConfig, theme }: { menuId: string, layoutConfig?: string, theme: string }) => {
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const navRef = useRef<HTMLDivElement>(null);
  const cycleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const filteredCategories = useMemo(() => {
    if (!menu) return [];
    return (menu.content.categories || []).map(cat => {
      if (layoutConfig) {
        try {
          const config = JSON.parse(layoutConfig);
          if (config.dishIds && config.dishIds.length > 0) {
            return {
              ...cat,
              dishes: cat.dishes.filter(d => config.dishIds.includes(d.id))
            };
          }
        } catch (e) {}
      }
      return cat;
    }).filter(cat => cat.dishes.length > 0);
  }, [menu, layoutConfig]);

  useEffect(() => {
    fetch(`/api/menus/${menuId}`)
      .then(res => res.json())
      .then(data => {
        const content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
        
        if (content.dishes && !content.categories) {
          content.categories = [{
            id: 'default',
            name: 'Plats',
            dishes: content.dishes
          }];
        }
        
        setMenu({ ...data, content });
      })
      .catch(err => console.error('Failed to fetch menu', err));
  }, [menuId]);

  useEffect(() => {
    if (filteredCategories.length <= 1) return;

    cycleTimerRef.current = setInterval(() => {
      setActiveCategoryIdx(prev => (prev + 1) % filteredCategories.length);
    }, 8000);

    return () => {
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
    };
  }, [filteredCategories]);

  useEffect(() => {
    if (!navRef.current) return;
    const buttons = navRef.current.querySelectorAll('.menu-button');
    const activeButton = buttons[activeCategoryIdx] as HTMLElement;
    if (activeButton) {
      setHighlightStyle({
        width: `${activeButton.offsetWidth}px`,
        height: `${activeButton.offsetHeight}px`,
        left: `${activeButton.offsetLeft}px`,
        top: `${activeButton.offsetTop}px`,
        position: 'absolute',
        borderRadius: '12px',
        zIndex: 0,
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        pointerEvents: 'none',
        backgroundColor: menu?.accentColor || '#ffc600'
      });
    }
  }, [activeCategoryIdx, menu]);

  if (!menu) return <div className="flex items-center justify-center h-full text-white">Chargement du menu...</div>;

  const activeCategory = filteredCategories[activeCategoryIdx >= filteredCategories.length ? 0 : activeCategoryIdx];
  const accentColor = menu.accentColor || '#ffc600';

  const getMeshClass = () => {
    switch(theme) {
      case 'cyber': return 'bg-mesh-cyber';
      case 'nature': return 'bg-mesh-nature';
      case 'dark': return 'bg-mesh-dark';
      default: return 'bg-mesh';
    }
  };

  return (
    <div 
      className={`h-full w-full flex flex-col items-center overflow-hidden relative ${!menu.background ? getMeshClass() : ''}`}
      style={{
        background: menu.background ? `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url(${menu.background}) center/cover no-repeat fixed` : undefined,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div className="w-full max-w-5xl px-8 py-16 flex flex-col h-full relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <h2 
            className="inline-block border-b-4 leading-none mb-4"
            style={{ 
              borderColor: accentColor,
              font: "50px 'Cookie', cursive"
            }}
          >
            {menu.title}
          </h2>
        </motion.div>

        {filteredCategories.length > 1 && (
          <nav ref={navRef} className="flex justify-center flex-wrap mb-12 relative gap-3 p-2 bg-black/20 backdrop-blur-md rounded-[2rem] border border-white/10">
            <div style={highlightStyle}></div>
            {filteredCategories.map((cat, idx) => (
              <button
                key={cat.id}
                className={`menu-button px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all relative z-10 ${activeCategoryIdx === idx ? 'text-black' : 'text-white/60 hover:text-white'}`}
                onClick={() => setActiveCategoryIdx(idx)}
              >
                {cat.name}
              </button>
            ))}
          </nav>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-10 overflow-y-auto pr-4 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeCategory?.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-10"
            >
              {activeCategory?.dishes.map((dish) => (
                <div key={dish.id} className="flex flex-col group">
                  <div className="flex items-baseline gap-4">
                    <h3 
                      className="text-4xl leading-none m-0 whitespace-nowrap group-hover:scale-105 transition-transform origin-left"
                      style={{ color: accentColor, font: "35px 'Cookie', cursive" }}
                    >
                      {dish.name}
                    </h3>
                    <div className="flex-1 border-b border-white/20 border-dotted mb-1"></div>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed opacity-90 font-medium text-zinc-300">
                    {Array.isArray(dish.ingredients) ? dish.ingredients.join(', ') : dish.ingredients}
                  </p>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-auto pt-12 flex justify-between items-center text-white/40 text-[10px] font-bold uppercase tracking-[0.4em]">
          <span>Lalo's Kiosk Digital Signage</span>
          <div className="flex gap-4">
            <span>Fresh</span>
            <span>Local</span>
            <span>Daily</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Composant pour afficher les tâches
const TaskView = ({ layoutConfig, theme }: { layoutConfig?: string, theme: string }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [view, setView] = useState<'dashboard' | 'history' | 'stats'>('dashboard');
  const [timeframe, setTimeframe] = useState<'week' | '3m' | '6m' | '9m' | '12m' | 'year'>('week');

  const config = useMemo(() => {
    try {
      return layoutConfig ? JSON.parse(layoutConfig) : { child: 'all' };
    } catch (e) {
      return { child: 'all' };
    }
  }, [layoutConfig]);

  useEffect(() => {
    const fetchTasks = () => {
      fetch('/api/tasks')
        .then(res => res.json())
        .then(data => {
          setAllTasks(data);
          let filtered = data;
          if (config.child && config.child !== 'all') {
            filtered = data.filter((t: any) => t.assigned_to === config.child);
          }
          setTasks(filtered);
        })
        .catch(err => console.error('Failed to fetch tasks', err));
    };

    fetchTasks();
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, [config.child]);

  const updateTaskStatus = async (id: number, status: 'finished') => {
    try {
      const res = await fetch(`/api/tasks/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
        // Play sound
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
        audio.play().catch(() => {});
      }
    } catch (err) {
      console.error('Failed to update task status', err);
    }
  };

  const filteredTasks = tasks.filter(t => t.status !== 'approved');
  const historyTasks = tasks.filter(t => t.status === 'approved').sort((a, b) => new Date(b.approved_at || b.created_at).getTime() - new Date(a.approved_at || a.created_at).getTime());

  const getChartData = () => {
    const now = new Date();
    let startDate: Date;

    if (timeframe === 'week') {
      startDate = subDays(now, 6);
      const days = eachDayOfInterval({ start: startDate, end: now });
      return days.map(day => {
        const dayTasks = tasks.filter(t => t.status === 'approved' && isSameDay(new Date(t.approved_at), day));
        return {
          name: format(day, 'EEE', { locale: fr }),
          amount: dayTasks.reduce((sum, t) => sum + t.reward, 0)
        };
      });
    } else if (timeframe === 'year') {
      startDate = startOfYear(now);
      const months = eachMonthOfInterval({ start: startDate, end: now });
      return months.map(month => {
        const monthTasks = tasks.filter(t => t.status === 'approved' && isSameMonth(new Date(t.approved_at), month));
        return {
          name: format(month, 'MMM', { locale: fr }),
          amount: monthTasks.reduce((sum, t) => sum + t.reward, 0)
        };
      });
    } else {
      const monthsCount = parseInt(timeframe);
      startDate = subMonths(now, monthsCount - 1);
      const months = eachMonthOfInterval({ start: startOfMonth(startDate), end: now });
      return months.map(month => {
        const monthTasks = tasks.filter(t => t.status === 'approved' && isSameMonth(new Date(t.approved_at), month));
        return {
          name: format(month, 'MMM', { locale: fr }),
          amount: monthTasks.reduce((sum, t) => sum + t.reward, 0)
        };
      });
    }
  };

  const chartData = getChartData();
  const totalEarned = tasks.filter(t => t.status === 'approved').reduce((sum, t) => sum + t.reward, 0);

  const getMeshClass = () => {
    switch(theme) {
      case 'cyber': return 'bg-mesh-cyber';
      case 'nature': return 'bg-mesh-nature';
      case 'dark': return 'bg-mesh-dark';
      default: return 'bg-mesh-dark';
    }
  };

  return (
    <div className={`h-full w-full flex flex-col p-12 text-white font-sans overflow-hidden relative ${getMeshClass()}`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0"></div>
      
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-6">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="bg-amber-500 p-4 rounded-3xl shadow-lg shadow-amber-500/20"
            >
              <Trophy className="text-black w-8 h-8" />
            </motion.div>
            <div>
              <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white mb-1">
                {config.child === 'all' ? 'Tableau de la Maison' : `Espace de ${config.child}`}
              </h2>
              <div className="flex items-center gap-4">
                <p className="text-zinc-300 font-bold uppercase tracking-widest text-xs opacity-60">
                  {view === 'dashboard' ? 'Tâches en cours' : view === 'history' ? 'Historique des réussites' : 'Analyses des gains'}
                </p>
                <div className="h-1 w-1 rounded-full bg-zinc-700"></div>
                <p className="text-amber-500 font-black text-xs uppercase tracking-widest">
                  Cagnotte : {totalEarned.toFixed(2)}€
                </p>
              </div>
            </div>
          </div>

          <div className="flex bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
              { id: 'history', icon: History, label: 'Historique' },
              { id: 'stats', icon: TrendingUp, label: 'Stats' }
            ].map((v) => (
              <button 
                key={v.id}
                onClick={() => setView(v.id as any)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all relative ${
                  view === v.id ? 'text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {view === v.id && (
                  <motion.div 
                    layoutId="taskTab"
                    className="absolute inset-0 bg-amber-500 rounded-xl shadow-lg shadow-amber-500/20"
                  />
                )}
                <v.icon size={16} className="relative z-10" /> 
                <span className="relative z-10">{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-4 custom-scrollbar pb-10"
              >
                {filteredTasks.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-32 opacity-20">
                    <Trophy size={80} className="mb-6" />
                    <h3 className="text-4xl font-black italic uppercase">Libre comme l'air !</h3>
                    <p className="text-xl">Toutes les tâches sont terminées.</p>
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <motion.div 
                      layout
                      key={task.id} 
                      className={`group p-8 rounded-[2.5rem] border-2 transition-all duration-500 ${
                        task.status === 'finished' 
                          ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.15)]' 
                          : 'bg-black/40 backdrop-blur-md border-white/10 hover:border-white/20 hover:bg-black/60'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex flex-col gap-1">
                          <span className="px-4 py-1.5 bg-black/40 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 border border-white/10">
                            {task.assigned_to}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-3xl font-black text-amber-500">{task.reward.toFixed(2)}€</span>
                        </div>
                      </div>
                      <h3 className="text-3xl font-bold mb-3 uppercase tracking-tight leading-tight group-hover:text-amber-500 transition-colors">{task.title}</h3>
                      <div className="text-zinc-400 text-lg mb-8 font-medium leading-relaxed markdown-body">
                        <Markdown>{task.description}</Markdown>
                      </div>
                      
                      <div className="mt-auto">
                        {task.status === 'finished' ? (
                          <div className="flex items-center gap-3 py-4 px-6 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></div>
                            <span className="text-amber-500 font-black uppercase italic text-xs tracking-widest">En attente de validation</span>
                          </div>
                        ) : (
                          <button 
                            onClick={() => updateTaskStatus(task.id, 'finished')}
                            className="w-full bg-white text-black py-5 rounded-[1.5rem] font-black uppercase italic text-sm hover:bg-amber-500 transition-all active:scale-95 shadow-xl shadow-white/5"
                          >
                            J'ai fini !
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}

            {view === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 overflow-y-auto pr-4 custom-scrollbar pb-10"
              >
                <div className="space-y-4">
                  {historyTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 opacity-20">
                      <History size={80} className="mb-6" />
                      <h3 className="text-4xl font-black italic uppercase">L'histoire s'écrit...</h3>
                      <p className="text-xl">Aucune tâche approuvée pour le moment.</p>
                    </div>
                  ) : (
                    historyTasks.map((task) => (
                      <div key={task.id} className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex items-center justify-between group hover:bg-black/60 transition-all">
                        <div className="flex items-center gap-6">
                          <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                            <Check className="text-emerald-500 w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-xl font-bold uppercase tracking-tight mb-1">{task.title}</h4>
                            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
                              <span>{task.assigned_to}</span>
                              <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
                              <span>{format(new Date(task.approved_at || task.created_at), 'dd MMMM yyyy', { locale: fr })}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-2xl font-black text-emerald-500">+{task.reward.toFixed(2)}€</div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {view === 'stats' && (
              <motion.div 
                key="stats"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 flex flex-col gap-8"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Calendar className="text-amber-500" size={20} />
                    <span className="text-sm font-black uppercase tracking-widest text-zinc-400">Période d'analyse</span>
                  </div>
                  <div className="flex bg-black/40 backdrop-blur-md p-1 rounded-xl border border-white/10">
                    {[
                      { id: 'week', label: '7J' },
                      { id: '3m', label: '3M' },
                      { id: '6m', label: '6M' },
                      { id: '9m', label: '9M' },
                      { id: '12m', label: '12M' },
                      { id: 'year', label: 'AN' }
                    ].map((t) => (
                      <button 
                        key={t.id}
                        onClick={() => setTimeframe(t.id as any)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                          timeframe === t.id ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 bg-black/20 border border-white/5 rounded-[2.5rem] p-10 relative overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#52525b" 
                        fontSize={10} 
                        fontWeight="bold"
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis 
                        stroke="#52525b" 
                        fontSize={10} 
                        fontWeight="bold"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}€`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                        itemStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#f59e0b" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorAmount)" 
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Moyenne / Période</span>
                    <div className="text-3xl font-black text-white">
                      {(chartData.reduce((sum, d) => sum + d.amount, 0) / chartData.length).toFixed(2)}€
                    </div>
                  </div>
                  <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Record de gain</span>
                    <div className="text-3xl font-black text-amber-500">
                      {Math.max(...chartData.map(d => d.amount)).toFixed(2)}€
                    </div>
                  </div>
                  <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Total période</span>
                    <div className="text-3xl font-black text-emerald-500">
                      {chartData.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}€
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-8 border-t border-white/5 flex justify-between items-center opacity-20">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Kiosk Tasks System v2.0</span>
            <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Motivation & Récompense</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Système Connecté</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PlayerConfig {
  loop_playlist: boolean;
  theme: string;
  layout_mode: 'fullscreen' | 'split';
  sidebar_config: any[];
}

// Widget Horloge
const ClockWidget = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="text-6xl font-black tracking-tighter tabular-nums">
        {format(time, 'HH:mm')}
      </div>
      <div className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-400 mt-2">
        {format(time, 'EEEE d MMMM', { locale: fr })}
      </div>
    </div>
  );
};

// Widget Météo (Mocké avec style)
const WeatherWidget = ({ city }: { city?: string }) => {
  return (
    <div className="flex items-center justify-between w-full px-4">
      <div className="flex items-center gap-4">
        <CloudSun className="w-10 h-10 text-amber-400" />
        <div>
          <div className="text-2xl font-black">22°C</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{city || 'Paris'}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] font-bold uppercase text-zinc-500">Ensoleillé</div>
        <div className="text-[10px] font-bold uppercase text-zinc-500">Humidité: 45%</div>
      </div>
    </div>
  );
};

// Widget RSS (Mocké avec style)
const RSSWidget = ({ url }: { url?: string }) => {
  const news = [
    "L'intelligence artificielle transforme le quotidien",
    "Nouveaux records de température mondiale",
    "Exploration spatiale : mission vers Mars en vue",
    "Économie : les marchés en forte hausse ce matin"
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIdx(prev => (prev + 1) % news.length), 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full px-4">
      <div className="flex items-center gap-2 mb-3">
        <Newspaper className="w-4 h-4 text-indigo-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Actualités</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.p 
          key={idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="text-sm font-bold leading-tight"
        >
          {news[idx]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};

// Widget Compte à Rebours
const CountdownWidget = ({ date, label }: { date: string, label: string }) => {
  const [timeLeft, setTimeLeft] = useState('');
  
  useEffect(() => {
    const calculate = () => {
      const target = new Date(date).getTime();
      const now = new Date().getTime();
      const diff = target - now;
      
      if (diff <= 0) {
        setTimeLeft('Terminé !');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      setTimeLeft(`${days}j ${hours}h`);
    };
    
    calculate();
    const timer = setInterval(calculate, 60000);
    return () => clearInterval(timer);
  }, [date]);

  return (
    <div className="w-full px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Timer className="w-8 h-8 text-rose-500" />
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</div>
          <div className="text-xl font-black">{timeLeft}</div>
        </div>
      </div>
    </div>
  );
};

// Widget Calendrier
const CalendarWidget = ({ url }: { url?: string }) => {
  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/20">
        <Calendar className="w-8 h-8 mb-2" />
        <p className="text-[8px] font-black uppercase tracking-widest">Non configuré</p>
      </div>
    );
  }

  return (
    <div className="h-48 w-full rounded-2xl overflow-hidden bg-white/5 border border-white/10">
      <iframe 
        src={url} 
        className="w-full h-full border-0 grayscale invert opacity-70"
        title="Calendar"
      />
    </div>
  );
};

// Sidebar Component
const Sidebar = ({ config, theme }: { config: any[], theme: string }) => {
  return (
    <div className="h-full w-full bg-black/30 backdrop-blur-xl border-l border-white/10 flex flex-col p-8 gap-10 overflow-hidden">
      {config.filter(w => w.enabled).map((widget) => (
        <motion.div 
          key={widget.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full"
        >
          {widget.type === 'clock' && <ClockWidget />}
          {widget.type === 'weather' && <WeatherWidget city={widget.config?.city} />}
          {widget.type === 'rss' && <RSSWidget url={widget.config?.url} />}
          {widget.type === 'countdown' && <CountdownWidget date={widget.config?.date} label={widget.config?.label} />}
          {widget.type === 'calendar' && <CalendarWidget url={widget.config?.url} />}
          {widget.type === 'tasks' && (
            <div className="px-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tâches</span>
              </div>
              <div className="space-y-2">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[11px] font-bold">Ranger la chambre</div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[11px] font-bold">Mettre la table</div>
              </div>
            </div>
          )}
        </motion.div>
      ))}
      
      <div className="mt-auto pt-8 border-t border-white/5 flex flex-col items-center opacity-30">
        <div className="text-[8px] font-black uppercase tracking-[0.5em] mb-1">Lalo's Kiosk</div>
        <div className="text-[8px] font-black uppercase tracking-[0.5em]">Digital Signage</div>
      </div>
    </div>
  );
};

// Flash Message Component
const FlashMessage = ({ message, onComplete }: { message: any, onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, message.duration * 1000);
    return () => clearTimeout(timer);
  }, [message, onComplete]);

  const bgClass = message.type === 'error' ? 'bg-rose-600' : message.type === 'warning' ? 'bg-amber-500' : 'bg-indigo-600';

  return (
    <motion.div 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className={`fixed top-12 left-1/2 -translate-x-1/2 z-[100] px-12 py-6 rounded-3xl shadow-2xl flex items-center gap-6 border-4 border-white/20 ${bgClass}`}
    >
      <div className="bg-white/20 p-3 rounded-2xl">
        <MessageSquare className="w-8 h-8 text-white" />
      </div>
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-1">Message Flash</div>
        <div className="text-2xl font-black text-white">{message.text}</div>
      </div>
    </motion.div>
  );
};

// Composant pour encapsuler Video.js
const VideoJS = (props: any) => {
  const videoRef = React.useRef<any>(null);
  const playerRef = React.useRef<any>(null);
  const { options, onReady } = props;

  React.useEffect(() => {
    if (!playerRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, options, () => {
        onReady && onReady(player);
      });
    } else {
      const player = playerRef.current;
      player.autoplay(options.autoplay);
      player.src(options.sources);
    }
  }, [options, videoRef]);

  React.useEffect(() => {
    const player = playerRef.current;
    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [playerRef]);

  return (
    <div data-vjs-player className="w-full h-full">
      <div ref={videoRef} className="w-full h-full" />
    </div>
  );
}

export default function Player() {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [config, setConfig] = useState<PlayerConfig>({ 
    loop_playlist: true, 
    theme: 'modern',
    layout_mode: 'fullscreen',
    sidebar_config: []
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeFlashMessage, setActiveFlashMessage] = useState<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<any>(null);
  
  const searchParams = new URLSearchParams(window.location.search);
  const screenId = searchParams.get('screenId') || 'default';

  const fetchPlaylist = async () => {
    try {
      const res = await fetch(`/api/playlist?screenId=${screenId}`);
      const data = await res.json();
      setPlaylist(data.items || data);
      if (data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to fetch playlist', err);
    }
  };

  const isItemActive = (item: PlaylistItem) => {
    if (!item.schedule) return true;
    try {
      const schedule = JSON.parse(item.schedule);
      if (!schedule.enabled) return true;

      const now = new Date();
      const currentDay = now.getDay();
      
      if (schedule.days && schedule.days.length > 0) {
        if (!schedule.days.includes(currentDay)) return false;
      }

      if (schedule.startTime && schedule.endTime) {
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);
        
        const startTime = new Date(now);
        startTime.setHours(startH, startM, 0, 0);
        
        const endTime = new Date(now);
        endTime.setHours(endH, endM, 0, 0);

        if (now < startTime || now > endTime) return false;
      }

      return true;
    } catch (e) {
      console.error('Failed to parse schedule', e);
      return true;
    }
  };

  const activePlaylist = useMemo(() => {
    return playlist.filter(isItemActive);
  }, [playlist]);

  const prevSlide = () => {
    setCurrentIndex((prev) => {
      const nextIdx = prev - 1;
      if (nextIdx < 0) {
        return activePlaylist.length - 1;
      }
      return nextIdx;
    });
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => {
      const nextIdx = prev + 1;
      if (nextIdx >= activePlaylist.length) {
        return config.loop_playlist ? 0 : prev;
      }
      return nextIdx;
    });
  };

  useEffect(() => {
    if (!socketRef.current) return;

    const pingInterval = setInterval(() => {
      const currentItem = activePlaylist[currentIndex];
      socketRef.current?.emit('screen_ping', {
        currentItemId: currentItem?.id
      });
    }, 30000); // Ping every 30s

    return () => clearInterval(pingInterval);
  }, [activePlaylist, currentIndex]);

  useEffect(() => {
    fetchPlaylist();
    
    const interval = setInterval(() => {
      fetchPlaylist();
    }, 60000);

    const socket = io({
      query: { screenId }
    });
    socketRef.current = socket;

    socket.on('playlist_updated', () => {
      fetchPlaylist();
    });

    socket.on('reload_player', () => {
      window.location.reload();
    });

    socket.on('next_slide', () => {
      nextSlide();
    });

    socket.on('prev_slide', () => {
      prevSlide();
    });

    socket.on('pause_player', () => {
      setIsPaused(true);
    });

    socket.on('resume_player', () => {
      setIsPaused(false);
    });

    socket.on('flash_message', (message) => {
      setActiveFlashMessage(message);
    });

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [screenId]);

  useEffect(() => {
    if (!started || activePlaylist.length === 0 || isPaused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (currentIndex >= activePlaylist.length) {
      setCurrentIndex(0);
      return;
    }

    const currentItem = activePlaylist[currentIndex];
    
    if (timerRef.current) clearTimeout(timerRef.current);

    if (currentItem.loop) return;

    if (currentIndex === activePlaylist.length - 1 && !config.loop_playlist) return;

    if (currentItem.type !== 'video' && currentItem.type !== 'stream') {
      timerRef.current = setTimeout(() => {
        nextSlide();
      }, currentItem.duration * 1000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, started, activePlaylist, config.loop_playlist, isPaused]);

  if (activePlaylist.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-white font-mono text-sm">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-center">
            <p className="font-black uppercase tracking-widest mb-1">Chargement de la playlist</p>
            <p className="text-zinc-500 text-xs uppercase tracking-widest">Écran : {screenId}</p>
          </div>
          {playlist.length > 0 && <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full">Aucun média actif selon le planning</p>}
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className={`flex flex-col items-center justify-center h-screen text-white p-8 relative overflow-hidden ${config.theme === 'cyber' ? 'bg-mesh-cyber' : config.theme === 'nature' ? 'bg-mesh-nature' : 'bg-mesh-dark'}`}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center"
        >
          <div className="mb-8 inline-block p-6 bg-white/10 backdrop-blur-xl rounded-[2.5rem] border border-white/20 shadow-2xl">
            <MonitorPlay className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter mb-4">Prêt à diffuser</h1>
          <p className="text-white/60 font-bold uppercase tracking-[0.3em] text-xs mb-12">Écran ID: {screenId}</p>
          <button 
            onClick={() => setStarted(true)}
            className="px-12 py-6 bg-white text-black rounded-[2rem] font-black uppercase italic tracking-widest hover:bg-indigo-500 hover:text-white transition-all shadow-2xl active:scale-95"
          >
            Démarrer le Player
          </button>
        </motion.div>
      </div>
    );
  }

  const currentItem = activePlaylist[currentIndex];

  return (
    <div className={`h-screen w-screen overflow-hidden relative flex ${config.theme === 'cyber' ? 'bg-mesh-cyber' : config.theme === 'nature' ? 'bg-mesh-nature' : 'bg-mesh-dark'}`}>
      <AnimatePresence>
        {activeFlashMessage && (
          <FlashMessage 
            message={activeFlashMessage} 
            onComplete={() => setActiveFlashMessage(null)} 
          />
        )}
      </AnimatePresence>

      <div className={`flex-1 relative h-full overflow-hidden`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentItem.id}-${currentIndex}`}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 w-full h-full"
          >
            {currentItem.type === 'image' && (
              <img 
                src={currentItem.url} 
                className="w-full h-full object-cover" 
                alt="" 
                referrerPolicy="no-referrer"
              />
            )}
            
            {currentItem.type === 'video' && (
              <video 
                src={currentItem.url} 
                autoPlay 
                muted={false} 
                loop={currentItem.loop}
                onEnded={() => !currentItem.loop && nextSlide()}
                className="w-full h-full object-cover"
              />
            )}

            {currentItem.type === 'web' && (
              <iframe 
                src={currentItem.url} 
                className="w-full h-full border-0" 
                title="Web Content"
              />
            )}

            {currentItem.type === 'stream' && (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <VideoJS 
                  options={{
                    autoplay: true,
                    controls: false,
                    responsive: true,
                    fluid: true,
                    sources: [{
                      src: currentItem.url,
                      type: currentItem.url.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
                    }]
                  }}
                  onReady={(player: any) => {
                    player.on('ended', () => {
                      if (!currentItem.loop) nextSlide();
                    });
                  }}
                />
              </div>
            )}

            {currentItem.type === 'menu' && (
              <MenuView 
                menuId={currentItem.url} 
                layoutConfig={currentItem.layout_config} 
                theme={config.theme}
              />
            )}

            {currentItem.type === 'tasks' && (
              <TaskView 
                layoutConfig={currentItem.layout_config} 
                theme={config.theme}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Overlay progress bar for timed items */}
        {started && currentItem.type !== 'video' && currentItem.type !== 'stream' && !currentItem.loop && !isPaused && (
          <motion.div 
            key={`progress-${currentIndex}`}
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: currentItem.duration, ease: "linear" }}
            className="absolute bottom-0 left-0 h-1.5 bg-white/40 backdrop-blur-md z-50"
          />
        )}

        {/* Pause Indicator */}
        <AnimatePresence>
          {isPaused && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-black/60 backdrop-blur-xl p-10 rounded-full border border-white/20"
            >
              <Pause className="w-16 h-16 text-white" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Screen Info Badge */}
        <div className="absolute top-8 left-8 z-50 flex items-center gap-3 opacity-0 hover:opacity-100 transition-opacity duration-500">
          <div className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">{screenId}</span>
          </div>
        </div>
      </div>

      {config.layout_mode === 'split' && (
        <div className="w-[30%] h-full">
          <Sidebar config={config.sidebar_config} theme={config.theme} />
        </div>
      )}
    </div>
  );
}
