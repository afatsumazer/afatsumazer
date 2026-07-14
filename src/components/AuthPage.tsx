import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { motion } from 'motion/react';
import { Mail, Lock, User, Briefcase, ChevronRight, AlertCircle, ShieldCheck, HelpCircle } from 'lucide-react';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfigTip, setShowConfigTip] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setShowConfigTip(false);

    try {
      if (isRegister) {
        if (!name.trim()) {
          throw new Error('Nama lengkap wajib diisi');
        }
        // Register user
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        // Save custom profile information in Firestore users/{uid}
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          name: name.trim(),
          title: title.trim() || 'Freelancer',
          rate: 50, // default rate
          bio: 'Halo! Saya adalah freelancer profesional.',
          createdAt: new Date().toISOString()
        });
      } else {
        // Login user
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error('Authentication Error:', err);
      let errorMsg = 'Terjadi kesalahan sistem.';
      
      if (err.code === 'auth/operation-not-allowed') {
        errorMsg = 'Metode login Email/Password belum diaktifkan di Firebase Console Anda.';
        setShowConfigTip(true);
      } else if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'Email ini sudah terdaftar. Silakan login.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errorMsg = 'Email atau password salah. Silakan periksa kembali.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Password terlalu lemah. Minimal 6 karakter.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Format email tidak valid.';
      } else {
        errorMsg = err.message || errorMsg;
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    setShowConfigTip(false);
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user profile already exists
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        // Create initial profile for new Google user
        await setDoc(docRef, {
          uid: user.uid,
          email: user.email,
          name: user.displayName || 'Freelancer Baru',
          title: 'Freelancer',
          rate: 50,
          bio: 'Halo! Saya adalah freelancer profesional.',
          createdAt: new Date().toISOString()
        });
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      let errorMsg = 'Terjadi kesalahan saat masuk menggunakan Google.';
      if (err.code === 'auth/operation-not-allowed') {
        errorMsg = 'Metode Google Sign-In belum diaktifkan di Firebase Console Anda.';
        setShowConfigTip(true);
      } else {
        errorMsg = err.message || errorMsg;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-container" className="min-h-screen bg-neutral-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-2 mb-2">
          <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-sm">
            <ShieldCheck className="h-8 w-8" />
          </div>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-neutral-950 tracking-tight font-sans">
          Freelancer Portal
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-600">
          Kelola proyek, keuangan, dan klien Anda secara aman
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          layout
          className="bg-white py-8 px-4 shadow-md rounded-2xl sm:px-10 border border-neutral-100"
        >
          <div className="mb-6 flex border-b border-neutral-100">
            <button
              onClick={() => { setIsRegister(false); setError(null); }}
              className={`w-1/2 pb-3 font-medium text-sm text-center border-b-2 transition-colors ${!isRegister ? 'border-emerald-600 text-emerald-600 font-semibold' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
            >
              Masuk (Login)
            </button>
            <button
              onClick={() => { setIsRegister(true); setError(null); }}
              className={`w-1/2 pb-3 font-medium text-sm text-center border-b-2 transition-colors ${isRegister ? 'border-emerald-600 text-emerald-600 font-semibold' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
            >
              Daftar Baru
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm flex gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{error}</p>
                {showConfigTip && (
                  <div className="mt-2 bg-white/70 rounded p-2 text-xs border border-red-100 text-neutral-700">
                    <p className="font-semibold mb-1">💡 Langkah Perbaikan:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Buka <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-semibold">Firebase Console</a>.</li>
                      <li>Pilih proyek <code className="bg-neutral-100 px-1 rounded text-red-600">afatsumazer-app</code>.</li>
                      <li>Masuk ke menu <span className="font-medium">Authentication</span> → <span className="font-medium">Sign-in method</span>.</li>
                      <li>Aktifkan penyedia <span className="font-semibold">{isRegister || error.includes('Email/Password') ? 'Email/Password' : 'Google'}</span>.</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleEmailAuth}>
            {isRegister && (
              <>
                <div>
                  <label htmlFor="reg-name" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Nama Lengkap
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      id="reg-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: Budi Santoso"
                      className="block w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-title" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Keahlian / Spesialisasi
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <input
                      id="reg-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Contoh: UI/UX Designer, React Developer"
                      className="block w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                Alamat Email
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="budi@example.com"
                  className="block w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                Kata Sandi
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loading ? 'Memproses...' : isRegister ? 'Daftar Akun' : 'Masuk Sekarang'}
                {!loading && <ChevronRight className="ml-1.5 h-4 w-4" />}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-100"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-neutral-400 uppercase tracking-wider">Atau masuk dengan</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-neutral-200 rounded-lg shadow-sm bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 cursor-pointer"
              >
                <svg className="h-5 w-5 mr-2 text-neutral-500" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.193-5.136 4.193a5.95 5.95 0 0 1-5.951-5.95 5.95 5.95 0 0 1 5.951-5.95c1.616 0 3.085.623 4.205 1.636l3.125-3.125C18.995 2.915 15.776 1.5 12.24 1.5c-5.79 0-10.5 4.71-10.5 10.5s4.71 10.5 10.5 10.5c5.385 0 9.774-3.792 10.39-8.8H12.24Z"
                  />
                </svg>
                Google Sign In
              </button>
            </div>
          </div>
        </motion.div>

        {/* Informative Help Card */}
        <div className="mt-6 bg-amber-50 rounded-xl p-4 border border-amber-200 text-xs text-neutral-700 space-y-2">
          <div className="flex items-center gap-1.5 text-amber-900 font-semibold">
            <HelpCircle className="h-4 w-4 shrink-0" />
            <span>Petunjuk Integrasi Firebase</span>
          </div>
          <p>
            Aplikasi ini terintegrasi langsung dengan kredensial Firebase pribadi Anda:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Authentication:</strong> Mengelola keamanan akun freelancer. Pastikan Anda sudah mengaktifkan metode masuk <strong>Email/Password</strong> atau <strong>Google</strong> di Firebase Console.</li>
            <li><strong>Firestore Database:</strong> Menyimpan profil, daftar proyek, keuangan, catatan waktu, dan klien Anda secara aman (Zero-Trust).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
