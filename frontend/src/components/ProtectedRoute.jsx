import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute Component
 * Wraps routes that require authentication.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to render if allowed
 * @param {Array<string>} props.allowedRoles - List of roles that are allowed to access this route. If empty, all authenticated users are allowed.
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { user, isAuthenticated, loading } = useAuth();
    const location = useLocation();

    // 1. Show loading state while checking authentication
    if (loading) {
        return null;
    }

    // 2. Redirect to login if not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 3. Check for Role-based access
    if (allowedRoles.length > 0) {
        const getRoleKey = (role) => {
            if (!role) return 'guest';
            const r = role.toLowerCase();
            if (r === 'administrator' || r === 'admin') return 'admin';
            return r;
        };

        const userRoleKey = getRoleKey(user?.role);
        const normalizedAllowedRoles = allowedRoles.map(r => getRoleKey(r));

        if (!normalizedAllowedRoles.includes(userRoleKey)) {
            console.warn(`Access denied. User role: ${userRoleKey}, Allowed roles: ${normalizedAllowedRoles.join(', ')}`);
            return <Navigate to="/" replace />;
        }
    }

    // 4. Render the protected page
    return children;
};

export default ProtectedRoute;
