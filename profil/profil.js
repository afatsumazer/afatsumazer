// ================= LOGIKA INTERAKSI OPERASIONAL (PESAN, PENGIKUT, & DIKUTI) =================

// 1. Tampilkan Modal Daftar Pengikut (Followers)
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
                
                // Ambil info profil masing-masing pengikut
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

// 2. Tampilkan Modal Daftar Diikuti (Following)
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

// 3. Menutup Modal Hubungan
window.closeRelationsModal = function() {
    document.getElementById('relations-modal').classList.add('hidden');
}

// 4. Pembukaan & Penutupan Modal Pesan
window.openMessageModal = function() {
    const targetName = document.getElementById('other-profile-name').innerText;
    document.getElementById('message-target-name').innerText = targetName;
    document.getElementById('message-input').value = "";
    document.getElementById('message-modal').classList.remove('hidden');
}

window.closeMessageModal = function() {
    document.getElementById('message-modal').classList.add('hidden');
}

// 5. Kirim Pesan & Tulis ke Realtime Database secara Realtime
window.sendMessage = function() {
    const messageText = document.getElementById('message-input').value;
    if (!messageText.trim()) {
        alert("Isi pesan terlebih dahulu!");
        return;
    }

    if (currentUID === targetUID) {
        alert("Anda tidak bisa mengirimkan pesan ke akun Anda sendiri.");
        return;
    }

    // Buat node pesan masuk di database penerima
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
