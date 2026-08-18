// js/absensi.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Teks QR resmi kantor dibuat per-institusi (lihat kodeQrInstitusi() di bawah) —
// supaya QR institusi A tidak bisa dipakai absen di institusi B.

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

let myUID = null;
let myInstitusiId = null;
let institusiData = {};
let html5QrCode = null;
let modeScanSaatIni = 'masuk'; // 'masuk' | 'pulang'
let reminderTimer = null;
let bellNotifications = [];

function showToast(msg) {
    const el = document.getElementById('absensi-toast');
    el.textContent = msg;
    el.classList.remove('-bottom-16');
    el.classList.add('bottom-6');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { el.classList.remove('bottom-6'); el.classList.add('-bottom-16'); }, 2200);
}

function tanggalHariIni() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function jarakMeter(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Teks QR resmi institusi ini — HARUS SAMA PERSIS dengan yang dipakai admin saat
// generate QR di admin.html (tab Lokasi & Divisi -> QR Absensi Kantor).
function kodeQrInstitusi() {
    return `AFATSUMAZER-ABSEN-KANTOR:${myInstitusiId}`;
}

function ambilLokasi() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('Perangkat tidak mendukung GPS')); return; }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            err => reject(new Error('Gagal mengambil lokasi: ' + err.message)),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

// ================= 1. GERBANG AKSES =================
let myNama = '';
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "login.html"; return; }
    myUID = user.uid;

    const userSnap = await getDoc(doc(firestore, 'users', user.uid));
    const profile = (userSnap.exists() ? userSnap.data() : {}).profile || {};
    myInstitusiId = profile.institusiId;
    myNama = profile.name || user.uid;

    document.getElementById('access-checking').classList.add('hidden');

    if (!myInstitusiId) {
        showToast('Akun ini belum terhubung ke institusi manapun');
        return;
    }

    const instSnap = await getDoc(doc(firestore, 'institutions', myInstitusiId));
    institusiData = instSnap.exists() ? instSnap.data() : {};

    document.getElementById('absensi-content').classList.remove('hidden');
    document.getElementById('absensi-tanggal').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    await muatStatusHariIni();
    aturPengingatSenyap();
});

// Kirim satu baris data absen ke Apps Script Web App milik institusi ini (fire-and-forget).
function kirimAbsensiKeSheet(payload) {
    const url = institusiData.sheetWebhookUrl;
    if (!url) return;
    fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
    }).catch(() => { /* absensi tetap tersimpan di Firestore walau Sheets gagal dikirim */ });
}

// ================= 2. STATUS ABSENSI HARI INI =================
async function muatStatusHariIni() {
    const docId = `${tanggalHariIni()}_${myUID}`;
    const snap = await getDoc(doc(firestore, 'institutions', myInstitusiId, 'attendance', docId));

    const iconEl = document.getElementById('absensi-status-icon');
    const textEl = document.getElementById('absensi-status-text');
    const subEl = document.getElementById('absensi-status-sub');
    const btnEl = document.getElementById('absensi-scan-btn');
    const jamMasukEl = document.getElementById('absensi-jam-masuk');
    const jamPulangEl = document.getElementById('absensi-jam-pulang');

    if (!snap.exists()) {
        modeScanSaatIni = 'masuk';
        iconEl.textContent = '⏳';
        textEl.textContent = 'Belum Absen';
        subEl.textContent = 'Scan QR di kantor untuk absen masuk';
        btnEl.textContent = '📷 Scan QR Absen Masuk';
        btnEl.disabled = false;
        jamMasukEl.textContent = '--:--';
        jamPulangEl.textContent = '--:--';
        return;
    }

    const a = snap.data();
    const jamMasuk = a.jam_masuk && a.jam_masuk.toDate ? a.jam_masuk.toDate() : null;
    const jamPulang = a.jam_pulang && a.jam_pulang.toDate ? a.jam_pulang.toDate() : null;
    jamMasukEl.textContent = jamMasuk ? jamMasuk.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    jamPulangEl.textContent = jamPulang ? jamPulang.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--';

    if (jamMasuk && !jamPulang) {
        modeScanSaatIni = 'pulang';
        iconEl.textContent = '🟢';
        textEl.textContent = 'Sudah Absen Masuk';
        subEl.textContent = 'Scan QR lagi saat pulang';
        btnEl.textContent = '📷 Scan QR Absen Pulang';
        btnEl.disabled = false;
    } else if (jamMasuk && jamPulang) {
        iconEl.textContent = '✅';
        textEl.textContent = 'Absensi Hari Ini Selesai';
        subEl.textContent = 'Sampai jumpa besok';
        btnEl.textContent = 'Absensi Selesai';
        btnEl.disabled = true;
    }
}

// ================= 3. SCANNER QR =================
window.bukaScanner = function() {
    document.getElementById('scanner-modal').classList.remove('hidden');
    document.getElementById('scanner-modal').classList.add('flex');
    document.getElementById('scanner-status').textContent = 'Memuat kamera...';

    html5QrCode = new Html5Qrcode('qr-reader');
    html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        onScanSukses,
        () => {} // error per-frame diabaikan, cukup normal saat kamera masih mencari QR
    ).catch(err => {
        document.getElementById('scanner-status').textContent = 'Gagal membuka kamera: ' + err;
    });
};

window.tutupScanner = function() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
    }
    document.getElementById('scanner-modal').classList.add('hidden');
    document.getElementById('scanner-modal').classList.remove('flex');
};

async function onScanSukses(decodedText) {
    if (decodedText.trim() !== kodeQrInstitusi()) {
        document.getElementById('scanner-status').textContent = 'QR tidak dikenali, coba lagi.';
        return;
    }

    if (html5QrCode) { html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {}); }
    document.getElementById('scanner-status').textContent = 'QR terbaca. Memeriksa lokasi...';

    try {
        const lokasi = await ambilLokasi();

        // ---- Cek integritas lokasi (geofencing) terhadap titik kantor yang admin set ----
        const lok = institusiData.lokasiKantor;
        if (lok && lok.lat && lok.lng) {
            const jarak = jarakMeter(lokasi.lat, lokasi.lng, lok.lat, lok.lng);
            if (jarak > (lok.radius || 100)) {
                document.getElementById('scanner-status').textContent = `Di luar area kantor (±${Math.round(jarak)}m dari titik kantor). Absensi ditolak.`;
                showToast('Lokasi di luar radius kantor');
                return;
            }
        }

        await catatAbsensi(lokasi);
        window.tutupScanner();
        await muatStatusHariIni();
        showToast(modeScanSaatIni === 'pulang' ? 'Absen masuk berhasil' : 'Absen pulang berhasil');
    } catch (err) {
        document.getElementById('scanner-status').textContent = err.message;
    }
}

// Mekanisme scan cerdas: dokumen id = {tanggal}_{uid}. Scan pertama → catat sebagai
// Absen Masuk (create). Scan kedua di hari yang sama → otomatis jadi Absen Pulang (update).
// serverTimestamp() dipakai supaya jam HP tidak bisa dimanipulasi.
async function catatAbsensi(lokasi) {
    const tanggal = tanggalHariIni();
    const docId = `${tanggal}_${myUID}`;
    const ref = doc(firestore, 'institutions', myInstitusiId, 'attendance', docId);
    const existing = await getDoc(ref);
    const jamSekarang = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (!existing.exists()) {
        await setDoc(ref, {
            uid: myUID, tanggal, status: 'masuk',
            jam_masuk: serverTimestamp(), jam_pulang: null,
            lokasi_masuk: lokasi, lokasi_pulang: null
        });
        modeScanSaatIni = 'pulang';
        kirimAbsensiKeSheet({ docId, tanggal, nama: myNama, uid: myUID, jamMasuk: jamSekarang, jamPulang: '', status: 'masuk', sumber: 'Scan' });
    } else {
        await updateDoc(ref, { status: 'pulang', jam_pulang: serverTimestamp(), lokasi_pulang: lokasi });
        modeScanSaatIni = 'masuk';
        const d = existing.data();
        const jamMasukLama = d.jam_masuk && d.jam_masuk.toDate ? d.jam_masuk.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
        kirimAbsensiKeSheet({ docId, tanggal, nama: myNama, uid: myUID, jamMasuk: jamMasukLama, jamPulang: jamSekarang, status: 'pulang', sumber: 'Scan' });
    }
}

// ================= 4. PENGINGAT SENYAP (15 MENIT SEBELUM JAM MASUK) =================
function aturPengingatSenyap() {
    if (Notification && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
    // Cek tiap menit apakah sudah masuk jendela 15 menit sebelum jam masuk
    reminderTimer = setInterval(cekWaktuPengingat, 60 * 1000);
    cekWaktuPengingat();
}

function cekWaktuPengingat() {
    const jamMasuk = institusiData.jamMasuk || '08:00';
    const [jm, mm] = jamMasuk.split(':').map(Number);
    const now = new Date();
    const targetMasuk = new Date(now.getFullYear(), now.getMonth(), now.getDate(), jm, mm, 0);
    const menitMenujuMasuk = (targetMasuk - now) / 60000;

    // Jendela pengingat: 15 menit sampai 14 menit sebelum jam masuk (sekali per hari)
    if (menitMenujuMasuk <= 15 && menitMenujuMasuk > 14 && !cekWaktuPengingat._sudahHariIni) {
        cekWaktuPengingat._sudahHariIni = tanggalHariIni();
        kirimPengingatSenyap(`Jam masuk kerja (${jamMasuk}) sebentar lagi — 15 menit lagi.`);
    }
    // Reset penanda tiap ganti hari
    if (cekWaktuPengingat._sudahHariIni && cekWaktuPengingat._sudahHariIni !== tanggalHariIni()) {
        cekWaktuPengingat._sudahHariIni = null;
    }
}

function kirimPengingatSenyap(pesan) {
    // Notifikasi SENYAP (silent: true) — tidak bunyi/getar, tapi tetap tercatat di dropdown bel
    // dan memicu indikator visual titik merah berkedip (animate-ping) di ikon lonceng.
    if (Notification && Notification.permission === 'granted') {
        try {
            new Notification('Afatsumazer', { body: pesan, silent: true, tag: 'jam-masuk-reminder' });
        } catch (e) { /* sebagian browser mobile tidak izinkan Notification langsung, abaikan */ }
    }

    bellNotifications.unshift({ pesan, waktu: new Date() });
    renderBellDropdown();
    document.getElementById('bell-dot').classList.remove('hidden');
    document.getElementById('bell-dot-static').classList.remove('hidden');
}

function renderBellDropdown() {
    const listEl = document.getElementById('bell-dropdown-list');
    if (bellNotifications.length === 0) {
        listEl.innerHTML = `<p class="text-xs text-gray-400 italic px-1 py-2">Belum ada pengingat.</p>`;
        return;
    }
    listEl.innerHTML = bellNotifications.map(n => `
        <div class="px-2 py-2 rounded-xl hover:bg-gray-50">
            <p class="text-xs font-semibold text-gray-700">${n.pesan}</p>
            <p class="text-[10px] text-gray-400 mt-0.5">${n.waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>`).join('');
}

window.toggleBellDropdown = function() {
    const dd = document.getElementById('bell-dropdown');
    dd.classList.toggle('hidden');
    if (!dd.classList.contains('hidden')) {
        // Membuka dropdown = "dibaca" -> matikan indikator merah berkedip
        document.getElementById('bell-dot').classList.add('hidden');
        document.getElementById('bell-dot-static').classList.add('hidden');
    }
};
