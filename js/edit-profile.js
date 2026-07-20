console.log("File edit-profile.js berhasil dimuat!");
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, update, get, remove, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
const auth = getAuth(app);
const database = getDatabase(app);

let userUID = "";
let oldUsername = ""; 
let base64Photo = ""; 

// Referensi Elemen DOM
const profilePreview = document.getElementById('profile-preview');
const uploadPicInput = document.getElementById('upload-pic');
const inputName = document.getElementById('input-name');
const inputUsername = document.getElementById('input-username');
const inputBio = document.getElementById('input-bio');
const profileForm = document.getElementById('profile-form');

// Elemen Preview Card
const previewName = document.getElementById('preview-name');
const previewUsername = document.getElementById('preview-username');
const badgeVerified = document.getElementById('badge-verified');
const badgePremium = document.getElementById('badge-premium');

onAuthStateChanged(auth, (user) => {
    if (user) {
        userUID = user.uid;
        console.log("Pemeriksaan Auth: Sesi aktif terdeteksi untuk UID:", userUID);
        
        const profileRef = ref(database, `users/${userUID}/profile`);
        get(profileRef).then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                console.log("Database: Data profil lama ditemukan:", data);
                
                if (inputName) inputName.value = data.name || user.displayName || "";
                if (inputUsername) {
                    inputUsername.value = data.username ? data.username.replace('@', '') : "";
                    oldUsername = data.username ? data.username.replace('@', '') : "";
                }
                if (inputBio) inputBio.value = data.bio || "";
                
                if (previewName) previewName.innerText = data.name || user.displayName || "Pengguna";
                if (previewUsername) previewUsername.innerText = data.username || "@username";
                
                if (badgeVerified) {
                    if (data.isVerified === true) {
                        badgeVerified.classList.remove('hidden');
                    } else {
                        badgeVerified.classList.add('hidden');
                    }
                }
                
                if (badgePremium) {
                    if (data.isPremium === true) {
                        badgePremium.classList.remove('hidden');
                    } else {
                        badgePremium.classList.add('hidden');
                    }
                }

                if (data.photo) {
                    if (profilePreview) profilePreview.src = data.photo;
                    base64Photo = data.photo;
                } else {
                    if (profilePreview) profilePreview.src = user.photoURL || "https://via.placeholder.com/150";
                }
            } else {
                console.log("Database: Belum ada profil tersimpan untuk UID ini. Menampilkan data default Auth.");
                if (inputName) inputName.value = user.displayName || "";
                if (previewName) previewName.innerText = user.displayName || "Pengguna";
                if (profilePreview) profilePreview.src = user.photoURL || "https://via.placeholder.com/150";
            }
        }).catch((error) => console.error("Database: Gagal mengambil data profil:", error));

    } else {
        console.log("Pemeriksaan Auth: Sesi tidak aktif. Mengalihkan ke dashboard...");
        window.location.href = "dashboard.html"; 
    }
});

// Live-preview nama
if (inputName && previewName) {
    inputName.addEventListener('input', function() {
        previewName.innerText = this.value || "Pengguna";
    });
}

// Live-preview username
if (inputUsername && previewUsername) {
    inputUsername.addEventListener('input', function() {
        this.value = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        previewUsername.innerText = this.value ? "@" + this.value : "@username";
    });
}

// Proses unggah foto profil & live-preview lokal
if (uploadPicInput) {
    uploadPicInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 1.5 * 1024 * 1024) {
                alert("Ukuran foto profil terlalu besar. Harap unggah foto di bawah 1.5 MB.");
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                if (profilePreview) profilePreview.src = e.target.result;
                base64Photo = e.target.result; 
            }
            reader.readAsDataURL(file);
        }
    });
}

// === PENYELAMAT FORM SUBMIT (Menghentikan reload halaman) ===
if (profileForm) {
    profileForm.addEventListener('submit', async function(event) {
        event.preventDefault(); // Mencegah browser me-reload halaman!
        console.log("Event submit ditangkap! Memulai proses penyimpanan data...");
        
        const newUsername = inputUsername ? inputUsername.value.trim() : "";
        const newName = inputName ? inputName.value.trim() : "";
        const newBio = inputBio ? inputBio.value.trim() : "";

        console.log("Data yang akan dikirim:", { newName, newUsername, newBio });

        if (!userUID) {
            alert("Sesi pengguna belum terbaca sepenuhnya. Silakan muat ulang halaman.");
            return;
        }

        // Validasi Sederhana
        if (newName === "") {
            alert("Kolom nama lengkap wajib diisi.");
            return;
        }
        if (newUsername === "") {
            alert("Kolom ID unik/username wajib diisi.");
            return;
        }

        // Periksa ketersediaan username jika berubah
        if (newUsername !== oldUsername) {
            console.log(`Memeriksa ketersediaan username: @${newUsername}`);
            try {
                const usernameCheckRef = ref(database, `taken_usernames/${newUsername}`);
                const snapshot = await get(usernameCheckRef);
                
                if (snapshot.exists()) {
                    alert("Username @" + newUsername + " sudah digunakan oleh pengguna lain.");
                    return;
                }
            } catch (err) {
                console.error("Gagal memeriksa ketersediaan username:", err);
            }
        }

        try {
            console.log("Mengirim data profil ke database...");
            // Melakukan update profil pengguna
            await update(ref(database, `users/${userUID}/profile`), {
                name: newName,
                username: "@" + newUsername,
                bio: newBio,
                photo: base64Photo || (profilePreview ? profilePreview.src : "https://via.placeholder.com/150")
            });

            // Perbarui data folder taken_usernames jika username berubah
            if (newUsername !== oldUsername) {
                console.log("Mendaftarkan username baru dan menghapus username lama...");
                await set(ref(database, `taken_usernames/${newUsername}`), userUID);
                if (oldUsername) {
                    await remove(ref(database, `taken_usernames/${oldUsername}`));
                }
            }

            console.log("Penyimpanan selesai dengan sukses!");
            alert("Profil berhasil diperbarui!");
            window.location.href = "dashboard.html"; 
        } catch (error) {
            console.error("Detail Error saat proses pengiriman database:", error);
            alert("Gagal memperbarui profil: " + error.message);
        }
    });
} else {
    console.warn("Elemen form '#profile-form' tidak ditemukan pada halaman HTML ini.");
}
