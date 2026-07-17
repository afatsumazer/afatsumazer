import { auth } from "./firebase-config.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://gstatic.com";

const registerForm = document.getElementById('registerForm');
const errorMsg = document.getElementById('errorMsg');
const successMsg = document.getElementById('successMsg');

registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    errorMsg.innerText = '';
    successMsg.innerText = '';

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Setelah akun terbuat, simpan nama lengkap ke profil Firebase pengguna
            updateProfile(userCredential.user, {
                displayName: name
            }).then(() => {
                successMsg.innerText = 'Pendaftaran berhasil! Mengalihkan...';
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            });
        })
        .catch((error) => {
            console.error(error.code);
            if (error.code === 'auth/email-already-in-use') {
                errorMsg.innerText = 'Email sudah terdaftar. Gunakan email lain.';
            } else {
                errorMsg.innerText = 'Gagal mendaftar: ' + error.message;
            }
        });
});
