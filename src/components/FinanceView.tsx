import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Transaction, TransactionType, TransactionStatus } from '../types';
import { Search, Plus, Edit2, Trash2, ArrowUpRight, ArrowDownRight, DollarSign, X, Check, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function FinanceView() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'all'>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Form states
  const [type, setType] = useState<TransactionType>('income');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<TransactionStatus>('paid');
  const [description, setDescription] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTransactions = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    const path = 'transactions';
    try {
      const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      const list: Transaction[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
      });
      setTransactions(list);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleOpenAddModal = () => {
    setEditingTransaction(null);
    setType('income');
    setCategory('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setStatus('paid');
    setDescription('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: Transaction) => {
    setEditingTransaction(t);
    setType(t.type);
    setCategory(t.category);
    setAmount(t.amount.toString());
    setDate(t.date);
    setStatus(t.status);
    setDescription(t.description || '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (!category.trim() || !amount.trim() || !date) {
      setError('Kategori, jumlah nominal, dan tanggal wajib diisi.');
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      setError('Nominal harus berupa angka positif.');
      return;
    }

    setSaving(true);
    setError(null);
    const path = 'transactions';

    const transactionData = {
      userId: auth.currentUser.uid,
      type,
      category: category.trim(),
      amount: numAmount,
      date,
      status,
      description: description.trim(),
      createdAt: editingTransaction ? editingTransaction.createdAt : new Date().toISOString()
    };

    try {
      if (editingTransaction) {
        await updateDoc(doc(db, path, editingTransaction.id), transactionData);
      } else {
        await addDoc(collection(db, path), transactionData);
      }
      setIsModalOpen(false);
      fetchTransactions();
    } catch (err) {
      setError('Gagal menyimpan transaksi. Pastikan aturan keamanan (rules) telah diijinkan.');
      handleFirestoreError(err, editingTransaction ? OperationType.UPDATE : OperationType.CREATE, `${path}/${editingTransaction?.id || 'new'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus catatan transaksi ini?')) {
      return;
    }
    const path = 'transactions';
    try {
      await deleteDoc(doc(db, path, id));
      fetchTransactions();
    } catch (err) {
      alert('Gagal menghapus transaksi.');
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
    }
  };

  const handleTogglePaid = async (t: Transaction) => {
    const path = 'transactions';
    const newStatus: TransactionStatus = t.status === 'paid' ? 'pending' : 'paid';
    try {
      await updateDoc(doc(db, path, t.id), { status: newStatus });
      fetchTransactions();
    } catch (err) {
      alert('Gagal memperbarui status bayar.');
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${t.id}`);
    }
  };

  // Finance Summary Calculations
  const totalIncome = transactions
    .filter(t => t.type === 'income' && t.status === 'paid')
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingIncome = transactions
    .filter(t => t.type === 'income' && t.status === 'pending')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netIncome = totalIncome - totalExpense;

  // Format IDR
  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.category.toLowerCase().includes(search.toLowerCase()) || 
                          (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight font-sans">
            Buku Keuangan Freelance
          </h2>
          <p className="text-sm text-neutral-500">Catat pendapatan, pengeluaran cloud hosting, dan invoicing klien secara mandiri.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          Catat Transaksi
        </button>
      </div>

      {/* Finance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Net income */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm md:col-span-1">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Arus Kas Bersih (Lunas)</span>
          <h3 className={`text-2xl font-black tracking-tight ${netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatIDR(netIncome)}
          </h3>
          <p className="text-[11px] text-neutral-400 mt-2 font-medium">Pemasukan lunas dikurangi pengeluaran</p>
        </div>

        {/* Income paid */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Pendapatan Lunas</span>
            <h3 className="text-xl font-extrabold text-neutral-900 tracking-tight">{formatIDR(totalIncome)}</h3>
            <p className="text-[11px] text-emerald-600 mt-1.5 font-bold">Dana masuk terealisasi</p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </div>

        {/* Invoices pending */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Pending Invoice (Piutang)</span>
            <h3 className="text-xl font-extrabold text-neutral-900 tracking-tight">{formatIDR(pendingIncome)}</h3>
            <p className="text-[11px] text-amber-600 mt-1.5 font-bold">Belum dibayar oleh klien</p>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Total Pengeluaran</span>
            <h3 className="text-xl font-extrabold text-neutral-900 tracking-tight">{formatIDR(totalExpense)}</h3>
            <p className="text-[11px] text-red-600 mt-1.5 font-bold">Biaya sewa alat, server, dll</p>
          </div>
          <div className="p-2.5 bg-red-50 text-red-600 rounded-lg">
            <ArrowDownRight className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-neutral-100 shadow-sm">
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Cari transaksi berdasarkan kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-9 pr-3 py-1.5 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-neutral-50"
          />
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          <span className="text-xs text-neutral-400 font-bold uppercase flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Filter:
          </span>
          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as TransactionType | 'all')}
            className="bg-white border border-neutral-200 text-xs font-semibold text-neutral-600 py-1.5 px-2.5 rounded-lg focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Semua Tipe</option>
            <option value="income">Pemasukan (Income)</option>
            <option value="expense">Pengeluaran (Expense)</option>
          </select>
          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as TransactionStatus | 'all')}
            className="bg-white border border-neutral-200 text-xs font-semibold text-neutral-600 py-1.5 px-2.5 rounded-lg focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Semua Status</option>
            <option value="paid">Paid (Lunas)</option>
            <option value="unpaid">Unpaid (Belum Lunas)</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-16 text-neutral-400 space-y-2">
            <Search className="h-8 w-8 mx-auto stroke-1" />
            <p className="text-sm">Belum ada transaksi yang sesuai kriteria pencarian.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-100 text-sm">
              <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-left">
                <tr>
                  <th className="px-6 py-3">Tanggal</th>
                  <th className="px-6 py-3">Kategori</th>
                  <th className="px-6 py-3">Tipe</th>
                  <th className="px-6 py-3 text-right">Nominal</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50 text-neutral-700">
                {filteredTransactions
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((t) => (
                    <tr key={t.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-neutral-500">
                        {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-neutral-900">{t.category}</span>
                        {t.description && (
                          <span className="block text-xs text-neutral-400 truncate max-w-xs">{t.description}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          t.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-neutral-950">
                        {t.type === 'income' ? '+' : '-'}{formatIDR(t.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleTogglePaid(t)}
                          className={`inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase rounded border transition-colors cursor-pointer ${
                            t.status === 'paid' 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100' 
                              : t.status === 'unpaid' 
                                ? 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100' 
                                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                          }`}
                        >
                          {t.status}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-1.5">
                        <button
                          onClick={() => handleOpenEditModal(t)}
                          className="p-1 text-neutral-500 hover:text-emerald-600 hover:bg-neutral-100 rounded transition-colors cursor-pointer inline-block"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1 text-neutral-500 hover:text-red-600 hover:bg-neutral-100 rounded transition-colors cursor-pointer inline-block"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Entry Modal */}
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
                  {editingTransaction ? 'Edit Log Keuangan' : 'Catat Keuangan Baru'}
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

                {/* Type Selection */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Tipe Transaksi *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setType('income')}
                      className={`py-2 text-center rounded-lg text-sm font-semibold border cursor-pointer transition-all ${
                        type === 'income' 
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' 
                          : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      Pemasukan (Income)
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('expense')}
                      className={`py-2 text-center rounded-lg text-sm font-semibold border cursor-pointer transition-all ${
                        type === 'expense' 
                          ? 'border-red-500 bg-red-50 text-red-800 shadow-sm' 
                          : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      Pengeluaran (Expense)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Kategori / Sumber Transaksi *
                  </label>
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Contoh: Project A Payment, Hosting GCP, Beli Lisensi"
                    className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                      Jumlah Nominal (IDR) *
                    </label>
                    <input
                      type="number"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Nominal Rupiah"
                      className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                      Tanggal Transaksi *
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
                    Status Bayar *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TransactionStatus)}
                    className="block w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white text-neutral-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="paid">Lunas (Paid)</option>
                    <option value="unpaid">Belum Lunas (Unpaid)</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Catatan Deskripsi
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tambahkan info tambahan atau detail metode pembayaran..."
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
