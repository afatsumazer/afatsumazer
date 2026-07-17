import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {

        const docRef = doc(db, "users", user.uid);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            alert("Data pengguna tidak ditemukan.");
            return;
        }

        const data = snap.data();

        // Tampilkan data ke dashboard
        document.getElementById("nama").textContent = data.fullname;
        document.getElementById("email").textContent = data.email;
        document.getElementById("role").textContent = data.role;

        document.getElementById("saldo").textContent =
            "Rp " + (data.saldo || 0).toLocaleString("id-ID");

        document.getElementById("project").textContent =
            data.totalProject || 0;

        document.getElementById("client").textContent =
            data.totalClient || 0;

        document.getElementById("income").textContent =
            "Rp " + (data.totalIncome || 0).toLocaleString("id-ID");

    } catch (err) {

        console.error(err);

    }

});

// Tombol Logout
const logoutBtn = document.getElementById("logout");

if (logoutBtn) {

    logoutBtn.addEventListener("click", async () => {

        await signOut(auth);

        localStorage.clear();

        window.location.href = "login.html";

    });

}
