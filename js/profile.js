db.ref(`users/${uid}`).once('value').then((snapshot) => {
    const userData = snapshot.val();
    modalBio.innerText = userData ? (userData.bio || 'Tidak ada bio.') : 'Pengguna belum mengatur bio.';
});
