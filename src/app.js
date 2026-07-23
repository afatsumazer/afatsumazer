import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import ViewProfil from './views/ViewProfil';
import './App.css'; // Menghubungkan style global

function App() {
  return (
    <Router>
      <div className="app-container"> 
        <Sidebar />
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profil" element={<ViewProfil />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
