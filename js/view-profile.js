// js/view-profile.js

// URL Base API Server Anda (sesuaikan dengan endpoint afatsumazer Anda)
const API_BASE_URL = "https://eu.org"; 

async function loadUserProfile() {
    // Mengambil username dari penyimpanan browser (localStorage)
    const targetUsername = localStorage.getItem('selected_portfolio_username');

    if (!targetUsername) {
        document.getElementById('preview-name').innerText = "Pengguna Tidak Ditemukan";
        console.error("Username tidak ditemukan di localStorage. Silakan arahkan dari halaman daftar pengguna.");
        return;
    }

    try {
        // 1. Ambil data profil dari API berdasarkan username yang disimpan
        const profileResponse = await fetch(`${API_BASE_URL}/users/${targetUsername}`);
        if (!profileResponse.ok) throw new Error("Gagal mengambil data profil");
        
        const userData = await profileResponse.json();

        // 2. Tampilkan data profil ke elemen HTML
        document.getElementById('profile-preview').src = userData.avatar_url || 'https://placeholder.com';
        document.getElementById('preview-name').innerText = userData.full_name;
        document.getElementById('preview-username').innerText = `@${userData.username}`;
        document.getElementById('display-bio').innerText = userData.bio || 'Tidak ada bio singkat.';

        // Atur tampilan lencana (badge)
        if (userData.is_verified) {
            document.getElementById('badge-verified').classList.remove('hidden');
        }
        if (userData.is_premium) {
            document.getElementById('badge-premium').classList.remove('hidden');
        }

        // 3. Ambil data Kartu Pos publik milik pengguna ini menggunakan ID-nya
        loadUserPostcards(userData.id);

    } catch (error) {
        console.error("Error:", error);
        document.getElementById('preview-name').innerText = "Gagal memuat data";
    }
}

async function loadUserPostcards(userId) {
    const container = document.getElementById('postcard-container');
    if (!container) return; // Lewati jika elemen kontainer kartu pos tidak dibuat
    
    try {
        const response = await fetch(`${API_BASE_URL}/postcards?user_id=${userId}&public=true`);
        if (!response.ok) throw new Error();
        
        const postcards = await response.json();
        container.innerHTML = ""; // Bersihkan teks pemuatan awal

        if (postcards.length === 0) {
            container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-2">Belum ada kartu pos yang dibagikan.</p>`;
            return;
        }

        postcards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = "flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100/50 transition duration-200";
            cardElement.innerHTML = `
                <img src="${card.image_url}" alt="Postcard" class="w-12 h-12 rounded-lg object-cover bg-slate-200 flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-bold text-slate-800 truncate">${card.title || 'Tanpa Judul'}</h4>
                    <p class="text-[11px] text-slate-400 truncate">${card.description || 'Tidak ada deskripsi.'}</p>
                </div>
            `;
            container.appendChild(cardElement);
        });

    } catch (error) {
        container.innerHTML = `<p class="text-xs text-red-400 italic text-center py-2">Gagal memuat daftar kartu pos.</p>`;
    }
}

// Jalankan pencarian otomatis saat halaman terbuka
document.addEventListener('DOMContentLoaded', loadUserProfile);
