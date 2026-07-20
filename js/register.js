console.log("File register.js berhasil dimuat!");
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// Elemen DOM
const registerForm = document.getElementById('register-form');
const btnGoogleRegister = document.getElementById('btn-google-register');

// === METODE 1: PENDAFTARAN DENGAN EMAIL & PASSWORD ===
if (registerForm) {
    registerForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        console.log("Memulai pendaftaran email...");

        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;

        try {
            // Pembuatan User di Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log("Auth: Akun email berhasil dibuat untuk UID:", user.uid);

            // Membuat nama pengguna unik (username) otomatis dari depan email
            const autoUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');

            // Membuat data profil default awal di Realtime Database
            console.log("Database: Menulis profil awal ke Realtime Database...");
            await set(ref(database, `users/${user.uid}/profile`), {
                name: name,
                username: "@" + autoUsername,
                bio: "Halo, saya pengguna baru AppSaya!",
                photo: "https://via.placeholder.com/150",
                isVerified: false,
                isPremium: false
            });

            // Mendaftarkan username ini ke daftar username yang terpakai
            await set(ref(database, `taken_usernames/${autoUsername}`), user.uid);

            alert("Pendaftaran berhasil! Akun Anda telah siap.");
            window.location.href = "dashboard.html";
        } catch (error) {
            console.error("Proses Pendaftaran Gagal:", error);
            alert("Gagal melakukan pendaftaran: " + error.message);
        }
    });
}

// === METODE 2: PENDAFTARAN / LOGIN DENGAN GOOGLE ===
if (btnGoogleRegister) {
    btnGoogleRegister.addEventListener('click', async function() {
        console.log("Memulai pendaftaran Google...");
        const provider = new GoogleAuthProvider();

        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            console.log("Auth Google: Berhasil masuk, UID:", user.uid);

            // Periksa apakah pengguna ini sudah pernah terdaftar di database sebelumnya
            const profileRef = ref(database, `users/${user.uid}/profile`);
            const snapshot = await get(profileRef);

            if (!snapshot.exists()) {
                // Jika belum terdaftar, buat profil default awal menggunakan info dari Google
                console.log("Database: Pengguna baru Google terdeteksi. Membuat entri profil awal...");
                const autoUsername = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');

                await set(ref(database, `users/${user.uid}/profile`), {
                    name: user.displayName || "Pengguna Baru",
                    username: "@" + autoUsername,
                    bio: "Halo, saya pengguna baru AppSaya!",
                    photo: user.photoURL || "https://via.placeholder.com/150",
                    isVerified: false,
                    isPremium: false
                });

                // Daftarkan username ke database
                await set(ref(database, `taken_usernames/${autoUsername}`), user.uid);
            } else {
                console.log("Database: Pengguna lama Google terdeteksi. Melewati inisialisasi profil.");
            }

            alert("Berhasil masuk menggunakan akun Google Anda!");
            window.location.href = "dashboard.html";
        } catch (error) {
            console.error("Proses Google Gagal:", error);
            alert("Gagal mendaftar lewat Google: " + error.message);
        }
    });
}
