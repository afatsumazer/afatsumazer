import { auth } from "/js/firebase-config.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://gstatic.com";

document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById('registerForm');
    const errorMsg = document.getElementById('errorMsg');
    const successMsg = document.getElementById('successMsg');

    if (!registerForm) {
        console.error("Elemen form 'registerForm' tidak ditemukan di HTML!");
        return;
    }

    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (errorMsg) errorMsg.innerText = '';
        if (successMsg) successMsg.innerText = 'Sedang mendaftarkan akun...';

        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;

        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Menyimpan nama lengkap ke database profil Firebase
                return updateProfile(userCredential.user, { displayName: name });
            })
            .then(() => {
                if (successMsg) successMsg.innerText = 'Akun berhasil dibuat! Mengalihkan...';
                window.location.replace('dashboard.html');
            })
            .catch((error) => {
                console.error("Firebase Reg Error:", error.code);
                if (successMsg) successMsg.innerText = '';
                if (errorMsg) {
                    if (error.code === 'auth/email-already-in-use') {
                        errorMsg.innerText = 'Email ini sudah digunakan oleh akun lain.';
                    } else {
                        errorMsg.innerText = 'Gagal mendaftar: ' + error.message;
                    }
                }
            });
    });
});
