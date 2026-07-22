// js/dashboard.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ================= FIREBASE CONFIGURATION =================
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
let currentUserProfile = {};

// ================= HELPER FUNCTIONS =================
function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getFileExtension(filename, mimeType) {
    if (filename && filename.includes('.')) {
        const ext = filename.split('.').pop().toUpperCase();
        if (ext.length <= 5) return ext;
    }
    if (mimeType) {
        if (mimeType.includes('pdf')) return 'PDF';
        if (mimeType.includes('image/png')) return 'PNG';
        if (mimeType.includes('image/jpeg')) return 'JPG';
        if (mimeType.includes('word')) return 'DOCX';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'XLSX';
        if (mimeType.includes('zip')) return 'ZIP';
    }
    return 'FILE';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, "\\'");
}

// ================= 1. PENGAMAN SESI & AUTENTIKASI =================
onAuthStateChanged(auth, (user) => {
    if (user) {
        userUID = user.uid;
        
        // Load Profil User Aktif
        const profileRef = ref(database, `users/${userUID}/profile`);
        onValue(profileRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                currentUserProfile = data;
                
                const verifiedIcon = data.isVerified === true ? `
                    <span class="inline-flex items-center ml-1">
                        <svg class="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
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
                
                const displayName = data.name || user.displayName || "Pengguna";
                const userPhoto = data.photo || user.photoURL || "https://via.placeholder.com/150";

                const userDisplayEl = document.getElementById('user-display-name');
                if (userDisplayEl) userDisplayEl.innerHTML = `<span class="flex items-center">${displayName} ${verifiedIcon}</span>`;
                
                const userAvatarEl = document.getElementById('user-avatar');
                if (userAvatarEl) userAvatarEl.src = userPhoto;
                
                if(document.getElementById('profile-card-name')) {
                    document.getElementById('profile-card-name').innerHTML = `<span class="flex items-center justify-center">${displayName} ${verifiedIcon}</span>`;
                    document.getElementById('profile-card-avatar').src = userPhoto;
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
        loadUserPortfolio();   // Sinkronisasi Portofolio Saya
    } else {
        localStorage.removeItem('userSession');
        window.location.href = "login.html";
    }
});

// ================= 2. LOGIKA UNGGAH BERKAS (PUBLIK vs PRIVAT) =================
window.updateFileLabel = function() {
    const selector = document.getElementById('file-selector');
    const label = document.getElementById('file-label');
    if (selector && selector.files.length > 0) {
        label.innerText = `Terpilih: ${selector.files[0].name}`;
    } else if (label) {
        label.innerText = "Pilih file dari komputer Anda...";
    }
};

window.uploadSelectedFile = function() {
    const selector = document.getElementById('file-selector');
    const isPublicCheckbox = document.getElementById('file-is-public');
    
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
        alert("Ukuran file maksimal adalah 2 MB per file.");
        return;
    }

    const isPublic = isPublicCheckbox ? isPublicCheckbox.checked : false;
    const fileFormat = getFileExtension(file.name, file.type);

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Data = e.target.result; 
        const userNameEl = document.getElementById('user-display-name');
        const activeUserName = currentUserProfile.name || (userNameEl ? userNameEl.innerText.trim() : "Pengguna");

        const fileListRef = ref(database, `users/${userUID}/files`);
        const newFileRef = push(fileListRef);
        const fileKey = newFileRef.key;

        const fileDataObject = {
            id: fileKey,
            name: file.name,
            size: file.size,
            type: file.type,
            format: fileFormat,
            folder: currentFolder, 
            data: base64Data, 
            pubDate: Date.now(),
            uploadedBy: activeUserName,
            uploaderUID: userUID,
            isPublic: isPublic
        };

        // 1. Simpan ke Berkas Pribadi User
        set(newFileRef, fileDataObject).then(() => {
            // 2. JIKA PUBLIK -> Simpan ke node 'shared' untuk Tab Tugas
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
    };
    reader.readAsDataURL(file); 
};

// ================= 3. FOLDER & MANAGEMENT =================
window.setActiveFolder = function(folderName) {
    currentFolder = folderName;
    const activeFolderText = document.getElementById('active-folder-name');
    if (activeFolderText) activeFolderText.innerText = currentFolder;
    loadFolders();
    loadUserFiles();
};

window.createFolder = function() {
    const folderName = prompt("Masukkan nama folder baru:");
    if (!folderName) return;

    const folderRef = ref(database, `users/${userUID}/folders`);
    push(folderRef, folderName).then(() => {
        currentFolder = folderName;
        loadFolders();
        loadUserFiles();
    });
};

function loadFolders() {
    if (!userUID) return;
    const folderRef = ref(database, `users/${userUID}/folders`);
    onValue(folderRef, (snapshot) => {
        const folderListEl = document.getElementById('folder-list');
        if (!folderListEl) return;

        let defaultFolders = ["Utama", "Dokumen"];
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.values(data).forEach(f => {
                if (!defaultFolders.includes(f)) defaultFolders.push(f);
            });
        }

        folderListEl.innerHTML = defaultFolders.map(folder => `
            <li>
                <button onclick="setActiveFolder('${escapeHtml(folder)}')" class="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between ${currentFolder === folder ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'} transition">
                    <span>📁 ${folder}</span>
                    ${currentFolder === folder ? '<span class="text-[10px] bg-indigo-200 px-1.5 py-0.5 rounded">Aktif</span>' : ''}
                </button>
            </li>
        `).join('');

        const activeFolderText = document.getElementById('active-folder-name');
        if (activeFolderText) activeFolderText.innerText = currentFolder;
    });
}

// ================= 4. LOAD BERKAS (TAB BERKAS - PRIVAT) =================
function loadUserFiles() {
    if (!userUID) return;

    const fileRef = ref(database, `users/${userUID}/files`);
    onValue(fileRef, (snapshot) => {
        const tableBody = document.getElementById('file-table-body');
        if (tableBody) tableBody.innerHTML = '';

        let totalBytes = 0;

        if (!snapshot.exists()) {
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="2" class="px-6 py-4 text-center text-gray-400 text-xs">Belum ada file di folder <b>${currentFolder}</b>.</td></tr>`;
            const statFiles = document.getElementById('stat-files-count');
            if (statFiles) statFiles.innerText = 0;
            const kuotaInfo = document.getElementById('kuota-info');
            if (kuotaInfo) kuotaInfo.innerText = `Kapasitas: 0 MB dari ${limitMB} MB`;
            sisaKuotaCukup = true;
            return;
        }

        const data = snapshot.val();
        let totalFileCount = Object.keys(data).length;
        let countInFolder = 0;
        
        Object.keys(data).forEach(key => {
            const file = data[key];
            totalBytes += file.size || 0;

            if (file.folder === currentFolder) {
                countInFolder++;
                if (tableBody) {
                    const ext = file.format || getFileExtension(file.name, file.type);
                    const tr = document.createElement('tr');
                    tr.className = "hover:bg-gray-50 transition";
                    tr.innerHTML = `
                        <td class="px-6 py-4">
                            <div class="flex items-center space-x-2">
                                <span class="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">${ext}</span>
                                <span class="font-medium text-gray-800 break-all text-xs">${file.name}</span>
                                ${file.isPublic ? '<span class="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded">Publik</span>' : ''}
                            </div>
                        </td>
                        <td class="px-6 py-4 text-right space-x-2">
                            <button onclick="downloadFile('${key}')" class="text-indigo-600 hover:text-indigo-800 font-semibold text-xs">Unduh</button>
                            <button onclick="deleteFile('${key}')" class="text-red-500 hover:text-red-700 font-semibold text-xs">Hapus</button>
                        </td>
                    `;
                    tableBody.appendChild(tr);
                }
            }
        });

        if (countInFolder === 0 && tableBody) {
            tableBody.innerHTML = `<tr><td colspan="2" class="px-6 py-4 text-center text-gray-400 text-xs">Belum ada berkas di folder <b>${currentFolder}</b>.</td></tr>`;
        }

        const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
        const kuotaInfo = document.getElementById('kuota-info');
        if (kuotaInfo) kuotaInfo.innerText = `Terpakai: ${totalMB} MB dari ${limitMB} MB (${((totalMB/limitMB)*100).toFixed(1)}%)`;
        const statFiles = document.getElementById('stat-files-count');
        if (statFiles) statFiles.innerText = totalFileCount;
        sisaKuotaCukup = totalMB < limitMB;
    });
}

// ================= 5. LOAD TAB TUGAS (FILE PUBLIK) =================
function loadTasksTab() {
    const tasksContainer = document.getElementById('collaboration-files-container') || document.getElementById('tasks-files-container');
    if (!tasksContainer) return;

    const sharedRef = ref(database, 'shared');
    onValue(sharedRef, (snapshot) => {
        tasksContainer.innerHTML = '';

        if (snapshot.exists()) {
            const data = snapshot.val();
            let count = 0;

            Object.keys(data).forEach((key) => {
                const file = data[key];
                
                if (file.isPublic !== false) {
                    count++;
                    const fileSizeStr = formatBytes(file.size);
                    const ext = file.format || getFileExtension(file.name, file.type);
                    const pubDateStr = file.pubDate ? new Date(file.pubDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                    const uploaderName = file.uploadedBy || 'Pengguna';
                    const uploaderUID = file.uploaderUID || '';

                    tasksContainer.innerHTML += `
                        <div class="bg-gray-50 hover:bg-white border border-gray-200 rounded-xl p-4 shadow-sm transition group hover:shadow-md flex flex-col justify-between">
                            <div class="flex items-start justify-between">
                                <div class="flex items-center space-x-3 min-w-0">
                                    <div class="bg-indigo-600 text-white text-xs font-black px-2.5 py-2 rounded-lg shadow-sm uppercase shrink-0">
                                        ${ext}
                                    </div>
                                    <div class="min-w-0">
                                        <h4 onclick="openFileDetailModal('${escapeHtml(file.name)}', '${escapeHtml(uploaderName)}', '${ext}', '${fileSizeStr}', '${pubDateStr}', '${file.data}')" 
                                            class="text-sm font-bold text-gray-800 group-hover:text-indigo-600 cursor-pointer transition break-all line-clamp-1">
                                            ${file.name}
                                        </h4>
                                        <button onclick="showUserPortfolioModal('${uploaderUID}', '${escapeHtml(uploaderName)}')" 
                                           class="text-xs text-indigo-600 hover:underline font-semibold cursor-pointer mt-0.5 text-left">
                                           👤 ${uploaderName}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex items-center justify-between border-t border-gray-200/60 mt-4 pt-3 text-[11px] text-gray-500">
                                <span>Ukuran: <b>${fileSizeStr}</b></span>
                                <button onclick="downloadSharedDirect(event, '${key}')" class="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                                    Unduh
                                </button>
                            </div>
                        </div>
                    `;
                }
            });

            // Update Statistik Overview
            const pendingStat = document.getElementById('stat-tasks-pending');
            const completedStat = document.getElementById('stat-tasks-completed');
            if (pendingStat) pendingStat.innerText = 0; 
            if (completedStat) completedStat.innerText = count;

            if (count === 0) {
                tasksContainer.innerHTML = `<div class="col-span-2 py-8 text-center text-gray-400 text-sm">Belum ada berkas publik/tugas yang dibagikan.</div>`;
            }
        } else {
            tasksContainer.innerHTML = `<div class="col-span-2 py-8 text-center text-gray-400 text-sm">Belum ada berkas publik/tugas yang dibagikan.</div>`;
        }
    });
}

// ================= 6. FITUR PORTOFOLIO USER & MODAL POPUP =================

// Realtime Listener Portofolio Pribadi
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
                    <div class="bg-gray-50 p-3 rounded-lg border border-gray-200 relative group text-left">
                        <h4 class="font-bold text-gray-800 text-xs">${item.title}</h4>
                        <p class="text-[11px] text-gray-600 mt-1">${item.description}</p>
                        ${item.link ? `<a href="${item.link}" target="_blank" class="text-[10px] text-indigo-600 font-semibold mt-1.5 inline-block hover:underline">Lihat Project &rarr;</a>` : ''}
                        <button onclick="deletePortfolioItem('${key}')" class="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xs font-bold">
                            ✕
                        </button>
                    </div>
                `;
            });
        } else {
            container.innerHTML = `<p class="text-xs text-gray-400 italic">Belum ada portofolio. Tambahkan portofolio Anda!</p>`;
        }
    });
}

// Tambah Portofolio Baru ke DB
window.addPortfolioItem = function() {
    const title = prompt("Masukkan Judul Portofolio/Projek:");
    if (!title) return;

    const description = prompt("Masukkan Deskripsi Singkat:") || "";
    const link = prompt("Masukkan Link Projek/Sertifikat (opsional):") || "";

    const portfolioRef = ref(database, `users/${userUID}/portfolio`);
    const newItemRef = push(portfolioRef);

    set(newItemRef, {
        id: newItemRef.key,
        title: title,
        description: description,
        link: link,
        createdAt: Date.now()
    }).then(() => {
        alert("Portofolio berhasil ditambahkan!");
    }).catch(err => alert("Gagal menyimpan portofolio: " + err.message));
};

// Hapus Portofolio dari DB
window.deletePortfolioItem = function(portfolioKey) {
    if (confirm("Hapus item portofolio ini?")) {
        remove(ref(database, `users/${userUID}/portfolio/${portfolioKey}`)).then(() => {
            alert("Portofolio berhasil dihapus!");
        });
    }
};

// MODAL PORTOFOLIO PENGGUNAKAN SAAT NAMA DIKLIK
window.showUserPortfolioModal = function(uploaderUID, uploaderName) {
    if (!uploaderUID) {
        alert(`Pengguna ${uploaderName} belum melengkapi data profil/portofolio.`);
        return;
    }

    const userRef = ref(database, `users/${uploaderUID}`);
    get(userRef).then((snapshot) => {
        let bio = "Belum ada bio.";
        let portfolioListHTML = `<p class="text-xs text-gray-400 italic">Pengguna ini belum menambahkan portofolio.</p>`;

        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.profile && userData.profile.bio) bio = userData.profile.bio;

            if (userData.portfolio) {
                const items = Object.values(userData.portfolio);
                if (items.length > 0) {
                    portfolioListHTML = items.map(p => `
                        <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 text-left">
                            <h5 class="text-xs font-bold text-gray-800">${p.title}</h5>
                            <p class="text-[11px] text-gray-600 mt-0.5">${p.description || '-'}</p>
                            ${p.link ? `<a href="${p.link}" target="_blank" class="text-[10px] text-indigo-600 font-semibold hover:underline mt-1 inline-block">Buka Tautan Projek &rarr;</a>` : ''}
                        </div>
                    `).join('');
                }
            }
        }

        let modalEl = document.getElementById('user-portfolio-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'user-portfolio-modal';
            modalEl.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
                <button onclick="document.getElementById('user-portfolio-modal').classList.add('hidden')" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
                
                <div class="text-center pb-4 border-b border-gray-100">
                    <div class="w-16 h-16 bg-indigo-600 text-white font-bold text-2xl rounded-full flex items-center justify-center mx-auto mb-2 shadow-md">
                        ${uploaderName.charAt(0).toUpperCase()}
                    </div>
                    <h3 class="text-lg font-bold text-gray-900">${uploaderName}</h3>
                    <p class="text-xs text-gray-500 italic mt-0.5">"${bio}"</p>
                </div>

                <div class="py-4">
                    <h4 class="text-xs font-extrabold uppercase tracking-wider text-gray-400 mb-3">Portofolio & Projek</h4>
                    <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
                        ${portfolioListHTML}
                    </div>
                </div>

                <button onclick="document.getElementById('user-portfolio-modal').classList.add('hidden')" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-xs font-bold transition">
                    Tutup
                </button>
            </div>
        `;

        modalEl.classList.remove('hidden');
    }).catch(err => alert("Gagal memuat profil: " + err.message));
};

// ================= 7. AKSI UNDUH & HAPUS FILE =================
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
};

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
};

window.deleteFile = function(fileId) {
    if (confirm("Apakah Anda yakin ingin menghapus berkas ini?")) {
        remove(ref(database, `users/${userUID}/files/${fileId}`)).then(() => {
            remove(ref(database, `shared/${fileId}`));
            alert("Berkas berhasil dihapus!");
            loadTasksTab();
        });
    }
};

// ================= 8. LOGIKA NAVIGASI & SWITCH TAB =================
window.switchTab = function(tabName) {
    const tabs = ['overview', 'tasks', 'files', 'profile'];
    
    // Pemetaan Judul Halaman
    const pageTitles = {
        'overview': 'Ringkasan',
        'tasks': 'Tugas',
        'files': 'Berkas',
        'profile': 'Profil'
    };

    // 1. UBAH JUDUL HEADER ATAS DINAMIS
    const headerTitle = document.getElementById('page-title') || document.getElementById('header-title') || document.getElementById('ringkasan-title');
    if (headerTitle && pageTitles[tabName]) {
        headerTitle.innerText = pageTitles[tabName];
    }

    // 2. RESET SEMUA TAB KONTEN & EFEK TOMBOL (DESKTOP & MOBILE)
    tabs.forEach(t => {
        // Sembunyikan Konten Tab
        const tabEl = document.getElementById(`tab-${t}`);
        if (tabEl) tabEl.classList.add('hidden');
        
        // Reset Tombol Desktop
        const btnDesktop = document.getElementById(`btn-${t}`);
        if (btnDesktop) {
            btnDesktop.classList.remove('bg-indigo-800', 'text-white');
            btnDesktop.classList.add('text-indigo-100');
        }

        // Reset Tombol Mobile Bottom Nav
        const btnMobile = document.getElementById(`mobile-btn-${t}`);
        if (btnMobile) {
            btnMobile.classList.remove('bg-indigo-600', 'bg-indigo-700', 'bg-indigo-800', 'text-white', 'shadow-md');
            btnMobile.classList.add('text-indigo-200');
        }
    });

    // 3. TAMPILKAN KONTEN TAB AKTIF
    const activeTab = document.getElementById(`tab-${tabName}`);
    if (activeTab) activeTab.classList.remove('hidden');

    // 4. EFEK AKTIF PADA TOMBOL DESKTOP
    const activeBtn = document.getElementById(`btn-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-indigo-800', 'text-white');
        activeBtn.classList.remove('text-indigo-100');
    }

    // 5. EFEK AKTIF PADA TOMBOL MOBILE BOTTOM NAV
    const activeMobileBtn = document.getElementById(`mobile-btn-${tabName}`);
    if (activeMobileBtn) {
        activeMobileBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
        activeMobileBtn.classList.remove('text-indigo-200');
    }

    // 6. MUAT DATA SESUAI TAB
    if (tabName === 'tasks') loadTasksTab();
    if (tabName === 'files') loadUserFiles();
};

window.logout = function() {
    if (confirm('Apakah Anda yakin ingin keluar dari sesi?')) {
        signOut(auth).then(() => {
            localStorage.removeItem('userSession');
            window.location.href = "login.html";
        });
    }
};
