import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Clock, Plus, Trash2, 
  User, Wallet, ArrowLeft, ShieldCheck, 
  Baby, Check, X, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Task {
  id: number;
  title: string;
  description: string;
  reward: number;
  status: 'pending' | 'finished' | 'approved';
  assigned_to: string;
  created_at: string;
  finished_at?: string;
  approved_at?: string;
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [family, setFamily] = useState<{name: string, role: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    reward: 0,
    assigned_to: ''
  });

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data);

      const familyRes = await fetch('/api/family');
      const familyData = await familyRes.json();
      setFamily(familyData);
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      if (res.ok) {
        setNewTask({ title: '', description: '', reward: 0, assigned_to: '' });
        setShowAddForm(false);
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to add task', err);
    }
  };

  const updateTaskStatus = async (id: number, status: 'finished' | 'approved') => {
    try {
      const res = await fetch(`/api/tasks/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to update task status', err);
    }
  };

  const deleteTask = async (id: number) => {
    if (!confirm('Supprimer cette tâche ?')) return;
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      fetchTasks();
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  };

  const calculatePocketMoney = (childName?: string) => {
    return tasks
      .filter(t => t.status === 'approved' && (!childName || t.assigned_to === childName))
      .reduce((sum, t) => sum + t.reward, 0);
  };

  const children = Array.from(new Set(tasks.map(t => t.assigned_to).filter(Boolean))) as string[];
  
  // Historique des tâches uniques pour l'autocomplétion
  const pastTasks = Array.from(
    tasks.reduce((map, task) => {
      if (!map.has(task.title)) {
        map.set(task.title, { 
          title: task.title, 
          description: task.description, 
          reward: task.reward 
        });
      }
      return map;
    }, new Map<string, { title: string, description: string, reward: number }>())
    .values()
  );

  const handleTitleChange = (title: string) => {
    setNewTask(prev => ({ ...prev, title }));
    
    // Si on trouve une correspondance exacte dans l'historique, on remplit le reste
    const match = pastTasks.find(t => t.title.toLowerCase() === title.toLowerCase());
    if (match) {
      setNewTask(prev => ({
        ...prev,
        title: match.title, // On garde la casse originale
        description: match.description,
        reward: match.reward
      }));
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-zinc-600" />
            </Link>
            <h1 className="text-lg font-bold text-zinc-900">Gestion des Tâches (Parent)</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Wallet size={20} />
              </div>
              <span className="text-sm font-medium text-zinc-500">Total Cagnotte</span>
            </div>
            <div className="text-3xl font-bold text-zinc-900">{calculatePocketMoney().toFixed(2)}€</div>
          </div>

          {children.map(child => (
            <div key={child} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <User size={20} />
                </div>
                <span className="text-sm font-medium text-zinc-500">{child}</span>
              </div>
              <div className="text-3xl font-bold text-zinc-900">{calculatePocketMoney(child).toFixed(2)}€</div>
            </div>
          ))}
        </div>

        {/* Parent Actions */}
        <div className="mb-8">
          {!showAddForm ? (
            <button 
              onClick={() => setShowAddForm(true)}
              className="w-full py-4 border-2 border-dashed border-zinc-300 rounded-2xl flex items-center justify-center gap-2 text-zinc-500 hover:border-indigo-400 hover:text-indigo-600 transition-all group"
            >
              <Plus size={20} className="group-hover:scale-110 transition-transform" />
              <span className="font-medium">Ajouter une nouvelle tâche</span>
            </button>
          ) : (
              <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-md animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-zinc-900">Nouvelle Tâche</h3>
                  <button onClick={() => setShowAddForm(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleAddTask} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Titre</label>
                      <input 
                        required
                        type="text" 
                        list="titles-list"
                        value={newTask.title}
                        onChange={e => handleTitleChange(e.target.value)}
                        placeholder="Ex: Ranger la chambre"
                        className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                      <datalist id="titles-list">
                        {pastTasks.map((t, i) => (
                          <option key={i} value={t.title} />
                        ))}
                      </datalist>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Assigné à</label>
                      <input 
                        required
                        type="text" 
                        list="children-list"
                        value={newTask.assigned_to}
                        onChange={e => setNewTask({...newTask, assigned_to: e.target.value})}
                        placeholder="Prénom de l'enfant"
                        className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                      <datalist id="children-list">
                        {family.map(member => (
                          <option key={member.name} value={member.name} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Description (optionnel)</label>
                    <textarea 
                      value={newTask.description}
                      onChange={e => setNewTask({...newTask, description: e.target.value})}
                      placeholder="Détails de la tâche..."
                      className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Récompense (€)</label>
                    <input 
                      required
                      type="number" 
                      step="0.1"
                      value={newTask.reward}
                      onChange={e => setNewTask({...newTask, reward: parseFloat(e.target.value) || 0})}
                      className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                  >
                    Créer la tâche
                  </button>
                </form>
              </div>
            )}
          </div>

        {/* Tasks List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
            <CheckCircle2 className="text-indigo-600" />
            Suivi des tâches
          </h2>

          {tasks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-zinc-200">
              <AlertCircle className="mx-auto text-zinc-300 mb-2" size={40} />
              <p className="text-zinc-500">Aucune tâche pour le moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {tasks.map(task => (
                <div 
                  key={task.id}
                  className={`bg-white p-5 rounded-2xl border transition-all ${
                    task.status === 'approved' ? 'border-emerald-100 bg-emerald-50/30' : 
                    task.status === 'finished' ? 'border-amber-100 bg-amber-50/30' : 'border-zinc-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-bold ${task.status === 'approved' ? 'text-emerald-900 line-through opacity-60' : 'text-zinc-900'}`}>
                          {task.title}
                        </h3>
                        <span className="text-xs font-bold px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full">
                          {task.assigned_to}
                        </span>
                        {task.status === 'approved' && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <Check size={10} /> Approuvé
                          </span>
                        )}
                        {task.status === 'finished' && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                            <Clock size={10} /> En attente d'approbation
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 mb-3">{task.description}</p>
                      <div className="flex items-center gap-4 text-xs text-zinc-400">
                        <span className="flex items-center gap-1 font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                          <Wallet size={12} /> {task.reward.toFixed(2)}€
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {new Date(task.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {task.status === 'finished' && (
                        <button 
                          onClick={() => updateTaskStatus(task.id, 'approved')}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-100 flex items-center gap-2"
                        >
                          <Check size={16} /> Approuver
                        </button>
                      )}
                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
