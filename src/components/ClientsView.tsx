import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Client, ClientStatus } from '../types';
import { Search, Plus, Edit2, Trash2, Mail, Phone, Building, X, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ClientsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<ClientStatus>('active');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchClients = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    const path = 'clients';
    try {
      const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      const list: Client[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Client);
      });
      setClients(list);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleOpenAddModal = () => {
    setEditingClient(null);
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setStatus('active');
    setNotes('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Client) => {
    setEditingClient(c);
    setName(c.name);
    setCompany(c.company || '');
    setEmail(c.email);
    setPhone(c.phone || '');
    setStatus(c.status);
    setNotes(c.notes || '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (!name.trim() || !email.trim()) {
      setError('Nama klien dan email wajib diisi.');
      return;
    }

    setSaving(true);
    setError(null);
    const path = 'clients';

    const clientData = {
      userId: auth.currentUser.uid,
      name: name.trim(),
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      status,
      notes: notes.trim(),
      createdAt: editingClient ? editingClient.createdAt : new Date().toISOString()
    };

    try {
      if (editingClient) {
        await updateDoc(doc(db, path, editingClient.id), clientData);
      } else {
        await addDoc(collection(db, path), clientData);
      }
      setIsModalOpen(false);
      fetchClients();
    } catch (err) {
      setError('Gagal menyimpan kontak klien. Silakan cek firestore security rules.');
      handleFirestoreError(err, editingClient ? OperationType.UPDATE : OperationType.CREATE, `${path}/${editingClient?.id || 'new'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus data klien ini?')) {
      return;
    }
    const path = 'clients';
    try {
      await deleteDoc(doc(db, path, id));
      fetchClients();
    } catch (err) {
      alert('Gagal menghapus klien.');
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
    }
  };

  const handleToggleStatus = async (c: Client) => {
    const path = 'clients';
    const newStatus: ClientStatus = c.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, path, c.id), { status: newStatus });
      fetchClients();
    } catch (err) {
      alert('Gagal memperbarui status klien.');
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${c.id}`);
    }
  };

  // Filter clients
  const filteredClients = clients.filter(c => {
    return c.name.toLowerCase().includes(search.toLowerCase()) || 
           c.company.toLowerCase().includes(search.toLowerCase()) ||
           c.email.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight font-sans">
            Hubungan Klien (CRM Freelancer)
          </h2>
          <p className="text-sm text-neutral-500">Kelola kontak stakeholders, rekan bisnis, dan daftar kontak klien aktif Anda.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          Klien Baru
        </button>
      </div>

      {/* Metrics of CRM */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Klien Aktif</span>
            <h3 className="text-xl md:text-2xl font-extrabold text-neutral-900 mt-0.5">
              {clients.filter(c => c.status === 'active').length} Kontak
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-neutral-100 text-neutral-600 rounded-xl">
            <Building className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Total Organisasi/Perusahaan</span>
            <h3 className="text-xl md:text-2xl font-extrabold text-neutral-900 mt-0.5">
              {new Set(clients.map(c => c.company).filter(Boolean)).size} Korporasi
            </h3>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full max-w-md bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          placeholder="Cari nama klien, email, atau perusahaan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full pl-9 pr-3 py-2 border-0 text-sm placeholder-neutral-400 focus:outline-none focus:ring-0 bg-white"
        />
      </div>

      {/* List Clients */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600"></div>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-100 py-16 text-center text-neutral-400 space-y-2 shadow-sm">
          <Search className="h-8 w-8 mx-auto stroke-1" />
          <p className="text-sm">Belum ada klien terdaftar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <motion.div
              layout
              key={client.id}
              className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h4 className="font-bold text-neutral-900 text-base truncate">{client.name}</h4>
                    {client.company && (
                      <span className="text-xs text-emerald-600 font-semibold block">{client.company}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleStatus(client)}
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      client.status === 'active'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:bg-neutral-100'
                    }`}
                  >
                    {client.status === 'active' ? 'Aktif' : 'Nonaktif'}
                  </button>
                </div>

                {/* Contact info list */}
                <div className="space-y-2 pt-2 border-t border-neutral-50 text-xs text-neutral-600">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </div>
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {client.notes && (
                  <p className="text-xs text-neutral-500 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100 line-clamp-2">
                    {client.notes}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-1.5 pt-4 mt-4 border-t border-neutral-50">
                <button
                  onClick={() => handleOpenEditModal(client)}
                  className="p-1.5 text-neutral-400 hover:text-emerald-600 hover:bg-neutral-50 rounded transition-colors cursor-pointer"
                  title="Edit Kontak"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(client.id)}
                  className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-neutral-50 rounded transition-colors cursor-pointer"
                  title="Hapus Kontak"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Client Modal */}
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
                  {editingClient ? 'Edit Kontak Klien' : 'Tambah Kontak Klien Baru'}
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
                    Nama Klien / Penghubung Utama *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Andi Wijaya"
                    className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Nama Perusahaan / Organisasi
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Contoh: PT Teknologi Utama"
                    className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                      Alamat Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="andi@company.com"
                      className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                      Nomor Telepon
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+62 812..."
                      className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Status Kolaborasi *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ClientStatus)}
                    className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white text-neutral-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="active">Aktif (Active)</option>
                    <option value="inactive">Nonaktif (Inactive)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Catatan Kontak
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tulis info tambahan seperti jam operasional klien, kontrak rujukan, dll..."
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
                    {saving ? 'Menyimpan...' : 'Simpan Kontak'}
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
