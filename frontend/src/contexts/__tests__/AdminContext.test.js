import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AdminProvider, useAdmin } from '../AdminContext';
import { adminApi } from '../../api/admin';

// Mock API
jest.mock('../../api/admin', () => ({
    adminApi: {
        getSystemStats: jest.fn(),
        getAllUsers: jest.fn(),
        createUser: jest.fn(),
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
        getAuditLogs: jest.fn()
    }
}));

const TestComponent = () => {
    const { 
        stats, 
        users, 
        actions 
    } = useAdmin();

    return (
        <div>
            <div data-testid="active-users">{stats.activeUsers}</div>
            <div data-testid="total-users">{users.length}</div>
            <button onClick={() => actions.fetchStats()}>Fetch Stats</button>
            <button onClick={() => actions.fetchUsers()}>Fetch Users</button>
            <button onClick={() => actions.createUser({ email: 'new@itu.edu.tr' })}>Create User</button>
            <button onClick={() => actions.deleteUser(1)}>Delete User</button>
        </div>
    );
};

describe('AdminContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch system stats', async () => {
        adminApi.getSystemStats.mockResolvedValue({
            data: { success: true, data: { statistics: { activeUsers: 100 } } }
        });

        render(
            <AdminProvider>
                <TestComponent />
            </AdminProvider>
        );

        await act(async () => {
            screen.getByText('Fetch Stats').click();
        });

        await waitFor(() => {
            expect(screen.getByTestId('active-users')).toHaveTextContent('100');
        });
        expect(adminApi.getSystemStats).toHaveBeenCalled();
    });

    it('should fetch users list', async () => {
        adminApi.getAllUsers.mockResolvedValue({
            data: { success: true, data: { users: [{ id: 1 }, { id: 2 }] } }
        });

        render(
            <AdminProvider>
                <TestComponent />
            </AdminProvider>
        );

        await act(async () => {
            screen.getByText('Fetch Users').click();
        });

        await waitFor(() => {
            expect(screen.getByTestId('total-users')).toHaveTextContent('2');
        });
    });

    it('should create user and refresh list', async () => {
        adminApi.createUser.mockResolvedValue({
            data: { success: true, data: { id: 3 } }
        });
        // Initial fetch
        adminApi.getAllUsers.mockResolvedValueOnce({
            data: { success: true, data: { users: [] } }
        });
        // Refresh fetch
        adminApi.getAllUsers.mockResolvedValueOnce({
            data: { success: true, data: { users: [{ id: 3 }] } }
        });
        adminApi.getSystemStats.mockResolvedValue({
            data: { success: true, data: {} }
        });

        render(
            <AdminProvider>
                <TestComponent />
            </AdminProvider>
        );

        await act(async () => {
            screen.getByText('Create User').click();
        });

        expect(adminApi.createUser).toHaveBeenCalled();
        // Should trigger fetchUsers and fetchStats
        expect(adminApi.getAllUsers).toHaveBeenCalled();
        expect(adminApi.getSystemStats).toHaveBeenCalled();
    });

    it('should delete user and refresh list', async () => {
        adminApi.deleteUser.mockResolvedValue({
             data: { success: true }
        });
        adminApi.getAllUsers.mockResolvedValue({
            data: { success: true, data: { users: [] } }
        });
        adminApi.getSystemStats.mockResolvedValue({
            data: { success: true, data: {} }
        });

        render(
            <AdminProvider>
                <TestComponent />
            </AdminProvider>
        );

        await act(async () => {
            screen.getByText('Delete User').click();
        });

        expect(adminApi.deleteUser).toHaveBeenCalledWith(1);
        expect(adminApi.getAllUsers).toHaveBeenCalled();
    });
});
