 
// js/dashboard.js
import { initializeApp } from "https://gstatic.com";import { getAuth, onAuthStateChanged, signOut } from "https://gstatic.com";import { getDatabase, ref, set, push, onValue, remove, get } from "https://gstatic.com";
// Konfigurasi Firebase Anda (Sesuai Database Aktif Anda)const firebaseConfig = {
  apiKey: "AIzaSyDg2b6LERZ2zE86mTiYvUO1Uj--lAtpmgM",
  authDomain: "://firebaseapp.com",
  databaseURL: "https://firebasedatabase.app",
  projectId: "afatsumazer-app",
  storageBucket: "afatsumazer-app.firebasestorage.app",
  messagingSenderId: "16280759060",
  appId: "1:16280759060:web:fd4deacafdf5cadd777001",
  measurementId: "G-WB9YW9D726"
};
const app = initializeApp(firebaseConfig);const auth = getAuth(app);const database = getDatabase(app);
let userUID = "";let currentFolder = "Utama"; let limitMB = 50;let sisaKuotaCukup = true;let sharedFileToDownload = null; let currentChatTargetUID = ""; // Menyimpan ID pengguna yang sedang diajak chat
// ================= 1. PENGAMAN SESI & SINKRONISASI PROFIL REALTIME =================
onAuthStateChanged(auth, (user) => {
    // Cek apakah halaman dibuka melalui Link Berbagi Berkas atau Link Chat
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    const chatTargetId = urlParams.get('chat'); 
    
    if (shareId) {
        loadSharedFile(shareId);
        return; 
    }

    if (user) {
        userUID = user.uid;
        
        // Membaca profil dari Realtime Database secara realtime
        const profileRef = ref(database, `users/${userUID}/profile`);
        onValue(profileRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                // Balon keterangan (Tooltip) centang biru
                const verifiedIcon = data.isVerified === true ? `
                    <span class="relative group inline-flex items-center ml-1">
                        <svg class="w-5 h-5 text-blue-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l5-5z" clip-rule="evenodd"></path>
                        </svg>
                        <span class="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 text-white text-[10px] font-bold px-2.5 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                            Akun Terverifikasi
                        </span>
                    </span>
                ` : '';

                // Label Premium
                const premiumBadge = data.isPremium === true ? `
                    <div class="mt-2">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            ⭐ MEMBER PREMIUM
                        </span>
                    </div>
                ` : '';
                
                // Perbarui Tampilan Header Atas
                if (document.getElementById('user-display-name')) {
                    document.getElementById('user-display-name').innerHTML = `
                        <span class="flex items-center">${data.name || user.displayName || "Pengguna"} ${verifiedIcon}</span>
                    `;
                }
                if (document.getElementById('user-avatar')) {
                    document.getElementById('user-avatar').src = data.photo || user.photoURL || "https://placeholder.com";
                }
                
                // Perbarui kartu identitas di TAB PROFIL (Bisa diklik menuju Portofolio Publik sendiri)
                if (document.getElementById('profile-card-name')) {
                    document.getElementById('profile-card-name').innerHTML = `
                        <a href="portofolio.html?id=${userUID}" class="flex items-center justify-center group cursor-pointer">
                            <span class="font-bold text-slate-800 group-hover:text-indigo-600 transition duration-200">
                                ${data.name || user.displayName || "Pengguna"}
                            </span>
                            ${verifiedIcon}
                        </a>
                    `;
                }
                if (document.getElementById('profile-card-avatar')) {
                    document.getElementById('profile-card-avatar').src = data.photo || user.photoURL || "https://placeholder.com";
                }
                
                if (document.getElementById('profile-card-email')) {
                    document.getElementById('profile-card-email').innerHTML = `
                        <span class="text-indigo-600 font-bold block">${data.username || '@username'}</span>
                        <span class="text-xs text-gray-500 block mb-2">${user.email}</span>
                        ${premiumBadge}
                        <p class="text-sm italic text-gray-600 border-t border-gray-100 pt-2 mt-2">${data.bio || 'Belum ada bio.'}</p>
                    `;
                }
            } else {
                // Tampilan cadangan jika data database kosong
                if (document.getElementById('user-display-name')) document.getElementById('user-display-name').innerText = user.displayName || "Pengguna";
                if (document.getElementById('user-avatar')) document.getElementById('user-avatar').src = user.photoURL || "https://placeholder.com";
                if (document.getElementById('profile-card-name')) document.getElementById('profile-card-name').innerText = user.displayName || "Pengguna";
                if (document.getElementById('profile-card-email')) document.getElementById('profile-card-email').innerText = user.email;
                if (document.getElementById('profile-card-avatar')) document.getElementById('profile-card-avatar').src = user.photoURL || "https://placeholder.com";
            }
        });

        // Redirect otomatis ke box obrolan jika datang dari tombol "Hubungi" portofolio
        if (chatTargetId) {
            switchTab('tasks'); 
            bukaObrolanPesan(chatTargetId);
        }

        // Muat Manajer File Internal Bawaan
        loadFolders();
        loadUserFiles();
        loadSharedFilesTab(); 
        listenIncomingChats(); 
    } else {
        localStorage.removeItem('userSession');
        window.location.href = "login.html";
    }
});
// ================= 2. PENANGANAN LINK SHARE (BERBAGI FILE) =================function loadSharedFile(shareId) {
    const shareRef = ref(database, `shared/${shareId}`);
    get(shareRef).then((snapshot) => {
        if (snapshot.exists()) {
            const fileData = snapshot.val();
            sharedFileToDownload = fileData;
            
            document.getElementById('share-file-name').innerText = `${fileData.name} (${(fileData.size / 1024).toFixed(1)} KB)`;
            
            const modalOwnerEl = document.getElementById('share-file-owner');
            if (modalOwnerEl) {
                modalOwnerEl.innerText = `Dibagikan oleh: ${fileData.sharedBy || 'Pengguna Lain'}`;
            }
            
            document.getElementById('share-modal').classList.remove('hidden');
        } else {
            alert("Tautan rusak atau berkas telah dihapus oleh pemiliknya.");
            window.location.href = "index.html";
        }
    }).catch((err) => {
        console.error("Gagal memuat link share:", err);
    });
}

window.downloadSharedFile = function() {
    if (sharedFileToDownload) {
        const a = document.createElement('a');
        a.href = sharedFileToDownload.data; 
        a.download = sharedFileToDownload.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

window.closeShareModal = function() {
    document.getElementById('share-modal').classList.add('hidden');
    window.location.href = "dashboard.html";
}
// ================= 3. TAB KOLABORASI & HUBUNGI PENGGUNA LAIN =================function loadSharedFilesTab() {
    const sharedContainer = document.getElementById('shared-files-container'); 
    if (!sharedContainer) return;

    const sharedRef = ref(database, 'shared');

    onValue(sharedRef, (snapshot) => {
        sharedContainer.innerHTML = ""; 

        if (snapshot.exists()) {
            const filesData = snapshot.val();
            let hasFiles = false;

            for (let key in filesData) {
                const file = filesData[key];
                const targetID = file.uid || file.ownerId;
                if (!targetID) continue;
                hasFiles = true;

                const fileCard = document.createElement('div');
                fileCard.className = "p-4 bg-white border border-slate-100 rounded-xl flex items-center justify-between shadow-sm hover:border-slate-200 transition duration-200";

                // Terhubung ke Portofolio melalui ?id= dan menyediakan tombol Hubungi Langsung
                fileCard.innerHTML = `
                    <div class="flex items-center space-x-3">
                        <a href="portofolio.html?id=${targetID}" class="block flex-shrink-0 group">
                            <img src="${file.ownerPhoto || 'https://placeholder.com'}" class="w-10 h-10 rounded-full object-cover border group-hover:border-indigo-500 transition duration-200">
                        </a>
                        <div class="min-w-0">

${file.name || 'Tanpa Nama'}

Oleh: ${file.sharedBy || 'Pengguna Lain'}


💬 Hubungi


Unduh


; sharedContainer.appendChild(fileCard); } if (!hasFiles) sharedContainer.innerHTML = Belum ada berkas kolaborasi.; } else { sharedContainer.innerHTML = Belum ada berkas kolaborasi.`;
}
});
}
// ================= 4. SISTEM UTAMA CHAT REALTIME BERPASANGAN =================
window.bukaObrolanPesan = function(targetUID) {
if (targetUID === userUID) {
alert("Anda tidak bisa mengirim pesan ke diri sendiri.");
return;
}
// Menghapus lencana notifikasi merah secara otomatis saat obrolan dipilih
currentChatTargetUID = targetUID;
// Tampilkan nama teman bicara di judul box chat
const targetProfileRef = ref(database, users/${targetUID}/profile);
get(targetProfileRef).then((snapshot) => {
if (snapshot.exists()) {
const tData = snapshot.val();
document.getElementById('chat-with-name').innerText = Chat dengan: ${tData.name || 'Pengguna'};
}
});
const chatBox = document.getElementById('chat-box-container');
if (chatBox) chatBox.classList.remove('hidden');
// Mengambil riwayat pesan masuk dan keluar secara realtime
const chatRef = ref(database, messages/${userUID}/${targetUID});
onValue(chatRef, (snapshot) => {
const msgContainer = document.getElementById('chat-messages-list');
if (!msgContainer) return;
msgContainer.innerHTML = "";
if (snapshot.exists()) {
const messages = snapshot.val();
for (let id in messages) {
const msg = messages[id];
const isMe = msg.sender === userUID;
const msgBubble = document.createElement('div');
msgBubble.className = flex ${isMe ? 'justify-end' : 'justify-start'} mb-2;
msgBubble.innerHTML = <div class="max-w-[75%] px-3 py-2 rounded-xl text-xs shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}"> <p>${msg.text}</p> <span class="text-[9px] block text-right mt-1 opacity-70">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span> </div>;
msgContainer.appendChild(msgBubble);
}
msgContainer.scrollTop = msgContainer.scrollHeight;
} else {
msgContainer.innerHTML = <p class="text-xs text-slate-400 italic text-center py-4">Belum ada obrolan. Kirim pesan pertama Anda!</p>;
}
});
}
window.kirimPesanChat = function() {
const inputEl = document.getElementById('chat-input-text');
if (!inputEl || !inputEl.value.trim() || !currentChatTargetUID) return;
const pesanText = inputEl.value.trim();
const timestamp = new Date().getTime();
const dataPesan = {
sender: userUID,
text: pesanText,
timestamp: timestamp
};
// Sinkronisasi dua arah agar riwayat obrolan muncul di kedua akun secara realtime
push(ref(database, messages/${userUID}/${currentChatTargetUID}), dataPesan);
push(ref(database, messages/${currentChatTargetUID}/${userUID}), dataPesan);
inputEl.value = "";
}
// Menampilkan daftar kontak/inbox yang pernah mengirim pesan dengan deteksi lencana notifikasi baru
function listenIncomingChats() {
const listInboxContainer = document.getElementById('chat-inbox-list');
if (!listInboxContainer) return;
const myInboxRef = ref(database, messages/${userUID});
onValue(myInboxRef, (snapshot) => {
listInboxContainer.innerHTML = "";
if (snapshot.exists()) {
const activeChats = snapshot.val();
for (let senderKey in activeChats) {
const messagesObj = activeChats[senderKey];
const messageIds = Object.keys(messagesObj);
const lastMessageId = messageIds[messageIds.length - 1];
const lastMessage = messagesObj[lastMessageId];
// Deteksi jika pesan terakhir datang dari orang lain dan kita sedang menutup chat box-nya
const isNewMessage = lastMessage.sender !== userUID && currentChatTargetUID !== senderKey;
get(ref(database, users/${senderKey}/profile)).then((uSnap) => {
if (uSnap.exists()) {
const uData = uSnap.val();
// Siapkan bulatan merah berkedip sebagai lencana notifikasi
const notificationBadge = isNewMessage ? <span class="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse shadow-sm shadow-rose-400"></span> : '';
const inboxItem = document.createElement('div');
inboxItem.className = p-3 border rounded-xl flex items-center justify-between cursor-pointer transition mb-2 ${isNewMessage ? 'bg-indigo-50/50 border-indigo-100 font-medium' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'};
inboxItem.onclick = () => bukaObrolanPesan(senderKey);
inboxItem.innerHTML = <div class="flex items-center space-x-2 min-w-0"> <img src="${uData.photo || 'https://placeholder.com'}" class="w-8 h-8 rounded-full object-cover flex-shrink-0"> <div class="min-w-0"> <h5 class="text-xs font-bold text-slate-800 truncate">${uData.name}</h5> <p class="text-[10px] text-slate-400 truncate">${lastMessage.text || 'Klik untuk membalas obrolan'}</p> </div> </div> <div class="flex items-center ml-2 flex-shrink-0"> ${notificationBadge} </div>;
listInboxContainer.appendChild(inboxItem);
}
});
}
}
});
}
// ================= 5. LOGIKA NAVIGASI TAB BAWAAN DASHBOARD =================
window.switchTab = function(tabName) {
const tabs = ['overview', 'tasks', 'files', 'profile'];
tabs.forEach(t => {
const el = document.getElementById(tab-${t});
if (el) el.classList.add('hidden');
const dBtn = document.getElementById(btn-${t});
if (dBtn) {
dBtn.classList.remove('bg-indigo-800', 'text-white');
dBtn.classList.add('text-indigo-100', 'hover:bg-indigo-800', 'hover:text-white');
}
});
const activeTab = document.getElementById(tab-${tabName});
if (activeTab) activeTab.classList.remove('hidden');
const activeBtn = document.getElementById(btn-${tabName});
if (activeBtn) {
activeBtn.classList.add('bg-indigo-800', 'text-white');
}
}
// Fungsi pembantu (stub) agar fungsi bawaan pengatur berkas lokal Anda tidak menghasilkan error saat dijalankan
if (typeof window.loadFolders !== 'function') { window.loadFolders = function() { console.log("Folders loaded."); }; }
if (typeof window.loadUserFiles !== 'function') { window.loadUserFiles = function() { console.log("User files loaded."); };
                                                }


