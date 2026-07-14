import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Project, Transaction, TimeLog, Client, UserProfile } from '../types';
import { DollarSign, Briefcase, Clock, Users, ArrowUpRight, ArrowDownRight, Calendar, PlusCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardViewProps {
  profile: UserProfile | null;
  onNavigate: (tab: 'dashboard' | 'projects' | 'finance' | 'timelog' | 'clients' | 'profile') => void;
}

export default function DashboardView({ profile, onNavigate }: DashboardViewProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!auth.currentUser) return;
      const uid = auth.currentUser.uid;

      try {
        // Fetch projects
        const projQuery = query(collection(db, 'projects'), where('userId', '==', uid));
        const projSnap = await getDocs(projQuery);
        const projList: Project[] = [];
        projSnap.forEach((doc) => {
          projList.push({ id: doc.id, ...doc.data() } as Project);
        });
        setProjects(projList);

        // Fetch transactions
        const transQuery = query(collection(db, 'transactions'), where('userId', '==', uid));
        const transSnap = await getDocs(transQuery);
        const transList: Transaction[] = [];
        transSnap.forEach((doc) => {
          transList.push({ id: doc.id, ...doc.data() } as Transaction);
        });
        setTransactions(transList);

        // Fetch time logs
        const timeQuery = query(collection(db, 'timeLogs'), where('userId', '==', uid));
        const timeSnap = await getDocs(timeQuery);
        const timeList: TimeLog[] = [];
        timeSnap.forEach((doc) => {
          timeList.push({ id: doc.id, ...doc.data() } as TimeLog);
        });
        setTimeLogs(timeList);

        // Fetch clients
        const clientQuery = query(collection(db, 'clients'), where('userId', '==', uid));
        const clientSnap = await getDocs(clientQuery);
        const clientList: Client[] = [];
        clientSnap.forEach((doc) => {
          clientList.push({ id: doc.id, ...doc.data() } as Client);
        });
        setClients(clientList);

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  // Calculate statistics
  const activeProjectsCount = projects.filter(p => p.status === 'active').length;
  const activeClientsCount = clients.filter(c => c.status === 'active').length;
  
  const totalHoursTracked = timeLogs.reduce((sum, log) => sum + log.hours, 0);
  
  const totalEarnings = transactions
    .filter(t => t.type === 'income' && t.status === 'paid')
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingInvoices = transactions
    .filter(t => t.type === 'income' && t.status === 'pending')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netIncome = totalEarnings - totalExpenses;

  // Format currency
  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  // Prepare monthly income breakdown for custom minimalist bar chart
  const getMonthlyBreakdown = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const currentYear = new Date().getFullYear();
    const data = months.map((month, index) => {
      const monthStr = String(index + 1).padStart(2, '0');
      const filtered = transactions.filter(t => {
        return t.type === 'income' && 
               t.status === 'paid' && 
               t.date.startsWith(`${currentYear}-${monthStr}`);
      });
      const amount = filtered.reduce((sum, t) => sum + t.amount, 0);
      return { month, amount };
    });
    return data;
  };

  const chartData = getMonthlyBreakdown();
  const maxAmount = Math.max(...chartData.map(d => d.amount), 1000000); // at least 1M limit

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-neutral-900 tracking-tight font-sans">
            Selamat Datang, {profile?.name || 'Freelancer'}! 👋
          </h1>
          <p className="text-neutral-500 mt-1">
            {profile?.title || 'Profesional'} • Berikut adalah rangkuman performa kerja dan bisnis Anda hari ini.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => onNavigate('projects')}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            Tambah Proyek
          </button>
        </div>
      </div>

      {/* Grid Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Total Pendapatan</span>
            <h3 className="text-xl md:text-2xl font-extrabold text-neutral-900 tracking-tight">{formatIDR(totalEarnings)}</h3>
            <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-500">
              <span className="text-amber-600 font-semibold">{formatIDR(pendingInvoices)}</span> pending invoice
            </div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Proyek Aktif</span>
            <h3 className="text-xl md:text-2xl font-extrabold text-neutral-900 tracking-tight">{activeProjectsCount} Proyek</h3>
            <p className="text-[11px] text-neutral-500 font-medium">Dari total {projects.length} proyek terdaftar</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <Briefcase className="h-6 w-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Jam Kerja</span>
            <h3 className="text-xl md:text-2xl font-extrabold text-neutral-900 tracking-tight">{totalHoursTracked} Jam</h3>
            <p className="text-[11px] text-neutral-500 font-medium">Telah didelegasikan & dicatat</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Klien Aktif</span>
            <h3 className="text-xl md:text-2xl font-extrabold text-neutral-900 tracking-tight">{activeClientsCount} Klien</h3>
            <p className="text-[11px] text-neutral-500 font-medium">CRM kontak bisnis aktif</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Users className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Charts & Details Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Custom SVG Earnings Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-neutral-900 text-lg">Performa Keuangan bulanan</h3>
                <p className="text-xs text-neutral-500">Pendapatan bersih lunas di tahun {new Date().getFullYear()}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-neutral-400 block uppercase font-semibold">Kas Bersih</span>
                <span className="text-sm font-extrabold text-emerald-600">{formatIDR(netIncome)}</span>
              </div>
            </div>

            {/* SVG Minimalist Bar Chart */}
            <div className="h-64 flex items-end justify-between gap-2 pt-6 pb-2 px-1 border-b border-neutral-100">
              {chartData.map((data, index) => {
                const heightPercentage = (data.amount / maxAmount) * 100;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 bg-neutral-950 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                      {formatIDR(data.amount)}
                    </div>
                    {/* Bar */}
                    <div 
                      className="w-full bg-emerald-100 group-hover:bg-emerald-500 rounded-t-md transition-all ease-out duration-300 relative cursor-pointer"
                      style={{ height: `${Math.max(heightPercentage, 4)}%` }}
                    >
                      {data.amount > 0 && (
                        <div className="absolute inset-0 bg-gradient-to-t from-emerald-600/10 to-transparent rounded-t-md" />
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 mt-2 font-semibold uppercase">{data.month}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between text-xs text-neutral-500 mt-4 pt-1">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded" /> Pendapatan lunas</span>
            <span>Nilai tertinggi: <strong className="text-neutral-800">{formatIDR(maxAmount)}</strong></span>
          </div>
        </div>

        {/* Side panel: Projects Deadlines & Quick actions */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-neutral-900 text-lg mb-4">Proyek Mendekati Deadline</h3>
            {projects.filter(p => p.status === 'active' && p.deadline).length === 0 ? (
              <div className="py-8 text-center text-neutral-400 space-y-2">
                <Calendar className="h-8 w-8 mx-auto stroke-1" />
                <p className="text-sm">Tidak ada deadline aktif saat ini.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projects
                  .filter(p => p.status === 'active' && p.deadline)
                  .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
                  .slice(0, 4)
                  .map(project => (
                    <div key={project.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-semibold text-sm text-neutral-900 truncate">{project.title}</p>
                        <p className="text-xs text-neutral-400 truncate">{project.clientName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 rounded-md border border-amber-200">
                          {new Date(project.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-50 space-y-2">
            <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Akses Cepat Menu</h4>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => onNavigate('finance')}
                className="p-3 bg-neutral-50 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition-all text-left text-xs font-bold text-neutral-700 border border-neutral-100 cursor-pointer"
              >
                Catat Keuangan
              </button>
              <button 
                onClick={() => onNavigate('timelog')}
                className="p-3 bg-neutral-50 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition-all text-left text-xs font-bold text-neutral-700 border border-neutral-100 cursor-pointer"
              >
                Catat Jam Kerja
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Second row: Recent client logs & recent activities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Transactions list */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-neutral-900 text-lg">Catatan Keuangan Terakhir</h3>
            <button onClick={() => onNavigate('finance')} className="text-xs text-emerald-600 hover:underline font-semibold cursor-pointer">Lihat Semua</button>
          </div>
          {transactions.length === 0 ? (
            <p className="text-neutral-400 text-sm py-8 text-center">Belum ada transaksi keuangan.</p>
          ) : (
            <div className="divide-y divide-neutral-50">
              {transactions
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 4)
                .map(t => (
                  <div key={t.id} className="py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {t.type === 'income' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900">{t.category}</p>
                        <p className="text-xs text-neutral-400">{new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatIDR(t.amount)}
                      </p>
                      <span className={`text-[10px] font-bold uppercase ${t.status === 'paid' ? 'text-emerald-700 bg-emerald-50' : t.status === 'unpaid' ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50'} px-1.5 py-0.5 rounded border border-neutral-100`}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Recent Client Interactions */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-neutral-900 text-lg">Hubungan Klien Terbaru</h3>
            <button onClick={() => onNavigate('clients')} className="text-xs text-emerald-600 hover:underline font-semibold cursor-pointer">Lihat CRM</button>
          </div>
          {clients.length === 0 ? (
            <p className="text-neutral-400 text-sm py-8 text-center">Belum ada klien yang terdaftar.</p>
          ) : (
            <div className="divide-y divide-neutral-50">
              {clients.slice(0, 4).map(client => (
                <div key={client.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-neutral-900">{client.name}</p>
                    <p className="text-xs text-neutral-400">{client.company || 'Pribadi'} • {client.email}</p>
                  </div>
                  <div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${client.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-50 text-neutral-500 border border-neutral-200'}`}>
                      {client.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
