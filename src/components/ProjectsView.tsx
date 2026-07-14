import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Project, ProjectStatus } from '../types';
import { Search, Plus, Edit2, Trash2, Calendar, DollarSign, X, Check, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'all'>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [rate, setRate] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [notes, setNotes] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchProjects = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    const path = 'projects';
    try {
      const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      const list: Project[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Project);
      });
      setProjects(list);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleOpenAddModal = () => {
    setEditingProject(null);
    setTitle('');
    setClientName('');
    setDeadline('');
    setRate('');
    setStatus('active');
    setNotes('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (project: Project) => {
    setEditingProject(project);
    setTitle(project.title);
    setClientName(project.clientName);
    setDeadline(project.deadline || '');
    setRate(project.rate.toString());
    setStatus(project.status);
    setNotes(project.notes || '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (!title.trim() || !clientName.trim()) {
      setError('Judul Proyek dan Nama Klien wajib diisi.');
      return;
    }

    setSaving(true);
    setError(null);
    const path = 'projects';

    const projectData = {
      userId: auth.currentUser.uid,
      title: title.trim(),
      clientName: clientName.trim(),
      deadline: deadline || new Date().toISOString().split('T')[0],
      rate: Number(rate) || 0,
      status,
      notes: notes.trim(),
      createdAt: editingProject ? editingProject.createdAt : new Date().toISOString()
    };

    try {
      if (editingProject) {
        // Update existing project
        const projectDocRef = doc(db, path, editingProject.id);
        await updateDoc(projectDocRef, projectData);
      } else {
        // Create new project
        await addDoc(collection(db, path), projectData);
      }
      setIsModalOpen(false);
      fetchProjects();
    } catch (err) {
      setError('Gagal menyimpan proyek. Silakan periksa security rules atau jaringan.');
      handleFirestoreError(err, editingProject ? OperationType.UPDATE : OperationType.CREATE, `${path}/${editingProject?.id || 'new'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus proyek ini? Seluruh data proyek akan dihapus secara permanen.')) {
      return;
    }

    const path = 'projects';
    try {
      await deleteDoc(doc(db, path, id));
      fetchProjects();
    } catch (err) {
      alert('Gagal menghapus proyek.');
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
    }
  };

  const handleToggleCompleted = async (project: Project) => {
    const path = 'projects';
    const newStatus: ProjectStatus = project.status === 'completed' ? 'active' : 'completed';
    try {
      await updateDoc(doc(db, path, project.id), { status: newStatus });
      fetchProjects();
    } catch (err) {
      alert('Gagal memperbarui status proyek.');
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${project.id}`);
    }
  };

  // Format currency
  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  // Filter projects based on search query and status tab
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(search.toLowerCase()) || 
                          project.clientName.toLowerCase().includes(search.toLowerCase()) ||
                          (project.notes && project.notes.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header and Add button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight font-sans">
            Manajer Proyek Freelance
          </h2>
          <p className="text-sm text-neutral-500">Kelola siklus kerja, harga, dan target deadline proyek Anda.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          Proyek Baru
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-neutral-100 shadow-sm">
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Cari judul proyek atau nama klien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-9 pr-3 py-1.5 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-neutral-50"
          />
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap gap-1 w-full md:w-auto">
          {(['all', 'pitching', 'active', 'completed', 'paused'] as const).map((statusKey) => (
            <button
              key={statusKey}
              onClick={() => setFilterStatus(statusKey)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-all cursor-pointer ${
                filterStatus === statusKey 
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                  : 'bg-white border-neutral-200 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {statusKey === 'all' ? 'Semua' : statusKey}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Projects */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600"></div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-100 py-16 px-4 text-center text-neutral-400 space-y-3 shadow-sm">
          <Search className="h-10 w-10 mx-auto stroke-1" />
          <p className="text-sm">Tidak menemukan proyek yang sesuai kriteria.</p>
          <button 
            onClick={handleOpenAddModal}
            className="text-xs text-emerald-600 underline font-semibold cursor-pointer"
          >
            Buat proyek baru pertama Anda
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <motion.div
              layout
              key={project.id}
              className="bg-white rounded-2xl border border-neutral-100 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden relative group"
            >
              <div className="p-5 space-y-4">
                {/* Upper bar */}
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-neutral-400 truncate block">{project.clientName}</span>
                    <h3 className="font-bold text-neutral-900 text-base leading-tight group-hover:text-emerald-700 transition-colors truncate">
                      {project.title}
                    </h3>
                  </div>
                  <span className={`text-[10px] font-bold uppercase shrink-0 px-2 py-0.5 rounded border ${
                    project.status === 'active' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : project.status === 'completed' 
                        ? 'bg-neutral-100 text-neutral-600 border-neutral-200' 
                        : project.status === 'pitching' 
                          ? 'bg-purple-50 text-purple-700 border-purple-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {project.status}
                  </span>
                </div>

                {/* Rates & Deadline info */}
                <div className="grid grid-cols-2 gap-2 pt-2 text-xs border-t border-neutral-50">
                  <div className="space-y-0.5">
                    <span className="text-neutral-400 block font-medium">Nilai Proyek</span>
                    <div className="flex items-center text-neutral-800 font-bold gap-0.5">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>{formatIDR(project.rate)}</span>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-neutral-400 block font-medium">Target Selesai</span>
                    <div className="flex items-center text-neutral-800 font-semibold gap-1">
                      <Calendar className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                      <span>{new Date(project.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {project.notes && (
                  <p className="text-xs text-neutral-500 line-clamp-2 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                    {project.notes}
                  </p>
                )}
              </div>

              {/* Action Area */}
              <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
                <button
                  onClick={() => handleToggleCompleted(project)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded transition-colors cursor-pointer ${
                    project.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  {project.status === 'completed' ? 'Selesai' : 'Tandai Selesai'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(project)}
                    className="p-1.5 text-neutral-500 hover:text-emerald-600 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                    title="Edit Proyek"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                    title="Hapus Proyek"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-2xl border border-neutral-100 shadow-xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="font-bold text-lg text-neutral-900">
                  {editingProject ? 'Edit Proyek Freelance' : 'Daftarkan Proyek Baru'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 hover:bg-neutral-50 text-neutral-400 hover:text-neutral-600 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-semibold flex gap-2">
                    <span className="shrink-0">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Nama/Judul Proyek *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Redesign Aplikasi Mobile, Pembuatan Landing Page"
                    className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Nama Klien / Perusahaan *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Contoh: PT Kreasi Digital, Toko Sinar Jaya"
                    className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                      Nilai Proyek (IDR)
                    </label>
                    <input
                      type="number"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      placeholder="Contoh: 5000000"
                      className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                      Target Selesai *
                    </label>
                    <input
                      type="date"
                      required
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-neutral-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Status Proyek *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-neutral-700 bg-white"
                  >
                    <option value="pitching">Pitching / Penawaran</option>
                    <option value="active">Active / Sedang Dikerjakan</option>
                    <option value="completed">Completed / Selesai</option>
                    <option value="paused">Paused / Ditunda</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Catatan Deskripsi Proyek
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tulis detail cakupan kerja, link figma, atau info penagihan tambahan..."
                    className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-4 border-t border-neutral-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-lg text-sm font-semibold hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Menyimpan...' : 'Simpan Proyek'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
