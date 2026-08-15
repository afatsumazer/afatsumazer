// js/nft-member-card.js
// Template kartu member NFT untuk komunitas AFATSUMAZER — data disimpan di
// Firestore (collection "users"), bukan REST API kustom.
//
// Ketentuan:
// - Gambar kartu = NFT unik milik user, disimpan/di-mint per user
//   (field Firestore: nft_image_url). BUKAN gambar random/placeholder/upload bebas.
// - Wallet: connect (MetaMask) atau isi manual, TAPI wajib verifikasi
//   sidik jari (WebAuthn biometric) dulu sebelum alamat wallet disimpan.
//
// CATATAN PENTING soal "sidik jari" + Firestore:
// Browser tidak pernah memberi JS akses ke data sidik jari mentah — yang
// dipakai adalah WebAuthn API (sensor biometrik perangkat sebagai
// "platform authenticator"). Karena di sini TIDAK ada server backend
// (hanya Firestore sebagai database), verifikasi yang dilakukan hanya
// sebatas: dialog sidik jari perangkat berhasil diselesaikan (tidak
// dibatalkan). Ini BUKAN verifikasi kriptografis penuh (signature check)
// yang bisa dipercaya server — untuk itu Anda perlu menambahkan Firebase
// Cloud Function yang memverifikasi signature WebAuthn sebelum menyimpan
// data sensitif. Bagian yang perlu Cloud Function ditandai "// TODO Cloud Function".
//
// Dependensi: muat Firebase App + Firestore (compat SDK) SEBELUM file ini,
// lihat contoh di member.html.

const COMMUNITY_NAME = "AFATSUMAZER";

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

    const walletDisplay = user.wallet_address
        ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}`
        : "Belum terhubung";

    const fingerprintRegistered = !!user.webauthn_credential_id;

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
            <span class="text-slate-400">Verifikasi</span>
            <span class="fingerprint-status ${fingerprintRegistered ? "text-emerald-600" : "text-slate-400"}">
              ${fingerprintRegistered ? "Sidik jari terdaftar" : "Belum didaftarkan"}
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

        ${!fingerprintRegistered ? `
        <button
          onclick="registerFingerprint('${username}')"
          class="w-full mb-2 text-xs font-semibold bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-900 transition duration-200"
        >
          Daftarkan sidik jari
        </button>` : ""}

        <div class="flex gap-2 mb-2">
          <button
            onclick="connectWalletForUser('${username}')"
            class="flex-1 text-xs font-semibold bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition duration-200"
          >
            Connect wallet
          </button>
          <button
            onclick="toggleManualWalletInput('${username}')"
            class="flex-1 text-xs font-semibold bg-slate-100 text-slate-600 py-2 rounded-lg hover:bg-slate-200 transition duration-200"
          >
            Isi manual
          </button>
        </div>

        <div class="hidden gap-2" id="manual-wallet-${username}">
          <input
            type="text"
            placeholder="0x..."
            id="manual-wallet-input-${username}"
            class="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 font-mono"
          >
          <button
            onclick="saveManualWallet('${username}')"
            class="text-xs font-semibold bg-emerald-600 text-white px-3 rounded-lg hover:bg-emerald-700"
          >
            Simpan
          </button>
        </div>

        <button
          onclick="lihatPortofolio('${username}')"
          class="w-full mt-3 text-xs font-semibold bg-white border border-indigo-200 text-indigo-600 py-2 rounded-lg hover:bg-indigo-50 transition duration-200"
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

// ---------- WebAuthn (sidik jari / biometrik perangkat) ----------

function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = "";
    bytes.forEach((b) => (str += String.fromCharCode(b)));
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuffer(base64url) {
    const padded = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(
        base64url.length + (4 - (base64url.length % 4)) % 4, "="
    );
    const raw = atob(padded);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Daftarkan sidik jari/biometrik perangkat untuk user ini (sekali saja).
 * Challenge dibuat di client (crypto.getRandomValues) karena tidak ada
 * server. Untuk keamanan penuh, pindahkan pembuatan challenge + verifikasi
 * attestation ke Firebase Cloud Function.
 */
async function registerFingerprint(username) {
    if (!window.PublicKeyCredential) {
        alert("Perangkat/browser ini tidak mendukung verifikasi biometrik (WebAuthn).");
        return;
    }
    const platformAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!platformAvailable) {
        alert("Sensor sidik jari/biometrik tidak terdeteksi di perangkat ini.");
        return;
    }

    try {
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const userId = crypto.getRandomValues(new Uint8Array(16));

        const credential = await navigator.credentials.create({
            publicKey: {
                challenge,
                rp: { name: COMMUNITY_NAME },
                user: {
                    id: userId,
                    name: username,
                    displayName: username,
                },
                pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                authenticatorSelection: {
                    authenticatorAttachment: "platform", // wajib sensor bawaan perangkat
                    userVerification: "required",
                },
                timeout: 60000,
            },
        });

        // TODO Cloud Function: verifikasi attestationObject di server sebelum
        // dipercaya sepenuhnya. Di sini langsung disimpan (best-effort).
        const docRef = await getUserDocRef(username);
        await docRef.set(
            {
                webauthn_credential_id: bufferToBase64url(credential.rawId),
            },
            { merge: true }
        );

        const status = document.querySelector(`[data-username="${username}"] .fingerprint-status`);
        if (status) {
            status.textContent = "Sidik jari terdaftar";
            status.className = "fingerprint-status text-emerald-600";
        }
        alert("Sidik jari berhasil didaftarkan.");
    } catch (error) {
        console.error("Gagal mendaftarkan sidik jari:", error);
        alert("Pendaftaran sidik jari dibatalkan atau gagal.");
    }
}

/**
 * Minta verifikasi sidik jari/biometrik. Mengembalikan true/false.
 * CATATAN: tanpa server, ini hanya memastikan dialog biometrik perangkat
 * berhasil diselesaikan — bukan verifikasi signature kriptografis penuh.
 */
async function verifyFingerprint(username) {
    try {
        const docRef = await getUserDocRef(username);
        const doc = await docRef.get();
        const credentialId = doc.exists ? doc.data().webauthn_credential_id : null;

        if (!credentialId) {
            alert("Sidik jari belum didaftarkan untuk member ini.");
            return false;
        }

        const challenge = crypto.getRandomValues(new Uint8Array(32));

        await navigator.credentials.get({
            publicKey: {
                challenge,
                allowCredentials: [{ type: "public-key", id: base64urlToBuffer(credentialId) }],
                userVerification: "required",
                timeout: 60000,
            },
        });

        // TODO Cloud Function: kirim assertion ke server untuk verifikasi
        // signature sebenarnya. Tanpa itu, baris di bawah cuma "berhasil
        // diselesaikan tanpa error" = dianggap terverifikasi.
        return true;
    } catch (error) {
        console.error("Verifikasi sidik jari gagal:", error);
        return false;
    }
}

// ---------- Wallet (connect / manual), wajib lolos verifikasi sidik jari ----------

async function connectWalletForUser(username) {
    const ok = await verifyFingerprint(username);
    if (!ok) {
        alert("Verifikasi sidik jari gagal. Wallet tidak dapat dihubungkan.");
        return;
    }
    if (typeof window.ethereum === "undefined") {
        alert("Wallet extension (MetaMask) tidak terdeteksi. Silakan isi manual.");
        return;
    }
    try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        await saveWalletAddress(username, accounts[0]);
    } catch (error) {
        console.error("Gagal connect wallet:", error);
        alert("Gagal menghubungkan wallet. Coba lagi.");
    }
}

function toggleManualWalletInput(username) {
    const box = document.getElementById(`manual-wallet-${username}`);
    box.classList.toggle("hidden");
    box.classList.toggle("flex");
}

async function saveManualWallet(username) {
    const input = document.getElementById(`manual-wallet-input-${username}`);
    const address = input.value.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        alert("Format alamat wallet tidak valid.");
        return;
    }
    const ok = await verifyFingerprint(username);
    if (!ok) {
        alert("Verifikasi sidik jari gagal. Alamat wallet tidak disimpan.");
        return;
    }
    await saveWalletAddress(username, address);
}

async function saveWalletAddress(username, address) {
    try {
        const docRef = await getUserDocRef(username);
        await docRef.set({ wallet_address: address }, { merge: true });

        const card = document.querySelector(`[data-username="${username}"] .wallet-address`);
        if (card) {
            card.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
        }
    } catch (error) {
        console.error("Gagal menyimpan alamat wallet ke Firestore:", error);
        alert("Gagal menyimpan alamat wallet.");
    }
}

document.addEventListener("DOMContentLoaded", () => fetchAllUsersAsNftCards());
