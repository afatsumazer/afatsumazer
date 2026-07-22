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
let currentUsername = ""; // Menyimpan username aktif untuk link portofolio
let currentFolder = "Utama"; 
let limitMB = 50;
let sisaKuotaCukup = true;
let sharedFileToDownload = null; 

// 1. Pengaman Sesi & Sinkronisasi Profil Secara Realtime
onAuthStateChanged(auth, (user) => {
    // Cek apakah halaman dibuka melalui Link Berbagi Berkas
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    
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
                
                // Simpan username untuk akses portofolio
                currentUsername = data.username || user.displayName || userUID;

                // Siapkan icon centang biru (Tooltip)
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

                // Siapkan badge Premium
                const premiumBadge = data.isPremium === true ? `
                    <div class="mt-2">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            ⭐ MEMBER PREMIUM
                        </span>
                    </div>
                ` : '';
                
                // Perbarui tampilan header atas (Nama dibuat interaktif untuk portofolio)
                const headerDisplayName = document.getElementById('user-display-name');
                if (headerDisplayName) {
                    headerDisplayName.innerHTML = `
                        <button onclick="openPortfolio()" class="flex items-center hover:text-indigo-600 transition text-left" title="Klik untuk membuka Portofolio">
                            <span>${data.name || user.displayName || "Pengguna"}</span>
                            ${verifiedIcon}
                        </button>
                    `;
                }

                const userAvatarEl = document.getElementById('user-avatar');
                if (userAvatarEl) {
                    userAvatarEl.src = data.photo || user.photoURL || "https://via.placeholder.com/150";
                }
                
                // Perbarui kartu identitas di TAB PROFIL
                const profileCardName = document.getElementById('profile-card-name');
                if (profileCardName) {
                    profileCardName.innerHTML = `
                        <button onclick="openPortfolio()" class="flex items-center justify-center hover:text-indigo-600 transition" title="Klik untuk membuka Portofolio">
                            <span>${data.name || user.displayName || "Pengguna"}</span>
                            ${verifiedIcon}
                        </button>
                    `;
                }

                const profileAvatarEl = document.getElementById('profile-card-avatar');
                if (profileAvatarEl) {
                    profileAvatarEl.src = data.photo || user.photoURL || "https://via.placeholder.com/150";
                }
                
                // Tampilkan ID unik (@username), Email, Premium Badge, & Bio + Tombol Portofolio
                const profileEmailEl = document.getElementById('profile-card-email');
                if (profileEmailEl) {
                    profileEmailEl.innerHTML = `
                        <span class="text-indigo-600 font-bold block">${data.username || '@username'}</span>
                        <span class="text-xs text-gray-500 block mb-2">${user.email}</span>
                        ${premiumBadge}
                        <p class="text-sm italic text-gray-600 border-t border-gray-100 pt-2 mt-2">${data.bio || 'Belum ada bio.'}</p>
                        
                        <!-- Tombol Akses & Salin Link Portofolio -->
                        <div class="mt-4 pt-3 border-t border-gray-100 flex flex-col gap-2">
                            <button onclick="openPortfolio()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition">
                                🎨 Lihat Portofolio
                            </button>
                            <button onclick="copyPortfolioLink()" class="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold py-2 px-3 rounded-lg transition">
                                🔗 Salin Link Portofolio Saya
                            </button>
                        </div>
                    `;
                }
            } else {
                // Default jika database kosong
                currentUsername = user.uid;
                if (document.getElementById('user-display-name')) document.getElementById('user-display-name').innerText = user.displayName || "Pengguna";
                if (document.getElementById('user-avatar')) document.getElementById('user-avatar').src = user.photoURL || "https://via.placeholder.com/150";
                if (document.getElementById('profile-card-name')) document.getElementById('profile-card-name').innerText = user.displayName || "Pengguna";
                if (document.getElementById('profile-card-email')) document.getElementById('profile-card-email').innerText = user.email;
                if (document.getElementById('profile-card-avatar')) document.getElementById('profile-card-avatar').src = user.photoURL || "https://via.placeholder.com/150";
            }
        });

        // Muat Database Pengguna
        loadFolders();
        loadUserFiles();
        loadSharedFilesTab(); 
    } else {
        localStorage.removeItem('userSession');
        window.location.href = "login.html";
    }
});

// ================= AKSI PORTOFOLIO =================
// 1. Membuka halaman portofolio publik pengguna
window.openPortfolio = function(targetUsername = null) {
    const username = targetUsername || currentUsername || userUID;
    if (!username) {
        alert("Username portofolio belum tersedia.");
        return;
    }
    // Buka halaman portfolio.html membawa parameter username di tab baru
    window.open(`portfolio.html?user=${encodeURIComponent(username)}`, '_blank');
}

// 2. Menyalin link portofolio pengguna ke clipboard
window.copyPortfolioLink = function() {
    const username = currentUsername || userUID;
    const portfolioUrl = `${window.location.origin}/portfolio.html?user=${encodeURIComponent(username)}`;
    
    navigator.clipboard.writeText(portfolioUrl).then(() => {
        alert(`Link Portofolio berhasil disalin!\n${portfolioUrl}`);
    }).catch(err => {
        alert("Gagal menyalin link: " + err);
    });
}

// ================= PENANGANAN LINK SHARE (BERBAGI FILE) =================
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

// ================= LOGIKA NAVIGASI TAB (TETAP 4 TAB ASLI) =================
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

    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.classList.remove('hidden');
    
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

// ================= LOGIKA TUGAS (TODO LIST) =================
let tasks = JSON.parse(localStorage.getItem('localTasks') || '[]');

window.addTask = function(event) {
    event.preventDefault();
    const input = document.getElementById('task-input');
    const newTask = { id: Date.now(), title: input.value, completed: false };
    tasks.push(newTask);
    input.value = '';
    saveAndRenderTasks();
}

window.toggleTask = function(id) {
    tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveAndRenderTasks();
}

window.deleteTask = function(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveAndRenderTasks();
}

function saveAndRenderTasks() {
    localStorage.setItem('localTasks', JSON.stringify(tasks));
    const list = document.getElementById('task-list');
    if (list) {
        list.innerHTML = '';
        tasks.forEach(t => {
            const li = document.createElement('li');
            li.className = "flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg";
            li.innerHTML = `
                <div class="flex items-center space-x-3">
                    <input type="checkbox" ${t.completed ? 'checked' : ''} onclick="toggleTask(${t.id})" class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
                    <span class="${t.completed ? 'line-through text-gray-400' : 'text-gray-700 font-medium'}">${t.title}</span>
                </div>
                <button onclick="deleteTask(${t.id})" class="text-xs font-semibold text-red-500 hover:text-red-700 transition">Hapus</button>
            `;
            list.appendChild(li);
        });
    }

    let completedCount = 0;
    let pendingCount = 0;
    tasks.forEach(t => { if (t.completed) completedCount++; else pendingCount++; });

    const pendingEl = document.getElementById('stat-tasks-pending');
    const completedEl = document.getElementById('stat-tasks-completed');
    if (pendingEl) pendingEl.innerText = pendingCount;
    if (completedEl) completedEl.innerText = completedCount;
}

saveAndRenderTasks();

// ================= LOGIKA PENYIMPANAN BERKAS DATABASE (MENDUKUNG FOLDER) =================
window.updateFileLabel = function() {
    const selector = document.getElementById('file-selector');
    if (selector && selector.files.length > 0) {
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

window.uploadSelectedFile = function() {
    const selector = document.getElementById('file-selector');
    if (!selector || selector.files.length === 0) {
        alert("Pilih file terlebih dahulu!");
        return;
    }

    if (!sisaKuotaCukup) {
        alert("Batas kuota penyimpanan gratis Anda (50 MB) telah penuh!");
        return;
    }

    const file = selector.files[0];

    if (file.size > 2 * 1024 * 1024) {
        alert("Untuk menjamin kecepatan & kestabilan database gratis, batas unggah maksimal adalah 2 MB per file.");
        return;
    }

    alert("Sedang mengonversi dan menyimpan berkas ke database...");

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Data = e.target.result; 
        
        const userNameEl = document.getElementById('user-display-name');
        const activeUserName = userNameEl ? userNameEl.innerText.trim() : "Anda";

        const fileListRef = ref(database, `users/${userUID}/files`);
        const newFileRef = push(fileListRef);

        set(newFileRef, {
            id: newFileRef.key,
            name: file.name,
            size: file.size,
            type: file.type,
            folder: currentFolder, 
            data: base64Data, 
            pubDate: Date.now(),
            uploadedBy: activeUserName
        }).then(() => {
            alert("Berkas berhasil disimpan!");
            if (document.getElementById('file-label')) {
                document.getElementById('file-label').innerText = "Pilih file dari komputer Anda...";
            }
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

        const gridTab2 = document.getElementById('user-files-container');
        if (gridTab2) gridTab2.innerHTML = '';

        let totalBytes = 0;
        let fileCountFolder = 0; 
        let fileCountTab2 = 0;   

        if (!snapshot.exists()) {
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="2" class="px-6 py-4 text-center text-gray-400">Belum ada file di folder ini.</td></tr>`;
            if (gridTab2) gridTab2.innerHTML = `<div class="col-span-2 py-8 text-center text-slate-400 text-sm">Belum ada berkas pribadi di database.</div>`;
            
            if (document.getElementById('stat-files-count')) document.getElementById('stat-files-count').innerText = 0;
            const countTab2El = document.getElementById('user-files-count');
            if (countTab2El) countTab2El.innerText = "0 Berkas";
            
            if (document.getElementById('kuota-info')) document.getElementById('kuota-info').innerText = `Penyimpanan Digunakan: 0 MB dari ${limitMB} MB (Free)`;
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

            if (gridTab2) {
                fileCountTab2++;
                const fileName = file.name || 'Berkas';
                const fileSizeStr = (file.size / 1024).toFixed(1) + " KB";
                const uploader = file.uploadedBy || "Anda";
                
                const fileType = fileName.endsWith('.dot') ? 'dot' : (fileName.endsWith('.docx') || fileName.endsWith('.doc') ? 'doc' : 'other');
                const badgeText = fileType === 'dot' ? 'Template' : (fileType === 'doc' ? 'Dokumen' : 'Format Lain');

                gridTab2.innerHTML += `
                    <div class="file-card-item bg-white p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all duration-200 flex items-start space-x-3" data-format="${fileType}">
                        <div class="p-3 ${fileType === 'dot' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'} rounded-xl flex-shrink-0">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                        </div>
                        <div class="flex-grow min-w-0">
                            <h4 class="text-sm font-bold text-slate-800 truncate" title="${fileName}">${fileName}</h4>
                            <p class="text-[11px] text-slate-400 mt-0.5">${fileSizeStr}</p>
                            <p class="text-[10px] text-slate-500 mt-1 flex items-center space-x-1">
                                <span class="font-medium">Diunggah oleh:</span>
                                <span class="font-bold text-indigo-600">${uploader}</span>
                            </p>
                            <div class="flex items-center space-x-2 mt-2">
                                <span class="px-2 py-0.5 ${fileType === 'dot' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'} text-[10px] font-bold rounded uppercase">${badgeText}</span>
                            </div>
                        </div>
                        <button onclick="downloadFile('${key}')" class="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 flex-shrink-0 transition" title="Unduh Berkas">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                            </svg>
                        </button>
                    </div>
                `;
            }
        });

        if (fileCountFolder === 0 && tableBody) {
            tableBody.innerHTML = `<tr><td colspan="2" class="px-6 py-4 text-center text-gray-400">Tidak ada file di folder "${currentFolder}".</td></tr>`;
        }

        const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
        if (document.getElementById('kuota-info')) document.getElementById('kuota-info').innerText = `Penyimpanan Digunakan: ${totalMB} MB dari ${limitMB} MB (Free)`;
        if (document.getElementById('stat-files-count')) document.getElementById('stat-files-count').innerText = Object.keys(data).length;

        const countTab2El = document.getElementById('user-files-count');
        if (countTab2El) countTab2El.innerText = `${fileCountTab2} Berkas`;

        sisaKuotaCukup = totalMB < limitMB;
    });
}

// ================= SINCRONISASI GLOBAL BERKAS KOLABORASI =================
function loadSharedFilesTab() {
    const sharedFilesContainer = document.getElementById('shared-files-container');
    if (!sharedFilesContainer) return;

    const sharedRef = ref(database, 'shared');
    onValue(sharedRef, (snapshot) => {
        sharedFilesContainer.innerHTML = '';

        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach((key) => {
                const file = data[key];
                const fileName = file.name || 'Berkas Bersama';
                const sharedBy = file.sharedBy || 'Pengguna Lain';

                sharedFilesContainer.innerHTML += `
                    <div class="bg-slate-50/50 p-4 rounded-xl border border-slate-100 hover:border-emerald-200 transition duration-200 flex items-start space-x-3">
                        <div class="p-3 bg-emerald-50 text-emerald-600 rounded-xl flex-shrink-0">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                            </svg>
                        </div>
                        <div class="flex-grow min-w-0">
                            <h4 class="text-sm font-bold text-slate-800 truncate" title="${fileName}">${fileName}</h4>
                            <p class="text-[11px] text-slate-500 mt-0.5">Dibagikan oleh: <span class="font-bold text-emerald-600">${sharedBy}</span></p>
                            <div class="flex items-center space-x-2 mt-2">
                                <span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded">Shared</span>
                            </div>
                        </div>
                        <button onclick="openShareModalTab2('${key}')" class="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 flex-shrink-0 transition" title="Unduh Berkas Bersama">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                            </svg>
                        </button>
                    </div>
                `;
            });
        } else {
            sharedFilesContainer.innerHTML = `<div class="col-span-2 py-8 text-center text-slate-400 text-sm">Belum ada berkas kolaborasi yang dibagikan saat ini.</div>`;
        }
    });
}

window.openShareModalTab2 = function(fileId) {
    loadSharedFile(fileId);
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

// ================= AUTO-HIDE NAVIGASI & HEADER SAAT SCROLL =================
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
