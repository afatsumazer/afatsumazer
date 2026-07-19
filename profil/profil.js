// profil/profil.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, onValue, get, set, remove, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDg2b6LERZ2zE86mTiYvUO1Uj--lAtpmgM",
  authDomain: "afatsumazer-app.firebaseapp.com",
  databaseURL: "https://afatsumazer-app-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "afatsumazer-app",
  storageBucket: "afatsumazer-app.firebasestorage.app",
  messagingSenderId: "16280759060",
  appId: "1:16280759060:web:fd4deacafdf5cadd777001"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

let currentUID = ""; 
let targetUID = "";  

const urlParams = new URLSearchParams(window.location.search);
targetUID = urlParams.get('uid');

if (!targetUID) {
    alert("Parameter profil tidak ditemukan.");
    window.location.href = "../dashboard.html";
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUID = user.uid;
        loadTargetProfile();
        loadTargetFiles();
        listenFollowRelations();
    } else {
        window.location.href = "../login.html";
    }
});

// Muat Profil Target dengan Pengaman Null-Check
function loadTargetProfile() {
    const profileRef = ref(database, `users/${targetUID}/profile`);
    onValue(profileRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            const nameEl = document.getElementById('other-profile-name');
            const usernameEl = document.getElementById('other-profile-username');
            const avatarEl = document.getElementById('other-profile-avatar');
            const roleEl = document.getElementById('other-profile-role');
            const emailEl = document.getElementById('other-profile-email');

            if (nameEl) nameEl.innerText = data.name || "Pengguna";
            if (usernameEl) usernameEl.innerText = data.username ? (data.username.startsWith('@') ? data.username : '@' + data.username) : "@username";
            if (avatarEl) avatarEl.src = data.photo || "https://via.placeholder.com/150";
            if (roleEl) roleEl.innerText = data.role || "Member";
            if (emailEl) emailEl.innerText = data.email || "";
        }
    });
}

// Sinkronisasi Pengikut secara Realtime
function listenFollowRelations() {
    const followersRef = ref(database, `users/${targetUID}/followers`);
    const btnFollow = document.getElementById('btn-follow');

    onValue(followersRef, (snapshot) => {
        let count = 0;
        let isFollowing = false;

        if (snapshot.exists()) {
            const data = snapshot.val();
            count = Object.keys(data).length;
            if (data[currentUID]) {
                isFollowing = true;
            }
        }

        const followersCountEl = document.getElementById('other-followers-count');
        if (followersCountEl) followersCountEl.innerText = count;

        if (btnFollow) {
            if (isFollowing) {
                btnFollow.innerText = "Mengikuti";
                btnFollow.className = "text-xs px-4 py-2 bg-gray-250 text-gray-800 font-semibold rounded-lg transition hover:bg-gray-300";
            } else {
                btnFollow.innerText = "Ikuti";
                btnFollow.className = "text-xs px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition";
            }
            btnFollow.onclick = () => toggleFollow();
        }
    });

    const followingRef = ref(database, `users/${targetUID}/following`);
    onValue(followingRef, (snapshot) => {
        const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        const followingCountEl = document.getElementById('other-following-count');
        if (followingCountEl) followingCountEl.innerText = count;
    });
}

function toggleFollow() {
    if (currentUID === targetUID) {
        alert("Anda tidak bisa mengikuti diri sendiri.");
        return;
    }

    const myFollowingRef = ref(database, `users/${currentUID}/following/${targetUID}`);
    const theirFollowersRef = ref(database, `users/${targetUID}/followers/${currentUID}`);

    get(myFollowingRef).then((snapshot) => {
        if (snapshot.exists()) {
            remove(myFollowingRef).then(() => remove(theirFollowersRef));
        } else {
            set(myFollowingRef, true).then(() => set(theirFollowersRef, true));
        }
    });
}

function loadTargetFiles() {
    const filesContainer = document.getElementById('other-profile-shared-files');
    const publicRef = ref(database, 'public_files');

    onValue(publicRef, (snapshot) => {
        if (!filesContainer) return;
        filesContainer.innerHTML = '';

        if (snapshot.exists()) {
            let count = 0;
            snapshot.forEach((childSnapshot) => {
                const file = childSnapshot.val();
                if (file.uploaderUID === targetUID) {
                    count++;
                    const sizeKB = (file.size / 1024).toFixed(1);
                    const item = document.createElement('div');
                    item.className = "p-4 flex items-center justify-between";
                    item.innerHTML = `
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path></svg>
                            </div>
                            <div class="text-left">
                                <p class="text-xs font-bold text-gray-800">${file.name}</p>
                                <p class="text-[10px] text-gray-400">Ukuran: ${sizeKB} KB</p>
                            </div>
                        </div>
                        <button onclick="downloadPublicFile('${childSnapshot.key}')" class="text-gray-500 hover:text-indigo-600 p-2 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        </button>
                    `;
                    filesContainer.appendChild(item);
                }
            });

            if (count === 0) {
                filesContainer.innerHTML = `<p class="p-4 text-xs text-gray-400 text-center">Belum ada berkas publik.</p>`;
            }
        } else {
            filesContainer.innerHTML = `<p class="p-4 text-xs text-gray-400 text-center">Belum ada berkas publik.</p>`;
        }
    });
}

// ================= LOGIKA INTERAKSI OPERASIONAL =================

window.showFollowersList = function() {
    const listContainer = document.getElementById('relations-modal-list');
    document.getElementById('relations-modal-title').innerText = "Daftar Pengikut (Followers)";
    document.getElementById('relations-modal').classList.remove('hidden');
    listContainer.innerHTML = '<p class="text-xs text-center text-gray-400 py-4">Memuat pengikut...</p>';

    const followersRef = ref(database, `users/${targetUID}/followers`);
    get(followersRef).then((snapshot) => {
        listContainer.innerHTML = '';
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const fUID = childSnapshot.key;
                get(ref(database, `users/${fUID}/profile`)).then((pSnap) => {
                    if (pSnap.exists()) {
                        const pData = pSnap.val();
                        const row = document.createElement('div');
                        row.className = "flex items-center justify-between pt-2.5 first:pt-0";
                        row.innerHTML = `
                            <div class="flex items-center gap-2">
                                <img src="${pData.photo || 'https://via.placeholder.com/150'}" class="w-8 h-8 rounded-full object-cover">
                                <div class="text-left">
                                    <p class="text-xs font-bold text-gray-800">${pData.name}</p>
                                    <p class="text-[10px] text-gray-400">${pData.username || '@username'}</p>
                                </div>
                            </div>
                            <a href="index.html?uid=${fUID}" class="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2.5 py-1 rounded-md font-semibold transition">Lihat</a>
                        `;
                        listContainer.appendChild(row);
                    }
                });
            });
        } else {
            listContainer.innerHTML = '<p class="text-xs text-center text-gray-400 py-4">Belum memiliki pengikut.</p>';
        }
    });
}

window.showFollowingList = function() {
    const listContainer = document.getElementById('relations-modal-list');
    document.getElementById('relations-modal-title').innerText = "Daftar Diikuti (Following)";
    document.getElementById('relations-modal').classList.remove('hidden');
    listContainer.innerHTML = '<p class="text-xs text-center text-gray-400 py-4">Memuat daftar...</p>';

    const followingRef = ref(database, `users/${targetUID}/following`);
    get(followingRef).then((snapshot) => {
        listContainer.innerHTML = '';
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const fUID = childSnapshot.key;
                get(ref(database, `users/${fUID}/profile`)).then((pSnap) => {
                    if (pSnap.exists()) {
                        const pData = pSnap.val();
                        const row = document.createElement('div');
                        row.className = "flex items-center justify-between pt-2.5 first:pt-0";
                        row.innerHTML = `
                            <div class="flex items-center gap-2">
                                <img src="${pData.photo || 'https://via.placeholder.com/150'}" class="w-8 h-8 rounded-full object-cover">
                                <div class="text-left">
                                    <p class="text-xs font-bold text-gray-800">${pData.name}</p>
                                    <p class="text-[10px] text-gray-400">${pData.username || '@username'}</p>
                                </div>
                            </div>
                            <a href="index.html?uid=${fUID}" class="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2.5 py-1 rounded-md font-semibold transition">Lihat</a>
                        `;
                        listContainer.appendChild(row);
                    }
                });
            });
        } else {
            listContainer.innerHTML = '<p class="text-xs text-center text-gray-400 py-4">Belum mengikuti siapa pun.</p>';
        }
    });
}

window.closeRelationsModal = function() {
    document.getElementById('relations-modal').classList.add('hidden');
}

window.openMessageModal = function() {
    const nameEl = document.getElementById('other-profile-name');
    const targetName = nameEl ? nameEl.innerText : "Pengguna";
    const targetNameSpan = document.getElementById('message-target-name');
    if (targetNameSpan) targetNameSpan.innerText = targetName;
    
    const inputEl = document.getElementById('message-input');
    if (inputEl) inputEl.value = "";
    
    const messageModal = document.getElementById('message-modal');
    if (messageModal) messageModal.classList.remove('hidden');
}

window.closeMessageModal = function() {
    const messageModal = document.getElementById('message-modal');
    if (messageModal) messageModal.classList.add('hidden');
}

window.sendMessage = function() {
    const inputEl = document.getElementById('message-input');
    const messageText = inputEl ? inputEl.value : "";
    if (!messageText.trim()) {
        alert("Isi pesan terlebih dahulu!");
        return;
    }

    if (currentUID === targetUID) {
        alert("Anda tidak bisa mengirimkan pesan ke akun Anda sendiri.");
        return;
    }

    const messageListRef = ref(database, `users/${targetUID}/messages`);
    const newMessageRef = push(messageListRef);

    set(newMessageRef, {
        id: newMessageRef.key,
        senderUID: currentUID,
        text: messageText,
        timestamp: Date.now()
    }).then(() => {
        alert("Pesan Anda berhasil dikirim!");
        closeMessageModal();
    }).catch((err) => {
        alert("Gagal mengirim pesan: " + err.message);
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
