// js/admin.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, get, set, push, remove, onValue, runTransaction, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
    const tabs = ['missions', 'vouchers', 'users'];
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

        container.innerHTML = missions.map(m => `
            <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-start justify-between gap-3">
                <div class="flex items-start space-x-3 min-w-0">
                    <div class="text-xl">${m.icon || '🎯'}</div>
                    <div class="min-w-0">
                        <div class="text-xs font-extrabold text-gray-800">${escapeHtml(m.label)}</div>
                        <div class="text-[10px] font-bold text-indigo-500 mt-0.5">+${m.points || 0} poin &middot; urutan ${m.order || 0}</div>
                        <span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full ${m.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}">
                            ${m.active !== false ? 'AKTIF' : 'NONAKTIF'}
                        </span>
                    </div>
                </div>
                <div class="flex flex-col gap-1.5 shrink-0">
                    <button onclick="toggleMissionActive('${m.id}', ${m.active !== false})" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg ${m.active !== false ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}">
                        ${m.active !== false ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button onclick="editMission('${m.id}', ${m.points || 0}, ${m.order || 0})" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200">Edit</button>
                    <button onclick="deleteMission('${m.id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">Hapus</button>
                </div>
            </div>
        `).join('');
    });
}

window.addMission = function() {
    const icon = document.getElementById('mission-icon').value.trim() || '🎯';
    const label = document.getElementById('mission-label').value.trim();
    const points = parseInt(document.getElementById('mission-points').value, 10) || 0;
    const order = parseInt(document.getElementById('mission-order').value, 10) || 0;

    if (!label) { showToast('Nama misi wajib diisi'); return; }

    const newRef = push(ref(database, 'config/missions'));
    set(newRef, { icon, label, points, order, active: true }).then(() => {
        document.getElementById('mission-icon').value = '';
        document.getElementById('mission-label').value = '';
        document.getElementById('mission-points').value = '';
        document.getElementById('mission-order').value = '';
        showToast('Misi ditambahkan');
    }).catch(err => showToast('Gagal: ' + err.message));
};

window.toggleMissionActive = function(id, currentlyActive) {
    update(ref(database, `config/missions/${id}`), { active: !currentlyActive }).then(() => {
        showToast(!currentlyActive ? 'Misi diaktifkan' : 'Misi dinonaktifkan');
    });
};

window.editMission = function(id, currentPoints, currentOrder) {
    const newPoints = prompt('Ubah jumlah poin misi ini:', currentPoints);
    if (newPoints === null) return;
    const newOrder = prompt('Ubah urutan tampil misi ini:', currentOrder);
    if (newOrder === null) return;

    update(ref(database, `config/missions/${id}`), {
        points: parseInt(newPoints, 10) || 0,
        order: parseInt(newOrder, 10) || 0
    }).then(() => showToast('Misi diperbarui'));
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
