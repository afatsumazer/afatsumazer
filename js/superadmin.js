// js/superadmin.js
// Catatan penting: createUserWithEmailAndPassword otomatis SIGN IN sebagai user baru
// di instance Auth yang dipakai. Supaya sesi Super Admin yang sedang login tidak ikut
// tergusur saat membuat admin institusi baru, proses pembuatan akun dilakukan lewat
// instance Firebase App KEDUA (terpisah) yang khusus dipakai sekali pakai lalu di-signOut.

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

function showToast(msg) {
    const el = document.getElementById('superadmin-toast');
    el.textContent = msg;
    el.classList.remove('-bottom-16');
    el.classList.add('bottom-6');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { el.classList.remove('bottom-6'); el.classList.add('-bottom-16'); }, 2200);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, "&#39;");
}

// ================= GERBANG AKSES SUPER ADMIN =================
onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = "login.html"; return; }

    getDoc(doc(firestore, 'users', user.uid)).then((snap) => {
        const profile = (snap.exists() ? snap.data() : {}).profile || {};
        document.getElementById('access-checking').classList.add('hidden');

        if (profile.peran === 'superadmin') {
            document.getElementById('superadmin-content').classList.remove('hidden');
            loadInstitusiList();
        } else {
            document.getElementById('access-denied').classList.remove('hidden');
            document.getElementById('access-denied').classList.add('flex');
        }
    }).catch(() => {
        document.getElementById('access-checking').classList.add('hidden');
        document.getElementById('access-denied').classList.remove('hidden');
        document.getElementById('access-denied').classList.add('flex');
    });
});

window.superadminLogout = function() {
    if (confirm('Keluar dari Super Admin?')) signOut(auth).then(() => window.location.href = "login.html");
};

// ================= DAFTAR INSTITUSI =================
function loadInstitusiList() {
    onSnapshot(collection(firestore, 'institutions'), (snapshot) => {
        const container = document.getElementById('institusi-list');
        if (snapshot.empty) {
            container.innerHTML = `<div class="py-6 text-center text-xs text-gray-400">Belum ada institusi terdaftar.</div>`;
            return;
        }
        const items = [];
        snapshot.forEach(d => items.push({ id: d.id, ...d.data() }));
        items.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));

        container.innerHTML = items.map(i => `
            <div class="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3">
                <div class="min-w-0">
                    <p class="text-xs font-extrabold text-gray-800 truncate">${escapeHtml(i.nama)}</p>
                    <p class="text-[10px] text-gray-400 truncate">${escapeHtml(i.alamat || '-')}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="text-[9px] font-bold px-2 py-0.5 rounded-full ${i.status === 'aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}">${i.status === 'aktif' ? 'AKTIF' : 'NONAKTIF'}</span>
                    <button onclick="toggleInstitusiStatus('${i.id}', '${i.status}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg ${i.status === 'aktif' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}">
                        ${i.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                </div>
            </div>`).join('');
    }, err => showToast('Gagal memuat institusi: ' + err.message));
}

window.toggleInstitusiStatus = function(id, currentStatus) {
    const newStatus = currentStatus === 'aktif' ? 'nonaktif' : 'aktif';
    if (!confirm(`Ubah status institusi ini menjadi "${newStatus}"?`)) return;
    updateDoc(doc(firestore, 'institutions', id), { status: newStatus }).then(() => showToast('Status institusi diperbarui')).catch(err => showToast('Gagal: ' + err.message));
};

// ================= BUAT INSTITUSI + ADMIN PERTAMA =================
window.createInstitusi = async function() {
    const nama = document.getElementById('inst-nama').value.trim();
    const alamat = document.getElementById('inst-alamat').value.trim();
    const adminNama = document.getElementById('inst-admin-nama').value.trim();
    const adminEmail = document.getElementById('inst-admin-email').value.trim();
    const adminPassword = document.getElementById('inst-admin-password').value;
    const statusEl = document.getElementById('inst-create-status');

    if (!nama) { showToast('Nama institusi wajib diisi'); return; }
    if (!adminNama || !adminEmail || !adminPassword) { showToast('Data admin pertama wajib lengkap'); return; }
    if (adminPassword.length < 6) { showToast('Password minimal 6 karakter'); return; }

    statusEl.textContent = 'Membuat institusi...';

    // 1. Buat dokumen institusi terlebih dulu (id auto)
    let institusiRef;
    try {
        institusiRef = doc(collection(firestore, 'institutions'));
        await setDoc(institusiRef, {
            nama, alamat, status: 'aktif',
            jamMasuk: '08:00', jamPulang: '17:00',
            lokasiKantor: null,
            aturanPotongan: { kelipatanMenit: 15, persenPerKelipatan: 1, maksimalPersen: 50 },
            createdAt: serverTimestamp()
        });
    } catch (err) {
        statusEl.textContent = '';
        showToast('Gagal membuat institusi: ' + err.message);
        return;
    }

    // 2. Buat akun Auth admin pertama LEWAT APP INSTANCE KEDUA supaya sesi Super Admin tidak tergusur
    statusEl.textContent = 'Membuat akun admin...';
    const secondaryApp = initializeApp(firebaseConfig, 'AdminCreatorInstance-' + Date.now());
    const secondaryAuth = getAuth(secondaryApp);

    try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, adminEmail, adminPassword);
        const newAdminUID = cred.user.uid;

        await setDoc(doc(firestore, 'users', newAdminUID), {
            profile: {
                name: adminNama,
                username: adminEmail.split('@')[0],
                institusiId: institusiRef.id,
                peran: 'admin',
                isPremium: false,
                isVerified: true
            },
            rewards: { points: 0 }
        });

        await signOut(secondaryAuth);
        await deleteApp(secondaryApp);

        statusEl.textContent = '';
        showToast(`Institusi "${nama}" & admin pertama berhasil dibuat`);
        ['inst-nama', 'inst-alamat', 'inst-admin-nama', 'inst-admin-email', 'inst-admin-password'].forEach(id => document.getElementById(id).value = '');
    } catch (err) {
        statusEl.textContent = '';
        showToast('Gagal membuat akun admin: ' + err.message);
        await deleteApp(secondaryApp).catch(() => {});
    }
};
