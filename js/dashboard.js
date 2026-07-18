document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Mencegah form reload halaman bawaan
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loading = document.getElementById('loading');
    const errorDiv = document.getElementById('error');

    // 1. Tampilkan efek loading
    loading.style.display = 'block';
    errorDiv.innerText = '';

    // Simulasi proses pengecekan (misal 1 detik)
    setTimeout(() => {
        // 2. Sembunyikan loading
        loading.style.display = 'none';

        // 3. Alihkan pengguna ke halaman dashboard
        // Ganti 'dashboard-interaktif.html' sesuai dengan nama file dashboard Anda
        window.location.href = 'dashboard-interaktif.html'; 
        
    }, 1000); 
});
