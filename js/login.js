import { auth } from "./firebase-config.js";
import { 
    signInWithEmailAndPassword, 
    setPersistence, 
    browserLocalPersistence 
} from "https://gstatic.com";

const loginForm = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');

if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (errorMsg) errorMsg.innerText = '';

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        // MEMAKSA SESI TETAP TERSIMPAN DI BROWSER SAAT BERPINDAH HALAMAN
        setPersistence(auth, browserLocalPersistence)
            .then(() => {
                // Setelah sesi dikunci di browser, lakukan login
                return signInWithEmailAndPassword(auth, email, password);
            })
            .then(() => {
                console.log("Login sukses, mengalihkan...");
                window.location.href = 'dashboard.html';
            })
            .catch((error) => {
                console.error("Gagal Masuk:", error.code, error.message);
                if (errorMsg) {
                    if (error.code === 'auth/invalid-credential') {
                        errorMsg.innerText = 'Email atau password Anda salah.';
                    } else if (error.code === 'auth/operation-not-allowed') {
                        errorMsg.innerText = 'Fitur Email/Password belum diaktifkan di Firebase Console!';
                    } else {
                        errorMsg.innerText = 'Error: ' + error.message;
                    }
                }
            });
    });
}
