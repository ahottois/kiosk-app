import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Plus, Trash2, ArrowUp, ArrowDown, 
  RefreshCw, MonitorPlay, ChevronLeft, Repeat, 
  Link as LinkIcon, Upload, Radio, Utensils,
  Calendar, Clock, Users, Settings as SettingsIcon,
  Layout, Eye, CheckSquare, ChevronRight,
  Square, SkipForward, SkipBack, Pause, MessageSquare,
  CloudSun, Newspaper, Timer, Info, Library,
  Activity, Shield, LogOut, Sparkles, Wand2,
  AlertCircle, CheckCircle2, XCircle
} from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { playEasterEgg } from '../services/easterEgg';
import { io } from 'socket.io-client';

interface MediaItem {
  id: number;
  name: string;
  url: string;
  type: 'image' | 'video';
  size: number;
  created_at: string;
}

interface ScreenStatus {
  screen_id: string;
  loop_playlist: boolean;
  last_ping: string | null;
  current_item_id: number | null;
  uptime_start: string | null;
  item_count: number;
}

interface PlaylistItem {
  id: number;
  type: 'image' | 'video' | 'web' | 'stream' | 'menu' | 'tasks';
  url: string;
  duration: number;
  order_index: number;
  loop: boolean;
  layout_config?: string;
  schedule?: string;
}

interface Menu {
  id: number;
  name: string;
  content: string;
  dishes: { name: string; description?: string }[];
}

interface SidebarWidget {
  id: string;
  type: 'clock' | 'weather' | 'rss' | 'countdown' | 'tasks' | 'calendar';
  enabled: boolean;
  config?: any;
}

const LivePreview = ({ screenId, currentItemId, playlist }: { screenId: string, currentItemId: number | null, playlist: PlaylistItem[] }) => {
  const currentItem = playlist.find(item => item.id === currentItemId);
  
  if (!currentItem) {
    return (
      <div className="w-full aspect-video bg-zinc-900 rounded-3xl flex items-center justify-center border border-zinc-800 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.1),transparent)]"></div>
        <div className="text-center">
          <MonitorPlay className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Aucun flux actif</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video bg-black rounded-3xl overflow-hidden border border-zinc-800 relative shadow-2xl">
      <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
        <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">Live Preview</span>
      </div>
      
      {currentItem.type === 'image' && (
        <img src={currentItem.url} className="w-full h-full object-cover" alt="" />
      )}
      {currentItem.type === 'video' && (
        <video src={currentItem.url} className="w-full h-full object-cover" autoPlay muted loop />
      )}
      {currentItem.type === 'web' && (
        <iframe src={currentItem.url} className="w-full h-full border-0 pointer-events-none" title="Preview" />
      )}
      {(currentItem.type === 'menu' || currentItem.type === 'tasks' || currentItem.type === 'stream') && (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
          <div className="text-center">
            {currentItem.type === 'menu' && <Utensils className="w-8 h-8 text-zinc-600 mx-auto mb-2" />}
            {currentItem.type === 'tasks' && <CheckSquare className="w-8 h-8 text-zinc-600 mx-auto mb-2" />}
            {currentItem.type === 'stream' && <Radio className="w-8 h-8 text-zinc-600 mx-auto mb-2" />}
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{currentItem.type}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default function Admin() {
  const { screenId: urlScreenId } = useParams();
  const screenId = urlScreenId || 'default';
  const navigate = useNavigate();
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');

  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  const [screensStatus, setScreensStatus] = useState<ScreenStatus[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [children, setChildren] = useState<string[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('all');
  const [selectedDishes, setSelectedDishes] = useState<string[]>([]);
  const [loopPlaylist, setLoopPlaylist] = useState(true);
  const [theme, setTheme] = useState('modern');
  const [layoutMode, setLayoutMode] = useState<'fullscreen' | 'split'>('fullscreen');
  const [sidebarConfig, setSidebarConfig] = useState<SidebarWidget[]>([
    { id: '1', type: 'clock', enabled: true },
    { id: '2', type: 'weather', enabled: false, config: { city: 'Paris' } },
    { id: '3', type: 'rss', enabled: false, config: { url: 'https://www.lemonde.fr/rss/une.xml' } },
    { id: '4', type: 'countdown', enabled: false, config: { date: '2026-12-25', label: 'Noël' } },
    { id: '5', type: 'tasks', enabled: false },
    { id: '6', type: 'calendar', enabled: false, config: { url: '' } }
  ]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'playlist' | 'library' | 'layout' | 'remote' | 'family' | 'settings'>('playlist');
  const [flashMessage, setFlashMessage] = useState({ text: '', duration: 5, type: 'info' as 'info' | 'warning' | 'error' });
  
  const [newItem, setNewItem] = useState({ 
    type: 'image' as 'image' | 'video' | 'web' | 'stream' | 'menu' | 'tasks', 
    url: '', 
    duration: 10,
    loop: false 
  });
  const [schedule, setSchedule] = useState({
    enabled: false,
    startTime: '08:00',
    endTime: '20:00',
    days: [1, 2, 3, 4, 5, 6, 0] // 0 is Sunday
  });
  const [layoutConfig, setLayoutConfig] = useState({
    mode: 'fullscreen' as 'fullscreen' | 'center' | 'custom',
    top: 0,
    left: 0,
    width: 100,
    height: 100
  });
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<'upload' | 'url' | 'library'>('url');

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      setIsAuthenticated(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      if (res.ok) {
        setIsAuthenticated(true);
        setAuthError('');
      } else {
        setAuthError('Identifiants incorrects');
      }
    } catch (err) {
      setAuthError('Erreur de connexion');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAuthenticated(false);
  };

  const fetchMedia = async () => {
    try {
      const res = await fetch('/api/media');
      if (res.ok) {
        const data = await res.json();
        setMediaLibrary(data);
      }
    } catch (err) {
      console.error('Failed to fetch media', err);
    }
  };

  const fetchScreensStatus = async () => {
    try {
      const res = await fetch('/api/screens');
      if (res.ok) {
        const data = await res.json();
        setScreensStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch screens status', err);
    }
  };

  const fetchPlaylist = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/playlist?screenId=${screenId}`);
      const data = await res.json();
      setPlaylist(data.items);
      setLoopPlaylist(data.config.loop_playlist);
      setTheme(data.config.theme || 'modern');
      setLayoutMode(data.config.layout_mode || 'fullscreen');
      if (data.config.sidebar_config) {
        setSidebarConfig(data.config.sidebar_config);
      }
      
      const menusRes = await fetch('/api/menus');
      const menusData = await menusRes.json();
      setMenus(menusData);

      const familyRes = await fetch('/api/family');
      const familyData = await familyRes.json();
      const childrenNames = familyData
        .filter((m: any) => m.role === 'Enfant')
        .map((m: any) => m.name);
      setChildren(childrenNames);

      fetchMedia();
      fetchScreensStatus();
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPlaylist();
      const statusInterval = setInterval(fetchScreensStatus, 10000);
      return () => clearInterval(statusInterval);
    }
  }, [screenId, isAuthenticated]);

  const updateScreenConfig = async (config: { loopPlaylist?: boolean, theme?: string, layoutMode?: string, sidebarConfig?: any }) => {
    try {
      await fetch('/api/screens/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          screenId, 
          loopPlaylist: config.loopPlaylist !== undefined ? config.loopPlaylist : loopPlaylist,
          theme: config.theme !== undefined ? config.theme : theme,
          layoutMode: config.layoutMode !== undefined ? config.layoutMode : layoutMode,
          sidebarConfig: config.sidebarConfig !== undefined ? config.sidebarConfig : sidebarConfig
        }),
      });
    } catch (err) {
      console.error('Failed to update screen config', err);
    }
  };

  const toggleLoopPlaylist = async () => {
    const newValue = !loopPlaylist;
    setLoopPlaylist(newValue);
    updateScreenConfig({ loopPlaylist: newValue });
  };

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme);
    updateScreenConfig({ theme: newTheme });
  };

  const handleLayoutModeChange = async (mode: 'fullscreen' | 'split') => {
    setLayoutMode(mode);
    updateScreenConfig({ layoutMode: mode });
  };

  const handleWidgetToggle = (id: string) => {
    const newConfig = sidebarConfig.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w);
    setSidebarConfig(newConfig);
    updateScreenConfig({ sidebarConfig: newConfig });
  };

  const handleWidgetConfigChange = (id: string, config: any) => {
    const newConfig = sidebarConfig.map(w => w.id === id ? { ...w, config: { ...w.config, ...config } } : w);
    setSidebarConfig(newConfig);
    updateScreenConfig({ sidebarConfig: newConfig });
  };

  const sendRemoteAction = (action: string, data?: any) => {
    import('socket.io-client').then(({ io }) => {
      const socket = io();
      socket.emit(action, data || screenId);
      socket.disconnect();
    });
  };

  const sendFlashMessage = async () => {
    if (!flashMessage.text) return;
    try {
      await fetch('/api/screens/flash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenId, message: flashMessage }),
      });
      setFlashMessage({ ...flashMessage, text: '' });
    } catch (err) {
      console.error('Failed to send flash message', err);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let finalUrl = newItem.url;

      if (finalUrl.includes('youtube.com/watch?v=')) {
        finalUrl = finalUrl.replace('watch?v=', 'embed/');
      } else if (finalUrl.includes('youtu.be/')) {
        finalUrl = finalUrl.replace('youtu.be/', 'youtube.com/embed/');
      }

      const formData = new FormData();
      formData.append('screen_id', screenId);
      formData.append('type', newItem.type);
      formData.append('duration', newItem.duration.toString());
      formData.append('loop', newItem.loop.toString());
      
      if (newItem.type === 'stream') {
        formData.append('layout_config', JSON.stringify(layoutConfig));
      }

      if (newItem.type === 'menu') {
        formData.append('layout_config', JSON.stringify({ dishIds: selectedDishes }));
      }

      if (newItem.type === 'tasks') {
        formData.append('layout_config', JSON.stringify({ child: selectedChild }));
      }

      if (schedule.enabled) {
        formData.append('schedule', JSON.stringify(schedule));
      }

      if (sourceType === 'upload' && file) {
        formData.append('file', file);
      } else {
        formData.append('url', finalUrl);
      }

      const res = await fetch('/api/playlist', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to add item');

      // Play success sound
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
      audio.play().catch(() => {});

      setNewItem({ type: 'image', url: '', duration: 10, loop: false });
      setSelectedDishes([]);
      setSelectedChild('all');
      setLayoutConfig({
        mode: 'fullscreen',
        top: 0,
        left: 0,
        width: 100,
        height: 100
      });
      setFile(null);
      setSourceType('url');
      setSchedule({
        enabled: false,
        startTime: '08:00',
        endTime: '20:00',
        days: [1, 2, 3, 4, 5, 6, 0]
      });
      fetchPlaylist();
    } catch (err: any) {
      console.error(err.message);
      playEasterEgg();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cet élément ?')) return;
    await fetch(`/api/playlist/${id}`, { method: 'DELETE' });
    fetchPlaylist();
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newPlaylist = [...playlist];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= playlist.length) return;

    [newPlaylist[index], newPlaylist[swapIndex]] = [newPlaylist[swapIndex], newPlaylist[index]];
    
    const updates = newPlaylist.map((item, i) => ({ id: item.id, order_index: i }));
    setPlaylist(newPlaylist); 
    
    await fetch('/api/playlist/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: updates, screenId: screenId }),
    });
  };

  const handleForceReload = () => {
    const socket = io();
    socket.emit('force_reload', screenId);
    socket.disconnect();
  };

  const handleAddMediaToPlaylist = async (media: MediaItem) => {
    try {
      const formData = new FormData();
      formData.append('screen_id', screenId);
      formData.append('type', media.type);
      formData.append('duration', '10');
      formData.append('loop', 'false');
      formData.append('url', media.url);

      const res = await fetch('/api/playlist', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        fetchPlaylist();
        setActiveTab('playlist');
      }
    } catch (err) {
      console.error('Failed to add media to playlist', err);
    }
  };

  const handleDeleteMedia = async (id: number) => {
    if (!confirm('Supprimer ce média de la bibliothèque ?')) return;
    try {
      const res = await fetch(`/api/media/${id}`, { method: 'DELETE' });
      if (res.ok) fetchMedia();
    } catch (err) {
      console.error('Failed to delete media', err);
    }
  };

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) fetchMedia();
    } catch (err) {
      console.error('Failed to upload media', err);
    }
  };

  const generateAIDescription = async (dishName: string) => {
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Génère une description courte (max 100 caractères) et appétissante pour le plat suivant : ${dishName}`,
          systemInstruction: "Tu es un chef étoilé français qui écrit des menus élégants."
        }),
      });
      const data = await res.json();
      return data.text;
    } catch (err) {
      console.error('AI generation failed', err);
      return '';
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 shadow-2xl"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-500/20">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white text-center mb-2 uppercase italic">Admin Kiosk</h1>
          <p className="text-zinc-500 text-center mb-10 font-bold uppercase tracking-widest text-xs">Accès Sécurisé</p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Utilisateur</label>
              <input 
                type="text" 
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-indigo-500 transition-all"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Mot de passe</label>
              <input 
                type="password" 
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-indigo-500 transition-all"
                placeholder="••••••••"
              />
            </div>
            {authError && (
              <p className="text-rose-500 text-xs font-bold text-center uppercase tracking-widest">{authError}</p>
            )}
            <button 
              type="submit"
              className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase italic tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
            >
              Se Connecter
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const currentScreenStatus = screensStatus.find(s => s.screen_id === screenId);
  const isOnline = currentScreenStatus && currentScreenStatus.last_ping && (new Date().getTime() - new Date(currentScreenStatus.last_ping).getTime() < 60000);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#F8F9FA] p-6 md:p-12 font-sans"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="p-3 bg-white border border-zinc-200 rounded-2xl hover:bg-zinc-50 transition-all shadow-sm">
              <ChevronLeft className="w-6 h-6 text-zinc-600" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-extrabold text-zinc-900 tracking-tight font-display uppercase">
                  {screenId}
                </h1>
                {isOnline ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
                    <Activity className="w-3 h-3 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Online</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-700 rounded-full border border-rose-200">
                    <XCircle className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Offline</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-zinc-500 font-medium text-sm uppercase tracking-widest">Gestion de la Playlist</p>
                {currentScreenStatus?.uptime_start && (
                  <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Uptime: {Math.floor((new Date().getTime() - new Date(currentScreenStatus.uptime_start).getTime()) / 3600000)}h
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={handleLogout}
              className="p-3 bg-white border border-zinc-200 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm group"
              title="Déconnexion"
            >
              <LogOut className="w-6 h-6" />
            </button>
            <button 
              onClick={toggleLoopPlaylist}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border font-bold transition-all ${
                loopPlaylist ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-100' : 'bg-white text-zinc-600 border-zinc-200'
              }`}
            >
              <Repeat className="w-4 h-4" /> {loopPlaylist ? "Boucle Active" : "Boucle Désactivée"}
            </button>
            <Link 
              to={`/player?screenId=${screenId}`} target="_blank"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-95"
            >
              <Eye className="w-5 h-5" /> Voir l'écran
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-zinc-200/50 p-1.5 rounded-[1.5rem] mb-12 w-fit overflow-x-auto max-w-full">
          {[
            { id: 'playlist', icon: MonitorPlay, label: 'Playlist' },
            { id: 'library', icon: Library, label: 'Médiathèque' },
            { id: 'layout', icon: Layout, label: 'Zones & Widgets' },
            { id: 'remote', icon: Radio, label: 'Télécommande' },
            { id: 'family', icon: Users, label: 'Famille' },
            { id: 'settings', icon: SettingsIcon, label: 'Réglages' }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all relative whitespace-nowrap ${
                activeTab === tab.id ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white rounded-2xl shadow-sm"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <tab.icon className="w-4 h-4 relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'playlist' && (
            <motion.div 
              key="playlist"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12"
            >
              {/* Formulaire d'ajout */}
              <div className="lg:col-span-4 space-y-8">
                <LivePreview 
                  screenId={screenId} 
                  currentItemId={currentScreenStatus?.current_item_id || null} 
                  playlist={playlist} 
                />

                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-200">
                  <h2 className="text-2xl font-bold mb-8 text-zinc-900 flex items-center gap-3 font-display">
                    <Plus className="w-6 h-6 text-indigo-600" /> Ajouter du contenu
                  </h2>
                  <form onSubmit={handleAdd} className="space-y-8">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Type de média</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['image', 'video', 'web', 'stream', 'menu', 'tasks'].map((t) => (
                          <button
                            key={t} type="button"
                            onClick={() => {
                              setNewItem({...newItem, type: t as any});
                              if (t === 'web' || t === 'stream' || t === 'menu' || t === 'tasks') setSourceType('url');
                              if (t === 'tasks') setNewItem(prev => ({ ...prev, url: 'tasks', type: 'tasks' }));
                            }}
                            className={`py-3 text-[10px] font-bold rounded-xl border transition-all uppercase tracking-tighter ${
                              newItem.type === t ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg' : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {newItem.type !== 'web' && newItem.type !== 'stream' && newItem.type !== 'menu' && newItem.type !== 'tasks' && (
                      <div className="flex bg-zinc-50 p-1.5 rounded-2xl border border-zinc-100">
                        <button 
                          type="button" onClick={() => setSourceType('url')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${sourceType === 'url' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
                        >
                          <LinkIcon className="w-3.5 h-3.5" /> URL
                        </button>
                        <button 
                          type="button" onClick={() => setSourceType('library')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${sourceType === 'library' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
                        >
                          <Library className="w-3.5 h-3.5" /> Bibliothèque
                        </button>
                        <button 
                          type="button" onClick={() => setSourceType('upload')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${sourceType === 'upload' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload
                        </button>
                      </div>
                    )}

                    <div className="space-y-4">
                      {sourceType === 'upload' ? (
                        <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group cursor-pointer">
                          <input 
                            type="file" accept={newItem.type === 'video' ? 'video/*' : 'image/*'}
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="hidden" id="file-upload"
                          />
                          <label htmlFor="file-upload" className="cursor-pointer block">
                            <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white transition-colors">
                              <Upload className="w-6 h-6 text-zinc-400 group-hover:text-indigo-600" />
                            </div>
                            <span className="text-sm font-bold text-zinc-600 block mb-1">
                              {file ? file.name : "Cliquez pour uploader"}
                            </span>
                            <span className="text-xs text-zinc-400">Images ou Vidéos</span>
                          </label>
                        </div>
                      ) : sourceType === 'library' ? (
                        <div className="space-y-3">
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Choisir un média</label>
                          <div className="max-h-48 overflow-y-auto border border-zinc-100 rounded-2xl p-3 space-y-1 bg-zinc-50 custom-scrollbar">
                            {mediaLibrary.filter(m => m.type === newItem.type).map(media => (
                              <button
                                key={media.id} type="button"
                                onClick={() => setNewItem({...newItem, url: media.url})}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border ${newItem.url === media.url ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-transparent hover:border-zinc-100 text-zinc-700'}`}
                              >
                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-100 shrink-0">
                                  {media.type === 'image' ? <img src={media.url} className="w-full h-full object-cover" /> : <Play className="w-full h-full p-3 text-zinc-400" />}
                                </div>
                                <span className="text-xs font-bold truncate">{media.name}</span>
                              </button>
                            ))}
                            {mediaLibrary.filter(m => m.type === newItem.type).length === 0 && (
                              <p className="text-[10px] text-zinc-400 text-center py-4">Aucun média de ce type</p>
                            )}
                          </div>
                        </div>
                      ) : newItem.type === 'tasks' ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                            <div className="flex justify-between items-start mb-2">
                              <p className="text-xs font-bold text-amber-800 uppercase flex items-center gap-2">
                                <CheckSquare className="w-3.5 h-3.5" /> Mode Tâches
                              </p>
                              <button 
                                type="button"
                                onClick={async () => {
                                  const res = await fetch('/api/ai/generate', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      prompt: "Suggère 3 tâches ménagères adaptées à des enfants, avec une description courte pour chacune.",
                                      systemInstruction: "Tu es un assistant familial bienveillant."
                                    }),
                                  });
                                  const data = await res.json();
                                  alert("Suggestions de l'IA :\n\n" + data.text);
                                }}
                                className="p-1.5 bg-white text-amber-600 rounded-lg border border-amber-200 hover:bg-amber-100 transition-all shadow-sm"
                                title="Suggérer des tâches avec l'IA"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-[11px] text-amber-600 leading-relaxed">Affiche le tableau des tâches des enfants sur cet écran.</p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Filtrer par enfant</label>
                            <select 
                              value={selectedChild}
                              onChange={(e) => setSelectedChild(e.target.value)}
                              className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-3.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                            >
                              <option value="all">Tous les enfants</option>
                              {children.map(child => (
                                <option key={child} value={child}>{child}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : newItem.type === 'menu' ? (
                        <div className="space-y-4">
                          <select 
                            value={newItem.url || ''}
                            onChange={(e) => {
                              setNewItem({...newItem, url: e.target.value});
                              setSelectedDishes([]);
                            }}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-3.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                          >
                            <option value="">Sélectionner un menu...</option>
                            {menus.map(m => (
                              <option key={m.id} value={m.id.toString()}>{m.name}</option>
                            ))}
                          </select>

                          {newItem.url && (
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Plats à afficher</label>
                                <button 
                                  type="button"
                                  onClick={async () => {
                                    const menu = menus.find(m => m.id.toString() === newItem.url);
                                    if (!menu) return;
                                    const dishNames = menu.dishes.map(d => d.name).join(', ');
                                    const description = await generateAIDescription(dishNames);
                                    alert("Description générée par l'IA :\n\n" + description);
                                  }}
                                  className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-all text-[9px] font-black uppercase tracking-widest"
                                >
                                  <Sparkles className="w-3 h-3" /> Optimiser avec l'IA
                                </button>
                              </div>
                              <div className="max-h-48 overflow-y-auto border border-zinc-100 rounded-2xl p-3 space-y-1 bg-zinc-50 custom-scrollbar">
                                {(() => {
                                  const menu = menus.find(m => m.id.toString() === newItem.url);
                                  if (!menu) return null;
                                  const content = typeof menu.content === 'string' ? JSON.parse(menu.content) : menu.content;
                                  let dishes = content.dishes || [];
                                  if (content.categories) {
                                    dishes = content.categories.flatMap((cat: any) => cat.dishes || []);
                                  }
                                  return dishes.map((dish: any) => (
                                    <label key={dish.id} className="flex items-center gap-3 p-3 hover:bg-white rounded-xl cursor-pointer transition-all border border-transparent hover:border-zinc-100">
                                      <input 
                                        type="checkbox" 
                                        checked={selectedDishes.includes(dish.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) setSelectedDishes([...selectedDishes, dish.id]);
                                          else setSelectedDishes(selectedDishes.filter(id => id !== dish.id));
                                        }}
                                        className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <span className="text-sm font-bold text-zinc-700">{dish.name}</span>
                                    </label>
                                  ));
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <LinkIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                          <input 
                            type="text" 
                            placeholder={newItem.type === 'stream' ? "URL HLS (.m3u8) ou DASH" : "https://..."} 
                            value={newItem.url || ''}
                            onChange={(e) => setNewItem({...newItem, url: e.target.value})}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-12 pr-5 py-3.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          />
                        </div>
                      )}
                    </div>

                    {/* Scheduling Section */}
                    <div className="p-6 bg-zinc-50 rounded-[1.5rem] border border-zinc-200 space-y-5">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                          <Calendar className="w-4 h-4 text-indigo-500" /> Programmation
                        </label>
                        <button 
                          type="button"
                          onClick={() => setSchedule({...schedule, enabled: !schedule.enabled})}
                          className={`w-12 h-6 rounded-full transition-all relative ${schedule.enabled ? 'bg-indigo-600' : 'bg-zinc-300'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${schedule.enabled ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>

                      {schedule.enabled && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="space-y-5 pt-5 border-t border-zinc-200 overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Début</label>
                              <input 
                                type="time" value={schedule.startTime}
                                onChange={(e) => setSchedule({...schedule, startTime: e.target.value})}
                                className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Fin</label>
                              <input 
                                type="time" value={schedule.endTime}
                                onChange={(e) => setSchedule({...schedule, endTime: e.target.value})}
                                className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Jours actifs</label>
                            <div className="flex justify-between gap-1">
                              {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, i) => (
                                <button
                                  key={i} type="button"
                                  onClick={() => {
                                    const newDays = schedule.days.includes(i) 
                                      ? schedule.days.filter(d => d !== i)
                                      : [...schedule.days, i];
                                    setSchedule({...schedule, days: newDays});
                                  }}
                                  className={`flex-1 aspect-square rounded-xl text-[10px] font-black transition-all border ${
                                    schedule.days.includes(i) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100' : 'bg-white text-zinc-400 border-zinc-200'
                                  }`}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {newItem.type !== 'video' && newItem.type !== 'stream' && (
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Durée (sec)</label>
                          <input 
                            type="number" value={newItem.duration || 10}
                            onChange={(e) => setNewItem({...newItem, duration: parseInt(e.target.value) || 5})}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                          />
                        </div>
                      )}
                      <div className={`flex flex-col justify-end ${newItem.type === 'video' || newItem.type === 'stream' ? 'col-span-2' : ''}`}>
                        <button
                          type="button" onClick={() => setNewItem({...newItem, loop: !newItem.loop})}
                          className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border text-xs font-bold transition-all ${
                            newItem.loop ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-zinc-400 border-zinc-200'
                          }`}
                        >
                          <Repeat className="w-3.5 h-3.5" /> Boucle individuelle
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-4 bg-indigo-600 text-white rounded-[1.5rem] font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95"
                    >
                      <Plus className="w-6 h-6" /> Ajouter à la playlist
                    </button>
                  </form>
                </div>
              </div>

              {/* Liste de la playlist */}
              <div className="lg:col-span-8">
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-zinc-200 overflow-hidden">
                  <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/30">
                    <h2 className="text-xl font-bold text-zinc-900 font-display">Contenus de la playlist ({playlist.length})</h2>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">En ligne</span>
                    </div>
                  </div>
                  
                  {loading ? (
                    <div className="p-32 text-center">
                      <RefreshCw className="w-10 h-10 animate-spin mx-auto text-indigo-500 mb-4" />
                      <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Chargement...</p>
                    </div>
                  ) : playlist.length === 0 ? (
                    <div className="p-32 text-center">
                      <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Layout className="w-8 h-8 text-zinc-200" />
                      </div>
                      <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">La playlist est vide</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100">
                      {playlist.map((item, index) => (
                        <motion.div 
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          key={item.id} 
                          className="p-6 flex items-center gap-6 group hover:bg-zinc-50 transition-all"
                        >
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-1.5 text-zinc-300 hover:text-zinc-900 disabled:opacity-10 transition-colors"><ArrowUp className="w-4 h-4"/></button>
                            <button onClick={() => handleMove(index, 'down')} disabled={index === playlist.length - 1} className="p-1.5 text-zinc-300 hover:text-zinc-900 disabled:opacity-10 transition-colors"><ArrowDown className="w-4 h-4"/></button>
                          </div>
                          
                          <div className="w-24 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center overflow-hidden border border-zinc-200 shadow-sm relative">
                            {item.type === 'image' ? (
                              <img src={item.url} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                {item.type === 'video' && <Play className="w-4 h-4 text-zinc-400" />}
                                {item.type === 'stream' && <Radio className="w-4 h-4 text-zinc-400" />}
                                {item.type === 'menu' && <Utensils className="w-4 h-4 text-zinc-400" />}
                                {item.type === 'tasks' && <CheckSquare className="w-4 h-4 text-zinc-400" />}
                                <span className="text-[8px] font-black text-zinc-400 uppercase tracking-tighter">{item.type}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-zinc-900 truncate tracking-tight font-display">
                              {item.type === 'menu' ? (menus.find(m => m.id.toString() === item.url)?.name || 'Menu Gastronomique') : item.url.split('/').pop()}
                            </h3>
                            <div className="flex items-center gap-4 mt-1.5">
                              {item.type !== 'video' && item.type !== 'stream' && item.type !== 'menu' && (
                                <span className="text-xs font-bold text-zinc-400">{item.duration}s</span>
                              )}
                              {item.schedule && (() => {
                                try {
                                  const s = JSON.parse(item.schedule);
                                  if (!s.enabled) return null;
                                  return (
                                    <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg flex items-center gap-1.5 uppercase tracking-wider border border-amber-100">
                                      <Clock className="w-3 h-3" /> {s.startTime} - {s.endTime}
                                    </span>
                                  );
                                } catch (e) {
                                  return null;
                                }
                              })()}
                              {item.loop && (
                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg flex items-center gap-1.5 uppercase tracking-wider border border-indigo-100">
                                  <Repeat className="w-3 h-3" /> Boucle
                                </span>
                              )}
                            </div>
                          </div>

                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-3 text-zinc-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'library' && (
            <motion.div 
              key="library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black text-zinc-900 uppercase italic tracking-tighter">Médiathèque Centrale</h2>
                <label className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase italic tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 cursor-pointer flex items-center gap-3">
                  <Upload className="w-5 h-5" /> Ajouter un média
                  <input type="file" className="hidden" onChange={handleUploadMedia} />
                </label>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {mediaLibrary.map((media) => (
                  <motion.div 
                    layout
                    key={media.id}
                    className="bg-white rounded-[2rem] border border-zinc-200 overflow-hidden group shadow-sm hover:shadow-xl transition-all"
                  >
                    <div className="aspect-video bg-zinc-100 relative overflow-hidden">
                      {media.type === 'image' ? (
                        <img src={media.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-10 h-10 text-zinc-300" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button 
                          onClick={() => handleAddMediaToPlaylist(media)}
                          className="p-3 bg-white text-zinc-900 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-lg"
                          title="Ajouter à la playlist"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteMedia(media.id)}
                          className="p-3 bg-white text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-lg"
                          title="Supprimer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-zinc-900 text-sm truncate mb-1">{media.name}</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{media.type}</span>
                        <span className="text-[10px] font-bold text-zinc-400">{(media.size / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {mediaLibrary.length === 0 && (
                  <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border border-dashed border-zinc-200">
                    <Library className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Votre bibliothèque est vide</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'layout' && (
            <motion.div 
              key="layout"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12"
            >
              <div className="lg:col-span-5">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-200">
                  <h2 className="text-2xl font-bold mb-8 text-zinc-900 flex items-center gap-3 font-display">
                    <Layout className="w-6 h-6 text-indigo-600" /> Structure de l'écran
                  </h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Mode d'affichage</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => handleLayoutModeChange('fullscreen')}
                          className={`p-6 rounded-2xl border-2 transition-all text-center flex flex-col items-center gap-3 ${
                            layoutMode === 'fullscreen' ? 'border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-100' : 'border-zinc-100 hover:border-zinc-200'
                          }`}
                        >
                          <div className="w-full aspect-video bg-zinc-200 rounded-lg flex items-center justify-center">
                            <div className="w-3/4 h-3/4 bg-indigo-400/50 rounded shadow-sm"></div>
                          </div>
                          <span className="font-bold text-sm">Plein Écran</span>
                        </button>
                        <button
                          onClick={() => handleLayoutModeChange('split')}
                          className={`p-6 rounded-2xl border-2 transition-all text-center flex flex-col items-center gap-3 ${
                            layoutMode === 'split' ? 'border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-100' : 'border-zinc-100 hover:border-zinc-200'
                          }`}
                        >
                          <div className="w-full aspect-video bg-zinc-200 rounded-lg flex items-center justify-center gap-1 p-1">
                            <div className="w-2/3 h-full bg-indigo-400/50 rounded shadow-sm"></div>
                            <div className="w-1/3 h-full bg-zinc-400/50 rounded shadow-sm"></div>
                          </div>
                          <span className="font-bold text-sm">Multi-Zones</span>
                        </button>
                      </div>
                    </div>

                    {layoutMode === 'split' && (
                      <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl flex gap-4">
                        <Info className="w-5 h-5 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-800 leading-relaxed">
                          Le mode Multi-Zones divise l'écran en deux : une zone principale pour votre playlist (70%) et une barre latérale pour vos widgets (30%).
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-200">
                  <h2 className="text-2xl font-bold mb-8 text-zinc-900 flex items-center gap-3 font-display">
                    <Plus className="w-6 h-6 text-indigo-600" /> Widgets de la barre latérale
                  </h2>
                  
                  <div className="space-y-4">
                    {sidebarConfig.map((widget) => (
                      <div 
                        key={widget.id}
                        className={`p-6 rounded-2xl border transition-all ${
                          widget.enabled ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-50 border-zinc-100 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${widget.enabled ? 'bg-indigo-50 text-indigo-600' : 'bg-zinc-200 text-zinc-400'}`}>
                              {widget.type === 'clock' && <Clock className="w-5 h-5" />}
                              {widget.type === 'weather' && <CloudSun className="w-5 h-5" />}
                              {widget.type === 'rss' && <Newspaper className="w-5 h-5" />}
                              {widget.type === 'countdown' && <Timer className="w-5 h-5" />}
                              {widget.type === 'tasks' && <CheckSquare className="w-5 h-5" />}
                              {widget.type === 'calendar' && <Calendar className="w-5 h-5" />}
                            </div>
                            <div>
                              <h3 className="font-bold text-zinc-900">
                                {widget.type === 'clock' && 'Horloge Design'}
                                {widget.type === 'weather' && 'Météo Locale'}
                                {widget.type === 'rss' && 'Flux d\'Actualités'}
                                {widget.type === 'countdown' && 'Compte à Rebours'}
                                {widget.type === 'tasks' && 'Tableau des Tâches'}
                                {widget.type === 'calendar' && 'Calendrier Familial'}
                              </h3>
                              <p className="text-xs text-zinc-500">
                                {widget.type === 'clock' && 'Affiche l\'heure et la date actuelle.'}
                                {widget.type === 'weather' && 'Prévisions météo en temps réel.'}
                                {widget.type === 'rss' && 'Dernières nouvelles via flux RSS.'}
                                {widget.type === 'countdown' && 'Décompte jusqu\'à une date précise.'}
                                {widget.type === 'tasks' && 'Aperçu des tâches familiales.'}
                                {widget.type === 'calendar' && 'Synchronisez votre Google Calendar.'}
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleWidgetToggle(widget.id)}
                            className={`w-12 h-6 rounded-full transition-all relative ${widget.enabled ? 'bg-indigo-600' : 'bg-zinc-300'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${widget.enabled ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>

                        {widget.enabled && widget.type !== 'clock' && widget.type !== 'tasks' && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="pt-4 border-t border-zinc-100 grid grid-cols-2 gap-4"
                          >
                            {widget.type === 'weather' && (
                              <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Ville</label>
                                <input 
                                  type="text" 
                                  value={widget.config?.city || ''}
                                  onChange={(e) => handleWidgetConfigChange(widget.id, { city: e.target.value })}
                                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:border-indigo-500"
                                  placeholder="Ex: Paris"
                                />
                              </div>
                            )}
                            {widget.type === 'rss' && (
                              <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">URL du flux RSS</label>
                                <input 
                                  type="text" 
                                  value={widget.config?.url || ''}
                                  onChange={(e) => handleWidgetConfigChange(widget.id, { url: e.target.value })}
                                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:border-indigo-500"
                                  placeholder="https://..."
                                />
                              </div>
                            )}
                            {widget.type === 'countdown' && (
                              <>
                                <div>
                                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Libellé</label>
                                  <input 
                                    type="text" 
                                    value={widget.config?.label || ''}
                                    onChange={(e) => handleWidgetConfigChange(widget.id, { label: e.target.value })}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:border-indigo-500"
                                    placeholder="Ex: Vacances"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Date cible</label>
                                  <input 
                                    type="date" 
                                    value={widget.config?.date || ''}
                                    onChange={(e) => handleWidgetConfigChange(widget.id, { date: e.target.value })}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:border-indigo-500"
                                  />
                                </div>
                              </>
                            )}
                            {widget.type === 'calendar' && (
                              <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">URL Publique Google Calendar (iCal/Embed)</label>
                                <input 
                                  type="text" 
                                  value={widget.config?.url || ''}
                                  onChange={(e) => handleWidgetConfigChange(widget.id, { url: e.target.value })}
                                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:border-indigo-500"
                                  placeholder="https://calendar.google.com/calendar/embed?..."
                                />
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'remote' && (
            <motion.div 
              key="remote"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-zinc-200">
                  <h2 className="text-2xl font-bold mb-8 text-zinc-900 flex items-center gap-3 font-display">
                    <Radio className="w-6 h-6 text-indigo-600" /> Contrôle en Direct
                  </h2>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <button 
                      onClick={() => sendRemoteAction('prev_slide')}
                      className="aspect-square bg-zinc-50 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-zinc-100 transition-all border border-zinc-100 group active:scale-95"
                    >
                      <SkipBack className="w-6 h-6 text-zinc-400 group-hover:text-zinc-900" />
                      <span className="text-[10px] font-bold uppercase text-zinc-400 group-hover:text-zinc-900">Précédent</span>
                    </button>
                    <div className="flex flex-col gap-4">
                      <button 
                        onClick={() => sendRemoteAction('pause_player')}
                        className="flex-1 bg-zinc-900 text-white rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-zinc-800 transition-all shadow-lg active:scale-95"
                      >
                        <Pause className="w-6 h-6" />
                        <span className="text-[10px] font-bold uppercase">Pause</span>
                      </button>
                      <button 
                        onClick={() => sendRemoteAction('resume_player')}
                        className="flex-1 bg-emerald-600 text-white rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
                      >
                        <Play className="w-6 h-6" />
                        <span className="text-[10px] font-bold uppercase">Lecture</span>
                      </button>
                    </div>
                    <button 
                      onClick={() => sendRemoteAction('next_slide')}
                      className="aspect-square bg-zinc-50 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-zinc-100 transition-all border border-zinc-100 group active:scale-95"
                    >
                      <SkipForward className="w-6 h-6 text-zinc-400 group-hover:text-zinc-900" />
                      <span className="text-[10px] font-bold uppercase text-zinc-400 group-hover:text-zinc-900">Suivant</span>
                    </button>
                  </div>

                  <div className="mt-8 pt-8 border-t border-zinc-100">
                    <button 
                      onClick={handleForceReload}
                      className="w-full py-4 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-50 transition-all shadow-sm active:scale-95"
                    >
                      <RefreshCw className="w-5 h-5 text-indigo-600" /> Recharger l'écran
                    </button>
                  </div>
                </div>

                <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-zinc-200">
                  <h2 className="text-2xl font-bold mb-8 text-zinc-900 flex items-center gap-3 font-display">
                    <MessageSquare className="w-6 h-6 text-indigo-600" /> Message Flash
                  </h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Contenu du message</label>
                      <textarea 
                        value={flashMessage.text}
                        onChange={(e) => setFlashMessage({ ...flashMessage, text: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-sm font-medium outline-none focus:border-indigo-500 h-32 resize-none"
                        placeholder="Tapez votre message ici..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Durée (sec)</label>
                        <input 
                          type="number" 
                          value={flashMessage.duration}
                          onChange={(e) => setFlashMessage({ ...flashMessage, duration: parseInt(e.target.value) || 5 })}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Type</label>
                        <select 
                          value={flashMessage.type}
                          onChange={(e) => setFlashMessage({ ...flashMessage, type: e.target.value as any })}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500 appearance-none"
                        >
                          <option value="info">Information</option>
                          <option value="warning">Attention</option>
                          <option value="error">Urgent</option>
                        </select>
                      </div>
                    </div>

                    <button 
                      onClick={sendFlashMessage}
                      disabled={!flashMessage.text}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 disabled:opacity-50 disabled:shadow-none active:scale-95"
                    >
                      <Play className="w-5 h-5" /> Envoyer le message
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'family' && (
            <motion.div 
              key="family"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white rounded-[3rem] shadow-sm border border-zinc-200 p-20 text-center"
            >
              <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-8">
                <Users className="w-10 h-10 text-rose-500" />
              </div>
              <h2 className="text-3xl font-bold text-zinc-900 mb-4 font-display">Gestion de la Famille</h2>
              <p className="text-zinc-500 text-lg max-w-md mx-auto mb-12 leading-relaxed">
                Organisez les membres de votre famille et gérez leurs rôles pour un affichage personnalisé des tâches.
              </p>
              <Link 
                to="/family"
                className="inline-flex items-center gap-3 px-12 py-4 bg-rose-600 text-white rounded-[1.5rem] font-bold hover:bg-rose-700 transition-all shadow-xl shadow-rose-100 active:scale-95"
              >
                Accéder aux réglages famille <ChevronRight className="w-5 h-5" />
              </Link>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl"
            >
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-zinc-200 p-10 space-y-10">
                <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-3 font-display">
                  <SettingsIcon className="w-6 h-6 text-indigo-600" /> Réglages de l'écran
                </h2>
                
                <div className="space-y-8">
                  <div className="flex items-center justify-between p-6 bg-zinc-50 rounded-[1.5rem] border border-zinc-100">
                    <div>
                      <h3 className="font-bold text-zinc-900 text-lg">Lecture en boucle</h3>
                      <p className="text-sm text-zinc-500 mt-1">Relancer la playlist automatiquement à la fin.</p>
                    </div>
                    <button 
                      onClick={toggleLoopPlaylist}
                      className={`w-14 h-7 rounded-full transition-all relative ${loopPlaylist ? 'bg-indigo-600' : 'bg-zinc-300'}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${loopPlaylist ? 'left-8' : 'left-1'}`} />
                    </button>
                  </div>
                  
                  <div className="p-8 bg-zinc-50 rounded-[1.5rem] border border-zinc-100">
                    <h3 className="font-bold text-zinc-900 text-lg mb-4">Thème visuel</h3>
                    <p className="text-sm text-zinc-500 mb-6">Choisissez l'ambiance visuelle de cet écran.</p>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: 'modern', label: 'Moderne', class: 'bg-mesh' },
                        { id: 'dark', label: 'Sombre', class: 'bg-mesh-dark' },
                        { id: 'nature', label: 'Nature', class: 'bg-mesh-nature' },
                        { id: 'cyber', label: 'Cyberpunk', class: 'bg-mesh-cyber' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleThemeChange(t.id)}
                          className={`p-4 rounded-2xl border-2 transition-all text-left relative overflow-hidden group ${
                            theme === t.id ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-zinc-200 hover:border-zinc-300'
                          }`}
                        >
                          <div className={`absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity ${t.class}`}></div>
                          <span className={`relative z-10 font-bold text-sm ${theme === t.id ? 'text-indigo-600' : 'text-zinc-600'}`}>
                            {t.label}
                          </span>
                          {theme === t.id && (
                            <div className="absolute top-2 right-2 z-10">
                              <div className="bg-indigo-600 rounded-full p-1">
                                <CheckSquare className="w-3 h-3 text-white" />
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-8 bg-zinc-50 rounded-[1.5rem] border border-zinc-100">
                    <h3 className="font-bold text-zinc-900 text-lg mb-2">Rechargement à distance</h3>
                    <p className="text-sm text-zinc-500 mb-8">Force le rafraîchissement de tous les lecteurs connectés à cet écran.</p>
                    <button 
                      onClick={handleForceReload}
                      className="flex items-center gap-3 px-8 py-3.5 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm hover:bg-zinc-100 transition-all shadow-sm active:scale-95"
                    >
                      <RefreshCw className="w-5 h-5 text-indigo-600" /> Recharger les lecteurs
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
