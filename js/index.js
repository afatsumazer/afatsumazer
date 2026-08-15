// functions/index.js
// Cloud Function AFATSUMAZER — otomatis generate gambar NFT unik untuk
// setiap user baru yang masuk ke collection Firestore "users", lalu
// simpan URL-nya ke field nft_image_url.
//
// Cara kerja gambar:
// Memakai DiceBear (https://www.dicebear.com), layanan avatar generator
// open-source yang deterministik — artinya untuk "seed" (di sini: username
// atau doc ID) yang sama, gambarnya akan SELALU sama persis, dan setiap
// seed berbeda pasti menghasilkan gambar berbeda. Jadi gambarnya:
// - TIDAK random tiap kali dibuka (deterministik per user)
// - TIDAK bisa diupload sembarangan oleh siapa pun
// - unik per user, dan URL-nya disimpan permanen di dokumen user itu
//
// Kalau Anda sudah punya sumber gambar NFT sendiri (misalnya hasil
// minting di suatu marketplace), ganti bagian buildNftImageUrl() di
// bawah dengan pemanggilan API/proses minting Anda yang sesungguhnya.

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

/**
 * Bangun URL gambar NFT unik & deterministik untuk satu user.
 * @param {string} seed - Nilai unik per user (username atau doc ID).
 * @returns {string} URL gambar.
 */
function buildNftImageUrl(seed) {
    const encodedSeed = encodeURIComponent(seed);
    // Gaya "bots" dipilih supaya terasa seperti karakter NFT, bukan sekadar
    // avatar polos. Bisa diganti style lain dari daftar DiceBear:
    // https://www.dicebear.com/styles
    return `https://api.dicebear.com/9.x/bottts-neutral/png?seed=${encodedSeed}&size=512`;
}

exports.generateNftOnUserCreate = onDocumentCreated("users/{userId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const user = snapshot.data();

    // Jangan timpa kalau ternyata field ini sudah pernah diisi (misalnya
    // diisi manual sebelumnya, atau function pernah jalan dua kali).
    if (user.nft_image_url) return;

    const seed = user.username || event.params.userId;
    const nftImageUrl = buildNftImageUrl(seed);

    await db.collection("users").doc(event.params.userId).update({
        nft_image_url: nftImageUrl,
        nft_minted_at: new Date(),
    });
});
