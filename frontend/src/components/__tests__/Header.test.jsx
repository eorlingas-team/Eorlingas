import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Header from '../Header';
import { AuthProvider } from '../../contexts/AuthContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { ThemeProvider } from '../../contexts/ThemeContext';

// Mock contexts to control state easier without complex providers in some tests
jest.mock('../../contexts/AuthContext', () => ({
    useAuth: jest.fn(),
    AuthProvider: ({ children }) => <div>{children}</div>
}));

jest.mock('../../contexts/NotificationContext', () => ({
    useNotifications: () => ({
        notifications: [],
        unreadCount: 2,
        loading: false,
        fetchNotifications: jest.fn(),
        markAsRead: jest.fn(),
        markAllAsRead: jest.fn()
    }),
    NotificationProvider: ({ children }) => <div>{children}</div>
}));

// Mock NotificationPanel
jest.mock('../NotificationPanel', () => () => <div data-testid="mock-notification-panel"></div>);

// Mock CSS Module
jest.mock('../../styles/Header.module.css', () => ({
    'app-header': 'app-header',
    'brand-title': 'brand-title',
    'header-nav': 'header-nav',
    'nav-links-desktop': 'nav-links-desktop',
    'auth-buttons': 'auth-buttons',
    'hamburger-btn': 'hamburger-btn',
    'mobile-menu': 'mobile-menu',
    'open': 'open',
    'nav-link': 'nav-link',
    'active': 'active',
    'btn-login': 'btn-login',
    'btn-signup': 'btn-signup',
    'icon-btn': 'icon-btn',
    'badge': 'badge',
    'user-avatar-small': 'user-avatar-small'
}));

jest.mock('../../contexts/ThemeContext', () => ({
    useTheme: () => ({ isDarkMode: false, toggleTheme: jest.fn() }),
    ThemeProvider: ({ children }) => <div>{children}</div>
}));

const { useAuth } = require('../../contexts/AuthContext');

// Mock react-router-dom hooks explicitly for this test
jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn(),
    useLocation: () => ({ pathname: '/' }),
    BrowserRouter: ({ children }) => <div>{children}</div>,
    Link: ({ children }) => children
}));

describe('Header Component', () => {

    beforeEach(() => {
        useAuth.mockReturnValue({
            isAuthenticated: false,
            user: null,
            logout: jest.fn()
        });
    });

    const renderHeader = () => {
        return render(
            <BrowserRouter>
                <Header />
            </BrowserRouter>
        );
    };

    it('renders logo and basic links for guest', () => {
        renderHeader();
        expect(screen.getByText(/İTÜ Study Space Finder/i)).toBeInTheDocument();
        // Login appears in desktop and mobile menu
        expect(screen.getAllByText(/Login/i).length).toBeGreaterThan(0);
    });

    it('renders navigation for authenticated student', () => {
        useAuth.mockReturnValue({
            isAuthenticated: true,
            user: { role: 'Student', email: 'student@test.com' },
            logout: jest.fn()
        });

        renderHeader();

        expect(screen.queryByText(/Login/i)).not.toBeInTheDocument();
        // My Bookings appears in desktop and mobile menu
        expect(screen.getAllByText(/My Bookings/i).length).toBeGreaterThan(0);
        // Profile icon has title "Profile" on desktop
        expect(screen.queryByTitle(/Profile/i)).toBeInTheDocument();
    });

    it('renders admin dashboard link for administrator', () => {
        useAuth.mockReturnValue({
            isAuthenticated: true,
            user: { role: 'Administrator' },
            logout: jest.fn()
        });

        renderHeader();

        // Dashboard appears in desktop and mobile menu
        expect(screen.getAllByText(/Dashboard/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Spaces/i).length).toBeGreaterThan(0);
    });
});
