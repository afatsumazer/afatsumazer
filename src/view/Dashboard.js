import React from 'react';

function Dashboard() {
  return (
    <div>
      {/* Judul Halaman menggunakan class dari App.css */}
      <h1 className="page-title">Selamat Datang di Dashboard</h1>
      <p style={{ color: '#64748b', marginBottom: '30px' }}>
        Berikut adalah ringkasan data dan aktivitas aplikasi Anda hari ini.
      </p>

      {/* Grid Kartu Data menggunakan class dari App.css */}
      <div className="card-grid">
        
        {/* Kartu 1 */}
        <div className="card">
          <h3 style={{ fontSize: '14px', color: '#64748b', marginBottom: '10px' }}>Total Pengguna</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a' }}>1,245</p>
          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '500' }}>▲ +12% bulan ini</span>
        </div>

        {/* Kartu 2 */}
        <div className="card">
          <h3 style={{ fontSize: '14px', color: '#64748b', marginBottom: '10px' }}>Pendapatan</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a' }}>Rp 15.4M</p>
          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '500' }}>▲ +8% dari kemarin</span>
        </div>

        {/* Kartu 3 */}
        <div className="card">
          <h3 style={{ fontSize: '14px', color: '#64748b', marginBottom: '10px' }}>Aktivitas Aktif</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a' }}>89</p>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Sesi berjalan sekarang</span>
        </div>

      </div>

      {/* Area Konten Tambahan di bawah Kartu */}
      <div className="card" style={{ marginTop: '30px', padding: '30px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Pengumuman Terbaru</h2>
        <p style={{ color: '#475569', lineHeight: '1.6' }}>
          Sistem utama akan melakukan pemeliharaan rutin pada hari Minggu pukul 02:00 WIB. 
          Beberapa fitur mungkin akan mengalami gangguan singkat selama proses pembaruan berlangsung.
        </p>
      </div>
    </div>
  );
}

export default Dashboard;

