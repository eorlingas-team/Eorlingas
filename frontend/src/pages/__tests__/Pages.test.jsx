import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock ThemeContext first to avoid matchMedia issue
jest.mock('../../contexts/ThemeContext', () => ({
    ThemeProvider: ({ children }) => <div data-testid="theme-provider">{children}</div>,
    useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() })
}));

import { AuthProvider } from '../../contexts/AuthContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { ConfirmProvider } from '../../contexts/ConfirmContext';

// Mock auth API
jest.mock('../../api/auth', () => ({
    authApi: {
        login: jest.fn(),
        logout: jest.fn(),
        getCurrentUser: jest.fn(),
        updateProfile: jest.fn(),
        deleteAccount: jest.fn(),
        register: jest.fn(),
        verifyEmail: jest.fn(),
        resendVerification: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn()
    }
}));

// Simple wrapper with minimal providers
const MinimalProviders = ({ children }) => (
    <BrowserRouter>
        <ThemeProvider>
            <ToastProvider>
                <ConfirmProvider>
                    <AuthProvider>
                        {children}
                    </AuthProvider>
                </ConfirmProvider>
            </ToastProvider>
        </ThemeProvider>
    </BrowserRouter>
);

// Import pages that have minimal dependencies
import LoginPage from '../LoginPage';
import RegisterPage from '../RegisterPage';
import ForgotPasswordPage from '../ForgotPasswordPage';

describe('Page Components - Render Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    describe('Authentication Pages', () => {
        test('LoginPage renders without crashing', () => {
            const { container } = render(<LoginPage />, { wrapper: MinimalProviders });
            expect(container).toBeInTheDocument();
        });

        test('LoginPage has link to register', () => {
            render(<LoginPage />, { wrapper: MinimalProviders });
            expect(screen.getByText(/register|sign up|create account/i)).toBeInTheDocument();
        });

        test('LoginPage contains forgot password link', () => {
            render(<LoginPage />, { wrapper: MinimalProviders });
            expect(screen.getByText(/forgot/i)).toBeInTheDocument();
        });

        test('RegisterPage renders without crashing', () => {
            const { container } = render(<RegisterPage />, { wrapper: MinimalProviders });
            expect(container).toBeInTheDocument();
        });

        test('RegisterPage has link to login', () => {
            render(<RegisterPage />, { wrapper: MinimalProviders });
            expect(screen.getByText(/login|sign in|already have/i)).toBeInTheDocument();
        });

        test('ForgotPasswordPage renders without crashing', () => {
            const { container } = render(<ForgotPasswordPage />, { wrapper: MinimalProviders });
            expect(container).toBeInTheDocument();
        });
    });
});
