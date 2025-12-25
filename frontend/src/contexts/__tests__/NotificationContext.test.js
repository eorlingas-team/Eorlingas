import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { NotificationProvider, useNotifications } from '../NotificationContext';
import { notificationsApi } from '../../api/notifications';

// Mock API
jest.mock('../../api/notifications', () => ({
    notificationsApi: {
        getNotifications: jest.fn(),
        getUnreadCount: jest.fn(),
        markAsRead: jest.fn(),
        markAllAsRead: jest.fn()
    }
}));

// Mock AuthContext
jest.mock('../AuthContext', () => ({
    useAuth: () => ({ isAuthenticated: true })
}));

const TestComponent = () => {
    const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotifications();
    return (
        <div>
            <div data-testid="unread-count">{unreadCount}</div>
            <div data-testid="notification-count">{notifications.length}</div>
            <button onClick={() => fetchNotifications()}>Fetch</button>
            <button onClick={() => markAsRead(1)}>Mark Read 1</button>
            <button onClick={() => markAllAsRead()}>Mark All Read</button>
            <ul>
                {notifications.map(n => (
                    <li key={n.notificationId} data-testid={`notif-${n.notificationId}`}>
                        {n.message} - {n.isRead ? 'Read' : 'Unread'}
                    </li>
                ))}
            </ul>
        </div>
    );
};

describe('NotificationContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch unread count on mount if authenticated', async () => {
        notificationsApi.getUnreadCount.mockResolvedValue({
            data: { success: true, data: { unreadCount: 5 } }
        });

        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('unread-count')).toHaveTextContent('5');
        });
        expect(notificationsApi.getUnreadCount).toHaveBeenCalled();
    });

    it('should fetch notifications', async () => {
        const mockNotifs = [
            { notificationId: 1, message: 'Test 1', isRead: false },
            { notificationId: 2, message: 'Test 2', isRead: true }
        ];

        notificationsApi.getNotifications.mockResolvedValue({
            data: { success: true, data: { notifications: mockNotifs, unreadCount: 1 } }
        });
        
        // Mock getUnreadCount for mount
        notificationsApi.getUnreadCount.mockResolvedValue({
            data: { success: true, data: { unreadCount: 1 } }
        });

        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>
        );

        await act(async () => {
            screen.getByText('Fetch').click();
        });

        await waitFor(() => {
            expect(screen.getByTestId('notification-count')).toHaveTextContent('2');
        });
        
        expect(screen.getByText('Test 1 - Unread')).toBeInTheDocument();
        expect(screen.getByText('Test 2 - Read')).toBeInTheDocument();
    });

    it('should mark single notification as read optimistically', async () => {
        const mockNotifs = [{ notificationId: 1, message: 'Test 1', isRead: false }];
        
        // Setup initial state
        notificationsApi.getUnreadCount.mockResolvedValue({ data: { success: true, data: { unreadCount: 1 } } });
        notificationsApi.getNotifications.mockResolvedValue({ data: { success: true, data: { notifications: mockNotifs, unreadCount: 1 } } });
        notificationsApi.markAsRead.mockResolvedValue({ data: { success: true } });

        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>
        );

        // Load notifications first
        await act(async () => {
            screen.getByText('Fetch').click();
        });

        // Click mark as read
        await act(async () => {
            screen.getByText('Mark Read 1').click();
        });

        // Verify optimistic update
        await waitFor(() => {
            expect(screen.getByText('Test 1 - Read')).toBeInTheDocument(); // Was Unread
            expect(screen.getByTestId('unread-count')).toHaveTextContent('0'); // Decreased
        });
        
        expect(notificationsApi.markAsRead).toHaveBeenCalledWith(1);
    });

    it('should mark all as read optimistically', async () => {
        const mockNotifs = [{ notificationId: 1, message: 'Test 1', isRead: false }];
        
        notificationsApi.getUnreadCount.mockResolvedValue({ data: { success: true, data: { unreadCount: 1 } } });
        notificationsApi.getNotifications.mockResolvedValue({ data: { success: true, data: { notifications: mockNotifs, unreadCount: 1 } } });
        notificationsApi.markAllAsRead.mockResolvedValue({ data: { success: true } });

        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>
        );

        await act(async () => {
            screen.getByText('Fetch').click();
        });

        await act(async () => {
            screen.getByText('Mark All Read').click();
        });

        await waitFor(() => {
             expect(screen.getByText('Test 1 - Read')).toBeInTheDocument();
             expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
        });
    });
});
