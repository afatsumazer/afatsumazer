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

// Mengambil referensi elemen DOM
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
        console.log("Pengguna terdeteksi dengan UID:", userUID);
        
        const profileRef = ref(database, `users/${userUID}/profile`);
        get(profileRef).then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                // Set data ke input form secara aman (hanya jika elemen ada)
                if (inputName) inputName.value = data.name || user.displayName || "";
                if (inputUsername) {
                    inputUsername.value = data.username ? data.username.replace('@', '') : "";
                    oldUsername = data.username ? data.username.replace('@', '') : "";
                }
                if (inputBio) inputBio.value = data.bio || "";
                
                // Sinkronisasi data ke Preview Card secara aman
                if (previewName) previewName.innerText = data.name || user.displayName || "Pengguna";
                if (previewUsername) previewUsername.innerText = data.username || "@username";
                
                // Menampilkan Lencana Centang Biru secara dinamis
                if (badgeVerified) {
                    if (data.isVerified === true) {
                        badgeVerified.classList.remove('hidden');
                    } else {
                        badgeVerified.classList.add('hidden');
                    }
                }
                
                // Menampilkan Label Premium secara dinamis
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
                if (inputName) inputName.value = user.displayName || "";
                if (previewName) previewName.innerText = user.displayName || "Pengguna";
                if (profilePreview) profilePreview.src = user.photoURL || "https://via.placeholder.com/150";
            }
        }).catch((error) => console.error("Gagal mengambil data profil:", error));

    } else {
        console.log("Tidak ada sesi pengguna aktif. Mengalihkan...");
        window.location.href = "dashboard.html"; 
    }
});

// Otomatis ubah preview saat nama diketik
if (inputName && previewName) {
    inputName.addEventListener('input', function() {
        previewName.innerText = this.value || "Pengguna";
    });
}

// Otomatis ubah preview saat username diketik
if (inputUsername && previewUsername) {
    inputUsername.addEventListener('input', function() {
        this.value = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        previewUsername.innerText = this.value ? "@" + this.value : "@username";
    });
}

// Unggah Foto Profil & Preview
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

// Simpan Perubahan Profil
if (profileForm) {
    profileForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        console.log("Formulir dikirim, memproses pembaruan...");
        
        const newUsername = inputUsername ? inputUsername.value.trim() : "";
        const newName = inputName ? inputName.value.trim() : "";
        const newBio = inputBio ? inputBio.value.trim() : "";

        if (!userUID) {
            alert("Sesi pengguna belum terbaca sepenuhnya. Silakan tunggu beberapa saat.");
            return;
        }

        if (newUsername !== oldUsername && newUsername !== "") {
            const usernameCheckRef = ref(database, `taken_usernames/${newUsername}`);
            const snapshot = await get(usernameCheckRef);
            
            if (snapshot.exists()) {
                alert("Username @" + newUsername + " sudah digunakan oleh pengguna lain.");
                return;
            }
        }

        try {
            // Menggunakan "update" agar isVerified dan isPremium tidak terhapus
            await update(ref(database, `users/${userUID}/profile`), {
                name: newName,
                username: "@" + newUsername,
                bio: newBio,
                photo: base64Photo || (profilePreview ? profilePreview.src : "")
            });

            if (newUsername !== oldUsername && newUsername !== "") {
                await set(ref(database, `taken_usernames/${newUsername}`), userUID);
                if (oldUsername) {
                    await remove(ref(database, `taken_usernames/${oldUsername}`));
                }
            }

            alert("Profil berhasil diperbarui!");
            window.location.href = "dashboard.html"; 
        } catch (error) {
            console.error("Detail Error:", error);
            alert("Gagal memperbarui profil: " + error.message);
        }
    });
} else {
    console.warn("Elemen form '#profile-form' tidak ditemukan di halaman.");
}
