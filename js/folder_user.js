db.ref('shared').once('value').then((snapshot) => {
    const allFiles = snapshot.val();
    Object.keys(allFiles).forEach(key => {
        const file = allFiles[key];
        // Jika ID pengirim cocok, masukkan ke dalam daftar aktivitas di modal
        if (file.senderUid === uid) {
            const liHTML = `<li>📁 ${file.fileName} - <a href="${file.fileUrl}">Buka</a></li>`;
            activitiesList.insertAdjacentHTML('beforeend', liHTML);
        }
    });
});
