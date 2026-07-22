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

// ================= 1. PENGAMAN SESI & AUTENTIKASI =================
onAuthStateChanged(auth, (user) => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    
    if (shareId) {
        loadSharedFile(shareId);
        return; 
    }

    if (user) {
        userUID = user.uid;
        
        // Load Profil User
        const profileRef = ref(database, `users/${userUID}/profile`);
        onValue(profileRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                const verifiedIcon = data.isVerified === true ? `
                    <span class="relative group inline-flex items-center ml-1">
                        <svg class="w-5 h-5 text-blue-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l5-5z" clip-rule="evenodd"></path>
                        </svg>
                    </span>
                ` : '';

                const premiumBadge = data.isPremium === true ? `
                    <div class="mt-2">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            ⭐ MEMBER PREMIUM
                        </span>
                    </div>
                ` : '';
                
                document.getElementById('user-display-name').innerHTML = `<span class="flex items-center">${data.name || user.displayName || "Pengguna"} ${verifiedIcon}</span>`;
                document.getElementById('user-avatar').src = data.photo || user.photoURL || "https://via.placeholder.com/150";
                
                if(document.getElementById('profile-card-name')) {
                    document.getElementById('profile-card-name').innerHTML = `<span class="flex items-center justify-center">${data.name || user.displayName || "Pengguna"} ${verifiedIcon}</span>`;
                    document.getElementById('profile-card-avatar').src = data.photo || user.photoURL || "https://via.placeholder.com/150";
                    document.getElementById('profile-card-email').innerHTML = `
                        <span class="text-indigo-600 font-bold block">${data.username || '@username'}</span>
                        <span class="text-xs text-gray-500 block mb-2">${user.email}</span>
                        ${premiumBadge}
                        <p class="text-sm italic text-gray-600 border-t border-gray-100 pt-2 mt-2">${data.bio || 'Belum ada bio.'}</p>
                    `;
                }
            }
        });

        // Load Data Utama
        loadFolders();
        loadUserFiles();       // Tab Berkas
        loadTasksTab();        // Tab Tugas (File Publik)
        loadUserPortfolio();   // Sinkronisasi Portofolio dari DB
    } else {
        localStorage.removeItem('userSession');
        window.location.href = "login.html";
    }
});

// ================= 2. LOGIKA UNGGAH BERKAS (PUBLIK vs PRIVAT) =================
window.uploadSelectedFile = function() {
    const selector = document.getElementById('file-selector');
    const isPublicCheckbox = document.getElementById('file-is-public'); // Checkbox "Bagikan Publik / Ke Tugas"
    
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
        alert("Ukuran file maksimal adalah 2 MB per file.");
        return;
    }

    const isPublic = isPublicCheckbox ? isPublicCheckbox.checked : false;

    alert("Sedang mengonversi dan menyimpan berkas...");

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
            sharedBy: activeUserName,
            isPublic: isPublic // Flag Publik/Privat
        };

        // 1. Selalu Simpan ke Berkas Pribadi User
        set(newFileRef, fileDataObject).then(() => {
            
            // 2. JIKA PUBLIK -> Simpan juga ke node 'shared' / 'tasks' agar muncul di Tab Tugas
            if (isPublic) {
                set(ref(database, `shared/${fileKey}`), fileDataObject);
                alert("Berkas berhasil diunggah secara PUBLIK dan muncul di Tab Tugas!");
            } else {
                alert("Berkas berhasil disimpan secara PRIVAT di Tab Berkas!");
            }

            document.getElementById('file-label').innerText = "Pilih file dari komputer Anda...";
            selector.value = "";
            if (isPublicCheckbox) isPublicCheckbox.checked = false;
            
            loadUserFiles();
            loadTasksTab();
        }).catch((error) => {
            alert("Gagal mengunggah berkas: " + error.message);
        });
    }
    reader.readAsDataURL(file); 
}

// ================= 3. LOAD BERKAS (TAB BERKAS - ALL / PRIVAT) =================
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
            document.getElementById('kuota-info').innerText = `Penyimpanan Digunakan: 0 MB dari ${limitMB} MB`;
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
                        <td class="px-6 py-4 font-medium text-gray-800 flex items-center justify-between">
                            <span>${file.name}</span>
                            <span class="text-[10px] px-2 py-0.5 rounded font-bold ${file.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">
                                ${file.isPublic ? 'Publik (Tugas)' : 'Privat'}
                            </span>
                        </td>
                        <td class="px-6 py-4 text-right space-x-3">
                            <button onclick="downloadFile('${key}')" class="text-indigo-600 hover:text-indigo-800 font-semibold text-xs">Unduh</button>
                            <button onclick="shareFile('${key}')" class="text-green-600 hover:text-green-800 font-semibold text-xs">Bagikan</button>
                            <button onclick="deleteFile('${key}')" class="text-red-500 hover:text-red-700 font-semibold text-xs">Hapus</button>
                        </td>
                    `;
                    tableBody.appendChild(tr);
                }
            }
        });

        const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
        document.getElementById('kuota-info').innerText = `Penyimpanan Digunakan: ${totalMB} MB dari ${limitMB} MB`;
        document.getElementById('stat-files-count').innerText = Object.keys(data).length;
        sisaKuotaCukup = totalMB < limitMB;
    });
}

// ================= 4. LOAD TAB TUGAS (HANYA FILE PUBLIK) =================
function loadTasksTab() {
    const tasksContainer = document.getElementById('tasks-files-container') || document.getElementById('collaboration-files-container');
    if (!tasksContainer) return;

    const sharedRef = ref(database, 'shared');
    onValue(sharedRef, (snapshot) => {
        tasksContainer.innerHTML = '';

        if (snapshot.exists()) {
            const data = snapshot.val();
            let count = 0;

            Object.keys(data).forEach((key) => {
                const file = data[key];
                
                // Tampilkan hanya jika file bersifat publik
                if (file.isPublic !== false) {
                    count++;
                    const fileSizeKB = file.size ? (file.size / 1024).toFixed(1) + ' KB' : '2 MB';

                    tasksContainer.innerHTML += `
                        <div class="bg-white p-4 rounded-xl border border-gray-200 hover:border-indigo-300 shadow-sm flex items-center justify-between">
                            <div class="flex items-center space-x-3 min-w-0">
                                <div class="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                                    📋
                                </div>
                                <div class="min-w-0">
                                    <h4 class="text-sm font-bold text-gray-900 truncate">${file.name}</h4>
                                    <p class="text-xs text-gray-500">Oleh: <span class="font-medium text-indigo-600">${file.uploadedBy || 'Pengguna'}</span> | ${fileSizeKB}</p>
                                </div>
                            </div>
                            <button onclick="downloadSharedDirect(event, '${key}')" class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-bold">
                                Unduh
                            </button>
                        </div>
                    `;
                }
            });

            if (count === 0) {
                tasksContainer.innerHTML = `<div class="col-span-2 py-8 text-center text-gray-400 text-sm">Belum ada tugas/berkas publik yang dibagikan.</div>`;
            }
        } else {
            tasksContainer.innerHTML = `<div class="col-span-2 py-8 text-center text-gray-400 text-sm">Belum ada tugas/berkas publik yang dibagikan.</div>`;
        }
    });
}

// ================= 5. SINKRONISASI PORTOFOLIO USER DENGAN DATABASE =================

// Realtime Listener Portofolio User
function loadUserPortfolio() {
    if (!userUID) return;

    const portfolioRef = ref(database, `users/${userUID}/portfolio`);
    onValue(portfolioRef, (snapshot) => {
        const container = document.getElementById('portfolio-list-container');
        if (!container) return;

        container.innerHTML = '';

        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach((key) => {
                const item = data[key];
                container.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group">
                        <h4 class="font-bold text-gray-800 text-base">${item.title}</h4>
                        <p class="text-xs text-gray-600 mt-1">${item.description}</p>
                        ${item.link ? `<a href="${item.link}" target="_blank" class="text-xs text-indigo-600 font-semibold mt-2 inline-block hover:underline">Lihat Project &rarr;</a>` : ''}
                        <button onclick="deletePortfolioItem('${key}')" class="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xs font-bold p-1">
                            ✕
                        </button>
                    </div>
                `;
            });
        } else {
            container.innerHTML = `<p class="text-xs text-gray-400 italic col-span-2">Belum ada portofolio. Tambahkan portofolio Anda!</p>`;
        }
    });
}

// Tambah Portofolio Baru ke DB
window.addPortfolioItem = function() {
    const title = prompt("Masukkan Judul Portofolio/Projek:");
    if (!title) return;

    const description = prompt("Masukkan Deskripsi Singkat:");
    const link = prompt("Masukkan Link Projek/Sertifikat (opsional):");

    const portfolioRef = ref(database, `users/${userUID}/portfolio`);
    const newItemRef = push(portfolioRef);

    set(newItemRef, {
        id: newItemRef.key,
        title: title,
        description: description || "",
        link: link || "",
        createdAt: Date.now()
    }).then(() => {
        alert("Portofolio berhasil ditambahkan dan disinkronkan!");
    }).catch(err => alert("Gagal menyimpan portofolio: " + err.message));
}

// Hapus Portofolio dari DB
window.deletePortfolioItem = function(portfolioKey) {
    if (confirm("Hapus item portofolio ini?")) {
        remove(ref(database, `users/${userUID}/portfolio/${portfolioKey}`)).then(() => {
            alert("Portofolio berhasil dihapus!");
        });
    }
}

// ================= 6. FITUR PENDUKUNG LAINNYA =================
window.downloadSharedDirect = function(event, fileKey) {
    if(event) event.stopPropagation();
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
            alert("File tidak ditemukan.");
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

window.deleteFile = function(fileId) {
    if (confirm("Apakah Anda yakin ingin menghapus berkas ini?")) {
        remove(ref(database, `users/${userUID}/files/${fileId}`)).then(() => {
            remove(ref(database, `shared/${fileId}`));
            alert("Berkas berhasil dihapus!");
            loadTasksTab();
        });
    }
}

window.switchTab = function(tabName) {
    const tabs = ['overview', 'tasks', 'files', 'profile'];
    tabs.forEach(t => {
        const tabEl = document.getElementById(`tab-${t}`);
        if (tabEl) tabEl.classList.add('hidden');
    });

    const activeTab = document.getElementById(`tab-${tabName}`);
    if (activeTab) activeTab.classList.remove('hidden');

    if (tabName === 'tasks') loadTasksTab();
    if (tabName === 'files') loadUserFiles();
}

window.logout = function() {
    signOut(auth).then(() => {
        localStorage.removeItem('userSession');
        window.location.href = "index.html";
    });
}
