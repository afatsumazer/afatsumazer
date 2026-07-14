import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { User, Briefcase, DollarSign, FileText, Check, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface ProfileViewProps {
  profile: UserProfile | null;
  onProfileUpdate: (updatedProfile: UserProfile) => void;
}

export default function ProfileView({ profile, onProfileUpdate }: ProfileViewProps) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [rate, setRate] = useState('');
  const [bio, setBio] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setTitle(profile.title || '');
      setRate(profile.rate ? profile.rate.toString() : '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !profile) return;

    if (!name.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    const path = 'users';

    const updatedData: Partial<UserProfile> = {
      name: name.trim(),
      title: title.trim(),
      rate: Number(rate) || 0,
      bio: bio.trim()
    };

    try {
      const userDocRef = doc(db, path, auth.currentUser.uid);
      await updateDoc(userDocRef, updatedData);
      
      onProfileUpdate({
        ...profile,
        ...updatedData
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError('Gagal memperbarui profil. Periksa aturan keamanan Firestore Anda.');
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${auth.currentUser.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight font-sans">
          Pengaturan Profil Profesional
        </h2>
        <p className="text-sm text-neutral-500">Kelola identitas, tarif billing per jam, dan bio keahlian Anda.</p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
        <form onSubmit={handleSave} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-semibold flex gap-2 items-center">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-semibold flex gap-2 items-center">
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Profil Anda berhasil diperbarui dengan aman!</span>
            </div>
          )}

          {/* Email Read-only */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
              Alamat Email (Akun)
            </label>
            <input
              type="text"
              readOnly
              disabled
              value={profile?.email || ''}
              className="block w-full px-3 py-2 border border-neutral-100 bg-neutral-50 rounded-lg text-sm text-neutral-400 focus:outline-none cursor-not-allowed"
            />
            <p className="text-[10px] text-neutral-400 mt-1">Email akun ini dikelola dengan aman oleh Firebase Authentication.</p>
          </div>

          {/* Name input */}
          <div>
            <label htmlFor="prof-name" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Nama Lengkap Anda *
            </label>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <User className="h-4 w-4" />
              </div>
              <input
                id="prof-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="block w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-neutral-850"
              />
            </div>
          </div>

          {/* Title input */}
          <div>
            <label htmlFor="prof-title" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Spesialisasi / Gelar Profesional
            </label>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <Briefcase className="h-4 w-4" />
              </div>
              <input
                id="prof-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: UI/UX Designer, React Developer"
                className="block w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-neutral-850"
              />
            </div>
          </div>

          {/* Rate input */}
          <div>
            <label htmlFor="prof-rate" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Tarif Kontrak Per Jam (IDR / USD)
            </label>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <DollarSign className="h-4 w-4" />
              </div>
              <input
                id="prof-rate"
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="Contoh: 150000"
                className="block w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-neutral-850"
              />
            </div>
          </div>

          {/* Bio input */}
          <div>
            <label htmlFor="prof-bio" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Biografi Profesional
            </label>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 pt-2.5 flex items-start pointer-events-none text-neutral-400">
                <FileText className="h-4 w-4" />
              </div>
              <textarea
                id="prof-bio"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tuliskan pengalaman ringkas Anda, portofolio utama, atau moto profesional..."
                className="block w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-neutral-850"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {saving ? 'Menyimpan...' : 'Perbarui Profil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
