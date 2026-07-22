// js/user-list.js (File daftar pengguna utama)

const API_BASE_URL = "https://app.afatsumazer.eu.org"; 

// 1. Fungsi Utama saat mengambil daftar pengguna dari Server
async function fetchAllUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/users`);
        const users = await response.json();
        
        const listContainer = document.getElementById('users-container'); // Sesuaikan ID kontainer Anda
        listContainer.innerHTML = ""; 

        users.forEach(user => {
            // Membuat elemen kartu untuk tiap pengguna
            const userCard = document.createElement('div');
            userCard.className = "p-4 bg-white border border-slate-100 rounded-xl flex items-center justify-between shadow-sm shadow-slate-100/50";
            
            // Perhatikan bagian onclick="lihatPortofolio('${user.username}')" di bawah ini
            userCard.innerHTML = `
                <div class="flex items-center space-x-3">
                    <img src="${user.avatar_url || 'https://placeholder.com'}" class="w-10 h-10 rounded-full object-cover">
                    <div>
                        <h4 class="text-sm font-bold text-slate-800">${user.full_name}</h4>
                        <p class="text-xs text-slate-400">@${user.username}</p>
                    </div>
                </div>
                <button onclick="lihatPortofolio('${user.username}')" class="text-xs bg-indigo-50 text-indigo-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition duration-200">
                    Lihat Profil
                </button>
            `;
            listContainer.appendChild(userCard);
        });
    } catch (error) {
        console.error("Gagal memuat daftar pengguna:", error);
    }
}

// 2. FUNGSI LANGKAH 3: Berfungsi menyimpan data ke browser & pindah halaman
window.lihatPortofolio = function(username) {
    // Simpan target username secara lokal ke memori browser
    localStorage.setItem('selected_portfolio_username', username);
    
    // Alihkan navigasi browser ke halaman portofolio statis Anda
    window.location.href = "portofolio.html"; // Sesuaikan jika nama file HTML portofolio Anda berbeda
}

// Jalankan pengambilan data saat halaman daftar dimuat
document.addEventListener('DOMContentLoaded', fetchAllUsers);
