// js/view-profile.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Konfigurasi Firebase (Harus sama persis dengan yang ada di dashboard Anda)
const firebaseConfig = {
  apiKey: "AIzaSyDg2b6LERZ2zE86mTiYvUO1Uj--lAtpmgM",
  authDomain: "afatsumazer-app.firebaseapp.com",
  databaseURL: "https://afatsumazer-app-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "afatsumazer-app",
  storageBucket: "afatsumazer-app.firebasestorage.app",
  messagingSenderId: "16280759060",
  appId: "1:16280759060:web:fd4deacafdf5cadd777001",
  measurementId: "G-WB9YW9D726"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function initPortfolio() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetUserId = urlParams.get('id'); // Mengambil parameter ?id=... dari URL

    // --- LOGIKA TOMBOL KEMBALI DINAMIS ---
    const backBtn = document.getElementById('back-btn');
    const backText = document.getElementById('back-text');
    if (backBtn) {
        const halamanAsal = document.referrer; 
        if (halamanAsal.includes('dashboard.html')) {
            backBtn.href = "dashboard.html";
            backText.innerText = "Ke Dashboard";
        } else {
            backBtn.href = "index.html"; 
            backText.innerText = "Ke Beranda";
        }
    }

    // Jika parameter ID tidak ada di URL
    if (!targetUserId) {
        document.getElementById('preview-name').innerText = "Pengguna Tidak Ditemukan";
        return;
    }

    // --- MENGAMBIL DATA PROFIL PENGGUNA SECARA REALTIME ---
    const profileRef = ref(database, `users/${targetUserId}/profile`);
    
    // onValue memastikan data langsung ter-update otomatis jika pemilik mengubah namanya di dashboard
    onValue(profileRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            // Suntikkan data profil ke elemen HTML portofolio
            document.getElementById('profile-preview').src = data.photo || "https://via.placeholder.com/150";
            document.getElementById('preview-name').innerText = data.name || "Pengguna";
            document.getElementById('preview-username').innerText = data.username || "@username";
            document.getElementById('display-bio').innerText = data.bio || "Belum ada bio singkat.";

            // Tampilkan atau sembunyikan lencana (badge) centang biru
            if (data.isVerified === true) {
                document.getElementById('badge-verified').classList.remove('hidden');
            } else {
                document.getElementById('badge-verified').classList.add('hidden');
            }

            // Tampilkan atau sembunyikan lencana Premium
            if (data.isPremium === true) {
                document.getElementById('badge-premium').classList.remove('hidden');
            } else {
                document.getElementById('badge-premium').classList.add('hidden');
            }

        } else {
            document.getElementById('preview-name').innerText = "Profil tidak ditemukan";
        }
    }, (error) => {
        console.error("Gagal memuat profil Firebase:", error);
        document.getElementById('preview-name').innerText = "Gagal memuat data";
    });

    // --- MENGAMBIL DATA KARTU POS / BERKAS PUBLIK PENGGUNA ---
    loadUserSharedFiles(targetUserId);
}

// Fungsi menampilkan daftar berkas publik di catatan kaki / galeri bawah portofolio
function loadUserSharedFiles(userId) {
    const container = document.getElementById('postcard-container');
    if (!container) return;

    // Sesuai dengan database dashboard Anda, berkas disimpan di path 'shared'
    const sharedRef = ref(database, 'shared');
    
    onValue(sharedRef, (snapshot) => {
        container.innerHTML = ""; // Bersihkan teks loading awal

        if (snapshot.exists()) {
            const allSharedFiles = snapshot.val();
            let fileDitemukan = false;

            // Lakukan perulangan untuk mencari file milik user terkait
            for (let key in allSharedFiles) {
                const file = allSharedFiles[key];
                
                // Menyamakan ID pemilik berkas (pastikan di database berkas Anda memiliki properti ownerId / uid)
                if (file.uid === userId || file.ownerId === userId) {
                    fileDitemukan = true;
                    
                    const cardElement = document.createElement('div');
                    cardElement.className = "flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100/50 transition duration-200";
                    
                    // Struktur tampilan list berkas/kartu pos di catatan kaki portofolio
                    cardElement.innerHTML = `
                        <div class="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="text-xs font-bold text-slate-800 truncate">${file.name || 'Tanpa Nama'}</h4>
                            <p class="text-[11px] text-slate-400 truncate">${((file.size || 0) / 1024).toFixed(1)} KB</p>
                        </div>
                        <a href="dashboard.html?share=${key}" class="text-[10px] bg-white border border-slate-200 text-slate-600 font-semibold px-2 py-1 rounded hover:bg-slate-50 transition">
                            Unduh
                        </a>
                    `;
                    container.appendChild(cardElement);
                }
            }

            if (!fileDitemukan) {
                container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-2">Belum ada berkas yang dibagikan.</p>`;
            }

        } else {
            container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-2">Belum ada berkas publik.</p>`;
        }
    });
}

// Jalankan sistem portofolio saat DOM siap
document.addEventListener('DOMContentLoaded', initPortfolio);
