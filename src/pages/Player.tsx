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
  Calendar, ChevronRight, ChevronLeft, Wallet, Check
} from 'lucide-react';

interface PlaylistItem {
  id: number;
  type: 'image' | 'video' | 'web' | 'stream' | 'menu' | 'tasks';
  url: string;
  duration: number;
  order_index: number;
  loop?: boolean;
  layout_config?: string;
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
const MenuView = ({ menuId, layoutConfig }: { menuId: string, layoutConfig?: string }) => {
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
        
        // Migration to categories if needed
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

  // Auto-cycle categories
  useEffect(() => {
    if (filteredCategories.length <= 1) return;

    cycleTimerRef.current = setInterval(() => {
      setActiveCategoryIdx(prev => (prev + 1) % filteredCategories.length);
    }, 8000); // Cycle every 8 seconds

    return () => {
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
    };
  }, [filteredCategories]);

  // Update highlight position
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
        borderRadius: '3px',
        zIndex: 0,
        transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.15)',
        pointerEvents: 'none',
        backgroundColor: menu?.accentColor || '#ffc600'
      });
    }
  }, [activeCategoryIdx, menu]);

  if (!menu) return <div className="flex items-center justify-center h-full text-white">Chargement du menu...</div>;

  const activeCategory = filteredCategories[activeCategoryIdx >= filteredCategories.length ? 0 : activeCategoryIdx];
  const accentColor = menu.accentColor || '#ffc600';

  return (
    <div 
      className="h-full w-full flex flex-col items-center overflow-hidden animate-fade-in relative"
      style={{
        background: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url(${menu.background || "https://i.imgur.com/er8DtBW.jpg"}) center/cover no-repeat fixed`,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div className="w-full max-w-5xl px-8 py-16 flex flex-col h-full">
        <div className="mb-4">
          <h2 
            className="inline-block border-b-4 leading-none mb-4"
            style={{ 
              borderColor: accentColor,
              font: "50px 'Cookie', cursive"
            }}
          >
            {menu.title}
          </h2>
        </div>

        {/* Navigation */}
        {filteredCategories.length > 1 && (
          <nav ref={navRef} className="flex justify-center flex-wrap mb-12 relative gap-3">
            <div style={highlightStyle}></div>
            {filteredCategories.map((cat, idx) => (
              <button
                key={cat.id}
                className="menu-button px-5 py-2.5 border rounded-sm text-white font-bold uppercase tracking-widest text-xs transition-colors relative z-10"
                style={{ borderColor: accentColor }}
                onClick={() => setActiveCategoryIdx(idx)}
              >
                {cat.name}
              </button>
            ))}
          </nav>
        )}

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-10 overflow-y-auto pr-4 custom-scrollbar">
          {activeCategory?.dishes.map((dish) => (
            <div key={dish.id} className="flex flex-col animate-fade-in">
              <div className="flex items-baseline gap-4">
                <h3 
                  className="text-4xl leading-none m-0 whitespace-nowrap"
                  style={{ color: accentColor, font: "35px 'Cookie', cursive" }}
                >
                  {dish.name}
                </h3>
                <div className="flex-1 border-b border-white/20 border-dotted mb-1"></div>
              </div>
              <p className="mt-2 text-sm leading-relaxed opacity-90 font-medium">
                {Array.isArray(dish.ingredients) ? dish.ingredients.join(', ') : dish.ingredients}
              </p>
            </div>
          ))}
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
const TaskView = ({ layoutConfig }: { layoutConfig?: string }) => {
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
          // Filter by child if needed
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
    let interval: { start: Date, end: Date }[];

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

  return (
    <div className="h-full w-full bg-zinc-950 flex flex-col p-12 text-white font-sans animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-6">
          <div className="bg-amber-500 p-4 rounded-3xl shadow-lg shadow-amber-500/20">
            <Trophy className="text-black w-8 h-8" />
          </div>
          <div>
            <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white mb-1">
              {config.child === 'all' ? 'Tableau de la Maison' : `Espace de ${config.child}`}
            </h2>
            <div className="flex items-center gap-4">
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">
                {view === 'dashboard' ? 'Tâches en cours' : view === 'history' ? 'Historique des réussites' : 'Analyses des gains'}
              </p>
              <div className="h-1 w-1 rounded-full bg-zinc-700"></div>
              <p className="text-amber-500 font-black text-xs uppercase tracking-widest">
                Cagnotte : {totalEarned.toFixed(2)}€
              </p>
            </div>
          </div>
        </div>

        <div className="flex bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800">
          <button 
            onClick={() => setView('dashboard')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              view === 'dashboard' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-white'
            }`}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button 
            onClick={() => setView('history')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              view === 'history' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-white'
            }`}
          >
            <History size={16} /> Historique
          </button>
          <button 
            onClick={() => setView('stats')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              view === 'stats' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-white'
            }`}
          >
            <TrendingUp size={16} /> Stats
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-4 custom-scrollbar pb-10">
            {filteredTasks.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-32 opacity-20">
                <Trophy size={80} className="mb-6" />
                <h3 className="text-4xl font-black italic uppercase">Libre comme l'air !</h3>
                <p className="text-xl">Toutes les tâches sont terminées.</p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div 
                  key={task.id} 
                  className={`group p-8 rounded-[2.5rem] border-2 transition-all duration-500 ${
                    task.status === 'finished' 
                      ? 'bg-amber-500/5 border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.1)]' 
                      : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col gap-1">
                      <span className="px-4 py-1.5 bg-zinc-950 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 border border-zinc-800">
                        {task.assigned_to}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-3xl font-black text-amber-500">{task.reward.toFixed(2)}€</span>
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold mb-3 uppercase tracking-tight leading-tight group-hover:text-amber-500 transition-colors">{task.title}</h3>
                  <div className="text-zinc-500 text-lg mb-8 font-medium leading-relaxed markdown-body">
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
                </div>
              ))
            )}
          </div>
        )}

        {view === 'history' && (
          <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar pb-10">
            <div className="space-y-4">
              {historyTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 opacity-20">
                  <History size={80} className="mb-6" />
                  <h3 className="text-4xl font-black italic uppercase">L'histoire s'écrit...</h3>
                  <p className="text-xl">Aucune tâche approuvée pour le moment.</p>
                </div>
              ) : (
                historyTasks.map((task) => (
                  <div key={task.id} className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-3xl flex items-center justify-between group hover:bg-zinc-900/50 transition-all">
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
          </div>
        )}

        {view === 'stats' && (
          <div className="flex-1 flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Calendar className="text-amber-500" size={20} />
                <span className="text-sm font-black uppercase tracking-widest text-zinc-400">Période d'analyse</span>
              </div>
              <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
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
                      timeframe === t.id ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 bg-zinc-900/20 border border-zinc-900 rounded-[2.5rem] p-10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#f59e0b,transparent_70%)]"></div>
              </div>
              
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
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
              <div className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-3xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Moyenne / Période</span>
                <div className="text-3xl font-black text-white">
                  {(chartData.reduce((sum, d) => sum + d.amount, 0) / chartData.length).toFixed(2)}€
                </div>
              </div>
              <div className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-3xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Record de gain</span>
                <div className="text-3xl font-black text-amber-500">
                  {Math.max(...chartData.map(d => d.amount)).toFixed(2)}€
                </div>
              </div>
              <div className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-3xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Total période</span>
                <div className="text-3xl font-black text-emerald-500">
                  {chartData.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}€
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-8 border-t border-zinc-900 flex justify-between items-center opacity-20">
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
  );
};

interface PlayerConfig {
  loop_playlist: boolean;
}

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
  const [config, setConfig] = useState<PlayerConfig>({ loop_playlist: true });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const searchParams = new URLSearchParams(window.location.search);
  const screenId = searchParams.get('screenId') || 'default';

  // Récupération de la playlist et de la configuration de l'écran
  const fetchPlaylist = async () => {
    try {
      const res = await fetch(`/api/playlist?screenId=${screenId}`);
      const data = await res.json();
      // On s'attend à recevoir { items: [], config: { loop_playlist: boolean } }
      setPlaylist(data.items || data); // Fallback si ta route renvoie directement l'array
      if (data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to fetch playlist', err);
    }
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => {
      const nextIdx = prev + 1;
      
      // Si on arrive à la fin de la liste
      if (nextIdx >= playlist.length) {
        // Si la boucle globale est activée, on repart à 0, sinon on reste bloqué au dernier
        return config.loop_playlist ? 0 : prev;
      }
      return nextIdx;
    });
  };

  useEffect(() => {
    fetchPlaylist();

    // Connexion Socket.io pour les mises à jour en direct
    const socket = io({
      query: { screenId }
    });

    socket.on('playlist_updated', () => {
      fetchPlaylist();
    });

    socket.on('reload_player', () => {
      window.location.reload();
    });

    socket.on('next_slide', () => {
      nextSlide();
    });

    return () => {
      socket.disconnect();
    };
  }, [screenId]);

  useEffect(() => {
    // Ne rien faire si le player n'est pas démarré ou si la liste est vide
    if (!started || playlist.length === 0) return;

    const currentItem = playlist[currentIndex];
    
    // NETTOYAGE : On annule tout timer précédent
    if (timerRef.current) clearTimeout(timerRef.current);

    // LOGIQUE DE BOUCLE :
    // 1. Si l'item individuel est en "loop", on ne met pas de timer (il reste à l'écran indéfiniment)
    if (currentItem.loop) return;

    // 2. Si on est sur le dernier item et que la playlist ne boucle pas, on s'arrête là
    if (currentIndex === playlist.length - 1 && !config.loop_playlist) return;

    // 3. Sinon, on programme le passage au suivant selon la durée définie (uniquement pour images et web)
    if (currentItem.type !== 'video' && currentItem.type !== 'stream') {
      timerRef.current = setTimeout(() => {
        nextSlide();
      }, currentItem.duration * 1000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, started, playlist, config.loop_playlist]);

  // Écran d'attente si aucune donnée n'est disponible
  if (playlist.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900 text-white font-mono text-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p>Chargement de la playlist pour l'écran : {screenId}</p>
        </div>
      </div>
    );
  }

  // Écran de démarrage (évite les problèmes d'autoplay vidéo sans interaction)
  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-8">
        <h1 className="text-4xl font-black mb-8 tracking-tighter uppercase italic">Kiosk Player</h1>
        <button 
          onClick={() => setStarted(true)}
          className="group relative px-12 py-6 bg-white text-black rounded-full text-2xl font-black transition-all hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
        >
          DÉMARRER LA DIFFUSION
        </button>
        <p className="mt-8 text-zinc-500 text-sm">Identifiant : {screenId}</p>
      </div>
    );
  }

  const currentItem = playlist[currentIndex];

  // Parsing de la configuration de mise en page
  let layoutStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0
  };

  if (currentItem.type === 'stream' && currentItem.layout_config) {
    try {
      const config = JSON.parse(currentItem.layout_config);
      if (config.mode === 'center') {
        layoutStyle = {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '80%',
          height: '80%'
        };
      } else if (config.mode === 'custom') {
        layoutStyle = {
          position: 'absolute',
          top: `${config.top}%`,
          left: `${config.left}%`,
          width: `${config.width}%`,
          height: `${config.height}%`
        };
      }
    } catch (e) {
      console.error('Failed to parse layout config', e);
    }
  }

  // Gestion spécifique pour YouTube
  const isYouTube = currentItem.type === 'web' && (currentItem.url.includes('youtube.com') || currentItem.url.includes('youtu.be'));
  let finalWebUrl = currentItem.url;
  
  if (isYouTube && currentItem.loop) {
    const videoId = currentItem.url.split('/').pop()?.split('?')[0];
    finalWebUrl += `${finalWebUrl.includes('?') ? '&' : '?'}playlist=${videoId}&loop=1&autoplay=1&mute=1`;
  }

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {/* AFFICHAGE IMAGE */}
      {currentItem.type === 'image' && (
        <div 
          key={currentItem.id + '-' + currentIndex}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-fade-in"
          style={{ backgroundImage: `url(${currentItem.url})` }}
        />
      )}

      {/* AFFICHAGE VIDÉO */}
      {currentItem.type === 'video' && (
        <video
          key={currentItem.id + '-' + currentIndex}
          src={currentItem.url}
          className="absolute inset-0 w-full h-full object-cover animate-fade-in"
          autoPlay
          muted
          playsInline
          loop={currentItem.loop}
          onEnded={() => {
            // Si la vidéo ne boucle pas sur elle-même, on force le passage au suivant dès qu'elle finit
            if (!currentItem.loop) nextSlide();
          }}
          onError={nextSlide}
        />
      )}

      {/* AFFICHAGE SITE WEB / IFRAME */}
      {currentItem.type === 'web' && (
        <div className="absolute inset-0 w-full h-full bg-white">
          <iframe
            key={currentItem.id + '-' + currentIndex}
            src={finalWebUrl}
            className="w-full h-full border-0 animate-fade-in"
            title="Signage Web Content"
            allow="autoplay; fullscreen"
          />
          {/* Indicateur discret en mode debug ou admin */}
          <div className="absolute bottom-4 right-4 bg-black/50 text-white text-[10px] px-2 py-1 rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            {currentItem.loop ? '∞ Loop Mode' : `Durée : ${currentItem.duration}s`}
          </div>
        </div>
      )}

      {/* AFFICHAGE STREAM (HLS/DASH) */}
      {currentItem.type === 'stream' && (
        <div 
          key={currentItem.id + '-' + currentIndex} 
          className="bg-black animate-fade-in"
          style={layoutStyle}
        >
          <VideoJS 
            options={{
              autoplay: true,
              controls: false,
              responsive: true,
              fluid: false,
              muted: true,
              sources: [{
                src: currentItem.url,
                type: currentItem.url.includes('.mpd') ? 'application/dash+xml' : 'application/x-mpegURL'
              }]
            }}
            onReady={(player: any) => {
              player.on('error', () => {
                console.error('Stream error, skipping...');
                nextSlide();
              });
            }}
          />
        </div>
      )}

      {/* AFFICHAGE MENU */}
      {currentItem.type === 'menu' && (
        <div key={currentItem.id + '-' + currentIndex} className="absolute inset-0 w-full h-full">
          <MenuView 
            menuId={currentItem.url} 
            layoutConfig={currentItem.layout_config} 
          />
        </div>
      )}

      {/* AFFICHAGE TÂCHES */}
      {currentItem.type === 'tasks' && (
        <div key={currentItem.id + '-' + currentIndex} className="absolute inset-0 w-full h-full">
          <TaskView layoutConfig={currentItem.layout_config} />
        </div>
      )}
    </div>
  );
}