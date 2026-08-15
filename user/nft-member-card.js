// js/nft-member-card.js
// Template kartu member NFT untuk komunitas AFATSUMAZER
//
// Ketentuan:
// - Gambar kartu = NFT unik milik user, disimpan/di-mint per user di server
//   (field: user.nft_image_url). BUKAN gambar random/placeholder/upload bebas.
// - Wallet: connect (MetaMask) atau isi manual, TAPI wajib verifikasi
//   sidik jari (WebAuthn biometric) dulu sebelum alamat wallet disimpan.
//
// CATATAN PENTING soal "sidik jari":
// Browser tidak pernah memberi JS akses ke data sidik jari mentah.
// Yang bisa dilakukan adalah WebAuthn API, yang memakai sensor biometrik
// perangkat (fingerprint/Face ID) sebagai "platform authenticator" untuk
// membuktikan user itu benar pemilik perangkat — hasilnya cuma
// true/false + credential, bukan gambar/data sidik jari itu sendiri.
// Untuk PRODUKSI, proses register & verify WebAuthn WAJIB melibatkan
// server (generate challenge, simpan public key, verifikasi signature).
// Kode di bawah menyederhanakan bagian server (challenge dummy) supaya
// bisa langsung dicoba — ganti bagian yang ditandai "// TODO server"
// dengan pemanggilan endpoint backend Anda yang sesungguhnya.

const COMMUNITY_NAME = "AFATSUMAZER";
const API_BASE_URL = "https://app.afatsumazer.eu.org";

function renderNftMemberCard(user, options = {}) {
    const {
        tier = "Member",
        tokenId = "0001",
        network = "Polygon",
        joined = "",
    } = options;

    const fullName = user.full_name || "Tanpa nama";
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

async function fetchAllUsersAsNftCards(containerId = "users-container") {
    try {
        const response = await fetch(`${API_BASE_URL}/users`);
        const users = await response.json();

        const listContainer = document.getElementById(containerId);
        listContainer.innerHTML = "";
        listContainer.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";

        users.forEach((user, index) => {
            const cardWrapper = document.createElement("div");
            cardWrapper.innerHTML = renderNftMemberCard(user, {
                tokenId: String(index + 1).padStart(4, "0"),
            });
            listContainer.appendChild(cardWrapper.firstElementChild);
        });
    } catch (error) {
        console.error("Gagal memuat kartu member NFT:", error);
    }
}

// ---------- WebAuthn (sidik jari / biometrik perangkat) ----------

function base64urlToBuffer(base64url) {
    const padded = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(
        base64url.length + (4 - (base64url.length % 4)) % 4, "="
    );
    const raw = atob(padded);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = "";
    bytes.forEach((b) => (str += String.fromCharCode(b)));
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Daftarkan sidik jari/biometrik perangkat untuk user ini (sekali saja).
 * Idealnya challenge & penyimpanan public key dilakukan penuh di server.
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
        // TODO server: minta challenge acak dari backend, jangan generate di client.
        const challengeRes = await fetch(`${API_BASE_URL}/webauthn/register-challenge?username=${username}`);
        const { challenge, userId } = await challengeRes.json();

        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: base64urlToBuffer(challenge),
                rp: { name: COMMUNITY_NAME },
                user: {
                    id: base64urlToBuffer(userId),
                    name: username,
                    displayName: username,
                },
                pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                authenticatorSelection: {
                    authenticatorAttachment: "platform", // wajib sensor bawaan perangkat (sidik jari/Face ID)
                    userVerification: "required",
                },
                timeout: 60000,
            },
        });

        // TODO server: kirim credential.response ke backend untuk diverifikasi & disimpan.
        await fetch(`${API_BASE_URL}/webauthn/register-verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username,
                credentialId: bufferToBase64url(credential.rawId),
                attestationObject: bufferToBase64url(credential.response.attestationObject),
                clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
            }),
        });

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
 * Dipanggil sebelum wallet boleh di-connect atau disimpan.
 */
async function verifyFingerprint(username) {
    try {
        // TODO server: minta challenge acak dari backend.
        const challengeRes = await fetch(`${API_BASE_URL}/webauthn/auth-challenge?username=${username}`);
        const { challenge, credentialId } = await challengeRes.json();

        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: base64urlToBuffer(challenge),
                allowCredentials: [{ type: "public-key", id: base64urlToBuffer(credentialId) }],
                userVerification: "required",
                timeout: 60000,
            },
        });

        // TODO server: verifikasi signature assertion di backend, balikan true/false.
        const verifyRes = await fetch(`${API_BASE_URL}/webauthn/auth-verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username,
                credentialId: bufferToBase64url(assertion.rawId),
                authenticatorData: bufferToBase64url(assertion.response.authenticatorData),
                clientDataJSON: bufferToBase64url(assertion.response.clientDataJSON),
                signature: bufferToBase64url(assertion.response.signature),
            }),
        });
        const { verified } = await verifyRes.json();
        return !!verified;
    } catch (error) {
        console.error("Verifikasi sidik jari gagal:", error);
        return false;
    }
}

// ---------- Wallet (connect / manual), sekarang wajib lolos verifikasi sidik jari ----------

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
        await fetch(`${API_BASE_URL}/users/${username}/wallet`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet_address: address }),
        });

        const card = document.querySelector(`[data-username="${username}"] .wallet-address`);
        if (card) {
            card.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
        }
    } catch (error) {
        console.error("Gagal menyimpan alamat wallet:", error);
        alert("Gagal menyimpan alamat wallet ke server.");
    }
}

document.addEventListener("DOMContentLoaded", () => fetchAllUsersAsNftCards());
