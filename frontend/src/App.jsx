import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- Page Imports ---
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';

import SpaceDetailsPage from './pages/SpaceDetailsPage';
import BookSpacePage from './pages/BookSpacePage';
import MyBookingsPage from './pages/MyBookingsPage';
import BookingDetailsPage from './pages/BookingDetailsPage';
import ProfilePage from './pages/ProfilePage';

import AdminDashboard from './pages/AdminDashboard';
import UserManagementPage from './pages/UserManagementPage';
import AuditLogsPage from './pages/AuditLogsPage';
import SpaceManagerDashboard from './pages/SpaceManagerDashboard';
import CreateSpacePage from './pages/CreateSpacePage';
import EditSpacePage from './pages/EditSpacePage';

function App() {
  return (
    <Router>
      <Routes>
        {/* --- Public Routes --- */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* --- Student Routes --- */}
        <Route path="/spaces/:id" element={<SpaceDetailsPage />} />
        <Route path="/book/:id" element={<BookSpacePage />} />
        <Route path="/bookings" element={<MyBookingsPage />} />
        <Route path="/bookings/:id" element={<BookingDetailsPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        {/* --- Admin Routes --- */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagementPage />} />
        <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
        
        {/* --- Space Manager Routes --- */}
        <Route path="/space-manager" element={<SpaceManagerDashboard />} />
        <Route path="/space-manager/create-space" element={<CreateSpacePage />} />
        <Route path="/space-manager/edit/:id" element={<EditSpacePage />} />

        {/* Catch-all: Redirect to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;