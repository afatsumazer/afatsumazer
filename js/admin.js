// js/admin.js — Panel Admin Institusi (multi-tenant)
// Semua data dibaca/ditulis di bawah institutions/{institusiId}/... sesuai institusi admin yang login.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
    collection, query, where, onSnapshot, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let adminUID = null;
let myInstitusiId = null;
let institusiData = {}; // { nama, status, jamMasuk, jamPulang, lokasiKantor:{lat,lng,radius}, aturanPotongan:{...} }
let allUsersCache = {};      // { uid: { profile, rewards, ... } } — hanya anggota institusi ini
let allDivisiCache = {};     // { divisiId: { nama, order } }
let selectedUserUID = null;
let selectedCalendarDate = null;
let peteMapPicker = null;    // instance Leaflet map di tab Lokasi & Divisi
let peteMapMarker = null;

// ---- Helper referensi koleksi ter-scope ke institusi ----
function institusiDocRef() { return doc(firestore, 'institutions', myInstitusiId); }
function col(name) { return collection(firestore, 'institutions', myInstitusiId, name); }
function docIn(name, id) { return doc(firestore, 'institutions', myInstitusiId, name, id); }

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

function bersihkanNomorWA(nomor) {
    return String(nomor || '').replace(/[^0-9]/g, '');
}

function formatMenitJam(menit) {
    const m = Math.max(0, Math.round(menit || 0));
    const j = Math.floor(m / 60);
    const sisa = m % 60;
    if (j === 0) return `${sisa} menit`;
    return `${j} jam ${sisa} menit`;
}

function bulanIniDefault() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function jumlahHariDiBulan(yyyyMM) {
    const [y, m] = yyyyMM.split('-').map(Number);
    return new Date(y, m, 0).getDate();
}

// Jarak antar 2 koordinat (meter) — rumus Haversine, dipakai juga untuk cek radius kantor
function jarakMeter(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Hitung estimasi potongan gaji dari menit telat, berdasarkan aturanPotongan institusi
function hitungPotonganPersen(telatMenit) {
    const aturan = institusiData.aturanPotongan || { kelipatanMenit: 15, persenPerKelipatan: 1, maksimalPersen: 50 };
    if (!telatMenit || telatMenit <= 0) return 0;
    const kelipatan = Math.floor(telatMenit / (aturan.kelipatanMenit || 15));
    const persen = kelipatan * (aturan.persenPerKelipatan || 1);
    return Math.min(persen, aturan.maksimalPersen || 50);
}

let isActingAsSuperAdmin = false;

// ================= 1. GERBANG AKSES ADMIN INSTITUSI =================
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    getDoc(doc(firestore, 'users', user.uid)).then(async (snap) => {
        const data = snap.exists() ? snap.data() : {};
        const profile = data.profile || {};
        document.getElementById('access-checking').classList.add('hidden');

        // Super Admin BOLEH juga mengoperasikan panel admin institusi (satu akun,
        // dua kemampuan) — tapi karena super admin tidak "terikat" ke satu institusi,
        // dia harus pilih dulu institusi mana yang mau dikelola.
        if (profile.peran === 'superadmin') {
            adminUID = user.uid;
            isActingAsSuperAdmin = true;
            await tampilkanPemilihInstitusi();
            return;
        }

        if (profile.peran === 'admin' && profile.institusiId) {
            adminUID = user.uid;
            myInstitusiId = profile.institusiId;
            await masukKePanelInstitusi();
        } else {
            document.getElementById('access-denied').classList.remove('hidden');
            document.getElementById('access-denied').classList.add('flex');
            document.getElementById('access-denied-msg').textContent = 'Akun ini tidak memiliki hak admin institusi.';
        }
    }).catch(() => {
        document.getElementById('access-checking').classList.add('hidden');
        document.getElementById('access-denied').classList.remove('hidden');
        document.getElementById('access-denied').classList.add('flex');
    });
});

// Dipanggil setelah myInstitusiId sudah ditentukan (baik dari profile admin biasa,
// maupun hasil pilihan super admin) — memuat data institusi & seluruh tab panel.
async function masukKePanelInstitusi() {
    const instSnap = await getDoc(doc(firestore, 'institutions', myInstitusiId));
    if (!instSnap.exists() || instSnap.data().status !== 'aktif') {
        document.getElementById('admin-content').classList.add('hidden');
        document.getElementById('access-denied').classList.remove('hidden');
        document.getElementById('access-denied').classList.add('flex');
        document.getElementById('access-denied-msg').textContent = !instSnap.exists()
            ? 'Institusi tidak ditemukan.'
            : 'Langganan institusi ini sedang tidak aktif. Hubungi penyedia layanan.';
        return;
    }
    institusiData = instSnap.data();
    document.getElementById('admin-institusi-nama').textContent = institusiData.nama || myInstitusiId;
    if (isActingAsSuperAdmin) document.getElementById('admin-institusi-nama').textContent += ' (mode Super Admin)';

    document.getElementById('admin-content').classList.remove('hidden');
    loadMissions();
    loadVouchers();
    loadAllUsers();
    loadDivisiList();
    loadQuickMenu();
    loadOrderReview();
    loadArticles();
    loadLokasiDivisiForm();
}

// Super Admin: tampilkan daftar institusi untuk dipilih. Kalau cuma ada satu
// institusi aktif, langsung dipakai tanpa perlu klik apa-apa.
async function tampilkanPemilihInstitusi() {
    const snap = await getDocs(collection(firestore, 'institutions'));
    const daftar = [];
    snap.forEach(d => daftar.push({ id: d.id, ...d.data() }));

    if (daftar.length === 0) {
        document.getElementById('access-denied').classList.remove('hidden');
        document.getElementById('access-denied').classList.add('flex');
        document.getElementById('access-denied-msg').textContent = 'Belum ada institusi terdaftar. Buat dulu lewat superadmin.html.';
        return;
    }

    if (daftar.length === 1) {
        myInstitusiId = daftar[0].id;
        await masukKePanelInstitusi();
        return;
    }

    // Lebih dari satu institusi -> tampilkan pemilih
    const picker = document.getElementById('institusi-picker');
    const list = document.getElementById('institusi-picker-list');
    list.innerHTML = daftar.map(i => `
        <button onclick="pilihInstitusiSuperAdmin('${i.id}')" class="w-full text-left p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
            <p class="text-xs font-extrabold text-gray-800">${escapeHtml(i.nama)}</p>
            <p class="text-[10px] text-gray-400">${i.status === 'aktif' ? '🟢 Aktif' : '⚪ Nonaktif'}</p>
        </button>`).join('');
    picker.classList.remove('hidden');
    picker.classList.add('flex');
}

window.pilihInstitusiSuperAdmin = async function(institusiId) {
    myInstitusiId = institusiId;
    document.getElementById('institusi-picker').classList.add('hidden');
    document.getElementById('institusi-picker').classList.remove('flex');
    await masukKePanelInstitusi();
};

window.adminLogout = function() {
    if (confirm('Keluar dari panel admin?')) {
        signOut(auth).then(() => window.location.href = "login.html");
    }
};

// ================= 2. NAVIGASI SUB-TAB =================
window.switchAdminTab = function(tabName) {
    const tabs = ['missions', 'vouchers', 'users', 'quickmenu', 'orderreview', 'articles', 'lokasi', 'absensi', 'kalender', 'statistik'];
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

    if (tabName === 'statistik') loadStatistik();
    if (tabName === 'lokasi') setTimeout(initPetaPicker, 50); // peta butuh container sudah kelihatan (tidak 'hidden')
    if (tabName === 'absensi' && !document.getElementById('rekap-bulan').value) {
        document.getElementById('rekap-bulan').value = bulanIniDefault();
        loadRekapAbsensi();
    }
    if (tabName === 'kalender' && !document.getElementById('kalender-bulan').value) {
        document.getElementById('kalender-bulan').value = bulanIniDefault();
        renderKalenderKerja();
    }
};

// ================= 3. KELOLA MISI HARIAN =================
function loadMissions() {
    onSnapshot(col('missions'), (snapshot) => {
        const container = document.getElementById('missions-list');
        const data = {};
        snapshot.forEach(d => data[d.id] = d.data());
        const missions = Object.entries(data).map(([id, m]) => ({ id, ...m })).sort((a, b) => (a.order || 0) - (b.order || 0));
        loadMissions._cache = data;

        if (missions.length === 0) {
            container.innerHTML = `<div class="col-span-2 py-6 text-center text-xs text-gray-400">Belum ada misi.</div>`;
            return;
        }
        container.innerHTML = missions.map(m => {
            const isStreak = m.type === 'streak';
            const pointsInfo = isStreak
                ? `Base ${m.basePoints || 0} poin &middot; +${m.increment || 0}/hari &middot; urutan ${m.order || 0}`
                : `+${m.points || 0} poin &middot; urutan ${m.order || 0}`;
            const typeBadge = isStreak ? `<span class="inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 mr-1">STREAK HARIAN</span>` : '';
            return `
            <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-start justify-between gap-3">
                <div class="flex items-start space-x-3 min-w-0">
                    <div class="text-xl">${m.icon || '🎯'}</div>
                    <div class="min-w-0">
                        <div class="text-xs font-extrabold text-gray-800">${escapeHtml(m.label)}</div>
                        <div class="text-[10px] font-bold text-indigo-500 mt-0.5">${pointsInfo}</div>
                        <div>${typeBadge}<span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full ${m.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}">${m.active !== false ? 'AKTIF' : 'NONAKTIF'}</span></div>
                    </div>
                </div>
                <div class="flex flex-col gap-1.5 shrink-0">
                    <button onclick="toggleMissionActive('${m.id}', ${m.active !== false})" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg ${m.active !== false ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}">${m.active !== false ? 'Nonaktifkan' : 'Aktifkan'}</button>
                    <button onclick="editMission('${m.id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200">Edit</button>
                    <button onclick="deleteMission('${m.id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">Hapus</button>
                </div>
            </div>`;
        }).join('');
    }, err => showToast('Gagal memuat misi: ' + err.message));
}

window.addMission = function() {
    const icon = document.getElementById('mission-icon').value.trim() || '🎯';
    const label = document.getElementById('mission-label').value.trim();
    const order = parseInt(document.getElementById('mission-order').value, 10) || 0;
    const type = document.getElementById('mission-type').value === 'streak' ? 'streak' : 'normal';
    if (!label) { showToast('Nama misi wajib diisi'); return; }

    let missionData = { icon, label, order, active: true, type };
    if (type === 'streak') {
        missionData.basePoints = parseInt(document.getElementById('mission-base-points').value, 10) || 0;
        missionData.increment = parseInt(document.getElementById('mission-increment').value, 10) || 0;
    } else {
        missionData.points = parseInt(document.getElementById('mission-points').value, 10) || 0;
    }

    addDoc(col('missions'), missionData).then(() => {
        ['mission-icon', 'mission-label', 'mission-points', 'mission-base-points', 'mission-increment', 'mission-order'].forEach(id => document.getElementById(id).value = '');
        showToast('Misi ditambahkan');
    }).catch(err => showToast('Gagal: ' + err.message));
};

window.toggleMissionActive = function(id, currentlyActive) {
    updateDoc(docIn('missions', id), { active: !currentlyActive }).then(() => showToast(!currentlyActive ? 'Misi diaktifkan' : 'Misi dinonaktifkan'));
};

window.editMission = function(id) {
    const m = (loadMissions._cache || {})[id];
    if (!m) { showToast('Data tidak ditemukan'); return; }
    const newOrder = prompt('Ubah urutan tampil misi ini:', m.order || 0);
    if (newOrder === null) return;
    if (m.type === 'streak') {
        const newBase = prompt('Ubah Base Poin (hari ke-1):', m.basePoints || 0);
        if (newBase === null) return;
        const newInc = prompt('Ubah Kenaikan poin per hari:', m.increment || 0);
        if (newInc === null) return;
        updateDoc(docIn('missions', id), { basePoints: parseInt(newBase, 10) || 0, increment: parseInt(newInc, 10) || 0, order: parseInt(newOrder, 10) || 0 }).then(() => showToast('Misi diperbarui'));
    } else {
        const newPoints = prompt('Ubah jumlah poin misi ini:', m.points || 0);
        if (newPoints === null) return;
        updateDoc(docIn('missions', id), { points: parseInt(newPoints, 10) || 0, order: parseInt(newOrder, 10) || 0 }).then(() => showToast('Misi diperbarui'));
    }
};

window.deleteMission = function(id) {
    if (confirm('Hapus misi ini secara permanen?')) deleteDoc(docIn('missions', id)).then(() => showToast('Misi dihapus'));
};

// ================= 4. KELOLA VOUCHER =================
function loadVouchers() {
    onSnapshot(col('vouchers'), (snapshot) => {
        const container = document.getElementById('vouchers-list');
        const data = {};
        snapshot.forEach(d => data[d.id] = d.data());
        const vouchers = Object.entries(data).map(([id, v]) => ({ id, ...v })).sort((a, b) => (a.order || 0) - (b.order || 0));
        loadVouchers._cache = data;

        if (vouchers.length === 0) {
            container.innerHTML = `<div class="col-span-2 py-6 text-center text-xs text-gray-400">Belum ada voucher.</div>`;
            return;
        }
        container.innerHTML = vouchers.map(v => `
            <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <div class="text-xs font-extrabold text-gray-800">${escapeHtml(v.label)}</div>
                    <div class="text-[10px] font-bold text-amber-500 mt-0.5">${(v.cost || 0).toLocaleString('id-ID')} poin &middot; urutan ${v.order || 0}</div>
                    <div class="text-[10px] font-semibold text-gray-500 mt-0.5">${v.link ? `🔗 Link: ${escapeHtml(v.link)}` : `📱 WA: ${v.whatsapp ? escapeHtml(v.whatsapp) : '<span class="italic text-gray-400">nomor default</span>'}`}</div>
                    <span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full ${v.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}">${v.active !== false ? 'AKTIF' : 'NONAKTIF'}</span>
                </div>
                <div class="flex flex-col gap-1.5 shrink-0">
                    <button onclick="toggleVoucherActive('${v.id}', ${v.active !== false})" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg ${v.active !== false ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}">${v.active !== false ? 'Nonaktifkan' : 'Aktifkan'}</button>
                    <button onclick="editVoucher('${v.id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200">Edit</button>
                    <button onclick="deleteVoucher('${v.id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">Hapus</button>
                </div>
            </div>`).join('');
    }, err => showToast('Gagal memuat voucher: ' + err.message));
}

window.addVoucher = function() {
    const label = document.getElementById('voucher-label').value.trim();
    const cost = parseInt(document.getElementById('voucher-cost').value, 10) || 0;
    const order = parseInt(document.getElementById('voucher-order').value, 10) || 0;
    const whatsapp = bersihkanNomorWA(document.getElementById('voucher-whatsapp').value);
    const link = document.getElementById('voucher-link').value.trim();
    if (!label) { showToast('Nama voucher wajib diisi'); return; }

    addDoc(col('vouchers'), { label, cost, order, active: true, whatsapp, link }).then(() => {
        ['voucher-label', 'voucher-cost', 'voucher-order', 'voucher-whatsapp', 'voucher-link'].forEach(id => document.getElementById(id).value = '');
        showToast('Voucher ditambahkan');
    }).catch(err => showToast('Gagal: ' + err.message));
};

window.toggleVoucherActive = function(id, currentlyActive) {
    updateDoc(docIn('vouchers', id), { active: !currentlyActive }).then(() => showToast(!currentlyActive ? 'Voucher diaktifkan' : 'Voucher dinonaktifkan'));
};

window.editVoucher = function(id) {
    const v = (loadVouchers._cache || {})[id];
    if (!v) { showToast('Data tidak ditemukan'); return; }
    const newCost = prompt('Ubah harga voucher (poin):', v.cost || 0);
    if (newCost === null) return;
    const newOrder = prompt('Ubah urutan tampil:', v.order || 0);
    if (newOrder === null) return;
    const newWhatsapp = prompt('Nomor WA tujuan (kosongkan untuk default):', v.whatsapp || '');
    if (newWhatsapp === null) return;
    const newLink = prompt('Link kustom (kosongkan untuk pakai WA):', v.link || '');
    if (newLink === null) return;
    updateDoc(docIn('vouchers', id), { cost: parseInt(newCost, 10) || 0, order: parseInt(newOrder, 10) || 0, whatsapp: bersihkanNomorWA(newWhatsapp), link: newLink.trim() }).then(() => showToast('Voucher diperbarui'));
};

window.deleteVoucher = function(id) {
    if (confirm('Hapus voucher ini secara permanen?')) deleteDoc(docIn('vouchers', id)).then(() => showToast('Voucher dihapus'));
};

// ================= 5. KELOLA PENGGUNA (SALDO POIN, LENCANA, DIVISI, GAJI) =================
function loadAllUsers() {
    return getDocs(query(collection(firestore, 'users'), where('profile.institusiId', '==', myInstitusiId))).then((snapshot) => {
        allUsersCache = {};
        snapshot.forEach(d => allUsersCache[d.id] = d.data());
        renderManualAbsenKaryawanSelect();
    }).catch(err => showToast('Gagal memuat daftar pengguna: ' + err.message));
}

// Isi dropdown karyawan di form "Catat Absensi Manual" (tab Rekap Absensi)
function renderManualAbsenKaryawanSelect() {
    const sel = document.getElementById('manual-absen-karyawan');
    if (!sel) return;
    const entries = Object.entries(allUsersCache).sort((a, b) => ((a[1].profile || {}).name || '').localeCompare((b[1].profile || {}).name || ''));
    sel.innerHTML = entries.length === 0
        ? `<option value="">Belum ada karyawan</option>`
        : `<option value="">— Pilih karyawan —</option>` + entries.map(([uid, u]) => `<option value="${uid}">${escapeHtml((u.profile || {}).name || uid)}</option>`).join('');
}

window.filterUsers = function() {
    const q = document.getElementById('user-search-input').value.trim().toLowerCase();
    const resultsEl = document.getElementById('user-search-results');
    if (!q) { resultsEl.innerHTML = ''; return; }

    const matches = Object.entries(allUsersCache).filter(([uid, u]) => {
        const p = u.profile || {};
        return (p.name || '').toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q) || uid.toLowerCase().includes(q);
    }).slice(0, 20);

    resultsEl.innerHTML = matches.length === 0
        ? `<div class="text-xs text-gray-400 py-2">Tidak ada pengguna cocok.</div>`
        : matches.map(([uid, u]) => {
            const p = u.profile || {};
            const divisiNama = allDivisiCache[p.divisiId] ? allDivisiCache[p.divisiId].nama : '';
            return `
            <button onclick="openUserDetail('${uid}')" class="w-full flex items-center gap-3 text-left p-2.5 rounded-xl hover:bg-gray-50 border border-gray-100 transition">
                <img src="${p.photo || 'https://via.placeholder.com/150'}" class="w-8 h-8 rounded-full object-cover">
                <div class="min-w-0">
                    <div class="text-xs font-bold text-gray-800 truncate">${escapeHtml(p.name || 'Tanpa nama')}</div>
                    <div class="text-[10px] text-gray-400 truncate">${escapeHtml(p.username || uid)} ${divisiNama ? '· ' + escapeHtml(divisiNama) : ''}</div>
                </div>
            </button>`;
        }).join('');
};

window.openUserDetail = function(uid) {
    selectedUserUID = uid;
    const u = allUsersCache[uid] || {};
    const p = u.profile || {};
    const rewards = u.rewards || {};

    document.getElementById('user-detail-panel').classList.remove('hidden');
    document.getElementById('user-detail-avatar').src = p.photo || 'https://via.placeholder.com/150';
    document.getElementById('user-detail-name').textContent = p.name || 'Tanpa nama';
    document.getElementById('user-detail-username').textContent = p.username || uid;
    document.getElementById('user-detail-points').textContent = (rewards.points || 0).toLocaleString('id-ID');
    document.getElementById('user-detail-gaji').value = p.gajiHarian || '';

    renderDivisiSelectForUser(p.divisiId || '');
    renderStatusAkunButtons(p.isPremium === true, p.isVerified === true);
    loadUserBadges(uid);
    loadUserFilesForAdmin(uid);
};

function renderDivisiSelectForUser(currentDivisiId) {
    const sel = document.getElementById('user-detail-divisi');
    const opts = Object.entries(allDivisiCache).map(([id, d]) => `<option value="${id}" ${id === currentDivisiId ? 'selected' : ''}>${escapeHtml(d.nama)}</option>`).join('');
    sel.innerHTML = `<option value="">— Tanpa divisi —</option>${opts}`;
}

window.saveUserDivisiGaji = function() {
    if (!selectedUserUID) return;
    const divisiId = document.getElementById('user-detail-divisi').value;
    const gajiHarian = parseFloat(document.getElementById('user-detail-gaji').value) || 0;
    updateDoc(doc(firestore, 'users', selectedUserUID), { 'profile.divisiId': divisiId, 'profile.gajiHarian': gajiHarian }).then(() => {
        showToast('Divisi & gaji harian disimpan');
        refreshSelectedUserIfOpen(selectedUserUID);
    }).catch(err => showToast('Gagal: ' + err.message));
};

function loadUserBadges(uid) {
    const badgesEl = document.getElementById('user-detail-badges');
    badgesEl.innerHTML = `<span class="text-[10px] text-gray-400 italic">Memuat...</span>`;
    getDocs(collection(firestore, 'users', uid, 'badges')).then(snap => {
        if (selectedUserUID !== uid) return;
        badgesEl.innerHTML = snap.empty
            ? `<span class="text-[10px] text-gray-400 italic">Belum ada lencana</span>`
            : snap.docs.map(d => { const b = d.data(); return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100"><span>${b.icon || '🏅'}</span><span>${escapeHtml(b.label)}</span><button onclick="removeBadge('${d.id}')" class="text-indigo-400 hover:text-red-500 ml-0.5">✕</button></span>`; }).join('');
    });
}

function renderStatusAkunButtons(isPremium, isVerified) {
    const premiumBtn = document.getElementById('user-detail-premium-btn');
    const verifiedBtn = document.getElementById('user-detail-verified-btn');
    premiumBtn.className = 'text-xs font-bold px-3 py-2 rounded-xl border transition ' + (isPremium ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50');
    premiumBtn.textContent = isPremium ? '⭐ Member Premium (aktif)' : '⭐ Jadikan Member Premium';
    verifiedBtn.className = 'text-xs font-bold px-3 py-2 rounded-xl border transition ' + (isVerified ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50');
    verifiedBtn.textContent = isVerified ? '✔️ Terverifikasi (aktif)' : '✔️ Jadikan Terverifikasi';
}

window.toggleUserPremium = function() {
    if (!selectedUserUID) return;
    const current = ((allUsersCache[selectedUserUID] || {}).profile || {}).isPremium === true;
    updateDoc(doc(firestore, 'users', selectedUserUID), { 'profile.isPremium': !current }).then(() => { showToast(!current ? 'Member Premium diaktifkan' : 'Dinonaktifkan'); refreshSelectedUserIfOpen(selectedUserUID); });
};

window.toggleUserVerified = function() {
    if (!selectedUserUID) return;
    const current = ((allUsersCache[selectedUserUID] || {}).profile || {}).isVerified === true;
    updateDoc(doc(firestore, 'users', selectedUserUID), { 'profile.isVerified': !current }).then(() => { showToast(!current ? 'Akun diverifikasi' : 'Verifikasi dicabut'); refreshSelectedUserIfOpen(selectedUserUID); });
};

function formatBytesAdmin(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function loadUserFilesForAdmin(uid) {
    const container = document.getElementById('user-detail-files');
    const storageLabel = document.getElementById('user-detail-storage');
    if (!container) return;
    container.innerHTML = `<p class="text-xs text-gray-400 italic py-2">Memuat berkas...</p>`;

    getDocs(collection(firestore, 'users', uid, 'files')).then((snap) => {
        if (selectedUserUID !== uid) return;
        if (snap.empty) {
            container.innerHTML = `<p class="text-xs text-gray-400 italic py-2">Belum ada berkas.</p>`;
            if (storageLabel) storageLabel.textContent = '0 MB terpakai';
            return;
        }
        let totalBytes = 0;
        container.innerHTML = snap.docs.map(d => {
            const f = d.data(); totalBytes += f.size || 0;
            return `<div class="flex items-center justify-between gap-2 border border-gray-100 rounded-lg px-3 py-2">
                <div class="min-w-0"><div class="text-xs font-semibold text-gray-700 truncate">${escapeHtml(f.name || 'Tanpa nama')}</div>
                <div class="text-[10px] text-gray-400">${formatBytesAdmin(f.size)} ${f.isPublic ? '· <span class="text-emerald-600 font-bold">Publik</span>' : ''}</div></div>
                <button onclick="adminDeleteUserFile('${uid}', '${d.id}', ${f.isPublic === true})" class="shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">Hapus</button></div>`;
        }).join('');
        if (storageLabel) storageLabel.textContent = `${(totalBytes / (1024*1024)).toFixed(2)} MB terpakai`;
    }).catch(err => { container.innerHTML = `<p class="text-xs text-red-500">Gagal memuat berkas: ${err.message}</p>`; });
}

window.adminDeleteUserFile = function(uid, fileId, isPublic) {
    if (!confirm('Hapus berkas ini secara permanen?')) return;
    deleteDoc(doc(firestore, 'users', uid, 'files', fileId)).then(() => {
        if (isPublic) return deleteDoc(docIn('shared', fileId));
    }).then(() => { showToast('Berkas dihapus'); if (selectedUserUID === uid) loadUserFilesForAdmin(uid); }).catch(err => showToast('Gagal: ' + err.message));
};

function refreshSelectedUserIfOpen(uid) {
    if (selectedUserUID === uid) {
        getDoc(doc(firestore, 'users', uid)).then(snap => { allUsersCache[uid] = snap.exists() ? snap.data() : {}; openUserDetail(uid); });
    }
}

window.adjustUserPoints = function(sign) {
    if (!selectedUserUID) return;
    const amount = parseInt(document.getElementById('user-points-amount').value, 10);
    if (!amount || amount <= 0) { showToast('Masukkan jumlah poin yang valid'); return; }
    updateDoc(doc(firestore, 'users', selectedUserUID), { 'rewards.points': increment(sign * amount) }).then(() => {
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
    addDoc(collection(firestore, 'users', selectedUserUID, 'badges'), { icon, label, awardedAt: Date.now(), awardedBy: adminUID }).then(() => {
        document.getElementById('badge-icon').value = ''; document.getElementById('badge-label').value = '';
        showToast('Lencana diberikan'); loadUserBadges(selectedUserUID);
    }).catch(err => showToast('Gagal: ' + err.message));
};

window.removeBadge = function(badgeId) {
    if (!selectedUserUID) return;
    if (confirm('Cabut lencana ini?')) deleteDoc(doc(firestore, 'users', selectedUserUID, 'badges', badgeId)).then(() => { showToast('Lencana dicabut'); loadUserBadges(selectedUserUID); });
};

// ================= 6. KELOLA MENU CEPAT (FAB) =================
function loadQuickMenu() {
    onSnapshot(col('quickMenu'), (snapshot) => {
        const container = document.getElementById('quickmenu-list');
        if (!container) return;
        const data = {};
        snapshot.forEach(d => data[d.id] = d.data());
        const items = Object.entries(data).map(([id, q]) => ({ id, ...q })).sort((a, b) => (a.order || 0) - (b.order || 0));
        loadQuickMenu._cache = data;

        container.innerHTML = items.length === 0
            ? `<div class="col-span-2 py-6 text-center text-xs text-gray-400">Belum ada menu cepat kustom.</div>`
            : items.map(q => `
            <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-start justify-between gap-3">
                <div class="flex items-start space-x-3 min-w-0">
                    <div class="text-xl">${q.icon || '🔗'}</div>
                    <div class="min-w-0">
                        <div class="text-xs font-extrabold text-gray-800">${escapeHtml(q.label)}</div>
                        <div class="text-[10px] font-semibold text-gray-500 mt-0.5 break-all">${escapeHtml(q.url || '')}</div>
                        <span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full ${q.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}">${q.active !== false ? 'AKTIF' : 'NONAKTIF'}</span>
                    </div>
                </div>
                <div class="flex flex-col gap-1.5 shrink-0">
                    <button onclick="toggleQuickMenuActive('${q.id}', ${q.active !== false})" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg ${q.active !== false ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}">${q.active !== false ? 'Nonaktifkan' : 'Aktifkan'}</button>
                    <button onclick="editQuickMenu('${q.id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200">Edit</button>
                    <button onclick="deleteQuickMenu('${q.id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">Hapus</button>
                </div>
            </div>`).join('');
    }, err => showToast('Gagal memuat menu cepat: ' + err.message));
}

window.addQuickMenu = function() {
    const icon = document.getElementById('quickmenu-icon').value.trim() || '🔗';
    const label = document.getElementById('quickmenu-label').value.trim();
    const url = document.getElementById('quickmenu-url').value.trim();
    const order = parseInt(document.getElementById('quickmenu-order').value, 10) || 0;
    if (!label) { showToast('Nama menu wajib diisi'); return; }
    if (!url) { showToast('URL tujuan wajib diisi'); return; }
    addDoc(col('quickMenu'), { icon, label, url, order, active: true }).then(() => {
        ['quickmenu-icon', 'quickmenu-label', 'quickmenu-url', 'quickmenu-order'].forEach(id => document.getElementById(id).value = '');
        showToast('Menu cepat ditambahkan');
    }).catch(err => showToast('Gagal: ' + err.message));
};

window.toggleQuickMenuActive = function(id, currentlyActive) {
    updateDoc(docIn('quickMenu', id), { active: !currentlyActive }).then(() => showToast(!currentlyActive ? 'Menu diaktifkan' : 'Menu dinonaktifkan'));
};

window.editQuickMenu = function(id) {
    const q = (loadQuickMenu._cache || {})[id];
    if (!q) { showToast('Data tidak ditemukan'); return; }
    const newLabel = prompt('Ubah nama menu:', q.label || ''); if (newLabel === null) return;
    const newUrl = prompt('Ubah URL tujuan:', q.url || ''); if (newUrl === null) return;
    const newOrder = prompt('Ubah urutan tampil:', q.order || 0); if (newOrder === null) return;
    updateDoc(docIn('quickMenu', id), { label: newLabel.trim(), url: newUrl.trim(), order: parseInt(newOrder, 10) || 0 }).then(() => showToast('Menu cepat diperbarui'));
};

window.deleteQuickMenu = function(id) {
    if (confirm('Hapus menu cepat ini?')) deleteDoc(docIn('quickMenu', id)).then(() => showToast('Menu cepat dihapus'));
};

// ================= 7. ORDER REVIEW =================
function orderReviewDocRef() { return docIn('config', 'orderReview'); }

function loadOrderReview() {
    getDoc(orderReviewDocRef()).then((snap) => {
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
    }).catch(err => showToast('Gagal memuat: ' + err.message));
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
        updatedAt: Date.now(), updatedBy: adminUID
    };
    if (!data.productName) { showToast('Nama produk wajib diisi'); return; }
    setDoc(orderReviewDocRef(), data).then(() => {
        showToast('Order review disimpan');
        document.getElementById('or-last-saved').textContent = 'Tersimpan ' + new Date().toLocaleString('id-ID');
    }).catch(err => showToast('Gagal: ' + err.message));
};

// ================= 8. ARTIKEL =================
let editingArticleSlug = null;

function slugifyArticle(text) {
    return String(text || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

window.onArticleTitleInput = function() {
    if (editingArticleSlug) return;
    document.getElementById('article-slug').value = slugifyArticle(document.getElementById('article-title').value);
    updateArticleSlugPreview();
};

window.updateArticleSlugPreview = function() {
    document.getElementById('article-slug-preview').textContent = `/${document.getElementById('article-slug').value || 'judul-artikel'}`;
};

function statusBadgeArticle(status) {
    if (status === 'published') return `<span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">TAYANG</span>`;
    if (status === 'pending') return `<span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">MENUNGGU REVIEW</span>`;
    if (status === 'rejected') return `<span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">DITOLAK</span>`;
    return `<span class="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">DRAFT</span>`;
}

function loadArticles() {
    onSnapshot(col('articles'), (snapshot) => {
        const container = document.getElementById('articles-list');
        if (!container) return;
        if (snapshot.empty) {
            container.innerHTML = `<div class="col-span-2 py-6 text-center text-xs text-gray-400">Belum ada artikel.</div>`;
            return;
        }
        const items = [];
        snapshot.forEach(d => items.push({ slug: d.id, ...d.data() }));
        items.sort((a, b) => {
            const rank = { pending: 0, draft: 1, published: 2, rejected: 3 };
            const ra = rank[a.status] ?? 1, rb = rank[b.status] ?? 1;
            return ra !== rb ? ra - rb : (a.order || 0) - (b.order || 0);
        });
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
                    ${a.status === 'pending' ? `<button onclick="approveArticle('${a.slug}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Setujui</button><button onclick="rejectArticle('${a.slug}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">Tolak</button>` : ''}
                    <button onclick="editArticle('${a.slug}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200">Edit</button>
                    <button onclick="deleteArticle('${a.slug}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">Hapus</button>
                </div>
            </div>`).join('');
    }, err => showToast('Gagal memuat artikel: ' + err.message));
}

window.approveArticle = function(slug) {
    setDoc(docIn('articles', slug), { status: 'published', reviewedAt: serverTimestamp(), reviewedBy: adminUID }, { merge: true }).then(() => showToast('Artikel disetujui')).catch(err => showToast('Gagal: ' + err.message));
};

window.rejectArticle = function(slug) {
    if (!confirm('Tolak artikel ini?')) return;
    setDoc(docIn('articles', slug), { status: 'rejected', reviewedAt: serverTimestamp(), reviewedBy: adminUID }, { merge: true }).then(() => showToast('Artikel ditolak')).catch(err => showToast('Gagal: ' + err.message));
};

window.saveArticle = function() {
    const title = document.getElementById('article-title').value.trim();
    const slug = slugifyArticle(document.getElementById('article-slug').value);
    const cover = document.getElementById('article-cover').value.trim();
    const content = document.getElementById('article-content').value;
    const status = document.getElementById('article-status').value;
    const order = parseInt(document.getElementById('article-order').value, 10) || 0;
    if (!title) { showToast('Judul artikel wajib diisi'); return; }
    if (!slug) { showToast('Slug wajib diisi'); return; }

    const data = { title, slug, cover, content, status, order, updatedAt: serverTimestamp(), updatedBy: adminUID };
    const isRenaming = editingArticleSlug && editingArticleSlug !== slug;

    if (!editingArticleSlug || !isRenaming) {
        if (!editingArticleSlug) data.createdAt = serverTimestamp();
        setDoc(docIn('articles', slug), data, { merge: true }).then(() => { showToast(editingArticleSlug ? 'Artikel diperbarui' : 'Artikel ditambahkan'); resetArticleForm(); }).catch(err => showToast('Gagal: ' + err.message));
        return;
    }
    data.createdAt = (loadArticles._cache?.[editingArticleSlug]?.createdAt) || serverTimestamp();
    setDoc(docIn('articles', slug), data).then(() => deleteDoc(docIn('articles', editingArticleSlug))).then(() => { showToast('Artikel diperbarui (alamat baru: /' + slug + ')'); resetArticleForm(); }).catch(err => showToast('Gagal: ' + err.message));
};

window.editArticle = function(slug) {
    const a = (loadArticles._cache || {})[slug];
    if (!a) { showToast('Data tidak ditemukan'); return; }
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
    ['article-title', 'article-slug', 'article-cover', 'article-content'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('article-status').value = 'draft';
    document.getElementById('article-order').value = 0;
    updateArticleSlugPreview();
    document.getElementById('article-cancel-btn').classList.add('hidden');
    document.getElementById('article-save-btn').textContent = 'Simpan Artikel';
};

window.deleteArticle = function(slug) {
    if (confirm(`Hapus artikel "/${slug}" secara permanen?`)) deleteDoc(docIn('articles', slug)).then(() => showToast('Artikel dihapus')).catch(err => showToast('Gagal: ' + err.message));
};

// ================= 9. LOKASI KANTOR (GEOFENCING) & DIVISI =================
function loadLokasiDivisiForm() {
    document.getElementById('lokasi-radius').value = (institusiData.lokasiKantor && institusiData.lokasiKantor.radius) || 100;
    document.getElementById('potongan-kelipatan').value = (institusiData.aturanPotongan && institusiData.aturanPotongan.kelipatanMenit) || 15;
    document.getElementById('potongan-persen').value = (institusiData.aturanPotongan && institusiData.aturanPotongan.persenPerKelipatan) || 1;
    document.getElementById('potongan-maksimal').value = (institusiData.aturanPotongan && institusiData.aturanPotongan.maksimalPersen) || 50;
}

// Peta dimuat lewat Leaflet (CDN) di admin.html. Klik peta ATAU ketik koordinat manual
// di kolom Latitude/Longitude lalu "Terapkan ke Peta" — dua-duanya saling sinkron.
function initPetaPicker() {
    if (peteMapPicker || typeof L === 'undefined') return;
    const lat = (institusiData.lokasiKantor && institusiData.lokasiKantor.lat) || -6.200000;
    const lng = (institusiData.lokasiKantor && institusiData.lokasiKantor.lng) || 106.816666;

    peteMapPicker = L.map('lokasi-peta').setView([lat, lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(peteMapPicker);
    peteMapMarker = L.marker([lat, lng], { draggable: true }).addTo(peteMapPicker);
    updateLokasiInputFromMarker();

    peteMapMarker.on('dragend', updateLokasiInputFromMarker);
    peteMapPicker.on('click', (e) => {
        peteMapMarker.setLatLng(e.latlng);
        updateLokasiInputFromMarker();
    });
}

// Peta -> kolom input manual (dipanggil saat klik/geser peta)
function updateLokasiInputFromMarker() {
    const pos = peteMapMarker.getLatLng();
    document.getElementById('lokasi-lat').value = pos.lat.toFixed(6);
    document.getElementById('lokasi-lng').value = pos.lng.toFixed(6);
}

// Kolom input manual -> peta (dipanggil saat admin ketik koordinat sendiri, mis. hasil
// salin dari Google Maps, lalu klik "Terapkan ke Peta")
window.terapkanLokasiManual = function() {
    const lat = parseFloat(document.getElementById('lokasi-lat').value);
    const lng = parseFloat(document.getElementById('lokasi-lng').value);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        showToast('Koordinat tidak valid. Contoh: -6.200000, 106.816666');
        return;
    }
    if (!peteMapPicker) { showToast('Peta belum siap, coba lagi sesaat lagi'); return; }

    peteMapMarker.setLatLng([lat, lng]);
    peteMapPicker.setView([lat, lng], 16);
    showToast('Koordinat diterapkan ke peta — klik "Simpan Lokasi" untuk menyimpan');
};

window.saveLokasiKantor = function() {
    const lat = parseFloat(document.getElementById('lokasi-lat').value);
    const lng = parseFloat(document.getElementById('lokasi-lng').value);
    const radius = parseInt(document.getElementById('lokasi-radius').value, 10) || 100;

    if (isNaN(lat) || isNaN(lng)) { showToast('Isi koordinat lokasi kantor dulu (lewat peta atau manual)'); return; }

    updateDoc(institusiDocRef(), { lokasiKantor: { lat, lng, radius } }).then(() => {
        institusiData.lokasiKantor = { lat, lng, radius };
        showToast('Lokasi kantor disimpan');
    }).catch(err => showToast('Gagal: ' + err.message));
};

window.saveAturanPotongan = function() {
    const kelipatanMenit = parseInt(document.getElementById('potongan-kelipatan').value, 10) || 15;
    const persenPerKelipatan = parseFloat(document.getElementById('potongan-persen').value) || 1;
    const maksimalPersen = parseFloat(document.getElementById('potongan-maksimal').value) || 50;

    updateDoc(institusiDocRef(), { aturanPotongan: { kelipatanMenit, persenPerKelipatan, maksimalPersen } }).then(() => {
        institusiData.aturanPotongan = { kelipatanMenit, persenPerKelipatan, maksimalPersen };
        showToast('Aturan potongan disimpan');
    }).catch(err => showToast('Gagal: ' + err.message));
};

function loadDivisiList() {
    onSnapshot(col('divisi'), (snapshot) => {
        allDivisiCache = {};
        snapshot.forEach(d => allDivisiCache[d.id] = d.data());
        const container = document.getElementById('divisi-list');
        if (!container) return;
        const items = Object.entries(allDivisiCache).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
        container.innerHTML = items.length === 0
            ? `<div class="py-4 text-center text-xs text-gray-400">Belum ada divisi.</div>`
            : items.map(([id, d]) => `
                <div class="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                    <span class="text-xs font-bold text-gray-700">${escapeHtml(d.nama)}</span>
                    <button onclick="deleteDivisi('${id}')" class="text-[10px] font-bold text-red-500 hover:text-red-700">Hapus</button>
                </div>`).join('');

        // Refresh dropdown filter divisi di tab Kalender & panel detail Pengguna kalau sedang terbuka
        const filterSel = document.getElementById('kalender-divisi-filter');
        if (filterSel) {
            const current = filterSel.value;
            filterSel.innerHTML = `<option value="">Semua Divisi</option>` + items.map(([id, d]) => `<option value="${id}">${escapeHtml(d.nama)}</option>`).join('');
            filterSel.value = current;
        }
        if (selectedUserUID) renderDivisiSelectForUser(((allUsersCache[selectedUserUID] || {}).profile || {}).divisiId || '');
    }, err => showToast('Gagal memuat divisi: ' + err.message));
}

window.addDivisi = function() {
    const nama = document.getElementById('divisi-nama').value.trim();
    if (!nama) { showToast('Nama divisi wajib diisi'); return; }
    addDoc(col('divisi'), { nama, order: Object.keys(allDivisiCache).length }).then(() => {
        document.getElementById('divisi-nama').value = '';
        showToast('Divisi ditambahkan');
    }).catch(err => showToast('Gagal: ' + err.message));
};

window.deleteDivisi = function(id) {
    if (confirm('Hapus divisi ini? Karyawan yang sudah ditempatkan di sini tidak otomatis dipindah.')) {
        deleteDoc(docIn('divisi', id)).then(() => showToast('Divisi dihapus'));
    }
};

// ================= 9b. CATAT ABSENSI MANUAL (admin pilih karyawan langsung) =================
// Dipakai untuk kondisi lapangan yang tidak memungkinkan scan QR/GPS (sinyal lemah, alat
// rusak, karyawan dinas luar, dsb). Ditandai inputManual:true supaya beda dari absensi
// mandiri lewat scan, untuk keperluan audit.
window.catatAbsensiManual = async function() {
    const uid = document.getElementById('manual-absen-karyawan').value;
    const tanggal = document.getElementById('manual-absen-tanggal').value;
    const jenis = document.getElementById('manual-absen-jenis').value; // 'masuk' | 'pulang'
    const jam = document.getElementById('manual-absen-jam').value; // 'HH:MM'

    if (!uid) { showToast('Pilih karyawan dulu'); return; }
    if (!tanggal) { showToast('Pilih tanggal dulu'); return; }
    if (!jam) { showToast('Isi jam dulu'); return; }

    const [h, m] = jam.split(':').map(Number);
    const waktu = new Date(tanggal + 'T00:00:00');
    waktu.setHours(h, m, 0, 0);

    const docId = `${tanggal}_${uid}`;
    const ref = docIn('attendance', docId);

    try {
        const existing = await getDoc(ref);
        if (jenis === 'masuk') {
            await setDoc(ref, {
                uid, tanggal, status: 'masuk',
                jam_masuk: waktu, jam_pulang: existing.exists() ? (existing.data().jam_pulang || null) : null,
                lokasi_masuk: null, lokasi_pulang: existing.exists() ? (existing.data().lokasi_pulang || null) : null,
                inputManual: true, inputOleh: adminUID
            }, { merge: true });
        } else {
            await setDoc(ref, {
                uid, tanggal, status: 'pulang',
                jam_masuk: existing.exists() ? (existing.data().jam_masuk || waktu) : waktu,
                jam_pulang: waktu,
                lokasi_masuk: existing.exists() ? (existing.data().lokasi_masuk || null) : null, lokasi_pulang: null,
                inputManual: true, inputOleh: adminUID
            }, { merge: true });
        }
        showToast('Absensi manual disimpan');
        document.getElementById('manual-absen-jam').value = '';
        if (rekapCacheBulan === tanggal.slice(0, 7)) loadRekapAbsensi();
    } catch (err) {
        showToast('Gagal: ' + err.message);
    }
};

// ================= 10. REKAP ABSENSI (+ estimasi potongan gaji) =================
function jamMenitDariTimestamp(ts) {
    if (!ts || !ts.toDate) return null;
    const d = ts.toDate();
    return d.getHours() * 60 + d.getMinutes();
}

function jamMenitDariString(hhmm) {
    const [h, m] = String(hhmm || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

let rekapCacheBulan = null;
let rekapCachePerUser = {};

window.loadRekapAbsensi = async function() {
    const bulan = document.getElementById('rekap-bulan').value || bulanIniDefault();
    const container = document.getElementById('rekap-absensi-list');
    const totalPanel = document.getElementById('rekap-total-panel');
    container.innerHTML = `<div class="col-span-2 py-6 text-center text-xs text-gray-400">Menghitung rekap absensi...</div>`;

    try {
        if (Object.keys(allUsersCache).length === 0) await loadAllUsers();

        const attSnap = await getDocs(query(col('attendance'), where('tanggal', '>=', `${bulan}-01`), where('tanggal', '<=', `${bulan}-31`)));
        const schedSnap = await getDocs(query(col('schedule'), where('tanggal', '>=', `${bulan}-01`), where('tanggal', '<=', `${bulan}-31`)));

        const wajibHari = {};
        schedSnap.forEach(d => { (d.data().wajib_masuk || []).forEach(uid => { wajibHari[uid] = (wajibHari[uid] || 0) + 1; }); });

        const perUser = {};
        attSnap.forEach(d => {
            const a = d.data();
            const uid = a.uid;
            if (!uid) return;
            if (!perUser[uid]) perUser[uid] = { telatMenit: 0, pulangAwalMenit: 0, hadir: 0 };
            perUser[uid].hadir += 1;

            const masukMenit = jamMenitDariTimestamp(a.jam_masuk);
            if (masukMenit !== null) {
                const selisih = masukMenit - jamMenitDariString(institusiData.jamMasuk || '08:00');
                if (selisih > 0) perUser[uid].telatMenit += selisih;
            }
            const pulangMenit = jamMenitDariTimestamp(a.jam_pulang);
            if (pulangMenit !== null) {
                const selisih = jamMenitDariString(institusiData.jamPulang || '17:00') - pulangMenit;
                if (selisih > 0) perUser[uid].pulangAwalMenit += selisih;
            }
        });

        Object.keys(wajibHari).forEach(uid => { if (!perUser[uid]) perUser[uid] = { telatMenit: 0, pulangAwalMenit: 0, hadir: 0 }; });

        rekapCacheBulan = bulan;
        rekapCachePerUser = perUser;
        renderRekapAbsensi();
    } catch (err) {
        container.innerHTML = `<div class="col-span-2 py-6 text-center text-xs text-red-500">Gagal memuat rekap: ${err.message}</div>`;
        if (totalPanel) totalPanel.innerHTML = '';
    }
};

function renderRekapAbsensi() {
    const container = document.getElementById('rekap-absensi-list');
    const totalPanel = document.getElementById('rekap-total-panel');
    const filterMode = document.getElementById('rekap-filter').value;

    let rows = Object.entries(rekapCachePerUser).map(([uid, r]) => {
        const p = (allUsersCache[uid] && allUsersCache[uid].profile) || {};
        const potonganPersen = hitungPotonganPersen(r.telatMenit);
        const potonganRupiah = (p.gajiHarian || 0) * potonganPersen / 100;
        return { uid, name: p.name || uid, ...r, potonganPersen, potonganRupiah };
    });

    if (filterMode === 'late') rows = rows.filter(r => r.telatMenit > 0);
    rows.sort((a, b) => b.telatMenit - a.telatMenit);

    if (rows.length === 0) {
        container.innerHTML = `<div class="col-span-2 py-6 text-center text-xs text-gray-400">Tidak ada data untuk bulan/filter ini.</div>`;
        if (totalPanel) totalPanel.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="col-span-2 overflow-x-auto">
            <table class="w-full text-xs">
                <thead>
                    <tr class="text-left text-[10px] font-extrabold uppercase text-gray-400 border-b border-gray-200">
                        <th class="py-2 pr-2">Karyawan</th><th class="py-2 pr-2">Hadir</th><th class="py-2 pr-2">Total Telat</th>
                        <th class="py-2 pr-2">Pulang Awal</th><th class="py-2 pr-2">Estimasi Potongan</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r => `
                        <tr class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onclick="openRekapDetail('${r.uid}')">
                            <td class="py-2 pr-2 font-bold text-indigo-600">${escapeHtml(r.name)}</td>
                            <td class="py-2 pr-2 font-semibold text-gray-700">${r.hadir} hari</td>
                            <td class="py-2 pr-2 font-semibold ${r.telatMenit > 0 ? 'text-red-500' : 'text-gray-400'}">${formatMenitJam(r.telatMenit)}</td>
                            <td class="py-2 pr-2 font-semibold ${r.pulangAwalMenit > 0 ? 'text-amber-500' : 'text-gray-400'}">${formatMenitJam(r.pulangAwalMenit)}</td>
                            <td class="py-2 pr-2 font-semibold ${r.potonganPersen > 0 ? 'text-red-600' : 'text-gray-400'}">${r.potonganPersen > 0 ? `${r.potonganPersen}% ${r.potonganRupiah > 0 ? '(Rp' + r.potonganRupiah.toLocaleString('id-ID') + ')' : ''}` : '-'}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;

    const totalTelat = rows.reduce((s, r) => s + r.telatMenit, 0);
    const totalPulangAwal = rows.reduce((s, r) => s + r.pulangAwalMenit, 0);
    const totalPotongan = rows.reduce((s, r) => s + r.potonganRupiah, 0);
    if (totalPanel) {
        totalPanel.innerHTML = `
            <div class="grid grid-cols-3 gap-4">
                <div><p class="text-[10px] font-extrabold uppercase text-gray-400">Total Menit Telat</p><p class="text-lg font-black text-red-500">${formatMenitJam(totalTelat)}</p></div>
                <div><p class="text-[10px] font-extrabold uppercase text-gray-400">Total Menit Pulang Awal</p><p class="text-lg font-black text-amber-500">${formatMenitJam(totalPulangAwal)}</p></div>
                <div><p class="text-[10px] font-extrabold uppercase text-gray-400">Estimasi Total Potongan</p><p class="text-lg font-black text-red-600">Rp${totalPotongan.toLocaleString('id-ID')}</p></div>
            </div>
            <p class="text-[10px] text-gray-400 mt-3 italic">Estimasi berdasarkan aturan potongan & gaji harian yang diisi per karyawan — bukan angka final payroll.</p>`;
    }
}

window.filterRekapAbsensi = function() { renderRekapAbsensi(); };

window.openRekapDetail = async function(uid) {
    const r = rekapCachePerUser[uid];
    if (!r) return;
    const p = (allUsersCache[uid] && allUsersCache[uid].profile) || {};

    const schedSnap = await getDocs(query(col('schedule'), where('tanggal', '>=', `${rekapCacheBulan}-01`), where('tanggal', '<=', `${rekapCacheBulan}-31`)));
    let wajibHari = 0;
    schedSnap.forEach(d => { if ((d.data().wajib_masuk || []).includes(uid)) wajibHari += 1; });
    const alfa = Math.max(0, wajibHari - r.hadir);
    const potonganPersen = hitungPotonganPersen(r.telatMenit);
    const potonganRupiah = (p.gajiHarian || 0) * potonganPersen / 100;

    document.getElementById('rekap-modal-name').textContent = p.name || uid;
    document.getElementById('rekap-modal-body').innerHTML = `
        <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-50 rounded-xl p-3"><p class="text-[10px] font-extrabold uppercase text-gray-400">Hari Wajib Masuk</p><p class="text-lg font-black text-gray-800">${wajibHari} hari</p></div>
            <div class="bg-gray-50 rounded-xl p-3"><p class="text-[10px] font-extrabold uppercase text-gray-400">Hari Hadir</p><p class="text-lg font-black text-gray-800">${r.hadir} hari</p></div>
            <div class="bg-red-50 rounded-xl p-3"><p class="text-[10px] font-extrabold uppercase text-red-400">Total Telat</p><p class="text-lg font-black text-red-600">${formatMenitJam(r.telatMenit)}</p></div>
            <div class="bg-amber-50 rounded-xl p-3"><p class="text-[10px] font-extrabold uppercase text-amber-500">Total Pulang Awal</p><p class="text-lg font-black text-amber-600">${formatMenitJam(r.pulangAwalMenit)}</p></div>
            <div class="bg-gray-900 rounded-xl p-3"><p class="text-[10px] font-extrabold uppercase text-gray-400">Alfa Bulan Ini</p><p class="text-lg font-black text-white">${alfa} hari</p></div>
            <div class="bg-red-100 rounded-xl p-3"><p class="text-[10px] font-extrabold uppercase text-red-500">Estimasi Potongan</p><p class="text-lg font-black text-red-700">${potonganPersen}%${potonganRupiah > 0 ? ' · Rp' + potonganRupiah.toLocaleString('id-ID') : ''}</p></div>
        </div>`;
    document.getElementById('rekap-detail-modal').classList.remove('hidden');
    document.getElementById('rekap-detail-modal').classList.add('flex');
};

window.closeRekapDetail = function() {
    document.getElementById('rekap-detail-modal').classList.add('hidden');
    document.getElementById('rekap-detail-modal').classList.remove('flex');
};

// ================= 11. KALENDER KERJA (dengan filter & acak per divisi) =================
let scheduleCacheBulan = {};

window.renderKalenderKerja = async function() {
    const bulan = document.getElementById('kalender-bulan').value || bulanIniDefault();
    const grid = document.getElementById('kalender-grid');
    grid.innerHTML = `<div class="col-span-7 py-6 text-center text-xs text-gray-400">Memuat kalender...</div>`;

    if (Object.keys(allUsersCache).length === 0) await loadAllUsers();

    const schedSnap = await getDocs(query(col('schedule'), where('tanggal', '>=', `${bulan}-01`), where('tanggal', '<=', `${bulan}-31`)));
    scheduleCacheBulan = {};
    schedSnap.forEach(d => { scheduleCacheBulan[d.id] = d.data().wajib_masuk || []; });

    const [y, m] = bulan.split('-').map(Number);
    const totalHari = jumlahHariDiBulan(bulan);
    const hariPertama = new Date(y, m - 1, 1).getDay();
    const namaHari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    let html = namaHari.map(h => `<div class="text-center text-[10px] font-extrabold uppercase text-gray-400 py-1">${h}</div>`).join('');
    for (let i = 0; i < hariPertama; i++) html += `<div></div>`;
    for (let d = 1; d <= totalHari; d++) {
        const tanggal = `${bulan}-${String(d).padStart(2, '0')}`;
        const jumlahWajib = (scheduleCacheBulan[tanggal] || []).length;
        html += `<button onclick="openKalenderModal('${tanggal}')" class="aspect-square flex flex-col items-center justify-center rounded-xl border text-xs font-bold transition ${jumlahWajib > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}"><span>${d}</span>${jumlahWajib > 0 ? `<span class="text-[9px] font-bold text-indigo-500">${jumlahWajib} org</span>` : ''}</button>`;
    }
    grid.innerHTML = html;
};

window.openKalenderModal = function(tanggal) {
    selectedCalendarDate = tanggal;
    document.getElementById('kalender-modal-tanggal').textContent = new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('kalender-divisi-filter').value = '';
    renderKalenderChecklist();
    document.getElementById('kalender-detail-modal').classList.remove('hidden');
    document.getElementById('kalender-detail-modal').classList.add('flex');
};

// Render ulang checklist sesuai filter divisi yang dipilih (dipanggil ulang saat filter berubah)
window.renderKalenderChecklist = function() {
    const wajibSet = new Set(scheduleCacheBulan[selectedCalendarDate] || []);
    const filterDivisi = document.getElementById('kalender-divisi-filter').value;
    const listEl = document.getElementById('kalender-modal-checklist');

    let userEntries = Object.entries(allUsersCache);
    if (filterDivisi) userEntries = userEntries.filter(([, u]) => (u.profile || {}).divisiId === filterDivisi);

    listEl.innerHTML = userEntries.length === 0
        ? `<p class="text-xs text-gray-400 italic py-2">Tidak ada karyawan pada divisi ini.</p>`
        : userEntries.map(([uid, u]) => {
            const p = u.profile || {};
            const checked = wajibSet.has(uid) ? 'checked' : '';
            const divisiNama = allDivisiCache[p.divisiId] ? allDivisiCache[p.divisiId].nama : '';
            return `<label class="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" value="${uid}" ${checked} class="kalender-checkbox w-4 h-4 rounded accent-indigo-600">
                <img src="${p.photo || 'https://via.placeholder.com/150'}" class="w-6 h-6 rounded-full object-cover">
                <span class="text-xs font-semibold text-gray-700">${escapeHtml(p.name || uid)}</span>
                ${divisiNama ? `<span class="text-[9px] text-gray-400 ml-auto">${escapeHtml(divisiNama)}</span>` : ''}
            </label>`;
        }).join('');
};

// Centang otomatis N orang acak dari hasil filter divisi yang sedang tampil
window.acakKaryawan = function() {
    const jumlah = parseInt(document.getElementById('kalender-acak-jumlah').value, 10);
    if (!jumlah || jumlah <= 0) { showToast('Masukkan jumlah karyawan yang mau diacak'); return; }

    const checkboxes = Array.from(document.querySelectorAll('.kalender-checkbox'));
    checkboxes.forEach(cb => cb.checked = false);

    const acak = [...checkboxes].sort(() => Math.random() - 0.5).slice(0, jumlah);
    acak.forEach(cb => cb.checked = true);
    showToast(`${acak.length} karyawan dipilih acak`);
};

window.closeKalenderModal = function() {
    document.getElementById('kalender-detail-modal').classList.add('hidden');
    document.getElementById('kalender-detail-modal').classList.remove('flex');
};

window.saveKalenderJadwal = function() {
    if (!selectedCalendarDate) return;
    const checked = Array.from(document.querySelectorAll('.kalender-checkbox:checked')).map(cb => cb.value);
    setDoc(docIn('schedule', selectedCalendarDate), { tanggal: selectedCalendarDate, wajib_masuk: checked, updatedAt: serverTimestamp(), updatedBy: adminUID }, { merge: true }).then(() => {
        showToast('Jadwal kerja disimpan');
        closeKalenderModal();
        renderKalenderKerja();
    }).catch(err => showToast('Gagal: ' + err.message));
};

// ================= 12. STATISTIK =================
async function loadStatistik() {
    const container = document.getElementById('statistik-content');
    container.innerHTML = `<div class="col-span-2 py-10 text-center text-xs text-gray-400">Menghitung statistik...</div>`;
    try {
        const bulanIni = bulanIniDefault();
        const [usersSnap, missionsSnap, vouchersSnap, quickMenuSnap, sharedSnap, claimsSnap, articlesSnap, attendanceSnap] = await Promise.all([
            getDocs(query(collection(firestore, 'users'), where('profile.institusiId', '==', myInstitusiId))),
            getDocs(col('missions')), getDocs(col('vouchers')), getDocs(col('quickMenu')), getDocs(col('shared')),
            getDocs(col('voucherClaims')), getDocs(col('articles')),
            getDocs(query(col('attendance'), where('tanggal', '>=', `${bulanIni}-01`), where('tanggal', '<=', `${bulanIni}-31`)))
        ]);

        const userList = usersSnap.docs.map(d => d.data());
        const totalUsers = userList.length;
        const totalPoints = userList.reduce((s, u) => s + ((u.rewards && u.rewards.points) || 0), 0);
        const totalPremium = userList.filter(u => u.profile?.isPremium === true).length;
        const totalVerified = userList.filter(u => u.profile?.isVerified === true).length;
        const totalMissions = missionsSnap.size, activeMissions = missionsSnap.docs.filter(d => d.data().active !== false).length;
        const totalVouchers = vouchersSnap.size, activeVouchers = vouchersSnap.docs.filter(d => d.data().active !== false).length;

        const claimsList = claimsSnap.docs.map(d => d.data());
        const claimCountByVoucher = {};
        claimsList.forEach(c => { const key = c.voucherId || c.voucherLabel || 'Tanpa nama'; if (!claimCountByVoucher[key]) claimCountByVoucher[key] = { label: c.voucherLabel || key, count: 0 }; claimCountByVoucher[key].count++; });
        const topVouchers = Object.values(claimCountByVoucher).sort((a, b) => b.count - a.count).slice(0, 5);

        const statusCount = { published: 0, pending: 0, draft: 0, rejected: 0 };
        articlesSnap.forEach(d => { const s = d.data().status; statusCount[s] = (statusCount[s] || 0) + 1; });

        container.innerHTML = `
            <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm"><p class="text-[10px] font-extrabold uppercase text-gray-400 mb-1">Total Pengguna</p><p class="text-2xl font-black text-gray-900">${totalUsers.toLocaleString('id-ID')}</p></div>
            <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm"><p class="text-[10px] font-extrabold uppercase text-gray-400 mb-1">Total Poin Beredar</p><p class="text-2xl font-black text-indigo-600">${totalPoints.toLocaleString('id-ID')}</p></div>
            <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm"><p class="text-[10px] font-extrabold uppercase text-gray-400 mb-1">Absensi Bulan Ini</p><p class="text-2xl font-black text-gray-900">${attendanceSnap.size.toLocaleString('id-ID')}</p></div>
            <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm"><p class="text-[10px] font-extrabold uppercase text-gray-400 mb-1">Member Premium</p><p class="text-2xl font-black text-amber-600">${totalPremium}</p><p class="text-[10px] text-gray-400 font-semibold mt-1">dari ${totalUsers} pengguna</p></div>
            <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm"><p class="text-[10px] font-extrabold uppercase text-gray-400 mb-1">Akun Terverifikasi</p><p class="text-2xl font-black text-blue-600">${totalVerified}</p><p class="text-[10px] text-gray-400 font-semibold mt-1">dari ${totalUsers} pengguna</p></div>
            <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm"><p class="text-[10px] font-extrabold uppercase text-gray-400 mb-1">Berkas Publik</p><p class="text-2xl font-black text-gray-900">${sharedSnap.size}</p></div>
            <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm"><p class="text-[10px] font-extrabold uppercase text-gray-400 mb-1">Menu Cepat</p><p class="text-2xl font-black text-gray-900">${quickMenuSnap.size}</p></div>
            <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm"><p class="text-[10px] font-extrabold uppercase text-gray-400 mb-1">Misi Harian</p><p class="text-2xl font-black text-gray-900">${totalMissions}</p><p class="text-[10px] text-emerald-600 font-bold mt-1">${activeMissions} aktif</p></div>
            <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm"><p class="text-[10px] font-extrabold uppercase text-gray-400 mb-1">Voucher</p><p class="text-2xl font-black text-gray-900">${totalVouchers}</p><p class="text-[10px] text-emerald-600 font-bold mt-1">${activeVouchers} aktif</p></div>
            <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm"><p class="text-[10px] font-extrabold uppercase text-gray-400 mb-1">Total Klaim Voucher</p><p class="text-2xl font-black text-gray-900">${claimsList.length}</p></div>
            <div class="col-span-2 sm:col-span-3 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <p class="text-[10px] font-extrabold uppercase text-gray-400 mb-3">Voucher Paling Sering Diklaim</p>
                ${topVouchers.length === 0 ? `<p class="text-xs text-gray-400 italic">Belum ada data.</p>` : `<div class="space-y-2">${topVouchers.map((v, i) => `<div class="flex items-center justify-between text-xs"><span class="font-semibold text-gray-700">${i + 1}. ${escapeHtml(v.label)}</span><span class="font-black text-indigo-600">${v.count}x</span></div>`).join('')}</div>`}
            </div>
            <div class="col-span-2 sm:col-span-3 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <p class="text-[10px] font-extrabold uppercase text-gray-400 mb-3">Artikel</p>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div><p class="text-xl font-black text-emerald-600">${statusCount.published}</p><p class="text-[10px] text-gray-400 font-semibold">Tayang</p></div>
                    <div><p class="text-xl font-black text-amber-600">${statusCount.pending}</p><p class="text-[10px] text-gray-400 font-semibold">Menunggu Review</p></div>
                    <div><p class="text-xl font-black text-gray-400">${statusCount.draft}</p><p class="text-[10px] text-gray-400 font-semibold">Draft</p></div>
                    <div><p class="text-xl font-black text-red-500">${statusCount.rejected}</p><p class="text-[10px] text-gray-400 font-semibold">Ditolak</p></div>
                </div>
            </div>`;
    } catch (err) {
        container.innerHTML = `<div class="col-span-2 py-10 text-center text-xs text-red-500">Gagal memuat statistik: ${err.message}</div>`;
    }
}
