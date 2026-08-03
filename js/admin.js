// js/admin.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, get, set, push, remove, onValue, runTransaction, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
// Firestore dipakai KHUSUS untuk data Order Review — semua data lain (users, misi,
// voucher, menu cepat) tetap di Realtime Database seperti semula, tidak diubah.
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, onSnapshot as onFirestoreSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Konfigurasi sama persis dengan js/dashboard.js — satu project Firebase yang sama
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
const database = getDatabase(app);
const firestore = getFirestore(app);

let adminUID = null;
let allUsersCache = {};
let selectedUserUID = null;

function showToast(msg) {
    const el = document.getElementById('admin-toast');
    el.textContent = msg;
    el.classList.remove('-bottom-16');
    el.classList.add('bottom-6');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
        el.classList.remove('bottom-6');
        el.classList.add('-bottom-16');
    }, 1800);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, "&#39;");
}

// Menyisakan digit saja dari input nomor WA admin (mendukung format
// "+62 852-1507-9324", "0852...", dsb — disimpan tanpa karakter selain angka)
function bersihkanNomorWA(nomor) {
    return String(nomor || '').replace(/[^0-9]/g, '');
}

// ================= 1. GERBANG AKSES ADMIN =================
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const profileRef = ref(database, `users/${user.uid}/profile`);
    get(profileRef).then((snapshot) => {
        const profile = snapshot.exists() ? snapshot.val() : {};
        document.getElementById('access-checking').classList.add('hidden');

        if (profile.isAdmin === true) {
            adminUID = user.uid;
            document.getElementById('admin-content').classList.remove('hidden');
            loadMissions();
            loadVouchers();
            loadAllUsers();
            loadQuickMenu();
            loadOrderReview();
            loadArticles();
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

window.adminLogout = function() {
    if (confirm('Keluar dari panel admin?')) {
        signOut(auth).then(() => window.location.href = "login.html");
    }
};

// ================= 2. NAVIGASI SUB-TAB =================
window.switchAdminTab = function(tabName) {
    const tabs = ['missions', 'vouchers', 'users', 'quickmenu', 'orderreview', 'articles'];
    tabs.forEach(t => {
        const section = document.getElementById(`admin-tab-${t}`);
        if (section) section.classList.add('hidden');
        const btn = document.getElementById(`admin-tab-btn-${t}`);
        if (btn) {
            btn.classList.remove('bg-indigo-900', 'text-white');
            btn.classList.add('bg-white', 'text-gray-600', 'border', 'border-gray-200');
        }
    });
    document.getElementById(`admin-tab-${tabName}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`admin-tab-btn-${tabName}`);
    activeBtn.classList.add('bg-indigo-900', 'text-white');
    activeBtn.classList.remove('bg-white', 'text-gray-600', 'border', 'border-gray-200');
};

// ================= 3. KELOLA MISI HARIAN =================
function loadMissions() {
    onValue(ref(database, 'config/missions'), (snapshot) => {
        const container = document.getElementById('missions-list');
        const data = snapshot.val() || {};
        const missions = Object.entries(data).map(([id, m]) => ({ id, ...m }))
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        if (missions.length === 0) {
            container.innerHTML = `<div class="col-span-2 py-6 text-center text-xs text-gray-400">Belum ada misi. Tambahkan lewat form di atas.</div>`;
            return;
        }

        container.innerHTML = missions.map(m => {
            const isStreak = m.type === 'streak';
            const pointsInfo = isStreak
                ? `Base ${m.basePoints || 0} poin &middot; +${m.increment || 0}/hari &middot; urutan ${m.order || 0}`
                : `+${m.points || 0} poin &middot; urutan ${m.order || 0}`;
            const typeBadge = isStreak
                ? `<span class="inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 mr-1">STREAK HARIAN</span>`
                : '';

            return `
            <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-start justify-between gap-3">
                <div class="flex items-start space-x-3 min-w-0">
                    <div class="text-xl">${m.icon || '🎯'}</div>
                    <div class="min-w-0">
                        <div class="text-xs font-extrabold text-gray-800">${escapeHtml(m.label)}</div>
                        <div class="text-[10px] font-bold text-indigo-500 mt-0.5">${pointsInfo}</div>
                        <div>
                            ${typeBadge}
                            <span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full ${m.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}">
                                ${m.active !== false ? 'AKTIF' : 'NONAKTIF'}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col gap-1.5 shrink-0">
                    <button onclick="toggleMissionActive('${m.id}', ${m.active !== false})" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg ${m.active !== false ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}">
                        ${m.active !== false ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button onclick="editMission('${m.id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200">Edit</button>
                    <button onclick="deleteMission('${m.id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">Hapus</button>
                </div>
            </div>
        `;
        }).join('');

        // Simpan cache mentah supaya editMission() bisa ambil data lengkap tanpa fetch ulang
        loadMissions._cache = data;
    });
}

window.addMission = function() {
    const icon = document.getElementById('mission-icon').value.trim() || '🎯';
    const label = document.getElementById('mission-label').value.trim();
    const order = parseInt(document.getElementById('mission-order').value, 10) || 0;
    const type = document.getElementById('mission-type').value === 'streak' ? 'streak' : 'normal';

    if (!label) { showToast('Nama misi wajib diisi'); return; }

    let missionData = { icon, label, order, active: true, type };

    if (type === 'streak') {
        const basePoints = parseInt(document.getElementById('mission-base-points').value, 10) || 0;
        const increment = parseInt(document.getElementById('mission-increment').value, 10) || 0;
        missionData.basePoints = basePoints;
        missionData.increment = increment;
    } else {
        const points = parseInt(document.getElementById('mission-points').value, 10) || 0;
        missionData.points = points;
    }

    const newRef = push(ref(database, 'config/missions'));
    set(newRef, missionData).then(() => {
        document.getElementById('mission-icon').value = '';
        document.getElementById('mission-label').value = '';
        document.getElementById('mission-points').value = '';
        document.getElementById('mission-base-points').value = '';
        document.getElementById('mission-increment').value = '';
        document.getElementById('mission-order').value = '';
        showToast('Misi ditambahkan');
    }).catch(err => showToast('Gagal: ' + err.message));
};

window.toggleMissionActive = function(id, currentlyActive) {
    update(ref(database, `config/missions/${id}`), { active: !currentlyActive }).then(() => {
        showToast(!currentlyActive ? 'Misi diaktifkan' : 'Misi dinonaktifkan');
    });
};

// Diubah: sekarang hanya butuh id (data lengkap diambil dari cache loadMissions),
// supaya bisa menanyakan field yang berbeda tergantung tipe misi (normal/streak).
window.editMission = function(id) {
    const cache = loadMissions._cache || {};
    const m = cache[id];
    if (!m) { showToast('Data misi tidak ditemukan, coba muat ulang halaman'); return; }

    const newOrder = prompt('Ubah urutan tampil misi ini:', m.order || 0);
    if (newOrder === null) return;

    if (m.type === 'streak') {
        const newBase = prompt('Ubah Base Poin (poin di hari ke-1):', m.basePoints || 0);
        if (newBase === null) return;
        const newInc = prompt('Ubah Kenaikan poin per hari:', m.increment || 0);
        if (newInc === null) return;

        update(ref(database, `config/missions/${id}`), {
            basePoints: parseInt(newBase, 10) || 0,
            increment: parseInt(newInc, 10) || 0,
            order: parseInt(newOrder, 10) || 0
        }).then(() => showToast('Misi diperbarui'));
    } else {
        const newPoints = prompt('Ubah jumlah poin misi ini:', m.points || 0);
        if (newPoints === null) return;

        update(ref(database, `config/missions/${id}`), {
            points: parseInt(newPoints, 10) || 0,
            order: parseInt(newOrder, 10) || 0
        }).then(() => showToast('Misi diperbarui'));
    }
};

window.deleteMission = function(id) {
    if (confirm('Hapus misi ini secara permanen?')) {
        remove(ref(database, `config/missions/${id}`)).then(() => showToast('Misi dihapus'));
    }
};

// ================= 4. KELOLA VOUCHER =================
function loadVouchers() {
    onValue(ref(database, 'config/vouchers'), (snapshot) => {
        const container = document.getElementById('vouchers-list');
        const data = snapshot.val() || {};
        const vouchers = Object.entries(data).map(([id, v]) => ({ id, ...v }))
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        if (vouchers.length === 0) {
            container.innerHTML = `<div class="col-span-2 py-6 text-center text-xs text-gray-400">Belum ada voucher. Tambahkan lewat form di atas.</div>`;
            return;
        }

        container.innerHTML = vouchers.map(v => `
            <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <div class="text-xs font-extrabold text-gray-800">${escapeHtml(v.label)}</div>
                    <div class="text-[10px] font-bold text-amber-500 mt-0.5">${(v.cost || 0).toLocaleString('id-ID')} poin &middot; urutan ${v.order || 0}</div>
                    <div class="text-[10px] font-semibold text-gray-500 mt-0.5">
                        ${v.link ? `🔗 Link: ${escapeHtml(v.link)}` : `📱 WA: ${v.whatsapp ? escapeHtml(v.whatsapp) : '<span class="italic text-gray-400">nomor default</span>'}`}
                    </div>
                    <span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full ${v.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}">
                        ${v.active !== false ? 'AKTIF' : 'NONAKTIF'}
                    </span>
                </div>
                <div class="flex flex-col gap-1.5 shrink-0">
                    <button onclick="toggleVoucherActive('${v.id}', ${v.active !== false})" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg ${v.active !== false ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}">
                        ${v.active !== false ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button onclick="editVoucher('${v.id}', ${v.cost || 0}, ${v.order || 0}, '${escapeHtml(v.whatsapp || '')}', '${escapeHtml(v.link || '')}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200">Edit</button>
                    <button onclick="deleteVoucher('${v.id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">Hapus</button>
                </div>
            </div>
        `).join('');
    });
}

window.addVoucher = function() {
    const label = document.getElementById('voucher-label').value.trim();
    const cost = parseInt(document.getElementById('voucher-cost').value, 10) || 0;
    const order = parseInt(document.getElementById('voucher-order').value, 10) || 0;
    const whatsapp = bersihkanNomorWA(document.getElementById('voucher-whatsapp').value);
    const link = document.getElementById('voucher-link').value.trim();

    if (!label) { showToast('Nama voucher wajib diisi'); return; }

    const newRef = push(ref(database, 'config/vouchers'));
    set(newRef, { label, cost, order, active: true, whatsapp, link }).then(() => {
        document.getElementById('voucher-label').value = '';
        document.getElementById('voucher-cost').value = '';
        document.getElementById('voucher-order').value = '';
        document.getElementById('voucher-whatsapp').value = '';
        document.getElementById('voucher-link').value = '';
        showToast('Voucher ditambahkan');
    }).catch(err => showToast('Gagal: ' + err.message));
};

window.toggleVoucherActive = function(id, currentlyActive) {
    update(ref(database, `config/vouchers/${id}`), { active: !currentlyActive }).then(() => {
        showToast(!currentlyActive ? 'Voucher diaktifkan' : 'Voucher dinonaktifkan');
    });
};

window.editVoucher = function(id, currentCost, currentOrder, currentWhatsapp, currentLink) {
    const newCost = prompt('Ubah harga voucher ini (poin):', currentCost);
    if (newCost === null) return;
    const newOrder = prompt('Ubah urutan tampil voucher ini:', currentOrder);
    if (newOrder === null) return;
    const newWhatsapp = prompt('Nomor WhatsApp tujuan klaim voucher ini (kosongkan untuk pakai nomor default):', currentWhatsapp || '');
    if (newWhatsapp === null) return;
    const newLink = prompt('Link kustom tujuan klaim voucher ini (kosongkan untuk pakai WhatsApp):', currentLink || '');
    if (newLink === null) return;

    update(ref(database, `config/vouchers/${id}`), {
        cost: parseInt(newCost, 10) || 0,
        order: parseInt(newOrder, 10) || 0,
        whatsapp: bersihkanNomorWA(newWhatsapp),
        link: newLink.trim()
    }).then(() => showToast('Voucher diperbarui'));
};

window.deleteVoucher = function(id) {
    if (confirm('Hapus voucher ini secara permanen?')) {
        remove(ref(database, `config/vouchers/${id}`)).then(() => showToast('Voucher dihapus'));
    }
};

// ================= 5. KELOLA PENGGUNA (SALDO POIN & LENCANA) =================
// Catatan: pencarian bekerja dari data yang ada di node "users" (nama & username),
// bukan dari daftar akun Firebase Auth (SDK client tidak bisa mengambil itu).
function loadAllUsers() {
    get(ref(database, 'users')).then((snapshot) => {
        allUsersCache = snapshot.val() || {};
    }).catch(err => showToast('Gagal memuat daftar pengguna: ' + err.message));
}

window.filterUsers = function() {
    const q = document.getElementById('user-search-input').value.trim().toLowerCase();
    const resultsEl = document.getElementById('user-search-results');

    if (!q) { resultsEl.innerHTML = ''; return; }

    const matches = Object.entries(allUsersCache).filter(([uid, u]) => {
        const p = u.profile || {};
        return (p.name || '').toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q) || uid.toLowerCase().includes(q);
    }).slice(0, 20);

    if (matches.length === 0) {
        resultsEl.innerHTML = `<div class="text-xs text-gray-400 py-2">Tidak ada pengguna cocok.</div>`;
        return;
    }

    resultsEl.innerHTML = matches.map(([uid, u]) => {
        const p = u.profile || {};
        return `
            <button onclick="openUserDetail('${uid}')" class="w-full flex items-center gap-3 text-left p-2.5 rounded-xl hover:bg-gray-50 border border-gray-100 transition">
                <img src="${p.photo || 'https://via.placeholder.com/150'}" class="w-8 h-8 rounded-full object-cover">
                <div class="min-w-0">
                    <div class="text-xs font-bold text-gray-800 truncate">${escapeHtml(p.name || 'Tanpa nama')}</div>
                    <div class="text-[10px] text-gray-400 truncate">${escapeHtml(p.username || uid)}</div>
                </div>
            </button>
        `;
    }).join('');
};

window.openUserDetail = function(uid) {
    selectedUserUID = uid;
    const u = allUsersCache[uid] || {};
    const p = u.profile || {};
    const rewards = u.rewards || {};
    const badges = u.badges || {};

    document.getElementById('user-detail-panel').classList.remove('hidden');
    document.getElementById('user-detail-avatar').src = p.photo || 'https://via.placeholder.com/150';
    document.getElementById('user-detail-name').textContent = p.name || 'Tanpa nama';
    document.getElementById('user-detail-username').textContent = p.username || uid;
    document.getElementById('user-detail-points').textContent = (rewards.points || 0).toLocaleString('id-ID');

    const badgesEl = document.getElementById('user-detail-badges');
    const badgeEntries = Object.entries(badges);
    badgesEl.innerHTML = badgeEntries.length === 0
        ? `<span class="text-[10px] text-gray-400 italic">Belum ada lencana</span>`
        : badgeEntries.map(([bid, b]) => `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                <span>${b.icon || '🏅'}</span><span>${escapeHtml(b.label)}</span>
                <button onclick="removeBadge('${bid}')" class="text-indigo-400 hover:text-red-500 ml-0.5">✕</button>
            </span>
        `).join('');

    loadUserFilesForAdmin(uid);
};

// Format ukuran file (Bytes/KB/MB) untuk ditampilkan di panel admin
function formatBytesAdmin(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Muat & tampilkan daftar berkas milik pengguna yang dipilih, dengan tombol hapus.
// Berguna untuk membersihkan berkas "hantu"/lama yang bikin kuota tampak terpakai
// padahal pengguna merasa tidak pernah unggah apa-apa baru-baru ini.
function loadUserFilesForAdmin(uid) {
    const container = document.getElementById('user-detail-files');
    const storageLabel = document.getElementById('user-detail-storage');
    if (!container) return;

    container.innerHTML = `<p class="text-xs text-gray-400 italic py-2">Memuat berkas...</p>`;

    get(ref(database, `users/${uid}/files`)).then((snapshot) => {
        if (selectedUserUID !== uid) return; // pengguna sudah diganti sebelum data ini selesai dimuat

        if (!snapshot.exists()) {
            container.innerHTML = `<p class="text-xs text-gray-400 italic py-2">Pengguna ini belum punya berkas.</p>`;
            if (storageLabel) storageLabel.textContent = '0 MB terpakai';
            return;
        }

        const data = snapshot.val();
        let totalBytes = 0;
        const rows = Object.entries(data).map(([fileId, f]) => {
            totalBytes += f.size || 0;
            return `
                <div class="flex items-center justify-between gap-2 border border-gray-100 rounded-lg px-3 py-2">
                    <div class="min-w-0">
                        <div class="text-xs font-semibold text-gray-700 truncate">${escapeHtml(f.name || 'Tanpa nama')}</div>
                        <div class="text-[10px] text-gray-400">${formatBytesAdmin(f.size)} ${f.isPublic ? '· <span class="text-emerald-600 font-bold">Publik</span>' : ''}</div>
                    </div>
                    <button onclick="adminDeleteUserFile('${uid}', '${fileId}', ${f.isPublic === true})" class="shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">Hapus</button>
                </div>
            `;
        }).join('');

        container.innerHTML = rows;
        if (storageLabel) storageLabel.textContent = `${(totalBytes / (1024*1024)).toFixed(2)} MB terpakai`;
    }).catch(err => {
        container.innerHTML = `<p class="text-xs text-red-500">Gagal memuat berkas: ${err.message}</p>`;
    });
}

// Hapus satu berkas milik pengguna dari admin panel (dan dari node "shared" juga
// kalau berkas itu publik) — dipakai untuk membersihkan kuota yang salah kepakai.
window.adminDeleteUserFile = function(uid, fileId, isPublic) {
    if (!confirm('Hapus berkas ini secara permanen dari akun pengguna?')) return;

    remove(ref(database, `users/${uid}/files/${fileId}`)).then(() => {
        if (isPublic) {
            return remove(ref(database, `shared/${fileId}`));
        }
    }).then(() => {
        showToast('Berkas dihapus');
        if (selectedUserUID === uid) loadUserFilesForAdmin(uid);
    }).catch(err => showToast('Gagal menghapus: ' + err.message));
};

// ================= 6. KELOLA MENU CEPAT (FAB - LINK KUSTOM) =================
function loadQuickMenu() {
    onValue(ref(database, 'config/quickMenu'), (snapshot) => {
        const container = document.getElementById('quickmenu-list');
        if (!container) return;
        const data = snapshot.val() || {};
        const items = Object.entries(data).map(([id, q]) => ({ id, ...q }))
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        loadQuickMenu._cache = data;

        if (items.length === 0) {
            container.innerHTML = `<div class="col-span-2 py-6 text-center text-xs text-gray-400">Belum ada menu cepat kustom. Tambahkan lewat form di atas.</div>`;
            return;
        }

        container.innerHTML = items.map(q => `
            <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-start justify-between gap-3">
                <div class="flex items-start space-x-3 min-w-0">
                    <div class="text-xl">${q.icon || '🔗'}</div>
                    <div class="min-w-0">
                        <div class="text-xs font-extrabold text-gray-800">${escapeHtml(q.label)}</div>
                        <div class="text-[10px] font-semibold text-gray-500 mt-0.5 break-all">${escapeHtml(q.url || '')}</div>
                        <span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full ${q.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}">
                            ${q.active !== false ? 'AKTIF' : 'NONAKTIF'}
                        </span>
                    </div>
                </div>
                <div class="flex flex-col gap-1.5 shrink-0">
                    <button onclick="toggleQuickMenuActive('${q.id}', ${q.active !== false})" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg ${q.active !== false ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}">
                        ${q.active !== false ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button onclick="editQuickMenu('${q.id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200">Edit</button>
                    <button onclick="deleteQuickMenu('${q.id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">Hapus</button>
                </div>
            </div>
        `).join('');
    });
}

window.addQuickMenu = function() {
    const icon = document.getElementById('quickmenu-icon').value.trim() || '🔗';
    const label = document.getElementById('quickmenu-label').value.trim();
    const url = document.getElementById('quickmenu-url').value.trim();
    const order = parseInt(document.getElementById('quickmenu-order').value, 10) || 0;

    if (!label) { showToast('Nama menu wajib diisi'); return; }
    if (!url) { showToast('URL tujuan wajib diisi'); return; }

    const newRef = push(ref(database, 'config/quickMenu'));
    set(newRef, { icon, label, url, order, active: true }).then(() => {
        document.getElementById('quickmenu-icon').value = '';
        document.getElementById('quickmenu-label').value = '';
        document.getElementById('quickmenu-url').value = '';
        document.getElementById('quickmenu-order').value = '';
        showToast('Menu cepat ditambahkan');
    }).catch(err => showToast('Gagal: ' + err.message));
};

window.toggleQuickMenuActive = function(id, currentlyActive) {
    update(ref(database, `config/quickMenu/${id}`), { active: !currentlyActive }).then(() => {
        showToast(!currentlyActive ? 'Menu diaktifkan' : 'Menu dinonaktifkan');
    });
};

window.editQuickMenu = function(id) {
    const cache = loadQuickMenu._cache || {};
    const q = cache[id];
    if (!q) { showToast('Data menu tidak ditemukan, coba muat ulang halaman'); return; }

    const newLabel = prompt('Ubah nama menu:', q.label || '');
    if (newLabel === null) return;
    const newUrl = prompt('Ubah URL tujuan:', q.url || '');
    if (newUrl === null) return;
    const newOrder = prompt('Ubah urutan tampil:', q.order || 0);
    if (newOrder === null) return;

    update(ref(database, `config/quickMenu/${id}`), {
        label: newLabel.trim(),
        url: newUrl.trim(),
        order: parseInt(newOrder, 10) || 0
    }).then(() => showToast('Menu cepat diperbarui'));
};

window.deleteQuickMenu = function(id) {
    if (confirm('Hapus menu cepat ini secara permanen?')) {
        remove(ref(database, `config/quickMenu/${id}`)).then(() => showToast('Menu cepat dihapus'));
    }
};

// ================= 7. KELOLA HALAMAN ORDER REVIEW (CHECKOUT) =================
// Berbeda dari misi/voucher/menu cepat: ini bukan daftar, tapi satu konfigurasi
// tunggal untuk satu halaman. Disimpan di FIRESTORE (koleksi "config", dokumen
// "orderReview") — bukan Realtime Database — sesuai permintaan; data pengguna,
// misi, voucher, dan menu cepat tetap di RTDB seperti semula.
const orderReviewDocRef = doc(firestore, 'config', 'orderReview');

function loadOrderReview() {
    getDoc(orderReviewDocRef).then((snap) => {
        const d = snap.exists() ? snap.data() : {};
        document.getElementById('or-product-name').value = d.productName || '';
        document.getElementById('or-product-price').value = d.productPrice || '';
        document.getElementById('or-product-spec').value = d.productSpec || '';
        document.getElementById('or-product-image').value = d.productImage || '';
        document.getElementById('or-addon-name').value = d.addonName || '';
        document.getElementById('or-addon-price').value = d.addonPrice || '';
        document.getElementById('or-addon-desc').value = d.addonDesc || '';
        document.getElementById('or-addon-note').value = d.addonNote || '';
        document.getElementById('or-shipping-label').value = d.shippingLabel || 'Free';
        document.getElementById('or-checkout-label').value = d.checkoutLabel || 'Continue to Payment';
        document.getElementById('or-checkout-link').value = d.checkoutLink || '';
        document.getElementById('or-checkout-qr').value = d.checkoutQr || '';
        document.getElementById('or-notify-whatsapp').value = d.notifyWhatsapp || '';
    }).catch(err => showToast('Gagal memuat data order review: ' + err.message));
}

window.saveOrderReview = function() {
    const data = {
        productName: document.getElementById('or-product-name').value.trim(),
        productPrice: parseFloat(document.getElementById('or-product-price').value) || 0,
        productSpec: document.getElementById('or-product-spec').value.trim(),
        productImage: document.getElementById('or-product-image').value.trim(),
        addonName: document.getElementById('or-addon-name').value.trim(),
        addonPrice: parseFloat(document.getElementById('or-addon-price').value) || 0,
        addonDesc: document.getElementById('or-addon-desc').value.trim(),
        addonNote: document.getElementById('or-addon-note').value.trim(),
        shippingLabel: document.getElementById('or-shipping-label').value.trim() || 'Free',
        checkoutLabel: document.getElementById('or-checkout-label').value.trim() || 'Continue to Payment',
        checkoutLink: document.getElementById('or-checkout-link').value.trim(),
        checkoutQr: document.getElementById('or-checkout-qr').value.trim(),
        notifyWhatsapp: bersihkanNomorWA(document.getElementById('or-notify-whatsapp').value),
        updatedAt: Date.now(),
        updatedBy: adminUID
    };

    if (!data.productName) { showToast('Nama produk wajib diisi'); return; }

    setDoc(orderReviewDocRef, data).then(() => {
        showToast('Order review disimpan (Firestore)');
        document.getElementById('or-last-saved').textContent = 'Tersimpan ' + new Date().toLocaleString('id-ID');
    }).catch(err => showToast('Gagal: ' + err.message));
};

// Refresh live saat panel user sedang terbuka (opsional tapi berguna jika saldo berubah dari sisi lain)
function refreshSelectedUserIfOpen(uid) {
    if (selectedUserUID === uid) {
        get(ref(database, `users/${uid}`)).then(snap => {
            allUsersCache[uid] = snap.val() || {};
            openUserDetail(uid);
        });
    }
}

window.adjustUserPoints = function(sign) {
    if (!selectedUserUID) return;
    const amount = parseInt(document.getElementById('user-points-amount').value, 10);
    if (!amount || amount <= 0) { showToast('Masukkan jumlah poin yang valid'); return; }

    const delta = sign * amount;
    const pointsRef = ref(database, `users/${selectedUserUID}/rewards/points`);

    runTransaction(pointsRef, (current) => Math.max(0, (current || 0) + delta)).then(() => {
        document.getElementById('user-points-amount').value = '';
        showToast(sign > 0 ? `+${amount} poin ditambahkan` : `-${amount} poin dikurangi`);
        refreshSelectedUserIfOpen(selectedUserUID);
    }).catch(err => showToast('Gagal: ' + err.message));
};

window.giveBadge = function() {
    if (!selectedUserUID) return;
    const icon = document.getElementById('badge-icon').value.trim() || '🏅';
    const label = document.getElementById('badge-label').value.trim();
    if (!label) { showToast('Nama lencana wajib diisi'); return; }

    const newRef = push(ref(database, `users/${selectedUserUID}/badges`));
    set(newRef, { icon, label, awardedAt: Date.now(), awardedBy: adminUID }).then(() => {
        document.getElementById('badge-icon').value = '';
        document.getElementById('badge-label').value = '';
        showToast('Lencana diberikan');
        refreshSelectedUserIfOpen(selectedUserUID);
    }).catch(err => showToast('Gagal: ' + err.message));
};

window.removeBadge = function(badgeId) {
    if (!selectedUserUID) return;
    if (confirm('Cabut lencana ini dari pengguna?')) {
        remove(ref(database, `users/${selectedUserUID}/badges/${badgeId}`)).then(() => {
            showToast('Lencana dicabut');
            refreshSelectedUserIfOpen(selectedUserUID);
        });
    }
};

// ================= 8. KELOLA ARTIKEL (TAYANG DI domain.com/slug) =================
// Disimpan di FIRESTORE, koleksi "articles", dengan ID DOKUMEN = SLUG.
// Memakai slug sebagai document id (bukan id random dari push()) supaya halaman
// publik (p/index.html + 404.html) bisa langsung getDoc(articles/{slug}) tanpa query.
const articlesCollectionRef = collection(firestore, 'articles');
let editingArticleSlug = null; // null = mode tambah baru; diisi slug asli kalau sedang edit

function slugifyArticle(text) {
    return String(text || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

window.onArticleTitleInput = function() {
    if (editingArticleSlug) return; // saat edit, slug tidak diubah otomatis oleh judul
    const title = document.getElementById('article-title').value;
    document.getElementById('article-slug').value = slugifyArticle(title);
    updateArticleSlugPreview();
};

window.updateArticleSlugPreview = function() {
    const slug = document.getElementById('article-slug').value || 'judul-artikel';
    document.getElementById('article-slug-preview').textContent = `/${slug}`;
};

function statusBadgeArticle(status) {
    if (status === 'published') return `<span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">TAYANG</span>`;
    if (status === 'pending') return `<span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">MENUNGGU REVIEW</span>`;
    if (status === 'rejected') return `<span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">DITOLAK</span>`;
    return `<span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">DRAFT</span>`;
}

function loadArticles() {
    onFirestoreSnapshot(articlesCollectionRef, (snapshot) => {
        const container = document.getElementById('articles-list');
        if (!container) return;

        if (snapshot.empty) {
            container.innerHTML = `<div class="col-span-2 py-6 text-center text-xs text-gray-400">Belum ada artikel. Tambahkan lewat form di atas.</div>`;
            return;
        }

        const items = [];
        snapshot.forEach(docSnap => items.push({ slug: docSnap.id, ...docSnap.data() }));
        // Yang menunggu review naik ke atas supaya tidak terlewat oleh admin
        items.sort((a, b) => {
            const rank = { pending: 0, draft: 1, published: 2, rejected: 3 };
            const ra = rank[a.status] ?? 1, rb = rank[b.status] ?? 1;
            if (ra !== rb) return ra - rb;
            return (a.order || 0) - (b.order || 0);
        });

        // Cache mentah supaya tombol Edit tidak perlu fetch ulang ke Firestore
        loadArticles._cache = {};
        items.forEach(a => loadArticles._cache[a.slug] = a);

        container.innerHTML = items.map(a => `
            <div class="bg-white p-4 rounded-2xl border ${a.status === 'pending' ? 'border-amber-300' : 'border-gray-200'} shadow-sm flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <div class="text-xs font-extrabold text-gray-800">${escapeHtml(a.title)}</div>
                    <div class="text-[10px] font-semibold text-indigo-500 mt-0.5 break-all">/${escapeHtml(a.slug)}</div>
                    ${a.authorName ? `<div class="text-[10px] text-gray-400 mt-0.5">Oleh: ${escapeHtml(a.authorName)}</div>` : ''}
                    ${statusBadgeArticle(a.status)}
                </div>
                <div class="flex flex-col gap-1.5 shrink-0">
                    ${a.status === 'pending' ? `
                        <button onclick="approveArticle('${a.slug}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Setujui</button>
                        <button onclick="rejectArticle('${a.slug}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">Tolak</button>
                    ` : ''}
                    <button onclick="editArticle('${a.slug}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200">Edit</button>
                    <button onclick="deleteArticle('${a.slug}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">Hapus</button>
                </div>
            </div>
        `).join('');
    }, err => showToast('Gagal memuat artikel: ' + err.message));
}

window.approveArticle = function(slug) {
    setDoc(doc(articlesCollectionRef, slug), { status: 'published', reviewedAt: serverTimestamp(), reviewedBy: adminUID }, { merge: true })
        .then(() => showToast('Artikel disetujui dan tayang'))
        .catch(err => showToast('Gagal: ' + err.message));
};

window.rejectArticle = function(slug) {
    if (!confirm('Tolak artikel ini? Penulis akan melihat statusnya sebagai "Ditolak".')) return;
    setDoc(doc(articlesCollectionRef, slug), { status: 'rejected', reviewedAt: serverTimestamp(), reviewedBy: adminUID }, { merge: true })
        .then(() => showToast('Artikel ditolak'))
        .catch(err => showToast('Gagal: ' + err.message));
};

window.saveArticle = function() {
    const title = document.getElementById('article-title').value.trim();
    const slug = slugifyArticle(document.getElementById('article-slug').value);
    const cover = document.getElementById('article-cover').value.trim();
    const content = document.getElementById('article-content').value;
    const status = document.getElementById('article-status').value;
    const order = parseInt(document.getElementById('article-order').value, 10) || 0;

    if (!title) { showToast('Judul artikel wajib diisi'); return; }
    if (!slug) { showToast('Slug wajib diisi (dipakai sebagai alamat /...)'); return; }

    const data = {
        title, slug, cover, content, status, order,
        updatedAt: serverTimestamp(),
        updatedBy: adminUID
    };

    const isRenaming = editingArticleSlug && editingArticleSlug !== slug;

    // Slug tidak berubah -> tulis langsung ke dokumen yang sama (create atau update)
    if (!editingArticleSlug || !isRenaming) {
        if (!editingArticleSlug) data.createdAt = serverTimestamp();
        setDoc(doc(articlesCollectionRef, slug), data, { merge: true }).then(() => {
            showToast(editingArticleSlug ? 'Artikel diperbarui' : 'Artikel ditambahkan');
            resetArticleForm();
        }).catch(err => showToast('Gagal: ' + err.message));
        return;
    }

    // Slug berubah saat edit -> buat dokumen baru dengan slug baru, hapus dokumen lama
    data.createdAt = (loadArticles._cache && loadArticles._cache[editingArticleSlug] && loadArticles._cache[editingArticleSlug].createdAt) || serverTimestamp();
    setDoc(doc(articlesCollectionRef, slug), data).then(() => {
        return deleteDoc(doc(articlesCollectionRef, editingArticleSlug));
    }).then(() => {
        showToast('Artikel diperbarui (alamat baru: /' + slug + ')');
        resetArticleForm();
    }).catch(err => showToast('Gagal: ' + err.message));
};

window.editArticle = function(slug) {
    const cache = loadArticles._cache || {};
    const a = cache[slug];
    if (!a) { showToast('Data artikel tidak ditemukan, coba muat ulang halaman'); return; }

    editingArticleSlug = slug;
    document.getElementById('article-form-title').textContent = 'Edit Artikel';
    document.getElementById('article-title').value = a.title || '';
    document.getElementById('article-slug').value = a.slug || '';
    document.getElementById('article-cover').value = a.cover || '';
    document.getElementById('article-content').value = a.content || '';
    document.getElementById('article-status').value = a.status || 'draft';
    document.getElementById('article-order').value = a.order || 0;
    updateArticleSlugPreview();
    document.getElementById('article-cancel-btn').classList.remove('hidden');
    document.getElementById('article-save-btn').textContent = 'Perbarui Artikel';
    window.scrollTo({ top: document.getElementById('admin-tab-articles').offsetTop - 80, behavior: 'smooth' });
};

window.resetArticleForm = function() {
    editingArticleSlug = null;
    document.getElementById('article-form-title').textContent = 'Tulis Artikel Baru';
    document.getElementById('article-title').value = '';
    document.getElementById('article-slug').value = '';
    document.getElementById('article-cover').value = '';
    document.getElementById('article-content').value = '';
    document.getElementById('article-status').value = 'draft';
    document.getElementById('article-order').value = 0;
    updateArticleSlugPreview();
    document.getElementById('article-cancel-btn').classList.add('hidden');
    document.getElementById('article-save-btn').textContent = 'Simpan Artikel';
};

window.deleteArticle = function(slug) {
    if (confirm(`Hapus artikel "/${slug}" secara permanen? Halaman ini akan langsung tidak bisa diakses lagi.`)) {
        deleteDoc(doc(articlesCollectionRef, slug)).then(() => showToast('Artikel dihapus'))
            .catch(err => showToast('Gagal menghapus: ' + err.message));
    }
};
