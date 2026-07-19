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

const profilePreview = document.getElementById('profile-preview');
const uploadPicInput = document.getElementById('upload-pic');
const inputName = document.getElementById('input-name');
const inputUsername = document.getElementById('input-username');
const inputBio = document.getElementById('input-bio');

// Elemen Preview Card
const previewName = document.getElementById('preview-name');
const previewUsername = document.getElementById('preview-username');
const badgeVerified = document.getElementById('badge-verified');
const badgePremium = document.getElementById('badge-premium');

onAuthStateChanged(auth, (user) => {
    if (user) {
        userUID = user.uid;
        
        const profileRef = ref(database, `users/${userUID}/profile`);
        get(profileRef).then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                // Set data ke input form
                inputName.value = data.name || user.displayName || "";
                inputUsername.value = data.username ? data.username.replace('@', '') : "";
                oldUsername = data.username ? data.username.replace('@', '') : "";
                inputBio.value = data.bio || "";
                
                // Sinkronisasi data ke Preview Card
                previewName.innerText = data.name || user.displayName || "Pengguna";
                previewUsername.innerText = data.username || "@username";
                
                // Menampilkan Lencana Centang Biru secara dinamis
                if (data.isVerified === true) {
                    badgeVerified.classList.remove('hidden');
                }
                
                // Menampilkan Label Premium secara dinamis
                if (data.isPremium === true) {
                    badgePremium.classList.remove('hidden');
                }

                if (data.photo) {
                    profilePreview.src = data.photo;
                    base64Photo = data.photo;
                } else {
                    profilePreview.src = user.photoURL || "https://via.placeholder.com/150";
                }
            } else {
                inputName.value = user.displayName || "";
                previewName.innerText = user.displayName || "Pengguna";
                profilePreview.src = user.photoURL || "https://via.placeholder.com/150";
            }
        }).catch((error) => console.error("Gagal mengambil data profil:", error));

    } else {
        window.location.href = "dashboard.html"; 
    }
});

// Otomatis ubah preview saat nama diketik
inputName.addEventListener('input', function() {
    previewName.innerText = this.value || "Pengguna";
});

// Otomatis ubah preview saat username diketik
inputUsername.addEventListener('input', function() {
    this.value = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    previewUsername.innerText = this.value ? "@" + this.value : "@username";
});

// Unggah Foto Profil & Preview
uploadPicInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 1.5 * 1024 * 1024) {
            alert("Ukuran foto profil terlalu besar. Harap unggah foto di bawah 1.5 MB.");
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            profilePreview.src = e.target.result;
            base64Photo = e.target.result; 
        }
        reader.readAsDataURL(file);
    }
});

// Simpan Perubahan Profil
document.getElementById('profile-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const newUsername = inputUsername.value.trim();
    const newName = inputName.value.trim();
    const newBio = inputBio.value.trim();

    if (!userUID) return;

    if (newUsername !== oldUsername) {
        const usernameCheckRef = ref(database, `taken_usernames/${newUsername}`);
        const snapshot = await get(usernameCheckRef);
        
        if (snapshot.exists()) {
            alert("Username @" + newUsername + " sudah digunakan oleh pengguna lain.");
            return;
        }
    }

    try {
        // Menggunakan "update" agar isVerified dan isPremium yang sudah ada tidak terhapus
        await update(ref(database, `users/${userUID}/profile`), {
            name: newName,
            username: "@" + newUsername,
            bio: newBio,
            photo: base64Photo || profilePreview.src
        });

        if (newUsername !== oldUsername) {
            await set(ref(database, `taken_usernames/${newUsername}`), userUID);
            if (oldUsername) {
                await remove(ref(database, `taken_usernames/${oldUsername}`));
            }
        }

        alert("Profil berhasil diperbarui!");
        window.location.href = "dashboard.html"; 
    } catch (error) {
        alert("Gagal memperbarui profil: " + error.message);
    }
});
