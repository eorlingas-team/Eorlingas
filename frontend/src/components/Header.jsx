import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/Header.module.css';

const Header = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user, logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const getRoleKey = (role) => {
        if (!role) return 'guest';
        const roleLower = role.toLowerCase();
        if (roleLower === 'student') return 'student';
        if (roleLower === 'space_manager') return 'space_manager';
        if (roleLower === 'administrator' || roleLower === 'admin') return 'admin';
        return 'guest';
    };

    const userRole = getRoleKey(user?.role);

    const handleLogout = () => {
        logout();
        navigate('/login');
        setIsMobileMenuOpen(false);
    };

    const toggleMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const closeMenu = () => {
        setIsMobileMenuOpen(false);
    };

    const location = useLocation();

    const isActive = (path) => {
        if (path === '/') {
            return location.pathname === '/' || location.pathname.startsWith('/spaces');
        }
        return location.pathname.startsWith(path);
    };

    // Render navigation links based on role
    const renderNavLinks = () => {
        switch (userRole) {
            case 'guest':
                return (
                    <>
                        <button
                            className={`${styles['nav-link']} ${isActive('/') ? styles.active : ''}`}
                            onClick={() => navigate('/')}
                        >
                            Find a Space
                        </button>
                    </>
                );

            case 'student':
                return (
                    <>
                        <button
                            className={`${styles['nav-link']} ${isActive('/') ? styles.active : ''}`}
                            onClick={() => navigate('/')}
                        >
                            Find a Space
                        </button>
                        <button
                            className={`${styles['nav-link']} ${isActive('/bookings') ? styles.active : ''}`}
                            onClick={() => navigate('/bookings')}
                        >
                            My Bookings
                        </button>
                    </>
                );

            case 'space_manager':
                return (
                    <>
                        <button
                            className={`${styles['nav-link']} ${isActive('/space-manager') ? styles.active : ''}`}
                            onClick={() => navigate('/space-manager')}
                        >
                            Dashboard
                        </button>
                    </>
                );

            case 'admin':
                return (
                    <>
                        <button
                            className={`${styles['nav-link']} ${location.pathname === '/admin' ? styles.active : ''}`}
                            onClick={() => navigate('/admin')}
                        >
                            Dashboard
                        </button>
                        <button
                            className={`${styles['nav-link']} ${isActive('/admin/space-management') ? styles.active : ''}`}
                            onClick={() => navigate('/admin/space-management')}
                        >
                            Spaces
                        </button>
                        <button
                            className={`${styles['nav-link']} ${isActive('/admin/users') ? styles.active : ''}`}
                            onClick={() => navigate('/admin/users')}
                        >
                            Users
                        </button>
                        <button
                            className={`${styles['nav-link']} ${isActive('/admin/reports') ? styles.active : ''}`}
                            onClick={() => navigate('/admin/reports')}
                        >
                            Reports
                        </button>
                        <button
                            className={`${styles['nav-link']} ${isActive('/admin/audit-logs') ? styles.active : ''}`}
                            onClick={() => navigate('/admin/audit-logs')}
                        >
                            Audit Logs
                        </button>
                    </>
                );

            default:
                return null;
        }
    };

    // Render auth buttons/icons based on role
    const renderAuthSection = () => {
        if (userRole === 'guest') {
            return (
                <>
                    <button className={`${styles['btn-login']}`} onClick={() => navigate('/login')}>Login</button>
                    <button className={`${styles['btn-signup']}`} onClick={() => navigate('/register')}>Sign Up</button>
                </>
            );
        }

        return (
            <>
                {/* Notification icon button */}
                <button className={`${styles['icon-btn']}`} title="Notifications">
                    <span className={`material-symbols-outlined`}>notifications</span>
                </button>

                {/* Profile icon */}
                <div className={`${styles['user-avatar-small']} ${isActive('/profile') ? styles.active : ''}`} onClick={() => navigate('/profile')} title="Profile">
                    <span className={`material-symbols-outlined`}>person</span>
                </div>
            </>
        );
    };

    // Render mobile menu items based on role
    const renderMobileMenu = () => {
        switch (userRole) {
            case 'guest':
                return (
                    <>
                        <button onClick={() => { navigate('/'); closeMenu(); }} className={`${styles['nav-link']}`} style={{ textAlign: 'left' }}>Find a Space</button>
                        <button onClick={() => { navigate('/login'); closeMenu(); }} className={`${styles['nav-link']}`} style={{ textAlign: 'left' }}>Login</button>
                        <button onClick={() => { navigate('/register'); closeMenu(); }} className={`${styles['nav-link']}`} style={{ textAlign: 'left', color: 'var(--primary-color)' }}>Sign Up</button>
                    </>
                );

            case 'student':
                return (
                    <>
                        <button onClick={() => { navigate('/'); closeMenu(); }} className={`${styles['nav-link']}`} style={{ textAlign: 'left' }}>Find a Space</button>
                        <button onClick={() => { navigate('/bookings'); closeMenu(); }} className={`${styles['nav-link']}`} style={{ textAlign: 'left' }}>My Bookings</button>
                        <button onClick={() => { navigate('/profile'); closeMenu(); }} className={`${styles['nav-link']} ${isActive('/profile') ? styles.active : ''}`} style={{ textAlign: 'left' }}>Profile</button>
                        <button onClick={handleLogout} className={`${styles['nav-link']}`} style={{ textAlign: 'left', color: 'var(--danger-color)' }}>Logout</button>
                    </>
                );

            case 'space_manager':
                return (
                    <>
                        <button onClick={() => { navigate('/space-manager'); closeMenu(); }} className={`${styles['nav-link']}`} style={{ textAlign: 'left' }}>Dashboard</button>
                        <button onClick={() => { navigate('/profile'); closeMenu(); }} className={`${styles['nav-link']} ${isActive('/profile') ? styles.active : ''}`} style={{ textAlign: 'left' }}>Profile</button>
                        <button onClick={handleLogout} className={`${styles['nav-link']}`} style={{ textAlign: 'left', color: 'var(--danger-color)' }}>Logout</button>
                    </>
                );

            case 'admin':
                return (
                    <>
                        <button onClick={() => { navigate('/admin'); closeMenu(); }} className={`${styles['nav-link']}`} style={{ textAlign: 'left' }}>Dashboard</button>
                        <button onClick={() => { navigate('/admin/space-management'); closeMenu(); }} className={`${styles['nav-link']}`} style={{ textAlign: 'left' }}>Spaces</button>
                        <button onClick={() => { navigate('/admin/users'); closeMenu(); }} className={`${styles['nav-link']}`} style={{ textAlign: 'left' }}>Users</button>
                        <button onClick={() => { navigate('/admin/reports'); closeMenu(); }} className={`${styles['nav-link']}`} style={{ textAlign: 'left' }}>Reports</button>
                        <button onClick={() => { navigate('/admin/audit-logs'); closeMenu(); }} className={`${styles['nav-link']}`} style={{ textAlign: 'left' }}>Audit Logs</button>
                        <button onClick={() => { navigate('/profile'); closeMenu(); }} className={`${styles['nav-link']} ${isActive('/profile') ? styles.active : ''}`} style={{ textAlign: 'left' }}>Profile</button>
                        <button onClick={handleLogout} className={`${styles['nav-link']}`} style={{ textAlign: 'left', color: 'var(--danger-color)' }}>Logout</button>
                    </>
                );

            default:
                return null;
        }
    };

    // Navigate to role-appropriate home
    const handleBrandClick = () => {
        if (userRole === 'admin') {
            navigate('/admin');
        } else if (userRole === 'space_manager') {
            navigate('/space-manager');
        } else {
            navigate('/');
        }
    };

    return (
        <>
            <header className={`${styles['app-header']}`}>
                <div className={`${styles['brand-title']}`} onClick={handleBrandClick}>İTÜ Study Space Finder</div>

                <div className={`${styles['header-nav']}`}>
                    <div className={`${styles['nav-links-desktop']}`}>
                        {renderNavLinks()}
                    </div>

                    <div className={`${styles['nav-links-desktop']} ${styles['auth-buttons']}`}>
                        {renderAuthSection()}
                    </div>

                    <button
                        className={`${styles['hamburger-btn']}`}
                        onClick={toggleMenu}
                    >
                        <span className={`material-symbols-outlined`} style={{ fontSize: '28px' }}>menu</span>
                    </button>
                </div>
            </header>

            {/* Mobile Menu */}
            <div className={`${styles['mobile-menu']} ${isMobileMenuOpen ? styles.open : ''}`}>
                {renderMobileMenu()}
            </div>
        </>
    );
};

export default Header;
