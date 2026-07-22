// js/view-profile.js (File portofolio statis)

const API_BASE_URL = "https://app.afatsumazer.eu.org"; 

async function loadUserProfile() {
    // MEMBACA PARAMETER LANGSUNG DARI URL BROWSER
    const urlParams = new URLSearchParams(window.location.search);
    const targetUsername = urlParams.get('username');

    if (!targetUsername) {
        document.getElementById('preview-name').innerText = "Pengguna Tidak Ditemukan";
        return;
    }

    try {
        // Ambil data dari API berdasarkan parameter URL
        const profileResponse = await fetch(`${API_BASE_URL}/users/${targetUsername}`);
        if (!profileResponse.ok) throw new Error("Gagal mengambil data profil");
        
        const userData = await profileResponse.json();

        // Tampilkan data ke HTML
        document.getElementById('profile-preview').src = userData.avatar_url || 'https://placeholder.com';
        document.getElementById('preview-name').innerText = userData.full_name;
        document.getElementById('preview-username').innerText = `@${userData.username}`;
        document.getElementById('display-bio').innerText = userData.bio || 'Tidak ada bio singkat.';

        if (userData.is_verified) {
            document.getElementById('badge-verified').classList.remove('hidden');
        }
        if (userData.is_premium) {
            document.getElementById('badge-premium').classList.remove('hidden');
        }

        // Muat kartu pos
        loadUserPostcards(userData.id);

    } catch (error) {
        console.error("Error:", error);
        document.getElementById('preview-name').innerText = "Gagal memuat data";
    }
}

// ... (Fungsi loadUserPostcards tetap sama seperti sebelumnya) ...
document.addEventListener('DOMContentLoaded', loadUserProfile);
