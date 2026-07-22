// js/dashboard.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Konfigurasi Firebase Anda
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

let userUID = "";
let currentFolder = "Utama"; 
let limitMB = 50;
let sisaKuotaCukup = true;
let sharedFileToDownload = null; 

// 1. Pengaman Sesi & Sinkronisasi Profil Secara Realtime
onAuthStateChanged(auth, (user) => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    
    if (shareId) {
        loadSharedFile(shareId);
        return; 
    }

    if (user) {
        userUID = user.uid;
        
        const profileRef = ref(database, `users/${userUID}/profile`);
        onValue(profileRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                const verifiedIcon = data.isVerified === true ? `
                    <span class="relative group inline-flex items-center ml-1">
                        <svg class="w-5 h-5 text-blue-500 cursor-help" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l5-5z" clip-rule="evenodd"></path>
                        </svg>
                        <span class="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 text-white text-[10px] font-bold px-2.5 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                            Akun Terverifikasi
                        </span>
                    </span>
                ` : '';

                const premiumBadge = data.isPremium === true ? `
                    <div class="mt-2">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            ⭐ MEMBER PREMIUM
                        </span>
                    </div>
                ` : '';
                
                document.getElementById('user-display-name').innerHTML = `
                    <span class="flex items-center">
                        ${data.name || user.displayName || "Pengguna"}
                        ${verifiedIcon}
                    </span>
                `;
                document.getElementById('user-avatar').src = data.photo || user.photoURL || "https://via.placeholder.com/150";
                
                document.getElementById('profile-card-name').innerHTML = `
                    <span class="flex items-center justify-center">
                        ${data.name || user.displayName || "Pengguna"}
                        ${verifiedIcon}
                    </span>
                `;
                document.getElementById('profile-card-avatar').src = data.photo || user.photoURL || "https://via.placeholder.com/150";
                
                document.getElementById('profile-card-email').innerHTML = `
                    <span class="text-indigo-600 font-bold block">${data.username || '@username'}</span>
                    <span class="text-xs text-gray-500 block mb-2">${user.email}</span>
                    ${premiumBadge}
                    <p class="text-sm italic text-gray-600 border-t border-gray-100 pt-2 mt-2">${data.bio || 'Belum ada bio.'}</p>
                `;
            } else {
                document.getElementById('user-display-name').innerText = user.displayName || "Pengguna";
                document.getElementById('user-avatar').src = user.photoURL || "https://via.placeholder.com/150";
                document.getElementById('profile-card-name').innerText = user.displayName || "Pengguna";
                document.getElementById('profile-card-email').innerText = user.email;
                document.getElementById('profile-card-avatar').src = user.photoURL || "https://via.placeholder.com/150";
            }
        });

        loadFolders();
        loadUserFiles();
        loadSharedFilesTab(); // Sinkronisasi realtime Tab Kolaborasi
    } else {
        localStorage.removeItem('userSession');
        window.location.href = "login.html";
    }
});

// ================= PENANGANAN LINK SHARE =================
function loadSharedFile(shareId) {
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

// ================= LOGIKA NAVIGASI TAB =================
window.switchTab = function(tabName) {
    const tabs = ['overview', 'tasks', 'files', 'profile'];
    tabs.forEach(t => {
        const tabEl = document.getElementById(`tab-${t}`);
        if (tabEl) tabEl.classList.add('hidden');
        
        const dBtn = document.getElementById(`btn-${t}`);
        if (dBtn) {
            dBtn.classList.remove('bg-indigo-800', 'text-white');
            dBtn.classList.add('text-indigo-100', 'hover:bg-indigo-800', 'hover:text-white');
        }

        const mBtn = document.getElementById(`btn-${t}-mobile`);
        if (mBtn) {
            mBtn.classList.remove('bg-indigo-800', 'text-white');
            mBtn.classList.add('text-indigo-200');
        }
    });

    const activeTab = document.getElementById(`tab-${tabName}`);
    if (activeTab) activeTab.classList.remove('hidden');
    
    const activeBtn = document.getElementById(`btn-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-indigo-800', 'text-white');
        activeBtn.classList.remove('text-indigo-100', 'hover:bg-indigo-800', 'hover:text-white');
    }

    const activeMBtn = document.getElementById(`btn-${tabName}-mobile`);
    if (activeMBtn) {
        activeMBtn.classList.add('bg-indigo-800', 'text-white');
        activeMBtn.classList.remove('text-indigo-200');
    }

    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) {
        const titles = { overview: 'Ringkasan', tasks: 'Tugas Saya', files: 'Penyimpanan File', profile: 'Profil Saya' };
        pageTitleEl.innerText = titles[tabName];
    }
}

// ================= LOGIKA PENYIMPANAN BERKAS DATABASE =================
window.updateFileLabel = function() {
    const selector = document.getElementById('file-selector');
    if (selector.files.length > 0) {
        document.getElementById('file-label').innerText = selector.files[0].name;
    }
}

window.createFolder = function() {
    const name = prompt("Masukkan nama folder baru:");
    if (!name) return;

    const cleanName = name.replace(/[.#$\[\]]/g, ""); 
    const folderRef = ref(database, `users/${userUID}/folders/${cleanName}`);
    
    set(folderRef, {
        name: cleanName,
        created_at: Date.now()
    }).then(() => {
        alert(`Folder "${cleanName}" berhasil dibuat!`);
    });
}

window.selectFolder = function(folderName) {
    currentFolder = folderName;
    document.getElementById('active-folder-name').innerText = folderName;
    loadUserFiles(); 
}

function loadFolders() {
    const folderRef = ref(database, `users/${userUID}/folders`);
    onValue(folderRef, (snapshot) => {
        const list = document.getElementById('folder-list');
        if (!list) return;
        list.innerHTML = '';

        const liDefault = document.createElement('li');
        liDefault.innerHTML = `<button onclick="selectFolder('Utama')" class="w-full text-left px-3 py-1.5 rounded text-sm hover:bg-gray-100 font-medium">📁 Utama</button>`;
        list.appendChild(liDefault);

        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(key => {
                const li = document.createElement('li');
                li.innerHTML = `<button onclick="selectFolder('${key}')" class="w-full text-left px-3 py-1.5 rounded text-sm hover:bg-gray-100 font-medium">📁 ${key}</button>`;
                list.appendChild(li);
            });
        }
    });
}

// --- UNGGAH FILE & OTOMATIS TAMPIL DI KOLABORASI ---
window.uploadSelectedFile = function() {
    const selector = document.getElementById('file-selector');
    if (selector.files.length === 0) {
        alert("Pilih file terlebih dahulu!");
        return;
    }

    if (!sisaKuotaCukup) {
        alert("Batas kuota penyimpanan gratis Anda (50 MB) telah penuh!");
        return;
    }

    const file = selector.files[0];

    if (file.size > 2 * 1024 * 1024) {
        alert("Untuk menjamin kecepatan database, batas unggah maksimal adalah 2 MB per file.");
        return;
    }

    alert("Sedang mengonversi dan menyimpan berkas ke database...");

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Data = e.target.result; 
        
        const userNameEl = document.getElementById('user-display-name');
        const activeUserName = userNameEl ? userNameEl.innerText.trim() : "Pengguna";

        const fileListRef = ref(database, `users/${userUID}/files`);
        const newFileRef = push(fileListRef);
        const fileKey = newFileRef.key;

        const fileDataObject = {
            id: fileKey,
            name: file.name,
            size: file.size,
            type: file.type,
            folder: currentFolder, 
            data: base64Data, 
            pubDate: Date.now(),
            uploadedBy: activeUserName,
            sharedBy: activeUserName
        };

        // 1. Simpan ke folder pribadi pengguna
        set(newFileRef, fileDataObject).then(() => {
            // 2. OTOMATIS Simpan juga ke node 'shared' agar tampil di TAB KOLABORASI!
            set(ref(database, `shared/${fileKey}`), fileDataObject);

            alert("Berkas berhasil disimpan dan dapat dilihat di Tab Kolaborasi!");
            document.getElementById('file-label').innerText = "Pilih file dari komputer Anda...";
            selector.value = "";
            loadUserFiles();
        }).catch((error) => {
            alert("Gagal mengunggah berkas: " + error.message);
        });
    }
    reader.readAsDataURL(file); 
}

function loadUserFiles() {
    if (!userUID) return;

    const fileRef = ref(database, `users/${userUID}/files`);
    onValue(fileRef, (snapshot) => {
        const tableBody = document.getElementById('file-table-body');
        if (tableBody) tableBody.innerHTML = '';

        let totalBytes = 0;
        let fileCountFolder = 0;

        if (!snapshot.exists()) {
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="2" class="px-6 py-4 text-center text-gray-400">Belum ada file di folder ini.</td></tr>`;
            document.getElementById('stat-files-count').innerText = 0;
            document.getElementById('kuota-info').innerText = `Penyimpanan Digunakan: 0 MB dari ${limitMB} MB (Free)`;
            sisaKuotaCukup = true;
            return;
        }

        const data = snapshot.val();
        
        Object.keys(data).forEach(key => {
            const file = data[key];
            totalBytes += file.size;

            if (file.folder === currentFolder) {
                fileCountFolder++;
                if (tableBody) {
                    const tr = document.createElement('tr');
                    tr.className = "hover:bg-gray-50";
                    tr.innerHTML = `
                        <td class="px-6 py-4 font-medium text-gray-800">${file.name}</td>
                        <td class="px-6 py-4 text-right space-x-3">
                            <button onclick="downloadFile('${key}')" class="text-indigo-600 hover:text-indigo-800 font-semibold transition text-xs">Unduh</button>
                            <button onclick="shareFile('${key}')" class="text-green-600 hover:text-green-800 font-semibold transition text-xs">Bagikan Link</button>
                            <button onclick="deleteFile('${key}')" class="text-red-500 hover:text-red-700 font-semibold transition text-xs">Hapus</button>
                        </td>
                    `;
                    tableBody.appendChild(tr);
                }
            }
        });

        if (fileCountFolder === 0 && tableBody) {
            tableBody.innerHTML = `<tr><td colspan="2" class="px-6 py-4 text-center text-gray-400">Tidak ada file di folder "${currentFolder}".</td></tr>`;
        }

        const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
        document.getElementById('kuota-info').innerText = `Penyimpanan Digunakan: ${totalMB} MB dari ${limitMB} MB (Free)`;
        document.getElementById('stat-files-count').innerText = Object.keys(data).length;

        sisaKuotaCukup = totalMB < limitMB;
    });
}

// ================= SINKRONISASI REALTIME BERKAS KOLABORASI =================
function loadSharedFilesTab() {
    // Mendukung ID 'collaboration-files-container' (HTML baru) atau 'shared-files-container'
    const sharedFilesContainer = document.getElementById('collaboration-files-container') || document.getElementById('shared-files-container');
    if (!sharedFilesContainer) return;

    const sharedRef = ref(database, 'shared');
    onValue(sharedRef, (snapshot) => {
        sharedFilesContainer.innerHTML = '';

        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach((key) => {
                const file = data[key];
                const fileName = file.name || 'Berkas Bersama';
                const sharedBy = file.sharedBy || file.uploadedBy || 'Pengguna Lain';
                const fileSizeKB = file.size ? (file.size / 1024).toFixed(1) + ' KB' : '2 MB';
                const defaultImg = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';

                sharedFilesContainer.innerHTML += `
                    <div onclick="openPortfolioModal('${fileName}', '${sharedBy}', 'Ukuran Berkas: ${fileSizeKB}. Klik tombol di bawah untuk mengunduh.', '${defaultImg}')" 
                         class="bg-white p-4 rounded-xl border border-gray-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition cursor-pointer flex items-center justify-between group">
                        <div class="flex items-center space-x-3.5 min-w-0">
                            <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                                </svg>
                            </div>
                            <div class="min-w-0">
                                <h4 class="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-600 transition">${fileName}</h4>
                                <p class="text-xs text-gray-500 mt-0.5">Dibagikan oleh: <span class="font-medium text-emerald-600">${sharedBy}</span></p>
                                <div class="mt-2 flex items-center space-x-2">
                                    <span class="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded">Shared</span>
                                    <span class="text-[11px] font-semibold text-indigo-600 flex items-center group-hover:underline">Lihat Profil &rarr;</span>
                                </div>
                            </div>
                        </div>
                        <button onclick="downloadSharedDirect(event, '${key}')" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition shrink-0 ml-2" title="Unduh Langsung">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        </button>
                    </div>
                `;
            });
        } else {
            sharedFilesContainer.innerHTML = `<div class="col-span-2 py-8 text-center text-gray-400 text-sm">Belum ada berkas kolaborasi yang dibagikan saat ini.</div>`;
        }
    });
}

// Handler unduh langsung berkas kolaborasi
window.downloadSharedDirect = function(event, fileKey) {
    event.stopPropagation();
    const sharedRef = ref(database, `shared/${fileKey}`);
    get(sharedRef).then((snapshot) => {
        if (snapshot.exists()) {
            const file = snapshot.val();
            const a = document.createElement('a');
            a.href = file.data;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert("File tidak ditemukan di server.");
        }
    });
}

window.downloadFile = function(fileId) {
    const fileRef = ref(database, `users/${userUID}/files/${fileId}`);
    get(fileRef).then((snapshot) => {
        if (snapshot.exists()) {
            const file = snapshot.val();
            const a = document.createElement('a');
            a.href = file.data; 
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    });
}

window.shareFile = function(fileId) {
    const fileRef = ref(database, `users/${userUID}/files/${fileId}`);
    get(fileRef).then((snapshot) => {
        if (snapshot.exists()) {
            const fileData = snapshot.val();
            
            const userNameEl = document.getElementById('user-display-name');
            const activeUserName = userNameEl ? userNameEl.innerText.trim() : "Pengguna Lain";
            
            fileData.sharedBy = activeUserName; 
            
            set(ref(database, `shared/${fileId}`), fileData).then(() => {
                const shareUrl = `${window.location.origin}${window.location.pathname}?share=${fileId}`;
                navigator.clipboard.writeText(shareUrl).then(() => {
                    alert("Link Berbagi Berhasil Disalin!");
                });
            });
        }
    });
}

window.deleteFile = function(fileId) {
    if (confirm("Apakah Anda yakin ingin menghapus berkas ini dari database?")) {
        remove(ref(database, `users/${userUID}/files/${fileId}`)).then(() => {
            remove(ref(database, `shared/${fileId}`));
            alert("Berkas berhasil dihapus!");
        });
    }
}

// ================= LOGIKA KELUAR SESI (LOGOUT) =================
window.logout = function() {
    signOut(auth).then(() => {
        localStorage.removeItem('userSession');
        alert("Anda telah berhasil keluar.");
        window.location.href = "index.html";
    }).catch((error) => {
        alert("Gagal keluar sesi: " + error.message);
    });
}

// ================= AUTO-HIDE NAVIGASI & HEADER SAAT SCROLL (MOBILE) =================
let lastScrollTop = 0;
const header = document.querySelector('header');
const mobileNav = document.querySelector('.md\\:hidden.fixed.bottom-0');

window.addEventListener('scroll', () => {
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop > lastScrollTop && scrollTop > 60) {
        if (header) header.classList.add('-translate-y-full');
        if (mobileNav) mobileNav.classList.add('translate-y-full');
    } else {
        if (header) header.classList.remove('-translate-y-full');
        if (mobileNav) mobileNav.classList.remove('translate-y-full');
    }
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
}, { passive: true });
