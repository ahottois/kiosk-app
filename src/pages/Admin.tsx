import React, { useState, useEffect } from 'react';
import { 
  Play, Plus, Trash2, ArrowUp, ArrowDown, 
  RefreshCw, MonitorPlay, ChevronLeft, Repeat, 
  Link as LinkIcon, Upload, Radio, Utensils
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { playEasterEgg } from '../services/easterEgg';

interface PlaylistItem {
  id: number;
  type: 'image' | 'video' | 'web' | 'stream' | 'menu';
  url: string;
  duration: number;
  order_index: number;
  loop: boolean;
  layout_config?: string;
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
  const [selectedDishes, setSelectedDishes] = useState<string[]>([]);
  const [loopPlaylist, setLoopPlaylist] = useState(true);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ 
    type: 'image' as 'image' | 'video' | 'web' | 'stream' | 'menu', 
    url: '', 
    duration: 10,
    loop: false 
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
      // On sépare les items de la configuration globale de l'écran
      setPlaylist(data.items);
      setLoopPlaylist(data.config.loop_playlist);
      
      const menusRes = await fetch('/api/menus');
      const menusData = await menusRes.json();
      setMenus(menusData);
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

      // Gestion YouTube Embed automatique
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

      if (sourceType === 'upload' && file) {
        formData.append('file', file);
      } else {
        formData.append('url', finalUrl);
      }

      const res = await fetch('/api/playlist', {
        method: 'POST',
        body: formData, // On envoie en FormData pour supporter l'upload
      });

      if (!res.ok) throw new Error('Failed to add item');

      setNewItem({ type: 'image', url: '', duration: 10, loop: false });
      setSelectedDishes([]);
      setLayoutConfig({
        mode: 'fullscreen',
        top: 0,
        left: 0,
        width: 100,
        height: 100
      });
      setFile(null);
      setSourceType('url');
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
    <div className="min-h-screen bg-zinc-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-zinc-600" />
            </Link>
            <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight">
              {screenId} <span className="text-zinc-300 font-light">/</span> Playlist
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleLoopPlaylist}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold transition-all ${
                loopPlaylist ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-200' : 'bg-white text-zinc-600 border-zinc-200'
              }`}
            >
              <Repeat className="w-4 h-4" /> {loopPlaylist ? "Loop Playlist ON" : "Loop Playlist OFF"}
            </button>
            <button onClick={handleForceReload} className="p-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 shadow-sm">
              <RefreshCw className="w-5 h-5" />
            </button>
            <Link 
              to={`/player?screenId=${screenId}`} target="_blank"
              className="flex items-center gap-2 px-6 py-2.5 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-95"
            >
              <MonitorPlay className="w-5 h-5" /> Live View
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulaire d'ajout */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 sticky top-8">
              <h2 className="text-xl font-bold mb-6 text-zinc-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" /> Add Content
              </h2>
              <form onSubmit={handleAdd} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2">Media Type</label>
                  <div className="grid grid-cols-5 gap-2">
                    {['image', 'video', 'web', 'stream', 'menu'].map((t) => (
                      <button
                        key={t} type="button"
                        onClick={() => {
                          setNewItem({...newItem, type: t as any});
                          if (t === 'web' || t === 'stream' || t === 'menu') setSourceType('url');
                        }}
                        className={`py-2 text-[10px] font-bold rounded-lg border transition-all uppercase ${
                          newItem.type === t ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {newItem.type !== 'web' && newItem.type !== 'stream' && newItem.type !== 'menu' && (
                  <div className="flex bg-zinc-100 p-1 rounded-xl">
                    <button 
                      type="button" onClick={() => setSourceType('url')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${sourceType === 'url' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
                    >
                      <LinkIcon className="w-3 h-3" /> URL
                    </button>
                    <button 
                      type="button" onClick={() => setSourceType('upload')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${sourceType === 'upload' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
                    >
                      <Upload className="w-3 h-3" /> Upload
                    </button>
                  </div>
                )}

                {sourceType === 'upload' ? (
                  <div className="border-2 border-dashed border-zinc-200 rounded-xl p-4 text-center hover:border-indigo-400 transition-colors">
                    <input 
                      type="file" accept={newItem.type === 'video' ? 'video/*' : 'image/*'}
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden" id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer block">
                      <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                      <span className="text-xs font-medium text-zinc-600">
                        {file ? file.name : "Click to upload file"}
                      </span>
                    </label>
                  </div>
                ) : newItem.type === 'menu' ? (
                  <div className="space-y-4">
                    <select 
                      value={newItem.url}
                      onChange={(e) => {
                        setNewItem({...newItem, url: e.target.value});
                        setSelectedDishes([]);
                      }}
                      className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="">Sélectionner un menu...</option>
                      {menus.map(m => (
                        <option key={m.id} value={m.id.toString()}>{m.name}</option>
                      ))}
                    </select>

                    {newItem.url && (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase">Sélectionner les plats à afficher</label>
                        <div className="max-h-40 overflow-y-auto border border-zinc-100 rounded-xl p-2 space-y-1">
                          {(() => {
                            const menu = menus.find(m => m.id.toString() === newItem.url);
                            if (!menu) return null;
                            const content = typeof menu.content === 'string' ? JSON.parse(menu.content) : menu.content;
                            const dishes = content.dishes || [];
                            return dishes.map((dish: any) => (
                              <label key={dish.id} className="flex items-center gap-2 p-2 hover:bg-zinc-50 rounded-lg cursor-pointer transition-colors">
                                <input 
                                  type="checkbox" 
                                  checked={selectedDishes.includes(dish.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedDishes([...selectedDishes, dish.id]);
                                    else setSelectedDishes(selectedDishes.filter(id => id !== dish.id));
                                  }}
                                  className="rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs font-medium text-zinc-700">{dish.name}</span>
                              </label>
                            ));
                          })()}
                        </div>
                        <p className="text-[10px] text-zinc-400 italic">
                          {selectedDishes.length} plat(s) sélectionné(s)
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input 
                      type="text" placeholder={newItem.type === 'stream' ? "HLS (.m3u8) or DASH (.mpd) URL" : "https://..."} value={newItem.url}
                      onChange={(e) => setNewItem({...newItem, url: e.target.value})}
                      className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                    {newItem.type === 'stream' && (
                      <p className="text-[10px] text-zinc-400 mt-1">
                        Supports HLS, DASH, and WebRTC. For RTSP/RTMP, use a transcoder.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {newItem.type !== 'video' && newItem.type !== 'stream' && (
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Duration (s)</label>
                      <input 
                        type="number" value={newItem.duration}
                        onChange={(e) => setNewItem({...newItem, duration: parseInt(e.target.value) || 5})}
                        className="w-full border border-zinc-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                  <div className={`flex flex-col justify-end ${newItem.type === 'video' || newItem.type === 'stream' ? 'col-span-2' : ''}`}>
                    <button
                      type="button" onClick={() => setNewItem({...newItem, loop: !newItem.loop})}
                      className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-bold transition-all ${
                        newItem.loop ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-zinc-400 border-zinc-200'
                      }`}
                    >
                      <Repeat className="w-3 h-3" /> Individual Loop
                    </button>
                  </div>
                </div>

                {newItem.type === 'stream' && (
                  <div className="space-y-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                    <label className="block text-xs font-bold text-zinc-500 uppercase">Layout Settings</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['fullscreen', 'center', 'custom'].map((m) => (
                        <button
                          key={m} type="button"
                          onClick={() => setLayoutConfig({...layoutConfig, mode: m as any})}
                          className={`py-1.5 text-[10px] font-bold rounded-lg border transition-all uppercase ${
                            layoutConfig.mode === m ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    {layoutConfig.mode === 'custom' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Top (%)</label>
                          <input 
                            type="number" value={layoutConfig.top}
                            onChange={(e) => setLayoutConfig({...layoutConfig, top: parseInt(e.target.value) || 0})}
                            className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Left (%)</label>
                          <input 
                            type="number" value={layoutConfig.left}
                            onChange={(e) => setLayoutConfig({...layoutConfig, left: parseInt(e.target.value) || 0})}
                            className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Width (%)</label>
                          <input 
                            type="number" value={layoutConfig.width}
                            onChange={(e) => setLayoutConfig({...layoutConfig, width: parseInt(e.target.value) || 100})}
                            className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Height (%)</label>
                          <input 
                            type="number" value={layoutConfig.height}
                            onChange={(e) => setLayoutConfig({...layoutConfig, height: parseInt(e.target.value) || 100})}
                            className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> Add to Playlist
                </button>
              </form>
            </div>
          </div>

          {/* Liste de la playlist */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
              <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                <h2 className="font-bold text-zinc-800">Media Items ({playlist.length})</h2>
              </div>
              
              {loading ? (
                <div className="p-20 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-zinc-300" /></div>
              ) : playlist.length === 0 ? (
                <div className="p-20 text-center text-zinc-400 font-medium">Playlist is empty.</div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {playlist.map((item, index) => (
                    <div key={item.id} className="p-4 flex items-center gap-4 group hover:bg-zinc-50 transition-colors">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-1 text-zinc-300 hover:text-zinc-900 disabled:opacity-20"><ArrowUp className="w-4 h-4"/></button>
                        <button onClick={() => handleMove(index, 'down')} disabled={index === playlist.length - 1} className="p-1 text-zinc-300 hover:text-zinc-900 disabled:opacity-20"><ArrowDown className="w-4 h-4"/></button>
                      </div>
                      
                      <div className="w-16 h-12 bg-zinc-100 rounded-lg flex items-center justify-center overflow-hidden border border-zinc-200">
                        {item.type === 'image' ? (
                          <img src={item.url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">{item.type}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-zinc-900 truncate uppercase tracking-tight">
                          {item.type === 'menu' ? (menus.find(m => m.id.toString() === item.url)?.name || 'Menu') : item.url.split('/').pop()}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          {item.type !== 'video' && item.type !== 'stream' && item.type !== 'menu' && (
                            <span className="text-xs text-zinc-400 font-medium">{item.duration}s</span>
                          )}
                          {item.type === 'stream' && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1 uppercase">
                              <Radio className="w-2 h-2" /> Live Stream
                            </span>
                          )}
                          {item.type === 'menu' && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1 uppercase">
                              <Utensils className="w-2 h-2" /> Menu
                            </span>
                          )}
                          {item.loop && (
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded flex items-center gap-1 uppercase">
                              <Repeat className="w-2 h-2" /> Item Loop
                            </span>
                          )}
                        </div>
                      </div>

                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2.5 text-zinc-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}