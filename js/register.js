import { auth, db } from "./firebase-config.js";

import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const form = document.getElementById("registerForm");
const loading = document.getElementById("loading");
const error = document.getElementById("error");
const success = document.getElementById("success");

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    error.textContent = "";
    success.textContent = "";
    loading.style.display = "block";

    const fullname = document.getElementById("fullname").value.trim();
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const role = document.getElementById("role").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
        loading.style.display = "none";
        error.textContent = "Konfirmasi password tidak sama.";
        return;
    }

    try {

        // Membuat akun Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );

        const user = userCredential.user;

        // Menyimpan data pengguna ke Firestore
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            fullname: fullname,
            username: username,
            email: email,
            phone: phone,
            role: role,

            saldo: 0,
            totalIncome: 0,
            totalProject: 0,
            totalClient: 0,

            status: "active",

            createdAt: serverTimestamp()
        });

        loading.style.display = "none";

        success.textContent = "Pendaftaran berhasil. Mengalihkan...";

        setTimeout(() => {

            window.location.href = "dashboard.html";

        }, 1500);

    } catch (err) {

        loading.style.display = "none";

        switch (err.code) {

            case "auth/email-already-in-use":
                error.textContent = "Email sudah digunakan.";
                break;

            case "auth/invalid-email":
                error.textContent = "Format email tidak valid.";
                break;

            case "auth/weak-password":
                error.textContent = "Password minimal 6 karakter.";
                break;

            default:
                error.textContent = err.message;

        }

    }

});
