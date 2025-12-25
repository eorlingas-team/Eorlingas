import React, { createContext, useContext, useState, useCallback } from 'react';
import { adminApi } from '../api/admin';

const AdminContext = createContext();

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (!context) {
        throw new Error('useAdmin must be used within an AdminProvider');
    }
    return context;
};

export const AdminProvider = ({ children }) => {
    // System Stats State
    const [stats, setStats] = useState({
        activeUsers: 0,
        totalSpaces: 0,
        totalBookings: 0,
        activeBookings: 0,
        cancellationRate: 0,
        availableSpaces: 0,
        breakdown: { completed: 0, upcoming: 0, cancelled: 0, total: 0 },
        peakBookingHours: [],
        mostBookedSpaces: []
    });
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState(null);
    const [statsLastFetched, setStatsLastFetched] = useState(null);
    const [lastFetchParams, setLastFetchParams] = useState(null);

    // Users State
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState(null);
    const [usersPagination, setUsersPagination] = useState({
        total: 0,
        totalPages: 1,
        currentPage: 1,
        limit: 20
    });
    const [usersFilters, setUsersFilters] = useState({
        role: 'All',
        status: 'All',
        search: ''
    });
    const [usersLastFetched, setUsersLastFetched] = useState(null);

    // Audit Logs State
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditLogsLoading, setAuditLogsLoading] = useState(false);
    const [auditLogsError, setAuditLogsError] = useState(null);
    const [auditLogsPagination, setAuditLogsPagination] = useState({
        total: 0,
        totalPages: 1,
        currentPage: 1,
        limit: 20
    });
    const [auditLogsFilters, setAuditLogsFilters] = useState({
        actionType: 'All',
        targetEntity: 'All',
        result: 'All',
        startDate: null,
        endDate: null,
        search: ''
    });
    const [auditLogsLastFetched, setAuditLogsLastFetched] = useState(null);

    // Fetch System Stats
    const fetchStats = useCallback(async (params = {}, force = false) => {
        // Cache for 5 minutes if params haven't changed
        const CACHE_DURATION = 5 * 60 * 1000;
        const now = Date.now();
        const paramsChanged = JSON.stringify(params) !== JSON.stringify(lastFetchParams);
        
        if (!force && !paramsChanged && statsLastFetched && (now - statsLastFetched < CACHE_DURATION)) {
            return; // Use cached data
        }

        try {
            setStatsLoading(true);
            setStatsError(null);
            
            const response = await adminApi.getSystemStats(params);
            
            if (response.data.success) {
                setStats(response.data.data.statistics || {});
                setStatsLastFetched(now);
                setLastFetchParams(params);
            }
        } catch (err) {
            console.error('Failed to fetch system stats:', err);
            setStatsError('Failed to load system statistics');
        } finally {
            setStatsLoading(false);
        }
    }, [statsLastFetched, lastFetchParams]);

    // Fetch Users
    const fetchUsers = useCallback(async (isBackground = false, force = false, filters = {}) => {
        const CACHE_DURATION = 5 * 60 * 1000;
        const now = Date.now();
        const hasFilters = Object.values(filters).some(val => val !== 'All' && val !== '' && val !== null);
        
        if (!hasFilters && !force && users.length > 0 && usersLastFetched && (now - usersLastFetched < CACHE_DURATION)) {
            return;
        }

        try {
            if (!isBackground) {
                setUsersLoading(true);
            }
            setUsersError(null);

            const params = {
                page: 1,
                limit: 1000,
                ...filters
            };

            const response = await adminApi.getAllUsers(params);

            if (response.data.success) {
                const fetchedUsers = response.data.data.users || [];
                setUsers(fetchedUsers);
                if (!hasFilters) {
                    setUsersLastFetched(now);
                }
                setUsersPagination({
                    total: fetchedUsers.length,
                    totalPages: 1,
                    currentPage: 1,
                    limit: fetchedUsers.length
                });
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
            setUsersError('Failed to load users');
            setUsers([]);
        } finally {
            setUsersLoading(false);
        }
    }, [users.length, usersLastFetched]);

    // Create User
    const createUser = useCallback(async (userData) => {
        try {
            const response = await adminApi.createUser(userData);
            if (response.data.success) {
                // Refresh users list
                await fetchUsers(false, true);
                fetchStats(true);
                return { success: true, data: response.data.data };
            }
            return { success: false, error: response.data.error };
        } catch (err) {
            console.error('Failed to create user:', err);
             const errorMessage = err.response?.data?.error?.message || err.message;
            return { success: false, error: errorMessage };
        }
    }, [fetchUsers, fetchStats]);

    // Update User
    const updateUser = useCallback(async (userId, action, params) => {
        try {
            const response = await adminApi.updateUser(userId, action, params);
            
            if (response.data.success) {
                // Refresh users list
                await fetchUsers(false, true);
                return { success: true, data: response.data.data };
            }
            return { success: false, error: response.data.error };
        } catch (err) {
            console.error('Failed to update user:', err);
            return { success: false, error: err.message };
        }
    }, [fetchUsers]);

    // Delete User
    const deleteUser = useCallback(async (userId) => {
        try {
            await adminApi.deleteUser(userId);
            // Refresh users list and stats
            await fetchUsers(false, true);
            fetchStats(true);
            return { success: true };
        } catch (err) {
            console.error('Failed to delete user:', err);
            // Extract error message from API response if available
            const errorMessage = err.response?.data?.error?.message || err.message;
            return { success: false, error: errorMessage };
        }
    }, [fetchUsers, fetchStats]);

    // Fetch Audit Logs
    const fetchAuditLogs = useCallback(async (isBackground = false, force = false, params = {}) => {
        try {
            if (!isBackground) {
                setAuditLogsLoading(true);
            }
            setAuditLogsError(null);

            const backendParams = {
              page: 1,
              limit: 10000,
              actionType: auditLogsFilters.actionType !== 'All' ? auditLogsFilters.actionType : undefined,
              targetEntityType: auditLogsFilters.targetEntity !== 'All' ? auditLogsFilters.targetEntity : undefined,
              result: auditLogsFilters.result !== 'All' ? auditLogsFilters.result : undefined,
              dateFrom: auditLogsFilters.startDate || undefined,
              dateTo: auditLogsFilters.endDate || undefined,
            };

            const response = await adminApi.getAuditLogs(backendParams);

            if (response.data.success) {
                const fetchedLogs = response.data.data.logs || [];
                setAuditLogs(fetchedLogs);
                setAuditLogsPagination({
                    total: fetchedLogs.length,
                    totalPages: 1,
                    currentPage: 1,
                    limit: fetchedLogs.length
                });
            }
        } catch (err) {
            console.error('Failed to fetch audit logs:', err);
            setAuditLogsError('Failed to load audit logs');
            setAuditLogs([]);
        } finally {
            setAuditLogsLoading(false);
        }
    }, [auditLogsFilters]);

    // Export Audit Logs
    const exportAuditLogs = useCallback(async (format = 'csv', filters = auditLogsFilters) => {
        try {
            const params = {
                format,
                actionType: filters.actionType !== 'All' ? filters.actionType : undefined,
                targetEntityType: filters.targetEntity !== 'All' ? filters.targetEntity : undefined,
                startDate: filters.startDate || undefined,
                endDate: filters.endDate || undefined
            };

            const response = await adminApi.exportAuditLogs(params);
            return { success: true, data: response.data };
        } catch (err) {
            console.error('Failed to export audit logs:', err);
            return { success: false, error: err.message };
        }
    }, [auditLogsFilters]);

    // Update filters 
    const updateUsersFilters = useCallback((newFilters) => {
        setUsersFilters(prev => ({ ...prev, ...newFilters }));
    }, []);

    const updateAuditLogsFilters = useCallback((newFilters) => {
        setAuditLogsFilters(prev => ({ ...prev, ...newFilters }));
    }, []);

    const value = React.useMemo(() => ({
        // Stats
        stats,
        statsLoading,
        statsError,
        
        // Users
        users,
        usersLoading,
        usersError,
        usersPagination,
        usersFilters,
        
        // Audit Logs
        auditLogs,
        auditLogsLoading,
        auditLogsError,
        auditLogsPagination,
        auditLogsFilters,
        
        // Actions
        actions: {
            fetchStats,
            fetchUsers,
            createUser,
            updateUser,
            deleteUser,
            fetchAuditLogs,
            exportAuditLogs,
            updateUsersFilters,
            updateAuditLogsFilters,
            changeUsersPage: (page) => {},
            changeAuditLogsPage: (page) => {},
            refreshStats: () => fetchStats(true),
            refreshUsers: () => fetchUsers(),
            refreshAuditLogs: () => fetchAuditLogs()
        }
    }), [
        stats, statsLoading, statsError,
        users, usersLoading, usersError, usersPagination, usersFilters,
        auditLogs, auditLogsLoading, auditLogsError, auditLogsPagination, auditLogsFilters,
        fetchStats, fetchUsers, createUser, updateUser, deleteUser, fetchAuditLogs, exportAuditLogs, updateUsersFilters, updateAuditLogsFilters
    ]);

    return (
        <AdminContext.Provider value={value}>
            {children}
        </AdminContext.Provider>
    );
};
