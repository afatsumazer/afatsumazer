import React from 'react';

/**
 * Komponen Postcard / PopUp Profil User
 * 
 * @param {Object} user - Data pengguna (id, name, username, avatar, bio, status, dll)
 * @param {boolean} isOpen - Status apakah popup terbuka atau tertutup
 * @param {function} onClose - Fungsi untuk menutup popup
 * @param {function} onFollow - Fungsi ketika tombol Follow diklik
 */
const Postcard = ({ user, isOpen, onClose, onFollow }) => {
  // Jika popup tidak terbuka atau data user belum ada, jangan tampilkan apa-apa
  if (!isOpen || !user) return null;

  return (
    // Overlay Gelap (Latar Belakang)
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      
      // Kartu Postcard (Container)
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all border border-gray-100">
        
        // Tombol Close (X) di Pojok Kanan Atas
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 transition"
        >
          ✕
        </button>

        // Header Background Banner
        <div className="h-24 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

        // Konten Profil
        <div className="px-6 pb-6 pt-0 relative text-center">
          
          {/* Avatar / Foto Profil */}
          <div className="relative -mt-12 mb-3 inline-block">
            <img 
              src={user.avatar || "https://via.placeholder.com/150"} 
              alt={user.name} 
              className="w-24 h-24 rounded-full border-4 border-white object-cover shadow-md mx-auto"
            />
            {/* Indikator Status Aktif */}
            {user.status === 'ACTIVE' && (
              <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" title="Akun Aktif"></span>
            )}
          </div>

          {/* Nama & Username */}
          <h3 className="text-xl font-bold text-gray-800 leading-snug">
            {user.name}
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            @{user.username || user.uid}
          </p>

          {/* Badge Status UID */}
          <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full mb-4">
            UID: {user.uid ? user.uid.substring(0, 8) + '...' : 'Verified'}
          </span>

          {/* Bio / Deskripsi Singkat */}
          <p className="text-sm text-gray-600 line-clamp-3 mb-5 px-2 italic">
            "{user.bio || 'Belum ada biodata.'}"
          </p>

          {/* Statistik Singkat (Post, Followers, Following) */}
          <div className="flex justify-around items-center border-t border-b border-gray-100 py-3 mb-5 bg-gray-50/50 rounded-xl">
            <div>
              <span className="block text-base font-bold text-gray-800">{user.postsCount || 0}</span>
              <span className="text-xs text-gray-400">Post</span>
            </div>
            <div className="border-r h-6 border-gray-200"></div>
            <div>
              <span className="block text-base font-bold text-gray-800">{user.followersCount || 0}</span>
              <span className="text-xs text-gray-400">Pengikut</span>
            </div>
            <div className="border-r h-6 border-gray-200"></div>
            <div>
              <span className="block text-base font-bold text-gray-800">{user.followingCount || 0}</span>
              <span className="text-xs text-gray-400">Mengikuti</span>
            </div>
          </div>

          {/* Tombol Aksi */}
          <div className="flex gap-3">
            <button 
              onClick={() => onFollow && onFollow(user.uid)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-xl text-sm shadow-lg shadow-blue-500/30 transition active:scale-95"
            >
              + Ikuti
            </button>
            <button 
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-xl text-sm transition active:scale-95"
            >
              Tutup
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default Postcard;
