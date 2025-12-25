import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { BookingProvider, useBooking } from '../BookingContext';
import { bookingsApi } from '../../api/bookings';

// Mock API
jest.mock('../../api/bookings', () => ({
    bookingsApi: {
        getUserBookings: jest.fn(),
        cancel: jest.fn()
    }
}));

// Mock AuthContext
jest.mock('../AuthContext', () => ({
    useAuth: () => ({ isAuthenticated: true })
}));

const TestComponent = () => {
    const { bookings, loading, refreshBookings, cancelBooking } = useBooking();
    return (
        <div>
            <div data-testid="loading">{loading ? 'Loading...' : 'Loaded'}</div>
            <div data-testid="upcoming-count">{bookings.upcoming?.length || 0}</div>
            <button onClick={refreshBookings}>Refresh</button>
            <button onClick={() => cancelBooking(1, 'Reason')}>Cancel 1</button>
        </div>
    );
};

describe('BookingContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch bookings on mount if authenticated', async () => {
        const mockData = {
            upcoming: [{ bookingId: 1, title: 'Study' }],
            past: [],
            cancelled: [],
            statistics: {}
        };

        bookingsApi.getUserBookings.mockResolvedValue({
            data: { success: true, data: mockData }
        });

        render(
            <BookingProvider>
                <TestComponent />
            </BookingProvider>
        );

        // Initial loading state might be true or false depending on how fast useEffect runs
         // Wait for loading to finish and data to populate
        await waitFor(() => {
             expect(screen.getByTestId('upcoming-count')).toHaveTextContent('1');
        });
        
        expect(bookingsApi.getUserBookings).toHaveBeenCalled();
    });

    it('should refresh bookings manually', async () => {
        bookingsApi.getUserBookings.mockResolvedValue({
            data: { success: true, data: { upcoming: [], past: [], cancelled: [], statistics: {} } }
        });

        render(
            <BookingProvider>
                <TestComponent />
            </BookingProvider>
        );

        await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('Loaded'));

        // Mock new data for refresh
        bookingsApi.getUserBookings.mockResolvedValueOnce({
            data: { success: true, data: { upcoming: [{ bookingId: 2 }], past: [], cancelled: [], statistics: {} } }
        });

        await act(async () => {
            screen.getByText('Refresh').click();
        });

        await waitFor(() => {
            expect(screen.getByTestId('upcoming-count')).toHaveTextContent('1');
        });
    });

    it('should handle cancellation and auto-refresh', async () => {
        bookingsApi.getUserBookings.mockResolvedValue({
            data: { success: true, data: { upcoming: [{ bookingId: 1 }], past: [], cancelled: [], statistics: {} } }
        });
        bookingsApi.cancel.mockResolvedValue({ data: { success: true } });

        render(
            <BookingProvider>
                <TestComponent />
            </BookingProvider>
        );

        await waitFor(() => expect(screen.getByTestId('upcoming-count')).toHaveTextContent('1'));

        // When cancel happens, it should call refresh
        // We mock the response for the refresh call to show empty upcoming
        bookingsApi.getUserBookings.mockResolvedValueOnce({
            data: { success: true, data: { upcoming: [], past: [], cancelled: [], statistics: {} } }
        });

        await act(async () => {
            screen.getByText('Cancel 1').click();
        });

        expect(bookingsApi.cancel).toHaveBeenCalledWith(1, 'Reason');
        
        // Should have refreshed
        await waitFor(() => {
             expect(screen.getByTestId('upcoming-count')).toHaveTextContent('0');
        });
    });
});
