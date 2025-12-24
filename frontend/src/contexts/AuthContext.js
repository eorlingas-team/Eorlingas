import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext({
    isAuthenticated: false,
    loading: true,
    user: null,
    login: () => { },
    logout: () => { },
    updateProfile: () => { }
});

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        console.error("useAuth was used outside of AuthProvider");
        return { isAuthenticated: false, loading: true, user: null, login: async () => { }, logout: () => { } };
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    console.log("AuthProvider rendering");
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const storedToken = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');

            if (storedToken && storedUser) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    const login = async (email, password) => {
        try {
            const response = await authApi.login({ email, password });
            if (response.data.success) {
                const { token: newToken, refreshToken, user: userData } = response.data.data;
                setToken(newToken);
                setUser(userData);
                localStorage.setItem('token', newToken);
                localStorage.setItem('refreshToken', refreshToken);
                localStorage.setItem('user', JSON.stringify(userData));
                return userData;
            }
            throw new Error(response.data.error?.message || response.data.error || 'Login failed');
        } catch (error) {
            console.error("AuthContext Login Error:", error);
            const msg = error.response?.data?.error?.message || error.response?.data?.error || error.message || 'Login failed';
            throw new Error(msg);
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    const updateProfile = async (data) => {
        const response = await authApi.updateProfile(data);
        if (response.data.success) {
            setUser(prev => {
                const updated = { ...prev, ...data };
                localStorage.setItem('user', JSON.stringify(updated));
                return updated;
            });
        }
        return response;
    };

    const deleteAccount = async () => {
        try {
            await authApi.deleteAccount();
            logout();
            return { success: true };
        } catch (error) {
            console.error("Delete account error:", error);
            // Check for last admin error
            const msg = error.response?.data?.error?.message || "Failed to delete account";
            return { success: false, error: msg };
        }
    };

    const value = React.useMemo(() => ({
        user,
        token,
        isAuthenticated: !!token,
        loading,
        login,
        logout,
        updateProfile,
        deleteAccount
    }), [user, token, loading]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
