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
                
                // Siapkan icon centang biru jika isVerified === true
                const verifiedIcon = data.isVerified === true ? `
                    <svg class="w-5 h-5 text-blue-500 inline-block ml-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l5-5z" clip-rule="evenodd"></path>
                    </svg>
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
    window.location.href = "index.html";
}

// ================= LOGIKA NAVIGASI TAB =================
window.switchTab = function(tabName) {
    const tabs = ['overview', 'tasks', 'files', 'profile'];
    tabs.forEach(t => {
        document.getElementById(`tab-${t}`).classList.add('hidden');
        
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

    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    
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

    const titles = { overview: 'Ringkasan', tasks: 'Tugas Saya', files: 'Penyimpanan File', profile: 'Profil Saya' };
    document.getElementById('page-title').innerText = titles[tabName];
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
