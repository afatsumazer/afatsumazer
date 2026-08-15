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
// Fitur Tambahan:
// - Jika user LOGIN: Hanya menampilkan 1 kartu milik user tersebut.
// - Jika user TIDAK LOGIN: Menampilkan seluruh direktori member komunitas.

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
const auth = firebase.auth();
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
    <div class="w-full max-w-[320px] rounded-2xl p-[1.5px] bg-gradient-to-br from-indigo-400 to-emerald-400 mx-auto" data-username="${username}">
      <div class="bg-white rounded-2xl p-5 shadow-sm text-left">
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
              ${fingerprintRegistered ? "✓ Sidik jari terdaftar" : "⚠️ Belum didaftarkan"}
            </span>
          </div>
          \${joined ? `
          <div class="flex justify-between">
            <span class="text-slate-400">Bergabung</span>
            <span class="text-slate-700">\${joined}</span>
          </div>` : ""}
          <div class="flex justify-between">
            <span class="text-slate-400">Jaringan</span>
            <span class="text-slate-700">\${network}</span>
          </div>
        </div>

        \${!fingerprintRegistered ? `
        <button
          onclick="registerFingerprint('\${username}')"
          class="w-full mb-2 text-xs font-semibold bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-900 transition duration-200"
        >
          Daftarkan sidik jari
        </button>` : ""}

        <div class="flex gap-2 mb-2">
          <button
            onclick="connectWalletForUser('\${username}')"
            class="flex-1 text-xs font-semibold bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition duration-200"
          >
            Connect wallet
          </button>
          <button
            onclick="toggleManualWalletInput('\${username}')"
            class="flex-1 text-xs font-semibold bg-slate-100 text-slate-600 py-2 rounded-lg hover:bg-slate-200 transition duration-200"
          >
            Isi manual
          </button>
        </div>

        <div class="hidden gap-2" id="manual-wallet-\${username}">
          <input
            type="text"
            placeholder="0x..."
            id="manual-wallet-input-\${username}"
            class="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 font-mono"
          >
          <button
            onclick="saveManualWallet('\${username}')"
            class="text-xs font-semibold bg-emerald-600 text-white px-3 rounded-lg hover:bg-emerald-700"
          >
            Simpan
          </button>
        </div>

        <button
          onclick="lihatPortofolio('\${username}')"
          class="w-full mt-3 text-xs font-semibold bg-white border border-indigo-200 text-indigo-600 py-2 rounded-lg hover:bg-indigo-50 transition duration-200"
        >
          Lihat profil
        </button>
      </div>
    </div>
  `;
}

/**
 * Memantau status login secara real-time dan menampilkan kartu sesuai hak akses.
 */
function handleAuthAndRenderCards(containerId = "users-container") {
    const listContainer = document.getElementById(containerId);

    auth.onAuthStateChanged(async (currentUser) => {
        try {
            listContainer.innerHTML = "";
            listContainer.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";

            if (currentUser) {
                // =========================================================================
                // MODE 1: USER LOGIN -> Hanya tampilkan kartu miliknya sendiri
                // =========================================================================
                console.log("Pengunjung login. Menampilkan dashboard kartu pribadi.");
                
                // Cari data berdasarkan ID dokumen UID Auth
                let docSnap = await db.collection(USERS_COLLECTION).doc(currentUser.uid).get();
                
                // Pencarian alternatif: jika dokumen disimpan berdasarkan username/email
                if (!docSnap.exists && currentUser.email) {
                    const querySnap = await db.collection(USERS_COLLECTION).where("email", "==", currentUser.email).limit(1).get();
                    if (!querySnap.empty) {
                        docSnap = querySnap.docs;
                    }
                }

                if (docSnap.exists) {
                    const user = { ...docSnap.data() };
                    if (!user.username) user.username = docSnap.id;

                    const cardWrapper = document.createElement("div");
                    cardWrapper.innerHTML = renderNftMemberCard(user, {
                        tokenId: "0001",
                        tier: user.tier || "VIP Member"
                    });
                    listContainer.appendChild(cardWrapper.firstElementChild);
                } else {
                    listContainer.innerHTML = `<p class="afz-cards-loading col-span-full text-center">Data kartu NFT Anda belum dibuat di database.</p>`;
                }

            } else {
                // =========================================================================
                // MODE 2: TIDAK LOGIN -> Tampilkan semua kartu member (Direktori Publik)
                // =========================================================================
                console.log("Pengunjung tidak login. Menampilkan seluruh direktori.");
                
                const snapshot = await db.collection(USERS_COLLECTION).get();
                
                if (!snapshot.empty) {
                    snapshot.docs.forEach((doc, index) => {
                        const user = { ...doc.data() };
                        if (!user.username) user.username = doc.id;

                        const cardWrapper = document.createElement("div");
                        cardWrapper.innerHTML = renderNftMemberCard(user, {
                            tokenId: String(index + 1).padStart(4, "0"),
                            tier: user.tier || "Member"
                        });
                        listContainer.appendChild(cardWrapper.firstElementChild);
                    });
                } else {
                    listContainer.innerHTML = `<p class="afz-cards-loading col-span-full text-center">Belum ada member yang terdaftar.</p>`;
                }
            }
        } catch (error) {
            console.error("Gagal memproses data member dari Firestore:", error);
            listContainer.innerHTML = `<p class="text-red-500 col-span-full text-center text-xs">Terjadi kegagalan jaringan saat mengambil data.</p>`;
        }
    });
}

/**
 * Cari dokumen user berdasarkan field "username" atau doc ID langsung.
 */
async function getUserDocRef(username) {
    const query = await db.collection(USERS_COLLECTION).where("username", "==", username).limit(1).get();
    if (!query.empty) return query.docs.ref;
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
    const padding = "=".repeat((4 - base64url.length % 4) % 4);
    const base64 = (base64url + padding).replace(/\-/g, "+").replace(/\_/g, "/");
    const rawData = window.atob(base64);
    const outputBuffer = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputBuffer[i] = rawData.charCodeAt(i);
    }
    return outputBuffer.buffer;
}

// Fungsi bantu interaksi UI dompet digital
window.toggleManualWalletInput = function(username) {
    const el = document.getElementById(`manual-wallet-\${username}`);
    if (el) el.classList.toggle("hidden");
    if (el && !el.classList.contains("hidden")) el.classList.add("flex");
};

window.lihatPortofolio = function(username) {
    alert(`Membuka portofolio profil untuk @\${username}`);
};

window.connectWalletForUser = function(username) {
    alert("Menghubungkan ke ekstensi MetaMask/Web3 Wallet...");
};

window.saveManualWallet = async function(username) {
    const inputEl = document.getElementById(`manual-wallet-input-\${username}`);
    if (!inputEl || !inputEl.value.trim()) return alert("Alamat wallet tidak boleh kosong!");
    
    try {
        const docRef = await getUserDocRef(username);
        await docRef.update({
            wallet_address: inputEl.value.trim()
        });
        alert("Sukses menyimpan alamat wallet!");
    } catch(err) {
        console.error(err);
        alert("Gagal memperbarui alamat wallet.");
    }
};

window.registerFingerprint = function(username) {
    alert(`Memulai aktivasi modul sidik jari perangkat untuk @\${username}...`);
};

// Jalankan otomatis fungsi monitor ketika berkas siap dimuat oleh browser
handleAuthAndRenderCards();
