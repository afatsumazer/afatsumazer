import { onAuthStateChanged, signOut } from "https://gstatic.com";
import { ref, get, update } from "https://gstatic.com";
import { auth, database } from "./firebase-config.js";

// 1. PROTEKSI HALAMAN & AMBIL DATA
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Ambil data profil dari Realtime Database berdasarkan UID pengguna
        get(ref(database, 'users/' + user.uid)).then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                // Perbarui elemen UI Dashboard dengan data asli dari database
                document.getElementById('header-user-name').innerText = data.fullName;
                if(document.getElementById('input-name')) document.getElementById('input-name').value = data.fullName;
                if(document.getElementById('input-email')) document.getElementById('input-email').value = data.email;
                if(document.getElementById('input-phone')) document.getElementById('input-phone').value = data.phone;
            }
        });
    } else {
        // Jika tidak ada user terlogin, tendang kembali ke halaman login
        window.location.href = 'login.html';
    }
});

// 2. FUNGSI UPDATE PROFIL KE DATABASE
const profileForm = document.getElementById('profileForm');
if (profileForm) {
    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (user) {
            const updatedName = document.getElementById('input-name').value;
            const updatedPhone = document.getElementById('input-phone').value;

            update(ref(database, 'users/' + user.uid), {
                fullName: updatedName,
                phone: updatedPhone
            }).then(() => {
                document.getElementById('header-user-name').innerText = updatedName;
                alert('Profil di database berhasil diperbarui!');
            });
        }
    });
}

// 3. FUNGSI LOGOUT
window.logoutSistem = function() {
    signOut(auth).then(() => {
        window.location.href = 'login.html';
    });
}
