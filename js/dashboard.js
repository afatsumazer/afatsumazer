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

// Variabel Kontrol Tab 2
let activeChannel = 'pengumuman';
let currentFeedListener = null;

const channelDetails = {
    'pengumuman': {
        title: 'pengumuman',
        desc: 'Ruang informasi resmi dan pengumuman umum grup.'
    },
    'daftar-tugas': {
        title: 'daftar-tugas',
        desc: 'Daftar rincian pekerjaan, tugas harian, dan pembaruan tugas.'
    },
    'link-penting': {
        title: 'link-penting',
        desc: 'Kumpulan tautan proyek, link eksternal, dan dokumen penting.'
    }
};

// Database Profil lokal untuk fallback
let usersDatabase = {
    "Anda (Saya)": {
        username: "@anda_saya",
        name: "Anda (Saya)",
        avatar: "https://via.placeholder.com/150",
        bio: "Pengembang Web & Kreator Konten di AppSaya.",
        joined: "Juli 2026",
        followers: 142,
        following: 89,
        badges: ["Developer"]
    }
};

// 1. Pengaman Sesi & Sinkronisasi Profil Secara Realtime (Mendukung Centang Biru & Premium)
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
                
                // Daftarkan ke basis data lokal untuk popup
                usersDatabase["Anda (Saya)"] = {
                    username: data.username || "@username",
                    name: data.name || user.displayName || "Pengguna",
                    avatar: data.photo || user.photoURL || "https://via.placeholder.com/150",
                    bio: data.bio || "Belum ada bio.",
                    joined: data.joined || "Juli 2026",
                    followers: data.followers || 142,
                    following: data.following || 89,
                    badges: data.isVerified ? ["Developer", "VIP"] : ["Member"]
                };

                // Daftarkan profil publik agar bisa diakses oleh orang lain saat mengetuk profil Anda
                set(ref(database, `public_profiles/${userUID}`), {
                    uid: userUID,
                    name: data.name || user.displayName || "Pengguna",
                    username: data.username || "@username",
                    avatar: data.photo || user.photoURL || "https://via.placeholder.com/150",
                    bio: data.bio || "Belum ada bio.",
                    joined: data.joined || "Juli 2026",
                    followers: data.followers || 142,
                    following: data.following || 89,
                    badges: data.isVerified ? ["Developer", "VIP"] : ["Member"]
                });
                
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
                
                syncComposerAvatar();
                renderFeaturedCard();
                renderRecommendations();
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
        loadFeaturedFileRealtime();
        loadFeedPosts();
    } else {
        localStorage.removeItem('userSession');
        window.location.href = "login.html";
    }
});

// ================= POPUP DETAL PROFIL REALTIME (MENDUKUNG TAP PROFIL ORANG) =================
window.showProfilePopup = function(authorNameOrUid) {
    // Jika diakses menggunakan pengenal Uid unik "uid:XXXX"
    if (authorNameOrUid.startsWith('uid:')) {
        const targetUid = authorNameOrUid.replace('uid:', '');
        const targetProfileRef = ref(database, `public_profiles/${targetUid}`);
        
        get(targetProfileRef).then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                populatePopupUI(data);
            }
        });
    } else {
        // Fallback pencarian berbasis nama lokal jika data profil orang lain belum dimuat
        const localUser = usersDatabase[authorNameOrUid];
        if (localUser) {
            populatePopupUI(localUser);
        } else {
            // Default profil jika data belum tersedia di database publik
            populatePopupUI({
                name: authorNameOrUid,
                username: "@" + authorNameOrUid.toLowerCase().replace(/\s+/g, '_'),
                avatar: "https://via.placeholder.com/150",
                bio: "Anggota tim workspace AppSaya.",
                joined: "Juli 2026",
                followers: 10,
                following: 5,
                badges: ["Member"]
            });
        }
    }
    document.getElementById('profile-popup').classList.remove('hidden');
}

function populatePopupUI(user) {
    document.getElementById('popup-avatar').src = user.avatar || user.photo || "https://via.placeholder.com/150";
    document.getElementById('popup-name').textContent = user.name || "Pengguna";
    document.getElementById('popup-username').textContent = user.username || "@username";
    document.getElementById('popup-bio').textContent = user.bio || "Belum ada bio.";
    document.getElementById('popup-followers').textContent = user.followers || 0;
    document.getElementById('popup-following').textContent = user.following || 0;
    document.getElementById('popup-joined').textContent = user.joined || "Juli 2026";

    const badgeContainer = document.getElementById('popup-badges');
    badgeContainer.innerHTML = '';
    const badges = user.badges || ["Member"];
    badges.forEach(badge => {
        const badgeEl = document.createElement('span');
        badgeEl.className = "px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-indigo-500/30 text-indigo-300 border border-indigo-500/20";
        badgeEl.textContent = badge;
        badgeContainer.appendChild(badgeEl);
    });
}

window.closeProfilePopup = function() {
    document.getElementById('profile-popup').classList.add('hidden');
}

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

    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) {
        const titles = { overview: 'Ringkasan', tasks: 'Linimasa', files: 'Penyimpanan File', profile: 'Profil Saya' };
        pageTitleEl.innerText = titles[tabName];
    }
}

// ================= INTEGRASI LOGIKA FEED LINIMASA (GAYA TWITTER & 10 POST LIMIT CLEANUP) =================

window.switchChannel = function(channelId) {
    activeChannel = channelId;

    const channels = ['pengumuman', 'daftar-tugas', 'link-penting'];
    channels.forEach(ch => {
        const btn = document.getElementById(`chan-${ch}`);
        if (btn) {
            if (ch === channelId) {
                btn.className = "w-full text-left flex items-center px-3 py-2.5 rounded-lg text-sm bg-indigo-50 text-indigo-700 font-bold transition whitespace-nowrap md:whitespace-normal";
                btn.querySelector('span').className = "mr-2 text-indigo-400 font-mono font-bold";
            } else {
                btn.className = "w-full text-left flex items-center px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition whitespace-nowrap md:whitespace-normal";
                btn.querySelector('span').className = "mr-2 text-gray-400 font-mono";
            }
        }
    });

    document.getElementById('active-channel-title').textContent = channelDetails[channelId].title;
    document.getElementById('active-channel-desc').textContent = channelDetails[channelId].desc;
    document.getElementById('feed-composer-text').placeholder = `Tulis pesan atau letakkan link baru di #${channelDetails[channelId].title}...`;

    loadFeedPosts();
}

function loadFeedPosts() {
    if (currentFeedListener) {
        currentFeedListener(); // Hapus listener sebelumnya
    }

    const postsRef = ref(database, `posts/${activeChannel}`);
    currentFeedListener = onValue(postsRef, (snapshot) => {
        const feedContainer = document.getElementById('feed-container');
        if (!feedContainer) return;
        feedContainer.innerHTML = '';

        if (!snapshot.exists()) {
            feedContainer.innerHTML = `
                <div class="bg-white p-8 text-center rounded-2xl border border-gray-150 text-gray-400 text-sm">
                    Belum ada postingan di saluran <strong class="text-indigo-600">#${activeChannel}</strong>. Jadilah yang pertama memposting!
                </div>
            `;
            return;
        }

        const data = snapshot.val();
        
        // Urutkan postingan: Terbaru di atas
        const postsArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })).reverse();

        postsArray.forEach(post => {
            const isSelf = post.authorUid === userUID;
            const visibilityIcon = post.isPublic 
                ? `<svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3.6 9h16.8M3.6 15h16.8M12 3v18"></path></svg>`
                : `<svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>`;
            
            const visibilityText = post.isPublic ? 'Publik' : 'Privat';

            // Lampiran Berkas
            let attachmentHTML = '';
            if (post.fileAttached) {
                if (post.fileAttached.type === 'image') {
                    attachmentHTML = `
                        <div class="mt-3 rounded-xl overflow-hidden border border-gray-150 max-h-72 bg-gray-100 flex items-center justify-center max-w-full">
                            <img src="${post.fileAttached.url}" alt="Attachment" class="max-w-full h-auto max-h-72 object-contain rounded-xl">
                        </div>
                        <div class="mt-1 flex items-center space-x-1.5 text-xs text-indigo-600 font-semibold bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                            <span class="truncate">${post.fileAttached.name}</span>
                        </div>
                    `;
                } else {
                    attachmentHTML = `
                        <div class="mt-3 flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                            <div class="flex items-center space-x-3 overflow-hidden">
                                <svg class="w-5 h-5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                <span class="text-xs font-semibold text-gray-700 truncate">${post.fileAttached.name}</span>
                            </div>
                            <span class="text-[10px] text-gray-400 font-mono uppercase bg-gray-200/50 px-1.5 py-0.5 rounded">dokumen</span>
                        </div>
                    `;
                }
            }

            const likeColor = post.likedBy && post.likedBy[userUID] ? 'text-red-500 fill-red-500' : 'text-gray-400 group-hover:text-red-500';
            const linkedContent = post.content.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-indigo-600 hover:underline font-semibold">$1</a>');

            const postHTML = `
                <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex space-x-4 relative hover:border-gray-200 transition">
                    <img src="${post.authorAvatar || "https://via.placeholder.com/150"}" alt="Avatar" onclick="showProfilePopup('uid:${post.authorUid}')" class="w-10 h-10 rounded-full border border-gray-100 object-cover flex-shrink-0 cursor-pointer hover:scale-105 transition duration-150">
                    <div class="flex-grow space-y-2 min-w-0">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-2">
                                <span onclick="showProfilePopup('uid:${post.authorUid}')" class="text-sm font-bold text-gray-900 cursor-pointer hover:text-indigo-600 transition">${post.authorName}</span>
                                <span class="text-xs text-gray-400">${new Date(post.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                <span class="flex items-center space-x-0.5 px-1.5 py-0.5 bg-gray-50 rounded text-[9px] font-medium text-gray-500" title="Visibilitas">
                                    ${visibilityIcon}
                                    <span>${visibilityText}</span>
                                </span>
                            </div>
                        </div>
                        <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">${linkedContent}</p>
                        
                        ${attachmentHTML}

                        <!-- Aksi Sosial -->
                        <div class="flex items-center space-x-8 pt-2.5 text-xs text-gray-400">
                            <button onclick="togglePostLike('${post.id}')" class="flex items-center space-x-1.5 group hover:text-red-500 transition ${likeColor}">
                                <svg class="w-4 h-4 group-hover:scale-110 transition" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                                <span class="font-semibold">${post.likesCount || 0}</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            feedContainer.insertAdjacentHTML('beforeend', postHTML);
        });
    });
}

window.handleComposerFileSelection = function() {
    const input = document.getElementById('composer-file-selector');
    const preview = document.getElementById('composer-file-preview');
    const previewName = document.getElementById('composer-preview-name');

    if (input.files.length > 0) {
        const file = input.files[0];
        previewName.textContent = file.name;
        preview.classList.remove('hidden');

        const isImg = file.type.includes('image');
        
        // Simpan sementara sebagai Base64 agar bisa diunggah ke Realtime Database
        const reader = new FileReader();
        reader.onload = function(e) {
            composerAttachedFile = {
                name: file.name,
                type: isImg ? 'image' : 'document',
                url: e.target.result // Base64 Data
            };
        };
        reader.readAsDataURL(file);
    }
}

window.clearComposerFile = function() {
    const input = document.getElementById('composer-file-selector');
    if (input) input.value = '';
    composerAttachedFile = null;
    document.getElementById('composer-file-preview').classList.add('hidden');
}

window.createPostFromComposer = function() {
    const textarea = document.getElementById('feed-composer-text');
    const visibilitySelect = document.getElementById('feed-composer-visibility');
    const user = auth.currentUser;

    if (!textarea.value.trim() && !composerAttachedFile) {
        alert('Tulis pesan atau pilih berkas terlebih dahulu!');
        return;
    }

    const postsRef = ref(database, `posts/${activeChannel}`);
    const newPostRef = push(postsRef);

    set(newPostRef, {
        authorName: usersDatabase["Anda (Saya)"].name,
        authorAvatar: usersDatabase["Anda (Saya)"].avatar,
        authorUid: userUID,
        time: "Baru saja",
        content: textarea.value,
        fileAttached: composerAttachedFile || null,
        timestamp: Date.now(),
        isPublic: visibilitySelect.value === 'public',
        likesCount: 0
    }).then(() => {
        textarea.value = '';
        clearComposerFile();
        
        // Lakukan pembersihan (Hanya sisakan 10 postingan terbaru di database)
        cleanupOldPosts(activeChannel);
    });
}

// Fungsi Pembersihan Otomatis (Hanya simpan 10 postingan terbaru di RTDB)
function cleanupOldPosts(channelId) {
    const postsRef = ref(database, `posts/${channelId}`);
    get(postsRef).then((snapshot) => {
        if (snapshot.exists()) {
            const posts = snapshot.val();
            const keys = Object.keys(posts).sort(); // Urutkan secara kronologis
            
            // Jika postingan lebih dari 10, hapus yang terlama
            if (keys.length > 10) {
                const keysToDelete = keys.slice(0, keys.length - 10);
                keysToDelete.forEach(key => {
                    remove(ref(database, `posts/${channelId}/${key}`));
                });
            }
        }
    });
}

window.togglePostLike = function(postId) {
    const postLikeRef = ref(database, `posts/${activeChannel}/${postId}`);
    get(postLikeRef).then((snapshot) => {
        if (snapshot.exists()) {
            const post = snapshot.val();
            let likedBy = post.likedBy || {};
            let likesCount = post.likesCount || 0;

            if (likedBy[userUID]) {
                delete likedBy[userUID];
                likesCount = Math.max(0, likesCount - 1);
            } else {
                likedBy[userUID] = true;
                likesCount += 1;
            }

            set(ref(database, `posts/${activeChannel}/${postId}/likedBy`), likedBy);
            set(ref(database, `posts/${activeChannel}/${postId}/likesCount`), likesCount);
        }
    });
}

// ================= LOGIKA INTERAKTIF TAB 1 (REALTIME DATABASE) =================

function loadFeaturedFileRealtime() {
    const featuredRef = ref(database, `public_featured_file`);
    onValue(featuredRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            // Update data global kartu unggulan
            const info = data.info || {};
            const stats = data.stats || { likes: 0, downloads: 0, views: 0 };
            const comments = data.comments ? Object.values(data.comments) : [];

            // Update UI
            document.getElementById('featured-owner-name').textContent = info.ownerName || "Penerbit";
            document.getElementById('featured-owner-username').textContent = info.ownerUsername || "@member";
            document.getElementById('featured-owner-avatar').src = info.ownerAvatar || "https://via.placeholder.com/150";
            
            // Atur fungsi tap profil pada kartu unggulan
            document.getElementById('featured-owner-avatar').setAttribute('onclick', `showProfilePopup('uid:${info.ownerUid}')`);
            document.getElementById('featured-owner-name').setAttribute('onclick', `showProfilePopup('uid:${info.ownerUid}')`);

            document.getElementById('featured-file-image').src = info.url || "https://images.unsplash.com/photo-1541462608141-27b2c7452167?auto=format&fit=crop&w=600&q=80";
            document.getElementById('featured-file-title').textContent = info.title || "Nama File";
            document.getElementById('featured-file-meta').textContent = `Diterbitkan pada: ${info.date || 'Hari Ini'} • Ukuran: ${info.size || '1.0 MB'}`;
            document.getElementById('featured-file-badge').textContent = info.badge || "JPG IMAGE";

            document.getElementById('featured-like-count').textContent = stats.likes || 0;
            document.getElementById('featured-download-stat-text').textContent = `${stats.downloads || 0} Diunduh`;
            
            const likeIcon = document.getElementById('featured-like-icon');
            if (stats.likedBy && stats.likedBy[userUID]) {
                likeIcon.setAttribute('fill', 'currentColor');
                likeIcon.classList.add('text-red-500');
            } else {
                likeIcon.setAttribute('fill', 'none');
                likeIcon.classList.remove('text-red-500');
            }

            // Render Komentar Realtime
            const listEl = document.getElementById('featured-comments-list');
            listEl.innerHTML = '';
            comments.forEach(c => {
                const html = `
                    <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                        <div class="flex justify-between font-bold text-gray-800">
                            <span class="hover:text-indigo-600 cursor-pointer" onclick="showProfilePopup('uid:${c.authorUid}')">${c.authorName}</span>
                            <span class="text-[9px] text-gray-400">${c.authorUsername}</span>
                        </div>
                        <p class="text-gray-600 mt-0.5 leading-relaxed">${c.text}</p>
                    </div>
                `;
                listEl.insertAdjacentHTML('beforeend', html);
            });
            document.getElementById('featured-comment-count').textContent = comments.length;
        }
    });
}

window.toggleFeaturedLike = function() {
    const featuredLikeRef = ref(database, `public_featured_file/stats`);
    get(featuredLikeRef).then((snapshot) => {
        let stats = snapshot.exists() ? snapshot.val() : { likes: 0, likedBy: {} };
        let likedBy = stats.likedBy || {};
        let likes = stats.likes || 0;

        if (likedBy[userUID]) {
            delete likedBy[userUID];
            likes = Math.max(0, likes - 1);
        } else {
            likedBy[userUID] = true;
            likes += 1;
        }

        set(ref(database, `public_featured_file/stats/likedBy`), likedBy);
        set(ref(database, `public_featured_file/stats/likes`), likes);
    });
}

window.triggerFeaturedDownload = function() {
    const featuredDlRef = ref(database, `public_featured_file/stats/downloads`);
    get(featuredDlRef).then((snapshot) => {
        let currentDownloads = snapshot.exists() ? snapshot.val() : 0;
        set(ref(database, `public_featured_file/stats/downloads`), currentDownloads + 1);
        
        // Jalankan download file unggulan asli
        get(ref(database, `public_featured_file/info`)).then((infoSnap) => {
            if (infoSnap.exists()) {
                const info = infoSnap.val();
                const a = document.createElement('a');
                a.href = info.url; 
                a.download = info.title;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        });
    });
}

window.submitFeaturedComment = function() {
    const input = document.getElementById('featured-comment-input');
    if (!input.value.trim()) return;

    const commentRef = ref(database, `public_featured_file/comments`);
    const newCommentRef = push(commentRef);

    set(newCommentRef, {
        authorName: usersDatabase["Anda (Saya)"].name,
        authorUsername: usersDatabase["Anda (Saya)"].username,
        authorUid: userUID,
        text: input.value.trim(),
        timestamp: Date.now()
    }).then(() => {
        input.value = '';
    });
}

function renderRecommendations() {
    // Membaca profil-profil publik untuk dicantumkan di list rekomendasi secara dinamis
    const publicProfilesRef = ref(database, `public_profiles`);
    onValue(publicProfilesRef, (snapshot) => {
        const recProfiles = document.getElementById('recommended-profiles-list');
        if (!recProfiles) return;
        recProfiles.innerHTML = '';

        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(key => {
                if (key === userUID) return; // Jangan tampilkan diri sendiri di rekomendasi orang lain
                const user = data[key];
                const html = `
                    <div class="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition">
                        <div class="flex items-center space-x-3 overflow-hidden">
                            <img src="${user.avatar || "https://via.placeholder.com/150"}" alt="Avatar" class="w-8 h-8 rounded-full object-cover">
                            <div class="min-w-0">
                                <h5 class="text-xs font-bold text-gray-800 truncate">${user.name}</h5>
                                <p class="text-[10px] text-gray-400 truncate">${user.username}</p>
                            </div>
                        </div>
                        <button onclick="showProfilePopup('uid:${user.uid}')" class="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-lg transition">Lihat</button>
                    </div>
                `;
                recProfiles.insertAdjacentHTML('beforeend', html);
            });
        }
    });

    // Menampilkan berkas preset siap klik
    const recFiles = document.getElementById('recommended-files-list');
    if (recFiles) {
        recFiles.innerHTML = `
            <div onclick="selectFeaturedPreset('Database-Backup-July.sql', '6.5 MB', 'SQL BACKUP', 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=600&q=80', 'Budi Santoso', 'uid_budi')" class="p-3 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-100 cursor-pointer transition flex items-center justify-between">
                <div class="flex items-center space-x-2.5 overflow-hidden">
                    <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
                    <span class="text-xs font-bold text-gray-800 truncate">Database-Backup-July.sql</span>
                </div>
                <span class="text-[9px] text-gray-400 font-semibold font-mono">6.5 MB</span>
            </div>
            <div onclick="selectFeaturedPreset('Protokol-Kerja-v1.pdf', '820 KB', 'PDF DOCUMENT', 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=600&q=80', 'Sarah Amelia', 'uid_sarah')" class="p-3 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-100 cursor-pointer transition flex items-center justify-between">
                <div class="flex items-center space-x-2.5 overflow-hidden">
                    <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    <span class="text-xs font-bold text-gray-800 truncate">Protokol-Kerja-v1.pdf</span>
                </div>
                <span class="text-[9px] text-gray-400 font-semibold font-mono">820 KB</span>
            </div>
        `;
    }
}

window.selectFeaturedPreset = function(title, size, badge, url, ownerName, ownerUid) {
    const featuredFile = {
        title: title,
        size: size,
        date: "Hari Ini",
        badge: badge,
        url: url,
        type: title.includes('.pdf') ? 'document' : 'image',
        ownerName: ownerName,
        ownerUsername: "@" + ownerName.toLowerCase().replace(/\s+/g, '_'),
        ownerAvatar: "https://via.placeholder.com/150",
        ownerUid: ownerUid
    };

    set(ref(database, `public_featured_file/info`), featuredFile);
    set(ref(database, `public_featured_file/stats`), { likes: 10, downloads: 4, views: 24, likedBy: {} });
    set(ref(database, `public_featured_file/comments`), {});
}

window.handleDatabaseSearch = function() {
    const val = document.getElementById('database-search-input').value.toLowerCase();
    const recProfiles = document.getElementById('recommended-profiles-list');
    if (!recProfiles) return;
    const items = recProfiles.getElementsByTagName('div');

    for (let i = 0; i < items.length; i++) {
        const nameText = items[i].getElementsByTagName('h5')[0];
        if (nameText) {
            const txtValue = nameText.textContent || nameText.innerText;
            if (txtValue.toLowerCase().indexOf(val) > -1) {
                items[i].style.display = "";
            } else {
                items[i].style.display = "none";
            }
        }
    }
}

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
        if (!tableBody) return;
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

// Render manual featured card awal dari local state
function renderFeaturedCard() {
    const featuredImgEl = document.getElementById('featured-file-image');
    if (!featuredImgEl) return;
    
    // UI default dimuat realtime oleh loadFeaturedFileRealtime()
}

function syncComposerAvatar() {
    const mainAvatar = document.getElementById('user-avatar');
    const composerAvatar = document.getElementById('feed-composer-avatar');
    const cardAvatar = document.getElementById('profile-card-avatar');
    const cardName = document.getElementById('profile-card-name');
    const cardUsername = document.getElementById('profile-card-username-display');
    const headerName = document.getElementById('user-display-name');

    const savedUsername = localStorage.getItem('user_discord_username') || "@anda_saya";
    
    if (mainAvatar) {
        if (composerAvatar) composerAvatar.src = mainAvatar.src;
        if (cardAvatar) cardAvatar.src = mainAvatar.src;
        const popupAva = document.getElementById('popup-avatar');
        if (popupAva) popupAva.src = mainAvatar.src;
    }
    if (cardName) cardName.textContent = usersDatabase["Anda (Saya)"].name;
    if (cardUsername) cardUsername.textContent = savedUsername;
    if (headerName) headerName.innerHTML = `Anda (${savedUsername})`;
}
