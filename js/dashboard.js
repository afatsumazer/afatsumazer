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
let currentUserProfileName = "Pengguna"; // Menyimpan nama user aktif untuk penanda kepemilikan file publik
let currentFolder = "Utama"; 
let limitMB = 50;
let sisaKuotaCukup = true;
let sharedFileToDownload = null; 

// Menyimpan state sosial aktif
let activeSocialUID = "";
let chatListenerRef = null;
let allSocialUsers = {};

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
                currentUserProfileName = data.name || user.displayName || "Pengguna";
                
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
    } else {
        localStorage.removeItem('userSession');
        window.location.href = "login.html";
    }
});

// ================= PENANGANAN LINK SHARE (BERBAGI FILE) =================
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

// ================= LOGIKA NAVIGASI TAB (DIPERLUAS) =================
window.switchTab = function(tabName) {
    const tabs = ['overview', 'tasks', 'files', 'public-files', 'social', 'profile'];
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

    // Kode aman untuk mencegah tab macet saat elemen judul "page-title" dihapus di HTML
    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) {
        const titles = { 
            overview: 'Ringkasan', 
            tasks: 'Tugas Saya', 
            files: 'Penyimpanan File', 
            'public-files': 'Eksplorasi File Publik',
            social: 'Jejaring Sosial',
            profile: 'Profil Saya' 
        };
        pageTitleEl.innerText = titles[tabName] || '';
    }

    // Trigger pemuatan data saat tab dibuka
    if (tabName === 'public-files') {
        loadPublicFiles();
    } else if (tabName === 'social') {
        loadSocialUsers();
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
    if (!list) return;
    list.innerHTML = '';

    let completedCount = 0;
    let pendingCount = 0;

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

    document.getElementById('stat-tasks-pending').innerText = pendingCount;
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
            pubDate: Date.now(),
            status: 'privat' // Secara bawaan diunggah sebagai file privat
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
        if (!tableBody) return;
        tableBody.innerHTML = '';

        let totalBytes = 0;
        let fileCount = 0;

        if (!snapshot.exists()) {
            tableBody.innerHTML = `<tr><td colspan="3" class="px-6 py-4 text-center text-gray-400">Belum ada file di folder ini.</td></tr>`;
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
                const isPublic = file.status === 'publik';
                const accessBadgeClass = isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
                const accessText = isPublic ? '🌐 Publik' : '🔒 Privat';
                const actionAccessText = isPublic ? 'Jadikan Privat' : 'Jadikan Publik';

                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-50";
                tr.innerHTML = `
                    <td class="px-6 py-4 font-medium text-gray-800">${file.name}</td>
                    <td class="px-6 py-4 text-center">
                        <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${accessBadgeClass}">
                            ${accessText}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-right space-x-3">
                        <button onclick="toggleFileAccess('${key}', '${file.status || 'privat'}')" class="text-indigo-600 hover:text-indigo-800 font-semibold transition text-xs">${actionAccessText}</button>
                        <button onclick="downloadFile('${key}')" class="text-indigo-600 hover:text-indigo-800 font-semibold transition text-xs">Unduh</button>
                        <button onclick="shareFile('${key}')" class="text-green-600 hover:text-green-800 font-semibold transition text-xs">Bagikan Link</button>
                        <button onclick="deleteFile('${key}')" class="text-red-500 hover:text-red-700 font-semibold transition text-xs">Hapus</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            }
        });

        if (fileCount === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" class="px-6 py-4 text-center text-gray-400">Tidak ada file di folder "${currentFolder}".</td></tr>`;
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
            remove(ref(database, `public_files/${fileId}`)); // Hapus dari menu eksplorasi publik jika pernah dibagikan
            alert("Berkas berhasil dihapus!");
        });
    }
}

// ================= NEW: MENENTUKAN AKSES BERKAS (PRIVAT & PUBLIK) =================
window.toggleFileAccess = function(fileId, currentStatus) {
    const newStatus = currentStatus === 'publik' ? 'privat' : 'publik';
    const fileRef = ref(database, `users/${userUID}/files/${fileId}`);

    get(fileRef).then((snapshot) => {
        if (snapshot.exists()) {
            const fileData = snapshot.val();
            fileData.status = newStatus;

            // 1. Perbarui status di direktori pribadi pengguna
            set(fileRef, fileData).then(() => {
                if (newStatus === 'publik') {
                    // 2. Jika diatur ke publik, daftarkan datanya ke direktori global "public_files"
                    const publicFilePayload = {
                        id: fileId,
                        name: fileData.name,
                        size: fileData.size,
                        type: fileData.type,
                        data: fileData.data,
                        ownerUID: userUID,
                        ownerName: currentUserProfileName,
                        pubDate: Date.now()
                    };
                    set(ref(database, `public_files/${fileId}`), publicFilePayload).then(() => {
                        alert(`Berkas "${fileData.name}" sekarang dapat diakses publik di menu Eksplorasi!`);
                    });
                } else {
                    // 3. Jika diatur kembali ke privat, hapus data dari direktori global
                    remove(ref(database, `public_files/${fileId}`)).then(() => {
                        alert(`Berkas "${fileData.name}" diubah ke mode Privat.`);
                    });
                }
            });
        }
    });
}

// ================= NEW: MEMUAT BERKAS PUBLIK GLOBAL =================
function loadPublicFiles() {
    const publicFilesRef = ref(database, 'public_files');
    onValue(publicFilesRef, (snapshot) => {
        const tableBody = document.getElementById('public-file-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '';

        if (!snapshot.exists()) {
            tableBody.innerHTML = `<tr><td colspan="3" class="px-6 py-4 text-center text-gray-400">Tidak ada file publik yang tersedia saat ini.</td></tr>`;
            return;
        }

        const data = snapshot.val();
        Object.keys(data).forEach(key => {
            const file = data[key];
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50";
            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-800">${file.name} (${(file.size / 1024).toFixed(1)} KB)</td>
                <td class="px-6 py-4 text-gray-600 font-semibold text-xs">${file.ownerName || 'Anonim'}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="downloadPublicFile('${key}')" class="text-indigo-600 hover:text-indigo-800 font-semibold transition text-xs">Unduh</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    });
}

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

// ================= NEW: PENYEDIA JEJARING SOSIAL & PEMESANAN PRIBADI =================

// 1. Memuat semua pengguna terdaftar untuk opsi pencarian
function loadSocialUsers() {
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
        const listEl = document.getElementById('social-user-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        if (!snapshot.exists()) {
            listEl.innerHTML = `<li class="text-xs text-gray-400 text-center py-4">Belum ada pengguna terdaftar.</li>`;
            return;
        }

        allSocialUsers = snapshot.val();
        renderSocialUserList("");
    });
}

function renderSocialUserList(filterText) {
    const listEl = document.getElementById('social-user-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    let count = 0;
    Object.keys(allSocialUsers).forEach(uid => {
        if (uid === userUID) return; // Menyembunyikan profil diri sendiri dari pencarian

        const userData = allSocialUsers[uid];
        const profile = userData.profile || {};
        const name = profile.name || "Pengguna Baru";
        const username = profile.username || "@username";

        if (filterText && !name.toLowerCase().includes(filterText.toLowerCase()) && !username.toLowerCase().includes(filterText.toLowerCase())) {
            return;
        }

        count++;
        const li = document.createElement('li');
        li.className = "p-2 hover:bg-indigo-50 rounded-lg cursor-pointer transition flex items-center space-x-3 border border-gray-100 bg-white shadow-sm";
        li.onclick = () => openSocialProfile(uid);
        li.innerHTML = `
            <img src="${profile.photo || 'https://via.placeholder.com/150'}" class="w-8 h-8 rounded-full border border-gray-200 object-cover">
            <div class="flex-grow">
                <p class="text-xs font-bold text-gray-800 flex items-center">
                    ${name}
                    ${profile.isVerified ? ' <span class="text-blue-500 ml-1">✓</span>' : ''}
                </p>
                <p class="text-[10px] text-gray-500">${username}</p>
            </div>
        `;
        listEl.appendChild(li);
    });

    if (count === 0) {
        listEl.innerHTML = `<li class="text-xs text-gray-400 text-center py-4">Pengguna tidak ditemukan.</li>`;
    }
}

// Listener pencarian ketik langsung
document.getElementById('search-users-input').addEventListener('input', (e) => {
    renderSocialUserList(e.target.value);
});

// 2. Membuka profil statis dinamis pengguna lain
window.openSocialProfile = function(targetUID) {
    activeSocialUID = targetUID;

    document.getElementById('empty-profile-placeholder').classList.add('hidden');
    document.getElementById('social-profile-view').classList.remove('hidden');
    document.getElementById('private-chat-box').classList.add('hidden'); // Tutup chat lama jika berpindah user

    const targetUserRef = ref(database, `users/${targetUID}`);
    get(targetUserRef).then((snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.val();
        const profile = data.profile || {};

        document.getElementById('social-user-name').innerText = profile.name || "Pengguna";
        document.getElementById('social-user-email').innerText = profile.username || "@username";
        document.getElementById('social-user-avatar').src = profile.photo || "https://via.placeholder.com/150";

        // Hitung pengikut (followers) & mengikuti (following)
        const followersCount = data.followers ? Object.keys(data.followers).length : 0;
        const followingCount = data.following ? Object.keys(data.following).length : 0;

        // Hitung jumlah file yang dia atur berstatus 'publik'
        let publicFilesCount = 0;
        if (data.files) {
            Object.values(data.files).forEach(f => {
                if (f.status === 'publik') publicFilesCount++;
            });
        }

        document.getElementById('social-stat-followers').innerText = followersCount;
        document.getElementById('social-stat-following').innerText = followingCount;
        document.getElementById('social-stat-files').innerText = publicFilesCount;

        // Update teks dan gaya tombol Follow sesuai status relasi relasional
        const isFollowing = data.followers && data.followers[userUID] ? true : false;
        const followBtn = document.getElementById('btn-follow-user');
        
        if (isFollowing) {
            followBtn.innerText = "Batal Ikuti";
            followBtn.className = "bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-1.5 rounded-lg text-xs font-semibold transition";
        } else {
            followBtn.innerText = "Ikuti";
            followBtn.className = "bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition";
        }
    });
}

// 3. Sistem Follow & Unfollow Relasional
window.toggleFollowUser = function() {
    if (!activeSocialUID || !userUID) return;

    const followerRefOnTarget = ref(database, `users/${activeSocialUID}/followers/${userUID}`);
    const followingRefOnMe = ref(database, `users/${userUID}/following/${activeSocialUID}`);

    get(followerRefOnTarget).then((snapshot) => {
        if (snapshot.exists()) {
            // Unfollow
            remove(followerRefOnTarget);
            remove(followingRefOnMe).then(() => {
                openSocialProfile(activeSocialUID); // Perbarui tampilan statistik
            });
        } else {
            // Follow
            set(followerRefOnTarget, true);
            set(followingRefOnMe, true).then(() => {
                openSocialProfile(activeSocialUID); // Perbarui tampilan statistik
            });
        }
    });
}
document.getElementById('btn-follow-user').onclick = toggleFollowUser;

// 4. Sistem Pesan Pribadi (Private Messaging) Realtime
window.openSocialChat = function() {
    if (!activeSocialUID || !userUID) return;

    const chatBox = document.getElementById('private-chat-box');
    chatBox.classList.remove('hidden');

    // Menampilkan Nama Penerima Pesan
    const recipientNameEl = document.getElementById('chat-recipient-name');
    const targetUserRef = ref(database, `users/${activeSocialUID}/profile/name`);
    get(targetUserRef).then((snapshot) => {
        recipientNameEl.innerText = snapshot.val() || "Pengguna";
    });

    // Menentukan Chat Room ID gabungan unik (mengurutkan abjad UID terkecil ke terbesar)
    const chatRoomId = userUID < activeSocialUID ? `${userUID}_${activeSocialUID}` : `${activeSocialUID}_${userUID}`;
    const chatRef = ref(database, `chats/${chatRoomId}`);

    // Lepas listener lama jika ada agar tidak terjadi kebocoran performa data double-rendering
    if (chatListenerRef) {
        chatListenerRef();
    }

    // Set listener baru untuk membaca pesan secara realtime
    chatListenerRef = onValue(chatRef, (snapshot) => {
        const container = document.getElementById('chat-messages-container');
        if (!container) return;
        container.innerHTML = '';

        if (!snapshot.exists()) {
            container.innerHTML = `<p class="text-center text-gray-400 py-4 my-auto">Belum ada obrolan sebelumnya. Mulai menyapa!</p>`;
            return;
        }

        const messages = snapshot.val();
        Object.keys(messages).forEach(msgKey => {
            const msg = messages[msgKey];
            const isMe = msg.sender === userUID;

            const bubble = document.createElement('div');
            bubble.className = `max-w-[75%] p-2 rounded-xl text-xs shadow-sm ${
                isMe 
                ? 'bg-indigo-600 text-white rounded-br-none self-end ml-auto' 
                : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none self-start mr-auto'
            }`;
            bubble.innerText = msg.text;

            container.appendChild(bubble);
        });

        // Selalu gulir otomatis obrolan ke baris pesan terbawah
        container.scrollTop = container.scrollHeight;
    });
}
document.getElementById('btn-open-chat').onclick = openSocialChat;

window.closeSocialChat = function() {
    document.getElementById('private-chat-box').classList.add('hidden');
    if (chatListenerRef) {
        chatListenerRef();
        chatListenerRef = null;
    }
}

window.sendSocialMessage = function(event) {
    event.preventDefault();
    const input = document.getElementById('chat-message-input');
    const messageText = input.value.trim();
    if (!messageText || !activeSocialUID) return;

    const chatRoomId = userUID < activeSocialUID ? `${userUID}_${activeSocialUID}` : `${activeSocialUID}_${userUID}`;
    const chatRef = ref(database, `chats/${chatRoomId}`);
    const newMsgRef = push(chatRef);

    set(newMsgRef, {
        sender: userUID,
        text: messageText,
        timestamp: Date.now()
    }).then(() => {
        input.value = '';
    });
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
