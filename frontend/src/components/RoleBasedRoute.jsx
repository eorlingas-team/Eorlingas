import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * RoleBasedRoute component that redirects users based on their role
 * - Admin users -> /admin
 * - Space Manager users -> /space-manager
 * - Students and Guests -> allowed to access the route
 */
const RoleBasedRoute = ({ children }) => {
    const { user } = useAuth();

    // Normalize role to lowercase for consistent matching
    const getRoleKey = (role) => {
        if (!role) return 'guest';
        const roleLower = role.toLowerCase();
        if (roleLower === 'student') return 'student';
        if (roleLower === 'space_manager') return 'space_manager';
        if (roleLower === 'administrator' || roleLower === 'admin') return 'admin';
        return 'guest';
    };

    const userRole = getRoleKey(user?.role);

    // Redirect based on role
    if (userRole === 'admin') {
        return <Navigate to="/admin" replace />;
    }

    if (userRole === 'space_manager') {
        return <Navigate to="/space-manager" replace />;
    }

    // Allow students and guests to access
    return children;
};

export default RoleBasedRoute;
