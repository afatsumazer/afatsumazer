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
// CATATAN KEAMANAN:
// - saveWalletAddress() di bawah menulis ke Firestore tanpa pengecekan
//   Firebase Auth. Selama Firestore Security Rules Anda mengizinkan write ke
//   collection "users" dari client manapun, siapa pun bisa memanggil fungsi
//   ini dengan username orang lain. Sebelum production, batasi write
//   wallet_address lewat Firestore Rules (idealnya: hanya user yang sedang
//   login lewat Firebase Auth dan cocok dengan dokumennya sendiri) atau
//   pindahkan penulisan ini ke Firebase Cloud Function.
// - appName di bawah adalah label yang dilihat member saat dialog passkey
//   muncul — ganti sesuai nama produk Anda kalau berbeda dari komunitas.
// - Untuk mainnet Polygon (chain id 137), Coinbase TIDAK otomatis
//   men-sponsor gas seperti di Base. Kalau mau transaksi member gratis gas,
//   Anda perlu setup paymaster sendiri (mis. lewat thirdweb atau Pimlico).
//   Tanpa itu, member perlu sedikit POL di wallet mereka untuk transaksi.
//
// Dependensi: muat Firebase App + Firestore (compat SDK) SEBELUM file ini,
// lihat contoh di member.html. Coinbase Wallet SDK dimuat otomatis lewat
// dynamic import() saat tombol wallet pertama kali ditekan — tidak perlu
// tambah <script> lagi di HTML.

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
const USERS_COLLECTION = "users";

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
 * langsung kalau tidak ketemu lewat query field (untuk kompatibilitas
 * dengan data lama yang doc ID-nya = username).
 */
async function getUserDocRef(username) {
    const query = await db.collection(USERS_COLLECTION).where("username", "==", username).limit(1).get();
    if (!query.empty) return query.docs[0].ref;
    return db.collection(USERS_COLLECTION).doc(username);
}

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

/**
 * Handler tombol "Buat wallet dengan sidik jari". Memicu dialog biometrik
 * perangkat lewat Coinbase Smart Wallet SDK, lalu menyimpan alamat wallet
 * yang dihasilkan ke Firestore.
 */
async function connectPasskeyWallet(username) {
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
        const docRef = await getUserDocRef(username);
        await docRef.set(
            {
                wallet_address: address,
                wallet_type: "coinbase_smart_wallet_passkey",
                wallet_chain_id: POLYGON_CHAIN_ID,
            },
            { merge: true }
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

document.addEventListener("DOMContentLoaded", () => fetchAllUsersAsNftCards());
