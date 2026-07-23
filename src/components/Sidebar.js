import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css'; // Kita buat file CSS-nya di langkah bawah

function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <h2>App Logo</h2>
      </div>
      <nav className="sidebar-menu">
        {/* NavLink otomatis mendeteksi halaman aktif */}
        <NavLink 
          to="/" 
          className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}
        >
          📊 Dashboard
        </NavLink>
        
        <NavLink 
          to="/profil" 
          className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}
        >
          👤 Lihat Profil
        </NavLink>
      </nav>
    </div>
  );
}

export default Sidebar;
