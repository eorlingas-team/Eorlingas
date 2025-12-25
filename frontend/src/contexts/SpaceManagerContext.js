import React, { createContext, useContext, useState, useCallback } from 'react';
import { spacesApi } from '../api/spaces';

const SpaceManagerContext = createContext();

export const useSpaceManager = () => {
    const context = useContext(SpaceManagerContext);
    if (!context) {
        throw new Error('useSpaceManager must be used within a SpaceManagerProvider');
    }
    return context;
};

export const SpaceManagerProvider = ({ children }) => {
    // Managed Spaces State
    const [spaces, setSpaces] = useState([]);
    const [spacesLoading, setSpacesLoading] = useState(false);
    const [spacesError, setSpacesError] = useState(null);
    const [spacesPagination, setSpacesPagination] = useState({
        total: 0,
        totalPages: 1,
        currentPage: 1,
        limit: 20
    });
    const [spacesLastFetched, setSpacesLastFetched] = useState(null);

    // Filters State
    const [filters, setFilters] = useState({
        status: 'All',
        campus: 'All',
        building: 'All',
        capacity: 'All',
        search: ''
    });

    // Metadata State
    const [meta, setMeta] = useState({
        campuses: [],
        buildings: [],
        roomTypes: [],
        noiseLevels: []
    });
    const [metaLoading, setMetaLoading] = useState(false);
    const [metaLastFetched, setMetaLastFetched] = useState(null);

    // Stats State (for dashboard)
    const [stats, setStats] = useState({
        totalSpaces: 0,
        available: 0,
        maintenance: 0,
        deleted: 0
    });

    // Fetch Metadata (with caching)
    const fetchMeta = useCallback(async (force = false) => {
        // Cache for 10 minutes
        const CACHE_DURATION = 10 * 60 * 1000;
        const now = Date.now();
        
        if (!force && metaLastFetched && (now - metaLastFetched < CACHE_DURATION)) {
            return; // Use cached data
        }

        try {
            setMetaLoading(true);
            const response = await spacesApi.getFilterOptions();
            
            if (response.data.success) {
                setMeta(response.data.data);
                setMetaLastFetched(now);
            }
        } catch (err) {
            console.error('Failed to fetch metadata:', err);
        } finally {
            setMetaLoading(false);
        }
    }, [metaLastFetched]);

    // Fetch Stats
    const fetchStats = useCallback(async () => {
        try {
            const response = await spacesApi.getStats();
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }, []);

    // Fetch Spaces
    const fetchSpaces = useCallback(async (isBackground = false, force = false) => {
        // Cache for 5 minutes
        const CACHE_DURATION = 5 * 60 * 1000;
        const now = Date.now();
        
        // Skip fetch if data exists and is fresh
        if (!force && spaces.length > 0 && spacesLastFetched && (now - spacesLastFetched < CACHE_DURATION)) {
            return; // Use cached data
        }

        try {
            if (!isBackground) {
                setSpacesLoading(true);
            }
            setSpacesError(null);

            // Fetch ALL spaces for client-side handling
            const params = {
                page: 1,
                limit: 1000, 
                includeDeleted: true
            };

            const response = await spacesApi.getAll(params);

            if (response.data.success) {
                let fetchedSpaces = response.data.data.spaces || [];
                
                setSpaces(fetchedSpaces);
                setSpacesLastFetched(now);
                
                setSpacesPagination({
                    total: fetchedSpaces.length,
                    totalPages: 1,
                    currentPage: 1,
                    limit: fetchedSpaces.length
                });
            }
        } catch (err) {
            console.error('Failed to fetch spaces:', err);
            setSpacesError('Failed to load spaces');
            setSpaces([]);
        } finally {
            setSpacesLoading(false);
        }
    }, [spaces.length, spacesLastFetched]);

    // Update filters
    const updateFilters = useCallback((newFilters) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
    }, []);
    
    // Create Space
    const createSpace = useCallback(async (spaceData) => {
        try {
            const response = await spacesApi.create(spaceData);
            
            if (response.data.success) {
                // Refresh spaces list and stats
                await Promise.all([
                    fetchSpaces(false, true),
                    fetchStats()
                ]);
                return { success: true, data: response.data.data };
            }
            return { success: false, error: response.data.error };
        } catch (err) {
            console.error('Failed to create space:', err);
            return { success: false, error: err.message };
        }
    }, [fetchSpaces, fetchStats]);

    // Update Space
    const updateSpace = useCallback(async (spaceId, spaceData) => {
        try {
            const response = await spacesApi.update(spaceId, spaceData);
            
            if (response.data.success) {
                // Force refresh to get the complete updated data from server
                await fetchSpaces(false, true);
                fetchStats(); // Refresh stats in case status changed
                return { success: true, data: response.data.data };
            }
            return { success: false, error: response.data.error };
        } catch (err) {
            console.error('Failed to update space:', err);
            return { success: false, error: err.message };
        }
    }, [fetchSpaces, fetchStats]);

    // Update Space Status
    const updateSpaceStatus = useCallback(async (spaceId, status) => {
        try {
            const response = await spacesApi.updateStatus(spaceId, status);
            
            if (response.data.success) {
                // Update local state optimistically
                setSpaces(prev => prev.map(space => 
                    space.spaceId === spaceId 
                        ? { ...space, status } 
                        : space
                ));
                
                // Recalculate stats by fetching fresh data
                fetchStats();
                                
                return { success: true, data: response.data.data };
            }
            return { success: false, error: response.data.error };
        } catch (err) {
            console.error('Failed to update space status:', err);
            return { success: false, error: err.message };
        }
    }, [fetchStats]);

    // Delete Space
    const deleteSpace = useCallback(async (spaceId) => {
        try {
            const response = await spacesApi.remove(spaceId);
            
            if (response.data.success) {
                // Refresh spaces list and stats
                await Promise.all([
                    fetchSpaces(false, true),
                    fetchStats()
                ]);
                return { success: true };
            }
            return { success: false, error: response.data.error };
        } catch (err) {
            console.error('Failed to delete space:', err);
            return { success: false, error: err.message };
        }
    }, [fetchSpaces, fetchStats]);

    // Get Space by ID
    const getSpaceById = useCallback(async (spaceId) => {
        try {
            // Check if space is in cache first
            const cachedSpace = spaces.find(s => s.spaceId === parseInt(spaceId));
            if (cachedSpace) {
                return { success: true, data: cachedSpace };
            }

            // Fetch from API
            const response = await spacesApi.getById(spaceId);
            
            if (response.data.success) {
                return { success: true, data: response.data.data.space };
            }
            return { success: false, error: response.data.error };
        } catch (err) {
            console.error('Failed to fetch space:', err);
            return { success: false, error: err.message };
        }
    }, [spaces]);



    const value = React.useMemo(() => ({
        // Spaces
        spaces,
        spacesLoading,
        spacesError,
        spacesPagination,
        filters,
        stats,
        
        // Metadata
        meta,
        metaLoading,
        
        // Actions
        actions: {
            fetchSpaces,
            fetchMeta,
            fetchStats,
            createSpace,
            updateSpace,
            updateSpaceStatus,
            deleteSpace,
            getSpaceById,
            updateFilters,
            changePage: (page) => {}, 
            refreshSpaces: () => fetchSpaces(),
            refreshMeta: () => { fetchMeta(true); fetchStats(); }
        }
    }), [
        spaces, spacesLoading, spacesError, spacesPagination, filters, stats,
        meta, metaLoading,
        fetchSpaces, fetchMeta, fetchStats, createSpace, updateSpace, updateSpaceStatus, deleteSpace, getSpaceById, updateFilters
    ]);

    return (
        <SpaceManagerContext.Provider value={value}>
            {children}
        </SpaceManagerContext.Provider>
    );
};
