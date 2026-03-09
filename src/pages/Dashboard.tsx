import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Monitor, Plus, Settings, Play, Trash2, RefreshCw, LayoutGrid, Server, Utensils, CheckSquare, Users, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Screen {
  screen_id: string;
  item_count: number;
  loop_playlist: number;
}

export default function Dashboard() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  const [newScreenName, setNewScreenName] = useState('');
  const navigate = useNavigate();

  const fetchScreens = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/screens');
      if (!res.ok) throw new Error(`Erreur serveur: ${res.status}`);
      const data = await res.json();
      setScreens(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch screens:', err);
      setScreens([]); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScreens();
  }, []);

  const handleCreateScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newScreenName.trim();
    if (!trimmedName) return;
    
    try {
      const res = await fetch('/api/screens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trimmedName }),
      });

      if (res.ok) {
        setNewScreenName('');
        fetchScreens();
      } else {
        const errorData = await res.json();
        alert(`Erreur : ${errorData.error || 'Impossible de créer l\'écran'}`);
      }
    } catch (err) {
      console.error('Create screen error:', err);
    }
  };

  const handleDeleteScreen = async (id: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer l'écran "${id}" ? Cela supprimera également toute sa playlist.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/screens/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchScreens();
      }
    } catch (err) {
      console.error('Delete screen error:', err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#F8F9FA] p-6 md:p-12 font-sans"
    >
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-200">
                <LayoutGrid className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-5xl font-extrabold text-zinc-900 tracking-tight font-display">
                Kiosk<span className="text-indigo-600">Manager</span>
              </h1>
            </div>
            <p className="text-zinc-500 text-lg font-medium max-w-md leading-relaxed">
              Gérez vos écrans connectés, playlists et contenus interactifs en toute simplicité.
            </p>
            
            <div className="flex flex-wrap gap-4 mt-8">
              <Link to="/menus" className="group flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm">
                <Utensils className="w-4 h-4 text-emerald-500" /> Gestion Menus
              </Link>
              <Link to="/tasks" className="group flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 hover:border-amber-500 hover:text-amber-600 transition-all shadow-sm">
                <CheckSquare className="w-4 h-4 text-amber-500" /> Gestion Tâches
              </Link>
              <Link to="/family" className="group flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 hover:border-rose-500 hover:text-rose-600 transition-all shadow-sm">
                <Users className="w-4 h-4 text-rose-500" /> Ma Famille
              </Link>
            </div>
          </motion.div>
          
          <motion.form 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            onSubmit={handleCreateScreen} 
            className="flex w-full lg:w-auto gap-3 bg-white p-2 rounded-2xl shadow-xl shadow-zinc-200/50 border border-zinc-100"
          >
            <input 
              type="text" 
              placeholder="Nom de l'écran..." 
              value={newScreenName}
              onChange={(e) => setNewScreenName(e.target.value)}
              className="flex-1 lg:w-72 px-5 py-3 outline-none bg-transparent font-medium text-zinc-800"
            />
            <button 
              type="submit" 
              className="bg-zinc-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-600 transition-all flex items-center gap-2 shadow-lg active:scale-95"
            >
              <Plus className="w-5 h-5" /> Ajouter
            </button>
          </motion.form>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <RefreshCw className="w-12 h-12 text-indigo-500" />
            </motion.div>
            <p className="text-zinc-400 font-bold uppercase tracking-[0.2em] text-xs">Synchronisation des écrans...</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {screens.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white border border-zinc-200 rounded-[2.5rem] p-24 text-center shadow-sm"
              >
                <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-8">
                  <Monitor className="w-10 h-10 text-zinc-200" />
                </div>
                <h2 className="text-3xl font-bold text-zinc-900 mb-4 font-display">Aucun écran configuré</h2>
                <p className="text-zinc-500 text-lg max-w-md mx-auto mb-10">
                  Commencez par créer votre premier écran pour diffuser vos contenus.
                </p>
                <Link to="/installation" className="inline-flex items-center gap-2 text-indigo-600 font-bold hover:underline">
                  Consulter le guide d'installation <ChevronRight className="w-4 h-4" />
                </Link>
              </motion.div>
            ) : (
              <motion.div 
                layout
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {screens.map((screen, idx) => (
                  <motion.div 
                    key={screen.screen_id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all duration-500 flex flex-col"
                  >
                    <div className="p-8 flex-1">
                      <div className="flex justify-between items-start mb-8">
                        <div className="p-4 bg-zinc-50 rounded-2xl group-hover:bg-indigo-600 transition-colors duration-500">
                          <Monitor className="w-7 h-7 text-zinc-400 group-hover:text-white transition-colors" />
                        </div>
                        <button 
                          onClick={() => handleDeleteScreen(screen.screen_id)}
                          className="p-2.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="mb-10">
                        <h3 className="text-3xl font-bold text-zinc-900 mb-2 truncate font-display">
                          {screen.screen_id}
                        </h3>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full ${screen.item_count > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300'}`}></div>
                          <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                            {screen.item_count} média{screen.item_count > 1 ? 's' : ''} actif{screen.item_count > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Link 
                          to={`/admin/${screen.screen_id}`}
                          className="flex items-center justify-center gap-2 py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-indigo-600 transition-all active:scale-95 shadow-lg shadow-zinc-100"
                        >
                          <Settings className="w-4 h-4" /> Configurer
                        </Link>
                        <Link 
                          to={`/player?screenId=${screen.screen_id}`}
                          target="_blank"
                          className="flex items-center justify-center gap-2 py-4 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
                        >
                          <Play className="w-4 h-4 text-indigo-600" /> Aperçu
                        </Link>
                      </div>
                    </div>
                    
                    <div className="h-2 w-full bg-zinc-50">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: screen.item_count > 0 ? '100%' : '0%' }}
                        className={`h-full transition-all duration-1000 ${screen.item_count > 0 ? 'bg-indigo-500' : 'bg-zinc-200'}`}
                      />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-20 pt-12 border-t border-zinc-200 flex flex-col md:flex-row justify-between items-center gap-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xs">K</span>
            </div>
            <span className="text-sm font-bold text-zinc-400 uppercase tracking-[0.3em]">Kiosk Manager v2.5</span>
          </div>
          <Link to="/installation" className="text-xs font-bold text-zinc-400 hover:text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <Server className="w-3 h-3" /> Guide d'installation locale
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
