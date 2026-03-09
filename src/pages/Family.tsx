import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Trash2, ArrowLeft, 
  UserCircle, Heart, Star, Baby
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface FamilyMember {
  id: number;
  name: string;
  role: string;
  created_at: string;
}

const ROLES = ['Grand-parent', 'Parent', 'Enfant'];

export default function Family() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMember, setNewMember] = useState({ name: '', role: 'Enfant' });

  const fetchFamily = async () => {
    try {
      const res = await fetch('/api/family');
      const data = await res.json();
      setMembers(data);
    } catch (err) {
      console.error('Failed to fetch family', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamily();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.name) return;

    try {
      const res = await fetch('/api/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember),
      });
      if (res.ok) {
        setNewMember({ name: '', role: 'Enfant' });
        fetchFamily();
      }
    } catch (err) {
      console.error('Failed to add member', err);
    }
  };

  const deleteMember = async (id: number) => {
    if (!confirm('Supprimer ce membre de la famille ?')) return;
    try {
      await fetch(`/api/family/${id}`, { method: 'DELETE' });
      fetchFamily();
    } catch (err) {
      console.error('Failed to delete member', err);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Grand-parent': return <Heart className="text-rose-500" size={24} />;
      case 'Parent': return <Star className="text-amber-500" size={24} />;
      case 'Enfant': return <Baby className="text-indigo-500" size={24} />;
      default: return <UserCircle className="text-zinc-400" size={24} />;
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
      <div className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-zinc-600" />
            </Link>
            <div className="flex items-center gap-2">
              <Users className="text-indigo-600" size={24} />
              <h1 className="text-xl font-bold text-zinc-900">Ma Famille</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Member Form */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm sticky top-24">
              <h2 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
                <Plus size={20} className="text-indigo-600" />
                Ajouter un membre
              </h2>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nom / Prénom</label>
                  <input 
                    required
                    type="text" 
                    value={newMember.name}
                    onChange={e => setNewMember({...newMember, name: e.target.value})}
                    placeholder="Ex: Ezio"
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Rôle</label>
                  <select 
                    value={newMember.role}
                    onChange={e => setNewMember({...newMember, role: e.target.value})}
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white"
                  >
                    {ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-lg shadow-indigo-200"
                >
                  Ajouter à la famille
                </button>
              </form>
            </div>
          </div>

          {/* Members List */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {members.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-dashed border-zinc-300 flex flex-col items-center justify-center text-zinc-400">
                  <Users size={48} className="mb-4 opacity-20" />
                  <p className="font-medium">Aucun membre enregistré</p>
                  <p className="text-sm">Commencez par ajouter les membres de votre famille.</p>
                </div>
              ) : (
                members.map((member) => (
                  <div 
                    key={member.id} 
                    className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center border border-zinc-100">
                        {getRoleIcon(member.role)}
                      </div>
                      <div>
                        <h3 className="font-bold text-zinc-900">{member.name}</h3>
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{member.role}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteMember(member.id)}
                      className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
