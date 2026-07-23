import React from 'react';

function ViewProfil() {
  // Simulasi data pengguna (Bisa diganti dengan data dari API nanti)
  const user = {
    nama: "Alex Bhaskara",
    email: "alex.bhaskara@email.com",
    peran: "Administrator Utama",
    foto: "https://unsplash.com", // Foto sampel otomatis
    bergabung: "Januari 2025"
  };

  return (
    <div>
      {/* Judul Halaman menggunakan class dari App.css */}
      <h1 className="page-title">Profil Saya</h1>
      <p style={{ color: '#64748b', marginBottom: '30px' }}>
        Kelola informasi akun dan pengaturan keamanan Anda di sini.
      </p>

      {/* Kotak Utama Profil */}
      <div className="card" style={{ maxWidth: '600px', padding: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '25px', marginBottom: '30px', borderBottom: '1px solid #e2e8f0', paddingBottom: '25px' }}>
          {/* Foto Profil berbentuk Lingkaran */}
          <img 
            src={user.foto} 
            alt="Foto Profil" 
            style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #3b82f6' }}
          />
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '600', color: '#0f172a' }}>{user.nama}</h2>
            <p style={{ color: '#3b82f6', fontWeight: '500', fontSize: '14px', marginTop: '2px' }}>{user.peran}</p>
          </div>
        </div>

        {/* Detail Informasi Akun */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '5px' }}>Alamat Email</label>
            <p style={{ fontSize: '16px', color: '#334155', fontWeight: '500' }}>{user.email}</p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '5px' }}>Tanggal Bergabung</label>
            <p style={{ fontSize: '16px', color: '#334155', fontWeight: '500' }}>{user.bergabung}</p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '5px' }}>Status Akun</label>
            <span style={{ display: 'inline-block', backgroundColor: '#dcfce7', color: '#15803d', fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '50px', marginTop: '4px' }}>
              ● Aktif
            </span>
          </div>
        </div>

        {/* Tombol Aksi Tambahan */}
        <div style={{ marginTop: '35px', display: 'flex', gap: '10px' }}>
          <button style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
            Edit Profil
          </button>
          <button style={{ backgroundColor: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', fontSize: '14px' }}>
            Ubah Password
          </button>
        </div>
      </div>
    </div>
  );
}

export default ViewProfil;
