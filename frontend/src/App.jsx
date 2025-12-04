import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import SpaceDetailsPage from './pages/SpaceDetailsPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import EditSpacePage from './pages/EditSpacePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        <Route path="/spaces/:id" element={<SpaceDetailsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/edit/:id" element={<EditSpacePage />} />
      </Routes>
    </Router>
  );
}

export default App;