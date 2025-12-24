import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { bookingsApi } from '../api/bookings';
import { useAuth } from './AuthContext';

const BookingContext = createContext();

export const useBooking = () => {
    return useContext(BookingContext);
};

const STALE_TIME_MS = 30000; // 30 seconds

export const BookingProvider = ({ children }) => {
    const authState = useAuth();
    // Safety check for Auth Context
    const isAuthenticated = authState ? authState.isAuthenticated : false;

    const [bookings, setBookings] = useState({ upcoming: [], past: [], cancelled: [], statistics: {} });
    const [loading, setLoading] = useState(false);
    const [lastFetchTime, setLastFetchTime] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const fetchBookings = useCallback(async (force = false) => {
        if (!isAuthenticated) return;
        
        // Check if data is stale
        const now = Date.now();
        if (!force && lastFetchTime && (now - lastFetchTime) < STALE_TIME_MS) {
            if (!isInitialized) setIsInitialized(true);
            return;
        }

        setLoading(true);
        try {
            const response = await bookingsApi.getUserBookings({});
            if (response.data.success) {
                setBookings(response.data.data);
                setLastFetchTime(Date.now());
            }
        } catch (err) {
            console.error("Failed to fetch bookings context:", err);
        } finally {
            setLoading(false);
            setIsInitialized(true);
        }
    }, [isAuthenticated, lastFetchTime, isInitialized]);

    // Fetch on mount if authenticated and no data
    useEffect(() => {
        if (isAuthenticated && !lastFetchTime) {
            fetchBookings();
        }
    }, [isAuthenticated, lastFetchTime, fetchBookings]);

    // Reset when user logs out
    useEffect(() => {
        if (!isAuthenticated) {
            setBookings({ upcoming: [], past: [], cancelled: [], statistics: {} });
            setLastFetchTime(null);
            setIsInitialized(false);
        }
    }, [isAuthenticated]);

    const refreshBookings = useCallback(() => {
        fetchBookings(true);
    }, [fetchBookings]);

    const cancelBooking = useCallback(async (id, reason) => {
        await bookingsApi.cancel(id, reason);
        // Refresh after cancel
        refreshBookings();
    }, [refreshBookings]);

    const value = useMemo(() => ({
        bookings,
        loading,
        isInitialized,
        lastFetchTime,
        fetchBookings,
        refreshBookings,
        cancelBooking
    }), [bookings, loading, isInitialized, lastFetchTime, fetchBookings, refreshBookings, cancelBooking]);

    return (
        <BookingContext.Provider value={value}>
            {children}
        </BookingContext.Provider>
    );
};
