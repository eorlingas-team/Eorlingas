import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { spacesApi } from '../api/spaces';

const SpacesContext = createContext();

export const useSpaces = () => {
    const context = useContext(SpacesContext);
    if (!context) {
        throw new Error('useSpaces must be used within a SpacesProvider');
    }
    return context;
};

export const SpacesProvider = ({ children }) => {
    // Data State
    const [allSpaces, setAllSpaces] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 12;

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        campus: 'All',
        building: 'All',
        capacity: 'All',
        type: 'All',
        available: false,
        noiseLevel: 'All'
    });

    const [meta, setMeta] = useState({ campuses: [], buildings: [], roomTypes: [], noiseLevels: [] });
    const [isInitialized, setIsInitialized] = useState(false);

    const searchTimeoutRef = useRef(null);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setCurrentPage(1);
        }, 500);
    }, [searchTerm]);

    // Fetch metadata once on mount
    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const res = await spacesApi.getFilterOptions();
                if (res.data.success) {
                    setMeta(res.data.data);
                }
            } catch (err) {
                console.error("Failed to fetch filter metadata:", err);
            }
        };
        fetchMeta();
    }, []);

    // Fetch all spaces once on mount
    useEffect(() => {
        const fetchAllSpaces = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await spacesApi.getAll({
                    limit: 1000,
                    page: 1
                });

                if (response.data.success) {
                    setAllSpaces(response.data.data.spaces);
                }
            } catch (err) {
                console.error("API Error:", err);
                setError("Failed to load spaces.");
                setAllSpaces([]);
            } finally {
                setLoading(false);
                setIsInitialized(true);
            }
        };

        if (!isInitialized) {
            fetchAllSpaces();
        }
    }, [isInitialized]);

    // Client-side filtering
    const filteredSpaces = useMemo(() => {
        let result = [...allSpaces];

        // Search filter
        if (debouncedSearchTerm) {
            const searchLower = debouncedSearchTerm.toLowerCase();
            result = result.filter(space => 
                space.spaceName?.toLowerCase().includes(searchLower) ||
                space.building?.buildingName?.toLowerCase().includes(searchLower) ||
                space.building?.campus?.campusName?.toLowerCase().includes(searchLower) ||
                space.roomType?.toLowerCase().includes(searchLower)
            );
        }

        // Campus filter
        if (filters.campus !== 'All') {
            result = result.filter(space => space.building?.campus?.campusName === filters.campus);
        }

        // Building filter
        if (filters.building !== 'All') {
            result = result.filter(space => space.building?.buildingName === filters.building);
        }

        // Room type filter
        if (filters.type !== 'All') {
            result = result.filter(space => space.roomType === filters.type);
        }

        // Noise level filter
        if (filters.noiseLevel !== 'All') {
            result = result.filter(space => space.noiseLevel === filters.noiseLevel);
        }

        // Capacity filter
        if (Array.isArray(filters.capacity)) {
            const [min, max] = filters.capacity;
            result = result.filter(space => space.capacity >= min && space.capacity <= max);
        } else if (filters.capacity !== 'All') {
            result = result.filter(space => space.capacity >= filters.capacity);
        }

        // Available filter
        if (filters.available) {
            result = result.filter(space => space.status === 'Available');
        }

        return result;
    }, [allSpaces, debouncedSearchTerm, filters]);

    // Client-side pagination
    const paginatedSpaces = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filteredSpaces.slice(startIndex, endIndex);
    }, [filteredSpaces, currentPage]);

    const paginationInfo = useMemo(() => ({
        total: filteredSpaces.length,
        totalPages: Math.ceil(filteredSpaces.length / ITEMS_PER_PAGE),
        limit: ITEMS_PER_PAGE
    }), [filteredSpaces.length]);

    const updateFilters = useCallback((newFilters) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
        setCurrentPage(1);
    }, []);

    const updateSearchTerm = useCallback((term) => {
        setSearchTerm(term);
    }, []);

    const changePage = useCallback((page) => {
        if (page >= 1 && page <= paginationInfo.totalPages) {
            setCurrentPage(page);
        }
    }, [paginationInfo.totalPages]);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await spacesApi.getAll({
                limit: 1000,
                page: 1
            });

            if (response.data.success) {
                setAllSpaces(response.data.data.spaces);
            }
        } catch (err) {
            console.error("API Error:", err);
            setError("Failed to load spaces.");
        } finally {
            setLoading(false);
        }
    }, []);

    const value = useMemo(() => ({
        spaces: paginatedSpaces,
        allSpaces: filteredSpaces, // For map view - all filtered spaces
        loading,
        loadingAll: false,
        error,
        paginationInfo,
        currentPage,
        filters,
        searchTerm,
        meta,
        actions: {
            updateFilters,
            updateSearchTerm,
            changePage,
            refresh
        }
    }), [paginatedSpaces, filteredSpaces, loading, error, paginationInfo, currentPage, filters, searchTerm, meta, updateFilters, updateSearchTerm, changePage, refresh]);

    return (
        <SpacesContext.Provider value={value}>
            {children}
        </SpacesContext.Provider>
    );
};
