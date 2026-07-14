import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { TimeLog, Project } from '../types';
import { Search, Plus, Edit2, Trash2, Clock, Calendar, Briefcase, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function TimeLogView() {
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<TimeLog | null>(null);

  // Form states
  const [projectTitle, setProjectTitle] = useState('');
  const [date, setDate] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    const uid = auth.currentUser.uid;
    try {
      // Fetch time logs
      const qLogs = query(collection(db, 'timeLogs'), where('userId', '==', uid));
      const snapLogs = await getDocs(qLogs);
      const listLogs: TimeLog[] = [];
      snapLogs.forEach((docSnap) => {
        listLogs.push({ id: docSnap.id, ...docSnap.data() } as TimeLog);
      });
      setTimeLogs(listLogs);

      // Fetch projects for dropdown
      const qProjs = query(collection(db, 'projects'), where('userId', '==', uid));
      const snapProjs = await getDocs(qProjs);
      const listProjs: Project[] = [];
      snapProjs.forEach((docSnap) => {
        listProjs.push({ id: docSnap.id, ...docSnap.data() } as Project);
      });
      setProjects(listProjs);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddModal = () => {
    setEditingLog(null);
    setProjectTitle(projects.length > 0 ? projects[0].title : '');
    setDate(new Date().toISOString().split('T')[0]);
    setHours('');
    setDescription('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (log: TimeLog) => {
    setEditingLog(log);
    setProjectTitle(log.projectTitle);
    setDate(log.date);
    setHours(log.hours.toString());
    setDescription(log.description || '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (!projectTitle.trim() || !hours.trim() || !date) {
      setError('Judul Proyek, jam kerja, dan tanggal wajib diisi.');
      return;
    }

    const numHours = Number(hours);
    if (isNaN(numHours) || numHours <= 0 || numHours > 24) {
      setError('Jam kerja harus berupa angka positif (maksimal 24 jam sehari).');
      return;
    }

    setSaving(true);
    setError(null);
    const path = 'timeLogs';

    const logData = {
      userId: auth.currentUser.uid,
      projectTitle: projectTitle.trim(),
      date,
      hours: numHours,
      description: description.trim(),
      createdAt: editingLog ? editingLog.createdAt : new Date().toISOString()
    };

    try {
      if (editingLog) {
        await updateDoc(doc(db, path, editingLog.id), logData);
      } else {
        await addDoc(collection(db, path), logData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setError('Gagal menyimpan log waktu. Pastikan aturan keamanan (rules) telah diijinkan.');
      handleFirestoreError(err, editingLog ? OperationType.UPDATE : OperationType.CREATE, `${path}/${editingLog?.id || 'new'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus catatan log waktu ini?')) {
      return;
    }
    const path = 'timeLogs';
    try {
      await deleteDoc(doc(db, path, id));
      fetchData();
    } catch (err) {
      alert('Gagal menghapus log.');
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
    }
  };

  const totalHours = timeLogs.reduce((sum, log) => sum + log.hours, 0);

  // Filter logs
  const filteredLogs = timeLogs.filter(log => {
    return log.projectTitle.toLowerCase().includes(search.toLowerCase()) || 
           (log.description && log.description.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight font-sans">
            Pelacak Waktu Kerja (Time Tracker)
          </h2>
          <p className="text-sm text-neutral-500">Rekam setiap jam kerja produktif Anda untuk penagihan klien yang transparan.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          Log Jam Kerja
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Total Jam Kerja Terlacak</span>
            <h3 className="text-2xl font-extrabold text-neutral-900 mt-0.5">{totalHours} Jam</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Keterlibatan Proyek</span>
            <h3 className="text-2xl font-extrabold text-neutral-900 mt-0.5">{projects.length} Proyek Terdaftar</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Total Sesi Tercatat</span>
            <h3 className="text-2xl font-extrabold text-neutral-900 mt-0.5">{timeLogs.length} Sesi</h3>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative w-full max-w-md bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          placeholder="Cari berdasarkan nama proyek atau keterangan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full pl-9 pr-3 py-2 border-0 text-sm placeholder-neutral-400 focus:outline-none focus:ring-0 bg-white"
        />
      </div>

      {/* Time Logs List */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16 text-neutral-400 space-y-2">
            <Clock className="h-8 w-8 mx-auto stroke-1" />
            <p className="text-sm">Belum ada catatan log waktu.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filteredLogs
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((log) => (
                <div key={log.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-neutral-50/30 transition-colors">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-neutral-900 text-sm md:text-base">{log.projectTitle}</h4>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                        <Calendar className="h-3 w-3" />
                        {new Date(log.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {log.description && (
                      <p className="text-xs text-neutral-500 bg-neutral-50 p-2 rounded-lg border border-neutral-100">{log.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 shrink-0 self-end sm:self-center">
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-emerald-600 block">{log.hours} Jam</span>
                      <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Durasi Kerja</span>
                    </div>
                    
                    <div className="flex items-center gap-1 border-l border-neutral-100 pl-3">
                      <button
                        onClick={() => handleOpenEditModal(log)}
                        className="p-1.5 text-neutral-400 hover:text-emerald-600 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                        title="Edit Log"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                        title="Hapus Log"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Log Time Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-2xl border border-neutral-100 shadow-xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="font-bold text-lg text-neutral-900">
                  {editingLog ? 'Edit Sesi Kerja' : 'Catat Sesi Kerja Baru'}
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
                    <span>⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Pilih Proyek Pekerjaan *
                  </label>
                  {projects.length === 0 ? (
                    <div>
                      <input
                        type="text"
                        required
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
                        placeholder="Contoh: Freelance Project"
                        className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                      <span className="text-[10px] text-amber-600 block mt-1 font-semibold">💡 Tips: Anda belum mendaftarkan proyek di Manajer Proyek. Ketik nama proyek secara manual di atas.</span>
                    </div>
                  ) : (
                    <select
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white text-neutral-700 font-medium"
                    >
                      <option value="">-- Pilih Proyek --</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.title}>{p.title} ({p.clientName})</option>
                      ))}
                      <option value="Proyek Mandiri / Administratif">Proyek Mandiri / Administratif</option>
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                      Jumlah Jam Kerja *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      placeholder="Contoh: 3.5 atau 8"
                      className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                      Tanggal Kerja *
                    </label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Keterangan Kegiatan Pekerjaan
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Contoh: Fixing bug di dashboard, setup Firestore security rules, meeting dengan stakeholders..."
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
                    {saving ? 'Menyimpan...' : 'Simpan Log'}
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
