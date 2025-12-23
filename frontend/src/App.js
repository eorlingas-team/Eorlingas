import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- Page Imports ---
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

import SpaceDetailsPage from './pages/SpaceDetailsPage';
import MyBookingsPage from './pages/MyBookingsPage';
import BookingDetailsPage from './pages/BookingDetailsPage';
import ProfilePage from './pages/ProfilePage';

import AdminDashboard from './pages/AdminDashboard';
import UserManagementPage from './pages/UserManagementPage';
import AuditLogsPage from './pages/AuditLogsPage';
import SpaceManagerDashboard from './pages/SpaceManagerDashboard';
import CreateSpacePage from './pages/CreateSpacePage';
import EditSpacePage from './pages/EditSpacePage';

import { AppProviders } from './components/AppProviders';
import RoleBasedRoute from './components/RoleBasedRoute';

import ProtectedRoute from './components/ProtectedRoute';

// Main App Component with Global Providers
function App() {
  return (
    <AppProviders>
      <Routes>
        {/* --- Public Routes --- */}
        <Route path="/" element={
          <RoleBasedRoute>
            <LandingPage />
          </RoleBasedRoute>
        } />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/spaces/:id" element={<SpaceDetailsPage />} />

        {/* --- Student / Authenticated Routes --- */}
        <Route path="/bookings" element={
          <ProtectedRoute>
            <MyBookingsPage />
          </ProtectedRoute>
        } />
        <Route path="/bookings/:id" element={
          <ProtectedRoute>
            <BookingDetailsPage />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } />

        {/* --- Admin Routes --- */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['Administrator']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute allowedRoles={['Administrator']}>
            <UserManagementPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/audit-logs" element={
          <ProtectedRoute allowedRoles={['Administrator']}>
            <AuditLogsPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/space-management" element={
          <ProtectedRoute allowedRoles={['Administrator']}>
            <SpaceManagerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/space-management/create" element={
          <ProtectedRoute allowedRoles={['Administrator']}>
            <CreateSpacePage />
          </ProtectedRoute>
        } />
        <Route path="/admin/space-management/edit/:id" element={
          <ProtectedRoute allowedRoles={['Administrator']}>
            <EditSpacePage />
          </ProtectedRoute>
        } />


        {/* --- Space Manager Routes --- */}
        <Route path="/space-manager" element={
          <ProtectedRoute allowedRoles={['space_manager']}>
            <SpaceManagerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/space-manager/create-space" element={
          <ProtectedRoute allowedRoles={['space_manager']}>
            <CreateSpacePage />
          </ProtectedRoute>
        } />
        <Route path="/space-manager/edit/:id" element={
          <ProtectedRoute allowedRoles={['space_manager']}>
            <EditSpacePage />
          </ProtectedRoute>
        } />

        {/* Catch-all: Redirect to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProviders>
  );
}

export default App;