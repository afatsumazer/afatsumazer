import { createUserWithEmailAndPassword } from "https://gstatic.com";
import { ref, set } from "https://gstatic.com";
import { auth, database } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://gstatic.com";
import { ref, set } from "https://gstatic.com";
import { auth, database } from "../js/firebase-config.js"; // Pastikan mengarah ke ../js/

const registerForm = document.getElementById('registerForm'); // Pastikan id form di register.html adalah 'registerForm'

if (registerForm) {
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const phone = document.getElementById('phone') ? document.getElementById('phone').value.trim() : "-";

        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                
                // Simpan data tambahan (Nama & Telepon) ke Realtime Database
                set(ref(database, 'users/' + user.uid), {
                    fullName: name,
                    email: email,
                    phone: phone,
                    membership: "Premium Member",
                    createdAt: new Date().toISOString()
                }).then(() => {
                    alert('Pendaftaran Berhasil!');
                    window.location.href = 'login.html';
                });
            })
            .catch((error) => {
                alert('Gagal mendaftar: ' + error.message);
            });
    });
}
