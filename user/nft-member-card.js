// js/nft-member-card.js
// Template kartu member NFT untuk komunitas AFATSUMAZER — data disimpan di
// Firestore (collection "users"), bukan REST API kustom.
//
// Ketentuan:
// - Gambar kartu = NFT unik milik user, disimpan/di-mint per user
//   (field Firestore: nft_image_url). BUKAN gambar random/placeholder/upload bebas.
// - Wallet: PASSKEY ITU SENDIRI adalah wallet-nya (tidak ada MetaMask, tidak
//   ada seed phrase, tidak ada isi alamat manual). Saat member menekan
//   tombol "Buat wallet dengan sidik jari", Coinbase Smart Wallet SDK akan:
//     1) memicu dialog biometrik perangkat (sidik jari/Face ID/Windows Hello)
//        untuk membuat atau memakai ulang passkey member,
//     2) memakai passkey itu sebagai "pemilik" sebuah smart contract wallet
//        (ERC-4337, ditandatangani lewat WebAuthn/P-256),
//     3) mengembalikan alamat wallet on-chain yang siap dipakai di Polygon.
//   Coinbase yang menjalankan bundler ERC-4337 di baliknya — kita tidak perlu
//   server sendiri untuk itu.
//
// LOGIN (WAJIB — sesuai Firestore Rules Anda):
// Rules Anda mensyaratkan request.auth.uid == userId (Document ID di
// collection "users" = UID Firebase Auth) sebelum wallet_address boleh
// ditulis. Halaman member NFT ini sebelumnya TIDAK punya sesi login sama
// sekali, jadi write selalu ditolak. Sekarang halaman ini punya bar login
// sendiri (Google + Email/Password) yang dirender di atas grid kartu member.
// Member HARUS login dulu, dan cuma bisa membuat/kelola wallet untuk
// KARTUNYA SENDIRI (dicocokkan lewat field "username" di dokumen users/{uid}
// miliknya) — mencoba klik tombol wallet di kartu orang lain akan ditolak,
// baik oleh kode ini maupun oleh Firestore Rules.
//
// TAMBAHAN WAJIB DI HTML: muat firebase-auth-compat.js SEBELUM file ini,
// contoh (versi sama dengan app/firestore yang sudah Anda pakai):
//   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
//
// CATATAN LAIN:
// - appName di bawah adalah label yang dilihat member saat dialog passkey
//   muncul — ganti sesuai nama produk Anda kalau berbeda dari komunitas.
// - Untuk mainnet Polygon (chain id 137), Coinbase TIDAK otomatis
//   men-sponsor gas seperti di Base. Kalau mau transaksi member gratis gas,
//   Anda perlu setup paymaster sendiri (mis. lewat thirdweb atau Pimlico).
//   Tanpa itu, member perlu sedikit POL di wallet mereka untuk transaksi.
//
// Dependensi: muat Firebase App + Firestore + Auth (compat SDK) SEBELUM
// file ini. Coinbase Wallet SDK dimuat otomatis lewat dynamic import() —
// tidak perlu tambah <script> lagi untuk itu.

const COMMUNITY_NAME = "AFATSUMAZER";
const POLYGON_CHAIN_ID = 137;

const firebaseConfig = {
    apiKey: "AIzaSyDg2b6LERZ2zE86mTiYvUO1Uj--lAtpmgM",
    authDomain: "afatsumazer-app.firebaseapp.com",
    databaseURL: "https://afatsumazer-app-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "afatsumazer-app",
    storageBucket: "afatsumazer-app.firebasestorage.app",
    messagingSenderId: "16280759060",
    appId: "1:16280759060:web:fd4deacafdf5cadd777001",
    measurementId: "G-WB9YW9D726",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const USERS_COLLECTION = "users";

// Diisi otomatis oleh onAuthStateChanged di bawah.
let currentUser = null;
let currentUsername = null;

function renderNftMemberCard(user, options = {}) {
    const {
        tier = "Member",
        tokenId = "0001",
        network = "Polygon",
        joined = "",
    } = options;

    const fullName = user.fullname || "Tanpa nama";
    const username = user.username || "unknown";

    const nftImage = user.nft_image_url;
    const imageBlock = nftImage
        ? `<img src="${nftImage}" class="w-full h-full object-cover" alt="NFT ${fullName}">`
        : `<div class="w-full h-full flex items-center justify-center text-xs text-slate-400 text-center px-3">NFT belum di-mint untuk user ini</div>`;

    const hasWallet = !!user.wallet_address;
    const walletDisplay = hasWallet
        ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}`
        : "Belum ada wallet";

    return `
    <div class="w-full max-w-[320px] rounded-2xl p-[1.5px] bg-gradient-to-br from-indigo-400 to-emerald-400" data-username="${username}">
      <div class="bg-white rounded-2xl p-5">
        <div class="flex items-center justify-between mb-4">
          <span class="text-sm font-bold text-slate-800 tracking-wide">${COMMUNITY_NAME}</span>
          <span class="text-xs font-semibold px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600">${tier}</span>
        </div>

        <div class="w-full aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-100 mb-4">
          ${imageBlock}
        </div>

        <h4 class="text-base font-bold text-slate-800 mb-0.5">${fullName}</h4>
        <p class="text-xs text-slate-400 mb-4">@${username} · Token #${tokenId}</p>

        <div class="border-t border-slate-100 pt-3 space-y-2 text-xs mb-3">
          <div class="flex justify-between items-center">
            <span class="text-slate-400">Wallet</span>
            <span class="font-mono text-slate-700 wallet-address">${walletDisplay}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-slate-400">Diamankan dengan</span>
            <span class="wallet-security ${hasWallet ? "text-emerald-600" : "text-slate-400"}">
              ${hasWallet ? "Passkey (sidik jari/Face ID)" : "Belum ada wallet"}
            </span>
          </div>
          ${joined ? `
          <div class="flex justify-between">
            <span class="text-slate-400">Bergabung</span>
            <span class="text-slate-700">${joined}</span>
          </div>` : ""}
          <div class="flex justify-between">
            <span class="text-slate-400">Jaringan</span>
            <span class="text-slate-700">${network}</span>
          </div>
        </div>

        <button
          onclick="connectPasskeyWallet('${username}')"
          class="wallet-connect-btn w-full mb-2 text-xs font-semibold py-2 rounded-lg transition duration-200 ${hasWallet ? "bg-slate-100 text-slate-500" : "bg-slate-800 text-white hover:bg-slate-900"}"
        >
          ${hasWallet ? "Wallet aktif ✓" : "Buat wallet dengan sidik jari"}
        </button>

        <button
          onclick="lihatPortofolio('${username}')"
          class="w-full text-xs font-semibold bg-white border border-indigo-200 text-indigo-600 py-2 rounded-lg hover:bg-indigo-50 transition duration-200"
        >
          Lihat profil
        </button>
      </div>
    </div>
  `;
}

/**
 * Ambil semua dokumen user dari Firestore dan render sebagai kartu NFT.
 * Setiap dokumen disimpan doc.id-nya juga (dipakai kalau field username kosong).
 */
async function fetchAllUsersAsNftCards(containerId = "users-container") {
    try {
        const snapshot = await db.collection(USERS_COLLECTION).get();

        const listContainer = document.getElementById(containerId);
        listContainer.innerHTML = "";
        listContainer.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";

        snapshot.docs.forEach((doc, index) => {
            const user = { ...doc.data() };
            if (!user.username) user.username = doc.id;

            const cardWrapper = document.createElement("div");
            cardWrapper.innerHTML = renderNftMemberCard(user, {
                tokenId: String(index + 1).padStart(4, "0"),
            });
            listContainer.appendChild(cardWrapper.firstElementChild);
        });
    } catch (error) {
        console.error("Gagal memuat kartu member NFT dari Firestore:", error);
    }
}

/**
 * Cari dokumen user berdasarkan field "username". Fallback ke doc ID
 * langsung kalau tidak ketemu lewat query field (dipakai untuk BACA saja —
 * penulisan wallet SELALU langsung ke users/{currentUser.uid}, lihat
 * saveWalletAddress()).
 */
async function getUserDocRef(username) {
    const query = await db.collection(USERS_COLLECTION).where("username", "==", username).limit(1).get();
    if (!query.empty) return query.docs[0].ref;
    return db.collection(USERS_COLLECTION).doc(username);
}

// ---------- Login member (Google / Email+Password) ----------
//
// Firestore Rules mensyaratkan request.auth.uid == Document ID di
// collection "users". Bar login ini dirender di atas grid kartu member,
// dan statusnya (currentUser/currentUsername) dipakai untuk membatasi
// siapa yang boleh menekan tombol wallet di kartu mana.

function ensureAuthBar() {
    let bar = document.getElementById("afz-auth-bar");
    if (bar) return bar;

    const section = document.querySelector(".afz-cards-section");
    const usersContainer = document.getElementById("users-container");
    if (!section || !usersContainer) return null;

    bar = document.createElement("div");
    bar.id = "afz-auth-bar";
    section.insertBefore(bar, usersContainer);
    return bar;
}

function renderAuthBar() {
    const bar = ensureAuthBar();
    if (!bar) return;

    if (currentUser) {
        bar.innerHTML = `
        <div class="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 flex flex-wrap items-center gap-3">
          <span class="text-xs text-white/70 flex-1 min-w-[200px]">
            Login sebagai <span class="font-mono">${currentUser.email || currentUser.uid}</span>
          </span>
          <button onclick="logoutMember()" class="text-xs font-semibold border border-white/20 text-white px-3 py-2 rounded-lg hover:bg-white/10 transition">
            Logout
          </button>
        </div>
        `;
        return;
    }

    bar.innerHTML = `
    <div class="mb-3 rounded-xl border border-white/10 bg-white/5 p-4 flex flex-wrap items-center gap-3">
      <span class="text-xs text-white/70 flex-1 min-w-[200px]">Login untuk membuat/kelola wallet member Anda sendiri.</span>
      <button onclick="loginWithGoogle()" class="text-xs font-semibold bg-white text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition">
        Login dengan Google
      </button>
      <button onclick="toggleEmailLoginForm()" class="text-xs font-semibold border border-white/20 text-white px-3 py-2 rounded-lg hover:bg-white/10 transition">
        Login dengan Email
      </button>
    </div>
    <form id="afz-email-login-form" onsubmit="submitEmailLogin(event)" class="hidden mb-6 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
      <input type="email" id="afz-email-input" placeholder="Email" required autocomplete="username"
             class="flex-1 min-w-[160px] text-xs rounded-lg px-3 py-2 bg-white/10 text-white placeholder-white/40 border border-white/10">
      <input type="password" id="afz-password-input" placeholder="Password" required autocomplete="current-password"
             class="flex-1 min-w-[160px] text-xs rounded-lg px-3 py-2 bg-white/10 text-white placeholder-white/40 border border-white/10">
      <button type="submit" class="text-xs font-semibold bg-emerald-500 text-white px-3 py-2 rounded-lg hover:bg-emerald-600 transition">
        Masuk
      </button>
    </form>
    `;
}

function toggleEmailLoginForm() {
    const form = document.getElementById("afz-email-login-form");
    if (form) form.classList.toggle("hidden");
}

async function loginWithGoogle() {
    try {
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch (error) {
        console.error("Login Google gagal:", error);
        alert("Login dengan Google gagal atau dibatalkan.");
    }
}

async function submitEmailLogin(event) {
    event.preventDefault();
    const email = document.getElementById("afz-email-input").value.trim();
    const password = document.getElementById("afz-password-input").value;
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error("Login email gagal:", error);
        alert("Email atau password salah.");
    }
}

function logoutMember() {
    auth.signOut();
}

auth.onAuthStateChanged(async (user) => {
    currentUser = user;

    if (user) {
        try {
            const snap = await db.collection(USERS_COLLECTION).doc(user.uid).get();
            currentUsername = snap.exists ? (snap.data().username || user.uid) : user.uid;
        } catch (error) {
            console.error("Gagal membaca dokumen user yang login:", error);
            currentUsername = user.uid;
        }
    } else {
        currentUsername = null;
    }

    renderAuthBar();
});

// ---------- Wallet = Passkey (Coinbase Smart Wallet, ERC-4337, Polygon) ----------
//
// Tidak ada lagi WebAuthn manual (navigator.credentials.create/get) dan
// tidak ada lagi window.ethereum/MetaMask di sini. Coinbase Wallet SDK yang
// menjalankan seluruh alur passkey <-> smart contract wallet di baliknya.

let smartWalletProviderPromise = null;

/**
 * Muat Coinbase Wallet SDK (lazy, sekali saja) dan siapkan provider yang
 * DIPAKSA hanya menawarkan opsi Smart Wallet (passkey) — bukan koneksi ke
 * ekstensi/app Coinbase Wallet biasa.
 */
async function getSmartWalletProvider() {
    if (!smartWalletProviderPromise) {
        smartWalletProviderPromise = import("https://esm.sh/@coinbase/wallet-sdk@4")
            .then(({ CoinbaseWalletSDK }) => {
                const sdk = new CoinbaseWalletSDK({
                    appName: COMMUNITY_NAME,
                    appChainIds: [POLYGON_CHAIN_ID],
                });
                return sdk.makeWeb3Provider({
                    options: "smartWalletOnly",
                    attribution: { auto: true },
                });
            })
            .catch((error) => {
                smartWalletProviderPromise = null; // biar bisa dicoba ulang kalau gagal load
                throw error;
            });
    }
    return smartWalletProviderPromise;
}

// Mulai muat SDK-nya dari sekarang (saat script ini di-parse), bukan menunggu
// sampai tombol diklik. Alasan: proses provider.request() di dalamnya
// MEMBUKA POPUP ke keys.coinbase.com untuk dialog passkey, dan popup itu
// hanya diizinkan browser kalau terjadi LANGSUNG di dalam event klik.
// Kalau kita baru mulai `import()` lewat jaringan setelah tombol diklik,
// waktu tunggunya memutus konteks klik itu -> popup diblokir (ini yang
// menyebabkan "Wallet tidak berhasil dibuat/disambungkan" di Chrome Android).
// Dengan dipanggil lebih awal di sini, saat tombol diklik SDK sudah siap
// (promise sudah resolved), jadi provider.request() jadi langkah pertama
// yang benar-benar jalan dalam konteks klik.
getSmartWalletProvider().catch((error) => {
    console.warn("Gagal pre-load Coinbase Wallet SDK (akan dicoba ulang saat tombol diklik):", error);
});

/**
 * Handler tombol "Buat wallet dengan sidik jari". Memicu dialog biometrik
 * perangkat lewat Coinbase Smart Wallet SDK, lalu menyimpan alamat wallet
 * yang dihasilkan ke Firestore — HANYA untuk member yang sedang login dan
 * hanya untuk kartu miliknya sendiri (sesuai Firestore Rules).
 */
async function connectPasskeyWallet(username) {
    if (!currentUser) {
        alert("Silakan login dulu (Google atau Email) untuk membuat wallet.");
        document.getElementById("afz-auth-bar")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }
    if (username !== currentUsername) {
        alert("Anda cuma bisa membuat/kelola wallet untuk akun Anda sendiri. Login sebagai member ini dulu.");
        return;
    }

    const btn = document.querySelector(`[data-username="${username}"] .wallet-connect-btn`);
    const originalLabel = btn ? btn.textContent : "";

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Menunggu sidik jari…";
    }

    try {
        const provider = await getSmartWalletProvider();
        const accounts = await provider.request({ method: "eth_requestAccounts" });
        const address = accounts[0];

        if (!address) {
            throw new Error("Tidak ada alamat wallet yang dikembalikan.");
        }

        await saveWalletAddress(username, address);

        if (btn) {
            btn.disabled = false;
            btn.textContent = "Wallet aktif ✓";
            btn.classList.remove("bg-slate-800", "hover:bg-slate-900", "text-white");
            btn.classList.add("bg-slate-100", "text-slate-500");
        }
    } catch (error) {
        console.error("Gagal membuat/menyambungkan wallet passkey:", error);
        alert("Wallet tidak berhasil dibuat/disambungkan. Coba lagi.");
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalLabel;
        }
    }
}

async function saveWalletAddress(username, address) {
    try {
        // Ditulis LANGSUNG ke users/{currentUser.uid} (bukan lewat lookup
        // by-username) supaya path dokumennya pasti sama dengan yang
        // disyaratkan Firestore Rules: request.auth.uid == userId.
        await db.collection(USERS_COLLECTION).doc(currentUser.uid).set(
            { wallet_address: address }, // field lain (wallet_type, dst) belum
            { merge: true }              // diizinkan rules — lihat catatan di atas.
        );

        const card = document.querySelector(`[data-username="${username}"]`);
        if (card) {
            const addrEl = card.querySelector(".wallet-address");
            if (addrEl) addrEl.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;

            const secEl = card.querySelector(".wallet-security");
            if (secEl) {
                secEl.textContent = "Passkey (sidik jari/Face ID)";
                secEl.className = "wallet-security text-emerald-600";
            }
        }
    } catch (error) {
        console.error("Gagal menyimpan alamat wallet ke Firestore:", error);
        alert("Wallet berhasil dibuat, tapi gagal disimpan ke database. Coba tekan tombolnya lagi.");
        throw error;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    fetchAllUsersAsNftCards();
    renderAuthBar();
});
