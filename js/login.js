// Menggunakan jalur absolut agar aman di hosting GitHub / eu.org
import { auth } from "/js/firebase-config.js";
import { signInWithEmailAndPassword } from "https://gstatic.com";

// Pastikan skrip menunggu seluruh elemen HTML selesai dimuat
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById('loginForm');
    const errorMsg = document.getElementById('errorMsg');

    if (!loginForm) {
        console.error("Elemen form 'loginForm' tidak ditemukan di HTML!");
        return;
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Menghentikan reload halaman bawaan browser
        
        if (errorMsg) errorMsg.innerText = 'Sedang memproses masuk...';

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        // Eksekusi autentikasi Firebase
        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                console.log("Login sukses!", userCredential.user);
                // Pindah halaman dengan aman
                window.location.replace('dashboard.html');
            })
            .catch((error) => {
                console.error("Firebase Auth Error:", error.code);
                if (errorMsg) {
                    if (error.code === 'auth/invalid-credential') {
                        errorMsg.innerText = 'Email atau password salah.';
                    } else if (error.code === 'auth/operation-not-allowed') {
                        errorMsg.innerText = 'Fitur Email/Password belum aktif di Firebase Console.';
                    } else {
                        errorMsg.innerText = 'Gagal masuk: ' + error.message;
                    }
                }
            });
    });
});
