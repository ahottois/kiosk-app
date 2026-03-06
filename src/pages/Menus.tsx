import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronLeft, Plus, Trash2, Save, Utensils, 
  ListOrdered, Edit3, Image as ImageIcon, Upload, Search, X, Palette, Layout
} from 'lucide-react';
import { playEasterEgg } from '../services/easterEgg';

interface MenuItem {
  id: string;
  name: string;
  ingredients: string[];
  image: string;
}

interface Category {
  id: string;
  name: string;
  dishes: MenuItem[];
}

interface Menu {
  id?: number;
  name: string;
  title: string;
  background?: string;
  accentColor?: string;
  content: {
    categories: Category[];
  };
}

interface Ingredient {
  id: number;
  name: string;
}

export default function Menus() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [backgrounds, setBackgrounds] = useState<string[]>([]);
  
  // Ingredient search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Ingredient[]>([]);
  const [activeDishId, setActiveDishId] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const fetchMenus = async () => {
    try {
      const res = await fetch('/api/menus');
      const data = await res.json();
      const migratedData = data.map((m: any) => {
        const content = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
        
        // Migration to categories if needed
        if (content.dishes && !content.categories) {
          content.categories = [{
            id: 'default',
            name: 'Plats',
            dishes: content.dishes.map((d: any) => ({
              ...d,
              ingredients: Array.isArray(d.ingredients) ? d.ingredients : (d.ingredients ? d.ingredients.split(',').map((s: string) => s.trim()) : [])
            }))
          }];
          delete content.dishes;
        }
        
        return { ...m, content };
      });
      setMenus(migratedData);
    } catch (err) {
      console.error('Failed to fetch menus', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBackgrounds = async () => {
    try {
      const res = await fetch('/api/backgrounds');
      const data = await res.json();
      setBackgrounds(data);
    } catch (err) {
      console.error('Failed to fetch backgrounds', err);
    }
  };

  useEffect(() => {
    fetchMenus();
    fetchBackgrounds();
  }, []);

  // Search ingredients
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    if (searchQuery.length > 0) {
      searchTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/ingredients?q=${encodeURIComponent(searchQuery)}`);
          const data = await res.json();
          setSearchResults(data);
        } catch (err) {
          console.error('Search failed', err);
        }
      }, 300);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleCreateNew = () => {
    setEditingMenu({
      name: 'Nouveau Menu',
      title: 'Our Menu',
      accentColor: '#ffc600',
      background: 'https://i.imgur.com/er8DtBW.jpg',
      content: {
        categories: [
          { 
            id: Date.now().toString(), 
            name: 'Pizzas', 
            dishes: [{ id: (Date.now() + 1).toString(), name: 'Greek Pizza', ingredients: [], image: '' }] 
          }
        ]
      }
    });
  };

  const handleSave = async () => {
    if (!editingMenu) return;
    try {
      const method = editingMenu.id ? 'PUT' : 'POST';
      const url = editingMenu.id ? `/api/menus/${editingMenu.id}` : '/api/menus';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMenu),
      });
      if (res.ok) {
        setEditingMenu(null);
        fetchMenus();
      } else {
        playEasterEgg();
      }
    } catch (err) {
      console.error('Failed to save menu', err);
      playEasterEgg();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce menu ?')) return;
    await fetch(`/api/menus/${id}`, { method: 'DELETE' });
    fetchMenus();
  };

  const addCategory = () => {
    if (!editingMenu) return;
    const newCategories = [...editingMenu.content.categories, { 
      id: Date.now().toString(), 
      name: 'Nouvelle Catégorie', 
      dishes: [] 
    }];
    setEditingMenu({ ...editingMenu, content: { categories: newCategories } });
  };

  const removeCategory = (catId: string) => {
    if (!editingMenu) return;
    const newCategories = editingMenu.content.categories.filter(c => c.id !== catId);
    setEditingMenu({ ...editingMenu, content: { categories: newCategories } });
  };

  const updateCategoryName = (catId: string, name: string) => {
    if (!editingMenu) return;
    const newCategories = editingMenu.content.categories.map(cat => {
      if (cat.id === catId) return { ...cat, name };
      return cat;
    });
    setEditingMenu({ ...editingMenu, content: { categories: newCategories } });
  };

  const addDish = (catId: string) => {
    if (!editingMenu) return;
    const newCategories = editingMenu.content.categories.map(cat => {
      if (cat.id === catId) {
        return { 
          ...cat, 
          dishes: [...cat.dishes, { id: Date.now().toString(), name: 'Nouveau Plat', ingredients: [], image: '' }] 
        };
      }
      return cat;
    });
    setEditingMenu({ ...editingMenu, content: { categories: newCategories } });
  };

  const removeDish = (catId: string, dishId: string) => {
    if (!editingMenu) return;
    const newCategories = editingMenu.content.categories.map(cat => {
      if (cat.id === catId) {
        return { ...cat, dishes: cat.dishes.filter(d => d.id !== dishId) };
      }
      return cat;
    });
    setEditingMenu({ ...editingMenu, content: { categories: newCategories } });
  };

  const updateDish = (catId: string, dishId: string, field: keyof MenuItem, value: any) => {
    if (!editingMenu) return;
    const newCategories = editingMenu.content.categories.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          dishes: cat.dishes.map(dish => {
            if (dish.id === dishId) return { ...dish, [field]: value };
            return dish;
          })
        };
      }
      return cat;
    });
    setEditingMenu({ ...editingMenu, content: { categories: newCategories } });
  };

  const addIngredientToDish = async (catId: string, dishId: string, ingredientName: string) => {
    if (!editingMenu) return;
    const cat = editingMenu.content.categories.find(c => c.id === catId);
    if (!cat) return;
    const dish = cat.dishes.find(d => d.id === dishId);
    if (!dish) return;
    
    if (dish.ingredients.includes(ingredientName)) return;

    const newIngredients = [...dish.ingredients, ingredientName];
    updateDish(catId, dishId, 'ingredients', newIngredients);
    setSearchQuery('');
    setSearchResults([]);
    setActiveDishId(null);

    try {
      await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ingredientName }),
      });
    } catch (err) {}
  };

  const removeIngredientFromDish = (catId: string, dishId: string, ingredientName: string) => {
    if (!editingMenu) return;
    const cat = editingMenu.content.categories.find(c => c.id === catId);
    if (!cat) return;
    const dish = cat.dishes.find(d => d.id === dishId);
    if (!dish) return;
    const newIngredients = dish.ingredients.filter(i => i !== ingredientName);
    updateDish(catId, dishId, 'ingredients', newIngredients);
  };

  const handleImageUpload = async (catId: string, dishId: string, file: File) => {
    setUploading(dishId);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'image');
    formData.append('duration', '0');
    formData.append('screen_id', 'temp');

    try {
      const res = await fetch('/api/playlist', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) updateDish(catId, dishId, 'image', data.url);
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(null);
    }
  };

  const handleBgUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/backgrounds', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setEditingMenu(prev => prev ? { ...prev, background: data.url } : null);
        fetchBackgrounds();
      }
    } catch (err) {
      console.error('Background upload failed', err);
    }
  };

  if (editingMenu) {
    return (
      <div className="min-h-screen bg-zinc-50 p-8 font-sans">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <button onClick={() => setEditingMenu(null)} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
                <ChevronLeft className="w-6 h-6 text-zinc-600" />
              </button>
              <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight">
                {editingMenu.id ? 'Modifier' : 'Créer'} <span className="text-zinc-300 font-light">/</span> Menu
              </h1>
            </div>
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Save className="w-5 h-5" /> Enregistrer
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-6">
              {/* Menu Settings */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Palette className="w-4 h-4" /> Paramètres
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Nom Interne</label>
                    <input 
                      type="text" value={editingMenu.name}
                      onChange={(e) => setEditingMenu({...editingMenu, name: e.target.value})}
                      className="w-full border border-zinc-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Titre Affiché</label>
                    <input 
                      type="text" value={editingMenu.title}
                      onChange={(e) => setEditingMenu({...editingMenu, title: e.target.value})}
                      className="w-full border border-zinc-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Couleur d'accent</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" value={editingMenu.accentColor || '#ffc600'}
                        onChange={(e) => setEditingMenu({...editingMenu, accentColor: e.target.value})}
                        className="w-10 h-10 border-0 rounded p-0 cursor-pointer"
                      />
                      <input 
                        type="text" value={editingMenu.accentColor || '#ffc600'}
                        onChange={(e) => setEditingMenu({...editingMenu, accentColor: e.target.value})}
                        className="flex-1 border border-zinc-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Background Selection */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Arrière-plan
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                    {backgrounds.map(bg => (
                      <button 
                        key={bg}
                        onClick={() => setEditingMenu({...editingMenu, background: bg})}
                        className={`aspect-video rounded-lg overflow-hidden border-2 transition-all ${editingMenu.background === bg ? 'border-indigo-500 scale-95' : 'border-transparent hover:border-zinc-200'}`}
                      >
                        <img src={bg} className="w-full h-full object-cover" alt="" />
                      </button>
                    ))}
                    <label className="aspect-video rounded-lg border-2 border-dashed border-zinc-200 flex items-center justify-center hover:bg-zinc-50 cursor-pointer transition-colors">
                      <Plus className="w-6 h-6 text-zinc-300" />
                      <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleBgUpload(e.target.files[0])} />
                    </label>
                  </div>
                  <input 
                    type="text" 
                    placeholder="URL Personnalisée"
                    value={editingMenu.background || ''}
                    onChange={(e) => setEditingMenu({...editingMenu, background: e.target.value})}
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              
              <button 
                onClick={addCategory}
                className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
              >
                <Layout className="w-5 h-5" /> Ajouter une Catégorie
              </button>
            </div>

            <div className="lg:col-span-3 space-y-12">
              {editingMenu.content.categories.map((cat) => (
                <div key={cat.id} className="space-y-6">
                  <div className="flex items-center justify-between border-b-2 border-zinc-200 pb-2">
                    <div className="flex items-center gap-4 flex-1">
                      <input 
                        type="text" 
                        value={cat.name}
                        onChange={(e) => updateCategoryName(cat.id, e.target.value)}
                        className="text-2xl font-black text-zinc-900 uppercase tracking-tight bg-transparent outline-none focus:text-indigo-600 transition-colors"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => addDish(cat.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-lg text-xs font-bold hover:bg-zinc-200 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Plat
                      </button>
                      <button 
                        onClick={() => removeCategory(cat.id)}
                        className="p-1.5 text-zinc-300 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {cat.dishes.map((dish) => (
                      <div key={dish.id} className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 group relative">
                        <button 
                          onClick={() => removeDish(cat.id, dish.id)} 
                          className="absolute top-4 right-4 text-zinc-300 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                          <div className="md:col-span-1">
                            <div className="aspect-square bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-100 flex flex-col items-center justify-center overflow-hidden relative group/img">
                              {dish.image ? (
                                <>
                                  <img src={dish.image} className="w-full h-full object-cover" alt="" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <label className="p-2 bg-white rounded-full cursor-pointer hover:scale-110 transition-transform">
                                      <Upload className="w-4 h-4 text-zinc-900" />
                                      <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(cat.id, dish.id, e.target.files[0])} />
                                    </label>
                                    <button onClick={() => updateDish(cat.id, dish.id, 'image', '')} className="p-2 bg-white rounded-full hover:scale-110 transition-transform">
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </button>
                                  </div>
                                </>
                              ) : uploading === dish.id ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent"></div>
                              ) : (
                                <div className="text-center p-4">
                                  <ImageIcon className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                                  <label className="text-[10px] font-bold text-indigo-600 uppercase cursor-pointer hover:underline">
                                    Upload
                                    <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(cat.id, dish.id, e.target.files[0])} />
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="md:col-span-3 space-y-4">
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Nom du Plat</label>
                              <input 
                                type="text" value={dish.name}
                                onChange={(e) => updateDish(cat.id, dish.id, 'name', e.target.value)}
                                placeholder="Ex: Burger Maison"
                                className="w-full border-b border-zinc-100 py-2 text-lg font-bold text-zinc-800 outline-none focus:border-indigo-500 transition-colors"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-2">Ingrédients</label>
                              <div className="flex flex-wrap gap-2 mb-3">
                                {dish.ingredients.map((ing) => (
                                  <span key={ing} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100">
                                    {ing}
                                    <button onClick={() => removeIngredientFromDish(cat.id, dish.id, ing)} className="hover:text-indigo-900">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                              
                              <div className="relative">
                                <div className="flex items-center gap-2 bg-zinc-50 rounded-xl px-4 py-2 border border-zinc-100 focus-within:border-indigo-300 transition-colors">
                                  <Search className="w-4 h-4 text-zinc-400" />
                                  <input 
                                    type="text" 
                                    placeholder="Rechercher ou ajouter un ingrédient..."
                                    value={activeDishId === dish.id ? searchQuery : ''}
                                    onChange={(e) => {
                                      setActiveDishId(dish.id);
                                      setSearchQuery(e.target.value);
                                    }}
                                    onFocus={() => setActiveDishId(dish.id)}
                                    className="flex-1 bg-transparent text-sm outline-none"
                                  />
                                </div>
                                
                                {activeDishId === dish.id && searchQuery.length > 0 && (
                                  <div className="absolute z-20 top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-zinc-100 overflow-hidden max-h-60 overflow-y-auto">
                                    {searchResults.map((res) => (
                                      <button 
                                        key={res.id}
                                        onClick={() => addIngredientToDish(cat.id, dish.id, res.name)}
                                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0"
                                      >
                                        {res.name}
                                      </button>
                                    ))}
                                    {!searchResults.some(r => r.name.toLowerCase() === searchQuery.toLowerCase()) && (
                                      <button 
                                        onClick={() => addIngredientToDish(cat.id, dish.id, searchQuery)}
                                        className="w-full text-left px-4 py-2.5 text-sm bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-100 transition-colors"
                                      >
                                        + Créer "{searchQuery}"
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-zinc-600" />
            </Link>
            <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight">
              Gestion <span className="text-zinc-300 font-light">/</span> Menus
            </h1>
          </div>
          <button 
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" /> Créer un Menu
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : menus.length === 0 ? (
          <div className="bg-white p-20 rounded-3xl border border-zinc-200 text-center">
            <Utensils className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
            <p className="text-zinc-400 font-medium">Aucun menu créé pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menus.map((menu) => (
              <div key={menu.id} className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                    <Utensils className="w-6 h-6" />
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={async () => {
                        const res = await fetch(`/api/menus/${menu.id}`);
                        const data = await res.json();
                        const content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
                        
                        // Migration to categories if needed
                        if (content.dishes && !content.categories) {
                          content.categories = [{
                            id: 'default',
                            name: 'Plats',
                            dishes: content.dishes.map((d: any) => ({
                              ...d,
                              ingredients: Array.isArray(d.ingredients) ? d.ingredients : (d.ingredients ? d.ingredients.split(',').map((s: string) => s.trim()) : [])
                            }))
                          }];
                          delete content.dishes;
                        }

                        setEditingMenu({ ...data, content });
                      }}
                      className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-indigo-600"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(menu.id!)}
                      className="p-2 hover:bg-red-50 rounded-xl text-zinc-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="text-xl font-black text-zinc-900 uppercase tracking-tight mb-1">{menu.name}</h3>
                <p className="text-zinc-400 text-sm font-medium italic mb-4">{menu.title}</p>
                <div className="flex items-center gap-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-t border-zinc-50 pt-4">
                  <span className="flex items-center gap-1"><ListOrdered className="w-3 h-3" /> {menu.content.categories?.length || 0} Catégories</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
