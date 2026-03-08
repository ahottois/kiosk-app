import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Monitor, Plus, Settings, Play, Trash2, RefreshCw, LayoutGrid, Server, Utensils, CheckSquare } from 'lucide-react';

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

  // Récupération de la liste des écrans depuis l'API
  const fetchScreens = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/screens');
      
      if (!res.ok) {
        throw new Error(`Erreur serveur: ${res.status}`);
      }

      const data = await res.json();
      
      // CORRECTION : On s'assure que data est un tableau pour éviter le crash du .map()
      // Si l'API renvoie une erreur 500 sous forme d'objet, on bascule sur un tableau vide.
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

  // Création d'un nouvel écran
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

  // Suppression d'un écran
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
    <div className="min-h-screen bg-zinc-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* En-tête du Dashboard */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <LayoutGrid className="w-6 h-6 text-indigo-600" />
              <h1 className="text-4xl font-black text-zinc-900 uppercase tracking-tighter italic">Kiosk Manager</h1>
            </div>
            <p className="text-zinc-500 font-medium italic">Tableau de bord de vos points d'affichage</p>
            <Link to="/installation" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 mt-2 uppercase tracking-wider">
              <Server className="w-3 h-3" /> Guide d'installation locale
            </Link>
            <Link to="/menus" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 mt-2 ml-4 uppercase tracking-wider">
              <Utensils className="w-3 h-3" /> Gestion des Menus
            </Link>
            <Link to="/tasks" className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 mt-2 ml-4 uppercase tracking-wider">
              <CheckSquare className="w-3 h-3" /> Gestion des Tâches
            </Link>
          </div>
          
          <form onSubmit={handleCreateScreen} className="flex w-full md:w-auto gap-2">
            <input 
              type="text" 
              placeholder="Nom de l'écran (ex: Cuisine)" 
              value={newScreenName}
              onChange={(e) => setNewScreenName(e.target.value)}
              className="flex-1 md:w-64 px-4 py-2.5 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-all shadow-sm"
            />
            <button 
              type="submit" 
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95"
            >
              <Plus className="w-5 h-5" /> Ajouter
            </button>
          </form>
        </div>

        {/* État de chargement */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <RefreshCw className="w-10 h-10 animate-spin text-indigo-500" />
            <p className="text-zinc-400 font-bold animate-pulse uppercase tracking-widest text-xs">Synchronisation...</p>
          </div>
        ) : (
          <>
            {/* Grille des écrans */}
            {screens.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-zinc-200 rounded-3xl p-20 text-center">
                <Monitor className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-zinc-400">Aucun écran configuré</h2>
                <p className="text-zinc-400 text-sm mt-2">Commencez par créer votre premier écran en haut à droite.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {screens.map((screen) => (
                  <div 
                    key={screen.screen_id} 
                    className="group bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300"
                  >
                    <div className="p-8">
                      <div className="flex justify-between items-start mb-6">
                        <div className="p-4 bg-indigo-50 rounded-2xl group-hover:bg-indigo-600 transition-colors duration-300">
                          <Monitor className="w-7 h-7 text-indigo-600 group-hover:text-white transition-colors" />
                        </div>
                        <button 
                          onClick={() => handleDeleteScreen(screen.screen_id)}
                          className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Supprimer l'écran"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="mb-8">
                        <h3 className="text-2xl font-black text-zinc-900 mb-1 truncate uppercase tracking-tight">
                          {screen.screen_id}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                            {screen.item_count} média{screen.item_count > 1 ? 's' : ''} actif{screen.item_count > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Link 
                          to={`/admin/${screen.screen_id}`}
                          className="flex items-center justify-center gap-2 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-100"
                        >
                          <Settings className="w-4 h-4" /> Configurer
                        </Link>
                        <Link 
                          to={`/player?screenId=${screen.screen_id}`}
                          target="_blank"
                          className="flex items-center justify-center gap-2 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
                        >
                          <Play className="w-4 h-4 text-indigo-600" /> Aperçu
                        </Link>
                      </div>
                    </div>
                    
                    {/* Petite barre de statut en bas de carte */}
                    <div className="h-1.5 w-full bg-zinc-100 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${screen.item_count > 0 ? 'bg-indigo-500' : 'bg-zinc-300'}`}
                        style={{ width: screen.item_count > 0 ? '100%' : '0%' }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}