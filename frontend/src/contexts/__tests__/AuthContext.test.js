import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { authApi } from '../../api/auth';

// Mock dependencies
jest.mock('../../api/auth', () => ({
    authApi: {
        login: jest.fn(),
        logout: jest.fn(),
        updateProfile: jest.fn(),
        getCurrentUser: jest.fn(),
        deleteAccount: jest.fn()
    }
}));

// Helper component to consume context with logs
const TestComponent = () => {
    const { isAuthenticated, loading, user, login, logout, refreshUser, token } = useAuth();

    if (loading) return <div>Loading...</div>;
    
    return (
        <div>
            <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
            {user && <div data-testid="user-email">{user.email}</div>}
            <div data-testid="user-presence">{user ? 'User Present' : 'No User'}</div>
            <button onClick={() => login('test@example.com', 'password')}>Login</button>
            <button onClick={logout}>Logout</button>
            <button onClick={refreshUser}>Refresh</button>
        </div>
    );
};

describe('AuthContext', () => {
    const originalLocation = window.location;

    beforeAll(() => {
        delete window.location;
        window.location = { href: '' };
    });

    afterAll(() => {
        window.location = originalLocation;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        window.location.href = '';
    });

    it('should initialize with loading state and check local storage', async () => {
        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        // It might be too fast to catch Loading... text, so we just wait for it to settle.
        await waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    });

    it('should initialize with user if local storage has token', async () => {
        const mockUser = { email: 'stored@example.com' };
        localStorage.setItem('token', 'fake-token');
        localStorage.setItem('user', JSON.stringify(mockUser));

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });

        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
        expect(screen.getByTestId('user-email')).toHaveTextContent('stored@example.com');
    });

    it('should login successfully', async () => {
        const mockUser = { email: 'test@example.com', role: 'Student' };
        const mockResponse = {
            data: {
                success: true,
                data: {
                    token: 'new-token',
                    refreshToken: 'refresh-token',
                    user: mockUser
                }
            }
        };

        authApi.login.mockResolvedValue(mockResponse);

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

        act(() => {
            screen.getByText('Login').click();
        });

        await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
        });
        
        await waitFor(() => {
            expect(screen.getByTestId('user-presence')).toHaveTextContent('User Present');
        });
        
        expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
        expect(localStorage.getItem('token')).toBe('new-token');
    });

    it('should logout successfully', async () => {
        localStorage.setItem('token', 'old-token');
        
        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );
        
        await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

        act(() => {
            screen.getByText('Logout').click();
        });

        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
        expect(localStorage.getItem('token')).toBeNull();
    });
});
