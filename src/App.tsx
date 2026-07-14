import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ActiveTab, UserProfile } from './types';
import AuthPage from './components/AuthPage';
import DashboardView from './components/DashboardView';
import ProjectsView from './components/ProjectsView';
import FinanceView from './components/FinanceView';
import TimeLogView from './components/TimeLogView';
import ClientsView from './components/ClientsView';
import ProfileView from './components/ProfileView';
import { 
  LayoutDashboard, 
  Briefcase, 
  DollarSign, 
  Clock, 
  Users, 
  User as UserIcon, 
  LogOut, 
  Menu, 
  X,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch user profile from Firestore
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setProfile(userDocSnap.data() as UserProfile);
          } else {
            // Fallback profile if Firestore is blank
            setProfile({
              uid: currentUser.uid,
              email: currentUser.email || '',
              name: currentUser.displayName || 'Freelancer Baru',
              title: 'Freelancer',
              rate: 50,
              bio: 'Halo! Saya adalah freelancer profesional.'
            });
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    if (window.confirm('Apakah Anda yakin ingin keluar (logout)?')) {
      await signOut(auth);
      setMobileMenuOpen(false);
    }
  };

  const handleProfileUpdate = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col justify-center items-center">
        <div className="p-3 bg-emerald-50 rounded-2xl mb-4 text-emerald-600 animate-pulse">
          <ShieldCheck className="h-10 w-10" />
        </div>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600"></div>
        <p className="mt-4 text-neutral-500 text-sm font-semibold tracking-wide uppercase">Menghubungkan ke Portal...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuthSuccess={() => {}} />;
  }

  // Navigation Items definition
  const navItems = [
    { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'projects', label: 'Proyek Kerja', icon: Briefcase },
    { id: 'finance', label: 'Keuangan', icon: DollarSign },
    { id: 'timelog', label: 'Log Waktu', icon: Clock },
    { id: 'clients', label: 'Klien CRM', icon: Users },
    { id: 'profile', label: 'Profil Saya', icon: UserIcon },
  ] as const;

  return (
    <div className="min-h-screen bg-neutral-50/75 flex flex-col md:flex-row font-sans">
      
      {/* Mobile Top Header Bar */}
      <header className="md:hidden bg-white border-b border-neutral-200/80 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-600 rounded-lg text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-extrabold text-neutral-950 text-sm font-sans tracking-tight">
            Freelancer Portal
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 text-neutral-500 hover:text-neutral-900 focus:outline-none cursor-pointer"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Mobile Menu Backdrop & Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-30 md:hidden flex">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-neutral-900"
            />
            {/* Drawer */}
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="relative w-4/5 max-w-sm bg-white h-full flex flex-col justify-between p-6 shadow-2xl border-r border-neutral-100"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-neutral-50 pb-4">
                  <div className="p-2 bg-emerald-600 rounded-xl text-white">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-neutral-900 text-sm">Portal Freelancer</h3>
                    <p className="text-[10px] text-neutral-400">Secure Database & Auth</p>
                  </div>
                </div>

                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                          isActive 
                            ? 'bg-emerald-50 text-emerald-700' 
                            : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Mobile Profile & Signout footer */}
              <div className="border-t border-neutral-100 pt-4 flex flex-col gap-3">
                <div className="flex items-center gap-2.5 px-1">
                  <div className="h-9 w-9 bg-neutral-100 rounded-full flex items-center justify-center text-emerald-700 font-bold border border-neutral-200">
                    {profile?.name?.charAt(0).toUpperCase() || 'F'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-neutral-800 truncate">{profile?.name || 'Freelancer'}</p>
                    <p className="text-[10px] text-neutral-400 truncate">{profile?.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar Akun
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-white border-r border-neutral-200/80 p-6 sticky top-0 h-screen shrink-0 shadow-sm">
        <div className="space-y-8">
          {/* Logo brand */}
          <div className="flex items-center gap-2.5 border-b border-neutral-50 pb-5">
            <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-neutral-900 text-sm font-sans tracking-tight leading-none">
                Freelancer Portal
              </h3>
              <p className="text-[10px] text-neutral-400 font-medium mt-1">Secured by Firebase</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-emerald-50 text-emerald-700 shadow-sm font-bold border border-emerald-100/50' 
                      : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50/50'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-neutral-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Profile Card & Logout block */}
        <div className="border-t border-neutral-100 pt-5 space-y-4">
          <div className="flex items-center gap-3 px-1.5">
            <div className="h-10 w-10 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center font-bold border border-emerald-200 shadow-sm">
              {profile?.name?.charAt(0).toUpperCase() || 'F'}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-neutral-900 truncate">{profile?.name || 'Freelancer'}</p>
              <p className="text-xs text-neutral-400 truncate">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg cursor-pointer transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Keluar Akun
          </button>
        </div>
      </aside>

      {/* Main Viewport Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="h-full"
        >
          {activeTab === 'dashboard' && <DashboardView profile={profile} onNavigate={setActiveTab} />}
          {activeTab === 'projects' && <ProjectsView />}
          {activeTab === 'finance' && <FinanceView />}
          {activeTab === 'timelog' && <TimeLogView />}
          {activeTab === 'clients' && <ClientsView />}
          {activeTab === 'profile' && <ProfileView profile={profile} onProfileUpdate={handleProfileUpdate} />}
        </motion.div>
      </main>

    </div>
  );
}
