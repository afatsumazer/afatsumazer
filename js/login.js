// Mengimpor fungsi resmi dari Firebase SDK versi modular v10+
import { initializeApp } from "https://gstatic.com";
import { getAuth, signInWithEmailAndPassword } from "https://gstatic.com";

// Konfigurasi Firebase resmi milik aplikasi AFATSUMAZER Anda
const firebaseConfig = {
    apiKey: "AIzaSyDg2b6LERZ2zE86mTiYvUO1Uj--lAtpmgM",
    authDomain: "://firebaseapp.com",
    databaseURL: "https://firebasedatabase.app",
    projectId: "afatsumazer-app",
    storageBucket: "afatsumazer-app.firebasestorage.app",
    messagingSenderId: "16280759060",
    appId: "1:16280759060:web:fd4deacafdf5cadd777001",
    measurementId: "G-WB9YW9D726"
};

// Inisialisasi Firebase & Layanan Auth
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Menangkap elemen HTML dari file login.html Anda
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');

// Event listener saat form login dikirim (di-submit)
loginForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Mencegah reload halaman otomatis

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Menampilkan teks pemuatan dan menghapus pesan error lama
    loadingElement.style.display = 'block';
    errorElement.innerText = '';

    // Proses autentikasi login ke server Firebase
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // LOGIN BERHASIL
            loadingElement.style.display = 'none';
            
            // Mengarahkan pengguna langsung ke halaman utama dashboard Anda
            window.location.href = 'dashboard.html';
        })
        .catch((error) => {
            // LOGIN GAGAL (Email salah, password salah, dll)
            loadingElement.style.display = 'none';
            console.error("Firebase Login Error:", error.code, error.message);
            
            // Menerjemahkan pesan error Firebase ke Bahasa Indonesia agar ramah pengguna
            switch (error.code) {
                case 'auth/invalid-credential':
                    errorElement.innerText = 'Email atau password salah. Silakan periksa kembali.';
                    break;
                case 'auth/user-not-found':
                    errorElement.innerText = 'Akun tidak ditemukan. Silakan daftar terlebih dahulu.';
                    break;
                case 'auth/wrong-password':
                    errorElement.innerText = 'Password yang Anda masukkan salah.';
                    break;
                case 'auth/invalid-email':
                    errorElement.innerText = 'Format email tidak valid.';
                    break;
                case 'auth/too-many-requests':
                    errorElement.innerText = 'Terlalu banyak percobaan masuk gagal. Akun diblokir sementara.';
                    break;
                default:
                    errorElement.innerText = 'Terjadi kesalahan sistem: ' + error.message;
            }
        });
});
