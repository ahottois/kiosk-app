import React, { useState, useEffect } from 'react';
import { 
  Play, Plus, Trash2, ArrowUp, ArrowDown, 
  RefreshCw, MonitorPlay, ChevronLeft, Repeat, 
  Link as LinkIcon, Upload, Radio, Utensils,
  Calendar, Clock, Users, Settings as SettingsIcon,
  Layout, Eye, CheckSquare, ChevronRight
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { playEasterEgg } from '../services/easterEgg';

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
}

export default function Admin() {
  const { screenId: urlScreenId } = useParams();
  const screenId = urlScreenId || 'default';
  
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [children, setChildren] = useState<string[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('all');
  const [selectedDishes, setSelectedDishes] = useState<string[]>([]);
  const [loopPlaylist, setLoopPlaylist] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'playlist' | 'family' | 'settings'>('playlist');
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
  const [sourceType, setSourceType] = useState<'upload' | 'url'>('url');

  const fetchPlaylist = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/playlist?screenId=${screenId}`);
      const data = await res.json();
      setPlaylist(data.items);
      setLoopPlaylist(data.config.loop_playlist);
      
      const menusRes = await fetch('/api/menus');
      const menusData = await menusRes.json();
      setMenus(menusData);

      const familyRes = await fetch('/api/family');
      const familyData = await familyRes.json();
      const childrenNames = familyData
        .filter((m: any) => m.role === 'Enfant')
        .map((m: any) => m.name);
      setChildren(childrenNames);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylist();
  }, [screenId]);

  const toggleLoopPlaylist = async () => {
    const newValue = !loopPlaylist;
    setLoopPlaylist(newValue);
    try {
      await fetch('/api/screens/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenId, loopPlaylist: newValue }),
      });
    } catch (err) {
      console.error('Failed to update screen config', err);
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
    import('socket.io-client').then(({ io }) => {
      const socket = io();
      socket.emit('force_reload', screenId);
      socket.disconnect();
    });
  };

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
              <h1 className="text-4xl font-extrabold text-zinc-900 tracking-tight font-display uppercase">
                {screenId}
              </h1>
              <p className="text-zinc-500 font-medium text-sm mt-1 uppercase tracking-widest">Gestion de la Playlist</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
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
        <div className="flex items-center gap-1 bg-zinc-200/50 p-1.5 rounded-[1.5rem] mb-12 w-fit">
          {[
            { id: 'playlist', icon: MonitorPlay, label: 'Playlist' },
            { id: 'family', icon: Users, label: 'Famille' },
            { id: 'settings', icon: SettingsIcon, label: 'Réglages' }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-sm transition-all relative ${
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
              <div className="lg:col-span-4">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-200 sticky top-12">
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
                      ) : newItem.type === 'tasks' ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                            <p className="text-xs font-bold text-amber-800 uppercase mb-1 flex items-center gap-2">
                              <CheckSquare className="w-3.5 h-3.5" /> Mode Tâches
                            </p>
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
                              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Plats à afficher</label>
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
