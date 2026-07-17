import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://gstatic.com";

const loginForm = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    errorMsg.innerText = '';

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            // Berhasil login, arahkan langsung ke dashboard
            window.location.href = 'dashboard.html';
        })
        .catch((error) => {
            console.error(error.code);
            errorMsg.innerText = 'Email atau password salah. Silakan coba lagi.';
        });
});
