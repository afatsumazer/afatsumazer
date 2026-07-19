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

// 1. Pengaman Sesi & Sinkronisasi Profil Secara Realtime (Mendukung Centang Biru & Premium)
onAuthStateChanged(auth, (user) => {
    // Cek apakah halaman dibuka melalui Link Berbagi Berkas
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    
    if (shareId) {
        loadSharedFile(shareId);
        return; // Jangan redirect jika hanya ingin unduh file bersama
    }

    if (user) {
        userUID = user.uid;
        
        // Membaca profil dari Realtime Database secara realtime
        const profileRef = ref(database, `users/${userUID}/profile`);
        onValue(profileRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                // Siapkan icon centang biru dengan balon keterangan (Tooltip) saat disentuh/di-hover
                const verifiedIcon = data.isVerified === true ? `
                    <span class="relative group inline-flex items-center ml-1">
                        <!-- Ikon Centang Biru -->
                        <svg class="w-5 h-5 text-blue-500 cursor-help" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l5-5z" clip-rule="evenodd"></path>
                        </svg>
                        
                        <!-- Balon Keterangan (Tooltip) -->
                        <span class="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 text-white text-[10px] font-bold px-2.5 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                            Akun Terverifikasi
                        </span>
                    </span>
                ` : '';

                // Siapkan badge Premium jika isPremium === true
                const premiumBadge = data.isPremium === true ? `
                    <div class="mt-2">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            ⭐ MEMBER PREMIUM
                        </span>
                    </div>
                ` : '';
                
                // Perbarui tampilan header atas (Nama + Centang Biru)
                document.getElementById('user-display-name').innerHTML = `
                    <span class="flex items-center">
                        ${data.name || user.displayName || "Pengguna"}
                        ${verifiedIcon}
                    </span>
                `;
                document.getElementById('user-avatar').src = data.photo || user.photoURL || "https://via.placeholder.com/150";
                
                // Perbarui kartu identitas di TAB PROFIL (Nama + Centang Biru)
                document.getElementById('profile-card-name').innerHTML = `
                    <span class="flex items-center justify-center">
                        ${data.name || user.displayName || "Pengguna"}
                        ${verifiedIcon}
                    </span>
                `;
                document.getElementById('profile-card-avatar').src = data.photo || user.photoURL || "https://via.placeholder.com/150";
                
                // Tampilkan ID unik (@username), Email, Premium Badge, & Bio
                document.getElementById('profile-card-email').innerHTML = `
                    <span class="text-indigo-600 font-bold block">${data.username || '@username'}</span>
                    <span class="text-xs text-gray-500 block mb-2">${user.email}</span>
                    ${premiumBadge}
                    <p class="text-sm italic text-gray-600 border-t border-gray-100 pt-2 mt-2">${data.bio || 'Belum ada bio.'}</p>
                `;
            } else {
                // Default jika database kosong
                document.getElementById('user-display-name').innerText = user.displayName || "Pengguna";
                document.getElementById('user-avatar').src = user.photoURL || "https://via.placeholder.com/150";
                document.getElementById('profile-card-name').innerText = user.displayName || "Pengguna";
                document.getElementById('profile-card-email').innerText = user.email;
                document.getElementById('profile-card-avatar').src = user.photoURL || "https://via.placeholder.com/150";
            }
        });

        // Muat Database Pengguna
        loadFolders();
        loadUserFiles();
        muatFilePublik(); // Muat berkas publik secara berkala
    } else {
        localStorage.removeItem('userSession');
        window.location.href = "login.html";
    }
});

// ================= LOGIKA NAVIGASI TAB (YANG SUDAH DISATUKAN) =================
const allTabs = ['overview', 'tasks', 'files', 'profile', 'public', 'other-profile'];

export function switchTab(tabId) {
    allTabs.forEach(id => {
        const element = document.getElementById(`tab-${id}`);
        if (element) {
            element.classList.add('hidden');
        }
    });

    const activeElement = document.getElementById(`tab-${tabId}`);
    if (activeElement) {
        activeElement.classList.remove('hidden');
    }

    // Reset style semua tombol sidebar desktop & mobile
    const buttons = ['overview', 'tasks', 'files', 'profile', 'public'];
    buttons.forEach(btn => {
        const dBtn = document.getElementById(`btn-${btn}`);
        const mBtn = document.getElementById(`btn-${btn}-mobile`);
        
        if (dBtn) {
            dBtn.className = "w-full text-left flex items-center px-4 py-2.5 rounded-lg text-indigo-100 hover:bg-indigo-800 hover:text-white transition";
        }
        if (mBtn) {
            mBtn.className = "flex flex-col items-center justify-center flex-1 h-12 rounded-lg text-indigo-200";
        }
    });

    // Berikan warna aktif pada tombol tab yang dipilih (bila bukan profil orang lain)
    if (tabId !== 'other-profile') {
        const activeDesktopBtn = document.getElementById(`btn-${tabId}`);
        const activeMobileBtn = document.getElementById(`btn-${tabId}-mobile`);
        
        if (activeDesktopBtn) {
            activeDesktopBtn.className = "w-full text-left flex items-center px-4 py-2.5 rounded-lg bg-indigo-800 text-white font-medium transition";
        }
        if (activeMobileBtn) {
            activeMobileBtn.className = "flex flex-col items-center justify-center flex-1 h-12 rounded-lg bg-indigo-800 text-white";
        }
    }

    // Sinkronisasi judul halaman atas
    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) {
        const titles = { 
            overview: 'Ringkasan', 
            tasks: 'Tugas Saya', 
            files: 'Penyimpanan File', 
            profile: 'Profil Saya',
            public: 'Beranda File Publik',
            'other-profile': 'Profil Pengguna'
        };
        pageTitleEl.innerText = titles[tabId] || 'Workspace';
    }
}

// Daftarkan switchTab ke window global agar onclick di HTML berfungsi
window.switchTab = switchTab;

// ================= PENANGANAN LINK SHARE (BERBAGI FILE PRIVATE) =================
function loadSharedFile(shareId) {
    const shareRef = ref(database, `shared/${shareId}`);
    get(shareRef).then((snapshot) => {
        if (snapshot.exists()) {
            const fileData = snapshot.val();
            sharedFileToDownload = fileData;
            
            document.getElementById('share-file-name').innerText = `${fileData.name} (${(fileData.size / 1024).toFixed(1)} KB)`;
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
        a.href = sharedFileToDownload.data; // data base64
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
    list.innerHTML = '';

    let completedCount = 0;
    let pendingCount = 0;

    // Masukkan contoh tugas dari pengguna lain di baris pertama
    const staticCollabLi = document.createElement('li');
    staticCollabLi.className = "flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg";
    staticCollabLi.innerHTML = `
        <div class="flex items-center space-x-3">
            <input type="checkbox" disabled class="h-4 w-4 text-indigo-600 border-gray-300 rounded">
            <span class="text-gray-700 font-medium">Revisi Arsitektur Sistem Informasi</span>
        </div>
        <button onclick="openOtherProfile('Budi Santoso', 'budi_santoso', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'System Architect', 'budi@appsaya.com', 'budi_santoso_uid')" class="text-xs text-indigo-600 font-semibold hover:underline bg-white px-2 py-1 rounded border border-gray-200 transition">
            @budi_santoso
        </button>
    `;
    list.appendChild(staticCollabLi);

    tasks.forEach(t => {
        if (t.completed) completedCount++; else pendingCount++;

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

    document.getElementById('stat-tasks-pending').innerText = pendingCount + 1; // +1 untuk tugas kolaboratif statis
    document.getElementById('stat-tasks-completed').innerText = completedCount;
}

saveAndRenderTasks();

// ================= LOGIKA PENYIMPANAN BERKAS DATABASE (MENDUKUNG FOLDER) =================
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
        alert("Untuk menjamin kecepatan & kestabilan database gratis, batas unggah maksimal adalah 2 MB per file.");
        return;
    }

    alert("Sedang mengonversi dan menyimpan berkas ke database...");

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Data = e.target.result; 
        
        const fileListRef = ref(database, `users/${userUID}/files`);
        const newFileRef = push(fileListRef);

        set(newFileRef, {
            id: newFileRef.key,
            name: file.name,
            size: file.size,
            type: file.type,
            folder: currentFolder, 
            data: base64Data, 
            pubDate: Date.now()
        }).then(() => {
            alert("Berkas berhasil disimpan!");
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
        tableBody.innerHTML = '';

        let totalBytes = 0;
        let fileCount = 0;

        if (!snapshot.exists()) {
            tableBody.innerHTML = `<tr><td colspan="2" class="px-6 py-4 text-center text-gray-400">Belum ada file di folder ini.</td></tr>`;
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
                fileCount++;
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-50";
                tr.innerHTML = `
                    <td class="px-6 py-4 font-medium text-gray-800">${file.name}</td>
                    <td class="px-6 py-4 text-right space-x-3">
                        <button onclick="downloadFile('${key}')" class="text-indigo-600 hover:text-indigo-800 font-semibold transition text-xs">Unduh</button>
                        <button onclick="shareFile('${key}')" class="text-green-600 hover:text-green-800 font-semibold transition text-xs">Bagikan Link</button>
                        <!-- FITUR BARU: Tombol Bagikan ke Publik -->
                        <button onclick="bagikanKePublik('${key}')" class="text-blue-600 hover:text-blue-800 font-semibold transition text-xs">Bagikan Publik</button>
                        <button onclick="deleteFile('${key}')" class="text-red-500 hover:text-red-700 font-semibold transition text-xs">Hapus</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            }
        });

        if (fileCount === 0) {
            tableBody.innerHTML = `<tr><td colspan="2" class="px-6 py-4 text-center text-gray-400">Tidak ada file di folder "${currentFolder}".</td></tr>`;
        }

        const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
        document.getElementById('kuota-info').innerText = `Penyimpanan Digunakan: ${totalMB} MB dari ${limitMB} MB (Free)`;
        document.getElementById('stat-files-count').innerText = Object.keys(data).length;

        sisaKuotaCukup = totalMB < limitMB;
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

// ================= LOGIKA BARU: BERBAGI FILE KE PUBLIK =================
window.bagikanKePublik = function(fileId) {
    if (!userUID) return;

    // Ambil data file pribadi
    const fileRef = ref(database, `users/${userUID}/files/${fileId}`);
    get(fileRef).then((snapshot) => {
        if (snapshot.exists()) {
            const fileData = snapshot.val();

            // Ambil data profil uploader untuk dipasang pada data publik
            const profileRef = ref(database, `users/${userUID}/profile`);
            get(profileRef).then((pSnapshot) => {
                let uName = auth.currentUser.displayName || "Pengguna";
                let uUsername = "@username";
                let uAvatar = auth.currentUser.photoURL || "https://via.placeholder.com/150";
                let isVerif = false;

                if (pSnapshot.exists()) {
                    const pData = pSnapshot.val();
                    uName = pData.name || uName;
                    uUsername = pData.username || uUsername;
                    uAvatar = pData.photo || uAvatar;
                    isVerif = pData.isVerified || false;
                }

                // Kirim data gabungan ke node 'public_files'
                const publicFileRef = ref(database, `public_files/${fileId}`);
                set(publicFileRef, {
                    id: fileId,
                    name: fileData.name,
                    size: fileData.size,
                    type: fileData.type,
                    data: fileData.data, // Menyimpan base64 untuk unduhan publik
                    uploaderName: uName,
                    uploaderUsername: uUsername,
                    uploaderAvatar: uAvatar,
                    isVerified: isVerif,
                    uploaderUID: userUID,
                    uploaderEmail: auth.currentUser.email,
                    timestamp: Date.now()
                }).then(() => {
                    alert("Berkas berhasil dibagikan ke Beranda Publik!");
                    switchTab('public');
                }).catch((err) => {
                    alert("Gagal membagikan ke publik: " + err.message);
                });
            });
        } else {
            alert("Gagal membaca berkas asli.");
        }
    });
}

// ================= LOGIKA BARU: MEMUAT BERKAS PUBLIK SECARA REALTIME =================
function muatFilePublik() {
    const publicRef = ref(database, 'public_files');
    onValue(publicRef, (snapshot) => {
        const container = document.querySelector('#tab-public .grid');
        if (!container) return;

        container.innerHTML = ""; // Kosongkan placeholder statis

        if (!snapshot.exists()) {
            container.innerHTML = `<p class="col-span-full text-center text-gray-400 text-sm py-8">Belum ada file publik yang dibagikan.</p>`;
            return;
        }

        const data = snapshot.val();
        Object.keys(data).forEach(key => {
            const file = data[key];
            const sizeKB = (file.size / 1024).toFixed(1);

            const isVerifiedIcon = file.isVerified === true ? `
                <svg class="w-4 h-4 text-blue-500 inline-block ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l5-5z" clip-rule="evenodd"></path>
                </svg>
            ` : '';

            const card = document.createElement('div');
            card.className = "bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between";
            card.innerHTML = `
                <div>
                    <div class="flex items-center justify-between mb-4">
                        <div onclick="openOtherProfile('${file.uploaderName}', '${file.uploaderUsername}', '${file.uploaderAvatar}', 'Member', '${file.uploaderEmail}', '${file.uploaderUID}')" class="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition text-left">
                            <img src="${file.uploaderAvatar}" class="w-8 h-8 rounded-full object-cover border border-gray-200">
                            <div>
                                <span class="text-xs font-bold block text-gray-800 hover:text-indigo-600">
                                    ${file.uploaderName} ${isVerifiedIcon}
                                </span>
                                <span class="text-[10px] text-indigo-500 font-medium block">${file.uploaderUsername}</span>
                            </div>
                        </div>
                        <button onclick="toggleFollowUser(this)" class="text-xs px-2.5 py-1 border border-indigo-600 text-indigo-600 font-semibold rounded-full hover:bg-indigo-50 transition">
                            Ikuti
                        </button>
                    </div>
                    <h4 class="font-bold text-gray-900 text-sm mb-1">${file.name}</h4>
                </div>
                <div class="flex items-center justify-between pt-3 border-t border-gray-100 mt-4">
                    <span class="text-[10px] text-gray-400"><span class="font-medium">Ukuran:</span> ${sizeKB} KB</span>
                    <button onclick="downloadPublicFile('${key}')" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                        Unduh
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

// Unduh file dari area publik
window.downloadPublicFile = function(fileId) {
    const fileRef = ref(database, `public_files/${fileId}`);
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

// ================= LOGIKA BARU: MEMBUKA PROFIL PENGGUNA LAIN SECARA DINAMIS =================
window.openOtherProfile = function(name, username, avatar, role, email, uploaderUID) {
    // Sembunyikan semua tab
    allTabs.forEach(id => {
        const element = document.getElementById(`tab-${id}`);
        if (element) element.classList.add('hidden');
    });
    
    // Tampilkan tab profil orang lain
    const otherProfileTab = document.getElementById('tab-other-profile');
    if (otherProfileTab) {
        otherProfileTab.classList.remove('hidden');
    }

    // Perbarui data antarmuka profil uploader
    document.getElementById('other-profile-avatar').src = avatar || "https://via.placeholder.com/150";
    document.getElementById('other-profile-name').innerText = name;
    document.getElementById('other-profile-username').innerText = username.startsWith('@') ? username : '@' + username;
    document.getElementById('other-profile-role').innerText = role || "Member";
    document.getElementById('other-profile-email').innerText = email || "";

    // Muat semua berkas publik yang diunggah oleh pengguna ini saja
    const filesContainer = document.getElementById('other-profile-shared-files');
    if (filesContainer) {
        filesContainer.innerHTML = `<p class="p-4 text-xs text-gray-400 text-center">Sedang memuat berkas publik...</p>`;

        const publicRef = ref(database, 'public_files');
        get(publicRef).then((snapshot) => {
            filesContainer.innerHTML = '';
            
            if (snapshot.exists()) {
                let count = 0;
                snapshot.forEach((childSnapshot) => {
                    const file = childSnapshot.val();
                    if (file.uploaderUID === uploaderUID || file.uploaderUsername === username) {
                        count++;
                        const sizeKB = (file.size / 1024).toFixed(1);
                        const item = document.createElement('div');
                        item.className = "p-4 flex items-center justify-between";
                        item.innerHTML = `
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-xs font-bold text-gray-800">${file.name}</p>
                                    <p class="text-[10px] text-gray-400">Ukuran: ${sizeKB} KB</p>
                                </div>
                            </div>
                            <button onclick="downloadPublicFile('${childSnapshot.key}')" class="text-gray-500 hover:text-indigo-600 p-2 transition">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                </svg>
                            </button>
                        `;
                        filesContainer.appendChild(item);
                    }
                });

                if (count === 0) {
                    filesContainer.innerHTML = `<p class="p-4 text-xs text-gray-400 text-center">Pengguna ini belum membagikan file publik apa pun.</p>`;
                }
            } else {
                filesContainer.innerHTML = `<p class="p-4 text-xs text-gray-400 text-center">Pengguna ini belum membagikan file publik apa pun.</p>`;
            }
        }).catch((err) => {
            filesContainer.innerHTML = `<p class="p-4 text-xs text-red-500 text-center">Gagal memuat berkas: ${err.message}</p>`;
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
        // Scroll ke bawah -> Sembunyikan header atas & bar navigasi bawah
        if (header) header.classList.add('-translate-y-full');
        if (mobileNav) mobileNav.classList.add('translate-y-full');
    } else {
        // Scroll ke atas -> Munculkan kembali
        if (header) header.classList.remove('-translate-y-full');
        if (mobileNav) mobileNav.classList.remove('translate-y-full');
    }
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
}, { passive: true });
