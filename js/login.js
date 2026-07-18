import { signInWithEmailAndPassword } from "https://gstatic.com";
import { auth } from "./firebase-config.js";
// Menggunakan jalur relatif yang lebih aman untuk server produksi GitHub
import { signInWithEmailAndPassword } from "https://gstatic.com";
import { auth } from "../js/firebase-config.js"; // Diubah menggunakan ../js/ agar mutlak mencari di dalam folder js

const loginForm = document.getElementById('loginForm');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');

if (loginForm) {
    loginForm.addEventListener('submit', function(event) {
        event.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (loadingElement) loadingElement.style.display = 'block';
        if (errorElement) errorElement.innerText = '';

        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                if (loadingElement) loadingElement.style.display = 'none';
                window.location.href = 'dashboard.html';
            })
            .catch((error) => {
                if (loadingElement) loadingElement.style.display = 'none';
                let pesanError = "Email atau password salah.";
                if (error.code === 'auth/invalid-email') pesanError = "Format email salah.";
                if (errorElement) errorElement.innerText = pesanError;
            });
    });
}
