import { auth, db } from "./firebase-config.js";

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const form = document.getElementById("loginForm");
const loading = document.getElementById("loading");
const error = document.getElementById("error");

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    loading.style.display = "block";
    error.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {

        // Login ke Firebase
        const result = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        const uid = result.user.uid;

        // Ambil data user
        const userRef = doc(db, "users", uid);
        const snap = await getDoc(userRef);

        loading.style.display = "none";

        if (!snap.exists()) {

            error.textContent = "Data pengguna tidak ditemukan.";

            return;

        }

        const data = snap.data();

        // Simpan data user agar tidak perlu mengambil ulang
        localStorage.setItem("user", JSON.stringify(data));

        // Redirect sesuai role
        switch (data.role) {

            case "admin":
                window.location.href = "admin.html";
                break;

            case "client":
                window.location.href = "client.html";
                break;

            default:
                window.location.href = "dashboard.html";
                break;

        }

    } catch (err) {

        loading.style.display = "none";

        switch (err.code) {

            case "auth/invalid-credential":
                error.textContent = "Email atau password salah.";
                break;

            case "auth/user-disabled":
                error.textContent = "Akun dinonaktifkan.";
                break;

            case "auth/too-many-requests":
                error.textContent = "Terlalu banyak percobaan login. Coba lagi nanti.";
                break;

            default:
                error.textContent = err.message;
        }

    }

});
