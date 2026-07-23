import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import ViewProfil from './views/ViewProfil';

function App() {
  return (
    <Router>
      <div style={{ display: 'flex' }}>
        {/* Sidebar menetap di sisi kiri */}
        <Sidebar />
        
        {/* Area Konten Utama diberi margin-left 250px sesuai lebar sidebar */}
        <div style={{ marginLeft: '250px', padding: '30px', flex: 1 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profil" element={<ViewProfil />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
