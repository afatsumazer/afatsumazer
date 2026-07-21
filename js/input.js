// 1. Memicu klik pada input file tersembunyi saat tombol diklik
window.triggerGallery = function() {
    document.getElementById('gallery-input').click();
}

// 2. Membaca gambar yang dipilih dari galeri dan mengubahnya ke Base64 [2]
window.previewGalleryImage = function() {
    const input = document.getElementById('gallery-input');
    const preview = document.getElementById('gallery-preview');

    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // Membatasi ukuran (contoh maksimal 2 MB agar sesuai batas kuota database Anda)
        if (file.size > 2 * 1024 * 1024) {
            alert("Ukuran foto dari galeri melebihi batas maksimal 2 MB.");
            input.value = ''; // Reset input
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Data = e.target.result;
            
            // Tampilkan hasil foto galeri ke elemen img pratinjau [2]
            preview.src = base64Data;
            
            // === SIAP DIKIRIM KE DATABASE ===
            // Variabel 'base64Data' ini berisi string Base64 yang sudah siap Anda simpan ke database
            // Contoh: set(ref(database, `users/${userUID}/profile/photo`), base64Data);
            console.log("Gambar siap disimpan:", base64Data);
        }
        reader.readAsDataURL(file); // Konversi ke Base64 [2]
    }
}
