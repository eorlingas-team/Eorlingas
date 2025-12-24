import React, { useState, useMemo } from 'react';
import styles from '../styles/DataTable.module.css';
import LoadingSpinner from './LoadingSpinner';

/**
 * DataTable Component
 * 
 * A reusable table component with integrated search and filter functionality
 * Now supports Client-Side Pagination and Sorting by default.
 * 
 * @param {Object} props
 * @param {Array} props.columns - Array of column definitions: [{ key, label, width, align, render, sortAccessor }]
 * @param {Array} props.data - Array of data objects to display (FULL dataset for client-side mode)
 * @param {boolean} props.loading - Loading state
 * @param {string} props.searchTerm - Current search term
 * @param {Function} props.onSearchChange - Search change handler
 * @param {string} props.searchPlaceholder - Placeholder for search input
 * @param {Array} props.filters - Array of filter definitions
 * @param {Function} props.onClearFilters - Clear filters handler
 * @param {Function} props.onFilterChange - Filter change handler
 * @param {Object} props.pagination - Legacy Server-side pagination config (optional if clientSide=true)
 * @param {string} props.emptyMessage - Message to show when no data
 * @param {string} props.containerClass - Additional CSS class
 * @param {boolean} props.clientSide - Enable client-side pagination/sorting (Default: true)
 * @param {number} props.itemsPerPage - Items per page for client-side pagination (Default: 10)
 */
const DataTable = ({
    columns = [],
    data = [],
    loading = false,
    searchTerm = '',
    onSearchChange,
    searchPlaceholder = 'Search...',
    filters = [],
    onClearFilters,
    onFilterChange,
    pagination: serverPagination,
    emptyMessage = 'No data found',
    containerClass = '',
    clientSide = true,
    itemsPerPage = 10,
    rowsPerPageOptions = [10, 20, 50, 100],
    activeFilters = {}
}) => {
    // Local filter state
    const [localFilters, setLocalFilters] = useState(activeFilters);

    // Sync local filters
    React.useEffect(() => {
        setLocalFilters(activeFilters);
    }, [activeFilters]);

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Internal Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [currentLimit, setCurrentLimit] = useState(itemsPerPage);

    // Reset page when search or filters change to avoid empty pages
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, localFilters, currentLimit, data.length]);

    // Data is filtered from parent if clientSide is used for rendering
    const filteredData = data;

    // Handle local filter change
    const handleLocalFilterChange = (filterKey, value) => {
        const newFilters = {
            ...localFilters,
            [filterKey]: value
        };
        setLocalFilters(newFilters);
        if (onFilterChange) {
            onFilterChange(newFilters);
        }
    };

    // Clear all filters
    const handleClearAllFilters = () => {
        setLocalFilters({});
        if (onClearFilters) {
            onClearFilters();
        }
    };

    // Handle Column Sort
    const handleSort = (column) => {
        let direction = 'asc';
        if (sortConfig.key === column.key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key: column.key, direction });
    };

    // Sort Data
    const sortedData = useMemo(() => {
        if (!sortConfig.key) return filteredData;

        const sorted = [...filteredData];
        const column = columns.find(c => c.key === sortConfig.key);

        if (!column) return sorted;

        sorted.sort((a, b) => {
            let valA = a[column.key];
            let valB = b[column.key];

            // Use custom sort accessor
            if (column.sortAccessor) {
                valA = column.sortAccessor(a);
                valB = column.sortAccessor(b);
            }

            // Handle null/undefined/equality
            if (valA === valB) return 0;
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            // Sort based on type
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }

            // Date sorting cleanup
            // Only attempt date sorting if the value looks like a date string and isn't a plain number string
            if (typeof valA === 'string' && typeof valB === 'string' && valA.length > 5 && valB.length > 5) {
                const dateA = new Date(valA);
                const dateB = new Date(valB);
                if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime()) &&
                    isNaN(Number(valA)) && isNaN(Number(valB))) {
                    return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
                }
            }

            // Default String sort with locale support (crucial for Turkish characters)
            return sortConfig.direction === 'asc'
                ? String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' })
                : String(valB).localeCompare(String(valA), undefined, { numeric: true, sensitivity: 'base' });
        });

        return sorted;
    }, [filteredData, sortConfig, columns]);

    // Handle Limit Change
    const handleLimitChange = (e) => {
        const newLimit = parseInt(e.target.value);
        setCurrentLimit(newLimit);
        setCurrentPage(1); // Reset to first page
        if (!clientSide && serverPagination?.onRowsPerPageChange) {
            serverPagination.onRowsPerPageChange(newLimit);
        }
    };

    // Pagination Logic
    const paginationInfo = useMemo(() => {
        if (clientSide) {
            const total = sortedData.length;
            const totalPages = Math.ceil(total / currentLimit) || 1;
            const start = (currentPage - 1) * currentLimit;
            const end = start + currentLimit;
            const currentData = sortedData.slice(start, end);

            return {
                data: currentData,
                total,
                totalPages,
                current: currentPage,
                showing: {
                    start: total > 0 ? start + 1 : 0,
                    end: Math.min(end, total)
                },
                onPageChange: setCurrentPage
            };
        } else {
            return {
                data: sortedData,
                total: serverPagination?.total || 0,
                totalPages: serverPagination?.totalPages || 1,
                current: serverPagination?.current || 1,
                showing: serverPagination?.showing || { start: 0, end: 0 },
                onPageChange: serverPagination?.onPageChange
            };
        }
    }, [clientSide, sortedData, currentPage, currentLimit, serverPagination]);

    // Check if there are any active filters or search term
    const hasActiveFilters = (searchTerm && searchTerm.trim() !== '') ||
        Object.values(localFilters).some(val => val && val !== 'All');

    return (
        <>
            {/* Filter Panel */}
            <div className={`${styles['filter-panel']}`}>
                <div className={`${styles['filter-row']}`}>
                    {/* Search Wrapper */}
                    <div className={`${styles['search-wrapper']}`}>
                        <label className={`${styles['filter-label']}`}>Search</label>
                        <div className={`${styles['search-input-container']}`}>
                            <span className={`material-symbols-outlined ${styles['search-icon']}`}>search</span>
                            <input
                                type="text"
                                className={`${styles['search-input']}`}
                                placeholder={searchPlaceholder}
                                value={searchTerm}
                                onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Dynamic Filters */}
                    {filters.map((filter, index) => (
                        <div key={index} className={`${styles['filter-select-wrapper']}`}>
                            {filter.type === 'select' ? (
                                <>
                                    {filter.title && (
                                        <label className={`${styles['filter-label']}`}>{filter.title}</label>
                                    )}
                                    <select
                                        className={`${styles['filter-dropdown']}`}
                                        value={localFilters[filter.filterKey] || 'All'}
                                        onChange={(e) => handleLocalFilterChange(filter.filterKey, e.target.value)}
                                    >
                                        {filter.options.map((option, optIndex) => (
                                            <option key={optIndex} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </>
                            ) : filter.type === 'date' ? (
                                <>
                                    {filter.title && (
                                        <label className={`${styles['filter-label']}`}>{filter.title}</label>
                                    )}
                                    <input
                                        type="date"
                                        className={`${styles['filter-dropdown']} ${styles['filter-date-input']}`}
                                        value={localFilters[filter.filterKey] || ''}
                                        onChange={(e) => handleLocalFilterChange(filter.filterKey, e.target.value)}
                                    />
                                </>
                            ) : filter.type === 'number' ? (
                                <>
                                    {filter.title && (
                                        <label className={`${styles['filter-label']}`}>{filter.title}</label>
                                    )}
                                    <input
                                        type="number"
                                        className={`${styles['filter-dropdown']} ${styles['filter-number-input']}`}
                                        value={localFilters[filter.filterKey] || ''}
                                        onChange={(e) => handleLocalFilterChange(filter.filterKey, e.target.value)}
                                        placeholder={filter.placeholder || ''}
                                        min="0"
                                    />
                                </>
                            ) : (
                                <button className={`${styles['filter-dropdown']}`} onClick={filter.onClick}>
                                    {filter.label}
                                    <span className={`material-symbols-outlined`}>arrow_drop_down</span>
                                </button>
                            )}
                        </div>
                    ))}

                    {/* Clear Filters Button */}
                    {onClearFilters && (
                        <button
                            className={`${styles['clear-btn']} ${!hasActiveFilters ? styles.inactive : ''}`}
                            onClick={hasActiveFilters ? handleClearAllFilters : undefined}
                            title={hasActiveFilters ? "Clear all filters" : "No active filters"}
                            disabled={!hasActiveFilters}
                        >
                            <span className={`material-symbols-outlined`}>filter_alt_off</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Table Container */}
            <div className={`${styles['table-container']}`}>
                <div className={`${styles['table-scroll-wrapper']}`}>
                    <table className={`${styles['data-table']} ${containerClass}`}>
                        <thead>
                            <tr>
                                {columns.map((column, index) => {
                                    const isSortable = column.sortable !== false;
                                    return (
                                        <th
                                            key={index}
                                            onClick={() => isSortable && handleSort(column)}
                                            style={{
                                                width: column.width,
                                                textAlign: column.align || 'left',
                                                cursor: isSortable ? 'pointer' : 'default',
                                                userSelect: 'none'
                                            }}
                                            className={isSortable && sortConfig.key === column.key ? styles['active-sort'] : ''}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: column.align === 'right' ? 'flex-end' : 'flex-start' }}>
                                                {column.label}
                                                {isSortable && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', height: '20px', justifyContent: 'center' }}>
                                                        {sortConfig.key === column.key ? (
                                                            <span className={`material-symbols-outlined`} style={{ fontSize: '16px' }}>
                                                                {sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                                            </span>
                                                        ) : (
                                                            <span className={`material-symbols-outlined ${styles['sort-placeholder']}`} style={{ fontSize: '16px', opacity: 0.3 }}>
                                                                unfold_more
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={columns.length} style={{ padding: '40px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <LoadingSpinner size="md" text="Loading data..." />
                                        </div>
                                    </td>
                                </tr>
                            ) : paginationInfo.data.length > 0 ? (
                                paginationInfo.data.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                        {columns.map((column, colIndex) => (
                                            <td
                                                key={colIndex}
                                                style={{
                                                    textAlign: column.align || 'left',
                                                    color: column.color || 'inherit'
                                                }}
                                            >
                                                {column.render ? column.render(row, rowIndex) : row[column.key]}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                                        {emptyMessage}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            {paginationInfo.total > 0 && (
                <div className={`${styles['pagination-bar']}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span className={`${styles['page-info']}`}>
                            Showing <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                                {paginationInfo.showing.start}-{paginationInfo.showing.end}
                            </span> of <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                                {paginationInfo.total}
                            </span>
                        </span>

                        {/* Rows Per Page Selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <span>Rows:</span>
                            <select
                                className={styles['rows-select']}
                                value={currentLimit}
                                onChange={handleLimitChange}
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-main)',
                                    backgroundColor: 'var(--bg-card)',
                                    color: 'var(--text-main)',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {rowsPerPageOptions.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Page Nav */}
                    {paginationInfo.totalPages > 1 && (
                        <div className={`${styles['pagination-controls']}`}>
                            <button
                                className={`${styles['page-nav-btn']}`}
                                disabled={paginationInfo.current === 1}
                                onClick={() => paginationInfo.onPageChange(paginationInfo.current - 1)}
                            >
                                <span className={`material-symbols-outlined`}>chevron_left</span>
                            </button>

                            <div style={{ display: 'flex', gap: '4px' }}>
                                {/* Simple pagination: show current, prev, next, first, last layout */}
                                {Array.from({ length: Math.min(5, paginationInfo.totalPages) }, (_, i) => {
                                    let pageNum = paginationInfo.current - 2 + i;
                                    if (paginationInfo.current < 3) pageNum = i + 1;
                                    if (paginationInfo.current > paginationInfo.totalPages - 2) pageNum = paginationInfo.totalPages - 4 + i;

                                    if (pageNum < 1) pageNum = i + 1;
                                    if (pageNum > paginationInfo.totalPages) return null;

                                    return (
                                        <button
                                            key={pageNum}
                                            className={`${styles['page-nav-btn']} ${pageNum === paginationInfo.current ? styles.active : ''}`}
                                            onClick={() => paginationInfo.onPageChange(pageNum)}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                className={`${styles['page-nav-btn']}`}
                                disabled={paginationInfo.current === paginationInfo.totalPages}
                                onClick={() => paginationInfo.onPageChange(paginationInfo.current + 1)}
                            >
                                <span className={`material-symbols-outlined`}>chevron_right</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default DataTable;
