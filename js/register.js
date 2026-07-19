// Mengimpor modul Firebase yang diperlukan dari CDN resmi
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Konfigurasi Firebase milik Anda
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

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Menghubungkan elemen HTML
const registerForm = document.getElementById('registerForm');
const messageDiv = document.getElementById('message');

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    messageDiv.style.color = "blue";
    messageDiv.textContent = "Sedang mendaftarkan...";

    try {
        // 1. Daftarkan pengguna baru di Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Perbarui data nama profil pengguna di Firebase Auth
        await updateProfile(user, {
            displayName: fullName
        });

        // 3. Simpan data tambahan ke Firebase Realtime Database Anda
        await set(ref(db, 'users/' + user.uid), {
            uid: user.uid,
            name: fullName,
            email: email,
            createdAt: new Date().toISOString()
        });

        messageDiv.style.color = "green";
        messageDiv.textContent = "Registrasi berhasil!";
        registerForm.reset();

    } catch (error) {
        console.error("Registrasi gagal:", error);
        messageDiv.style.color = "red";
        
        // Penanganan error sederhana untuk pengguna
        if (error.code === 'auth/email-already-in-use') {
            messageDiv.textContent = "Email ini sudah terdaftar.";
        } else if (error.code === 'auth/weak-password') {
            messageDiv.textContent = "Password terlalu lemah (min. 6 karakter).";
        } else if (error.code === 'auth/invalid-email') {
            messageDiv.textContent = "Format email salah.";
        } else {
            messageDiv.textContent = "Error: " + error.message;
        }
    }
});
