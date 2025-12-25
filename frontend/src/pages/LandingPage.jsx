import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpaces } from '../contexts/SpacesContext';
import styles from '../styles/LandingPage.module.css';
import Header from '../components/Header';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import LoadingSpinner from '../components/LoadingSpinner';
import BuildingsMap from '../components/Map/BuildingsMap';

const LandingPage = () => {
  const navigate = useNavigate();

  const {
    spaces,
    allSpaces,
    loading,
    paginationInfo,
    currentPage,
    filters,
    searchTerm,
    meta,
    globalMaxCapacity,
    actions
  } = useSpaces();

  const handleApplyFilters = () => {
    actions.refresh();
  };

  const handlePageChange = (newPage) => {
    actions.changePage(newPage);
  };

  const handleFilterChange = (e) => {
    const { id, value } = e.target;
    // Map HTML IDs to state keys
    const keyMap = {
      'room-type-filter': 'type',
      'noise-level-filter': 'noiseLevel'
    };
    actions.updateFilters({ [keyMap[id]]: value });
  };

  const handleCapacityChange = (e) => {
    actions.updateFilters({ capacity: parseInt(e.target.value) || 'All' });
  };

  const handleAvailableToggle = () => {
    actions.updateFilters({ available: !filters.available });
  };

  const handleSearchChange = (e) => {
    actions.updateSearchTerm(e.target.value);
  };

  // Local state for slider to allow smooth sliding without constant API calls
  const [localCapacity, setLocalCapacity] = useState([0, globalMaxCapacity]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list');

  // Sync local slider with global filter state (e.g. on reset)
  useEffect(() => {
    if (Array.isArray(filters.capacity)) {
      setLocalCapacity(filters.capacity);
    } else if (filters.capacity === 'All') {
      setLocalCapacity([0, globalMaxCapacity]);
    } else if (typeof filters.capacity === 'number') {
      setLocalCapacity([filters.capacity, globalMaxCapacity]);
    }
  }, [filters.capacity, globalMaxCapacity]);

  // Navigation
  const handleViewDetails = (space) => {
    navigate(`/spaces/${space.spaceId}`, {
      state: { spaceData: space }
    });
  };

  return (
    <div className={`${styles['landing-container']} ${styles['dark']}`}>
      {/* Header */}
      <Header />

      <main className={`${styles['landing-main']}`}>
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className={`${styles['sidebar-overlay']}`}
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar Filters */}
        <aside className={`${styles['filter-sidebar']} ${isSidebarOpen ? styles.open : ''}`}>
          <div className={`${styles['filter-header']}`}>
            <div>
              <h2>Filters</h2>
              <p>Refine your search.</p>
            </div>
            <button
              className={`${styles['close-sidebar-btn']}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <span className={`material-symbols-outlined`}>close</span>
            </button>
          </div>

          <div className={`${styles['filter-section']}`}>
            <div className={`${styles['search-input-wrapper']}`} style={{ marginBottom: '24px' }}>
              <input
                type="text"
                placeholder="Search..."
                className={`${styles['search-input']}`}
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <span className={`material-symbols-outlined ${styles['search-icon']}`}>search</span>
            </div>

            <div className={`${styles['filter-group']}`}>
              <h3 className={`${styles['filter-title']}`}>Campus</h3>
              <select
                className={`${styles['filter-select']}`}
                value={filters.campus}
                onChange={(e) => actions.updateFilters({ campus: e.target.value })}
              >
                <option value="All">All Campuses</option>
                {meta.campuses.map(c => <option key={c.campus_id} value={c.campus_name}>{c.campus_name}</option>)}
              </select>
            </div>

            <div className={`${styles['filter-group']}`}>
              <h3 className={`${styles['filter-title']}`}>Building</h3>
              <select
                className={`${styles['filter-select']}`}
                value={filters.building}
                onChange={(e) => actions.updateFilters({ building: e.target.value })}
              >
                <option value="All">All Buildings</option>
                {meta.buildings
                  .filter(b => filters.campus === 'All' || !b.campus_id || (meta.campuses.find(c => c.campus_name === filters.campus)?.campus_id === b.campus_id))
                  .map(b => (
                    <option key={b.building_id} value={b.building_name}>{b.building_name}</option>
                  ))}
              </select>
            </div>

            <div className={`${styles['filter-group']}`}>
              <h3 className={`${styles['filter-title']}`}>Room Type</h3>
              <select
                id="room-type-filter"
                className={`${styles['filter-select']}`}
                value={filters.type}
                onChange={handleFilterChange}
              >
                <option value="All">All Types</option>
                {meta.roomTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>

            <div className={`${styles['filter-group']}`}>
              <h3 className={`${styles['filter-title']}`}>Noise Level</h3>
              <select
                id="noise-level-filter"
                className={`${styles['filter-select']}`}
                value={filters.noiseLevel}
                onChange={handleFilterChange}
              >
                <option value="All">All Levels</option>
                {meta.noiseLevels.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div className={`${styles['filter-group']}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 className={`${styles['filter-title']}`}>Capacity</h3>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {`${localCapacity[0]} - ${localCapacity[1]}`} People
                </span>
              </div>
              <div style={{ padding: '0 8px' }}>
                <Slider
                  range
                  min={0}
                  max={globalMaxCapacity}
                  step={5}
                  value={localCapacity}
                  onChange={(value) => setLocalCapacity(value)}
                  onChangeComplete={(value) => actions.updateFilters({ capacity: value })}
                  trackStyle={[{ backgroundColor: 'var(--primary-color)' }]}
                  handleStyle={[
                    { borderColor: 'var(--primary-color)', backgroundColor: 'white', opacity: 1, boxShadow: 'none' },
                    { borderColor: 'var(--primary-color)', backgroundColor: 'white', opacity: 1, boxShadow: 'none' }
                  ]}
                  railStyle={{ backgroundColor: 'var(--border-main)' }}
                />
              </div>
            </div>

            <div className={`${styles['filter-group']}`}>
              <h3 className={`${styles['filter-title']}`}>Available Now</h3>
              <div className={`${styles['toggle-wrapper']}`} style={{ marginTop: '8px' }}>
                <label className={`${styles['toggle-switch']}`}>
                  <input
                    type="checkbox"
                    checked={!!filters.available}
                    onChange={handleAvailableToggle}
                  />
                  <span className={`${styles['slider']}`}></span>
                </label>
              </div>
            </div>
          </div>

          <div className={`${styles['filter-actions']}`}>
            <button
              className={`${styles['btn-reset']}`}
              disabled={
                searchTerm === '' &&
                filters.campus === 'All' &&
                filters.building === 'All' &&
                filters.type === 'All' &&
                filters.noiseLevel === 'All' &&
                filters.available === false &&
                (filters.capacity === 'All' || (Array.isArray(filters.capacity) && filters.capacity[0] === 0 && filters.capacity[1] === globalMaxCapacity))
              }
              onClick={() => actions.updateFilters({
                campus: 'All', building: 'All', capacity: 'All', type: 'All', available: false, noiseLevel: 'All'
              })}
            >
              <span className={`material-symbols-outlined`} style={{ fontSize: '18px' }}>restart_alt</span>
              Reset Filters
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <div className={`${styles['content-area']}`}>
          <div className={`${styles['content-header']}`}>
            <h1>Study Space Details and Availability</h1>
            <p>Search, filter, and discover the perfect spot to study across all İTÜ campuses.</p>
          </div>

          <div className={`${styles['controls-bar']}`}>
            <button
              className={`${styles['mobile-filter-btn']}`}
              onClick={() => setIsSidebarOpen(true)}
            >
              <span className={`material-symbols-outlined`}>filter_list</span>
              Filters
            </button>

            {/* Loading Indicator for specific actions if needed, or global loader */}
            {loading && <div style={{ position: 'absolute', top: 5, right: 60 }}><LoadingSpinner size="sm" /></div>}

            {viewMode === 'list' && (
              <p className={`${styles['results-count']}`}>
                Showing <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  {spaces.length > 0 ? (currentPage - 1) * paginationInfo.limit + 1 : 0}-
                  {Math.min(currentPage * paginationInfo.limit, paginationInfo.total)}
                </span> of <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{paginationInfo.total}</span> results
              </p>
            )}
            {viewMode === 'map' && (
              <p className={`${styles['results-count']}`}>
                Showing <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{allSpaces.length}</span> spaces on map
              </p>
            )}
            <div className={`${styles['view-toggle']}`}>
              <button
                className={`${styles['view-btn']} ${viewMode === 'list' ? styles['active'] : ''}`}
                onClick={() => setViewMode('list')}
              >
                <span className={`material-symbols-outlined`} style={{ fontSize: '1.25rem' }}>list</span> List
              </button>
              <button
                className={`${styles['view-btn']} ${viewMode === 'map' ? styles['active'] : ''}`}
                onClick={() => setViewMode('map')}
              >
                <span className={`material-symbols-outlined`} style={{ fontSize: '1.25rem' }}>map</span> Map
              </button>
            </div>
          </div>

          {/* Content Area - Map or Grid */}
          {loading ? (
            <LoadingSpinner fullHeight text="Loading spaces..." />
          ) : (viewMode === 'map' ? allSpaces : spaces).length === 0 ? (
            <div className={`${styles['empty-state']}`} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '64px 20px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-main)',
              marginTop: '24px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '4rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                search_off
              </span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                No study spaces found
              </h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '400px' }}>
                We couldn't find any spaces matching your current filters. Try adjusting your search criteria or clearing filters.
              </p>
              <button
                className={`${styles['btn-reset']}`}
                style={{ marginTop: '24px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-main)' }}
                onClick={() => actions.updateFilters({
                  campus: 'All', building: 'All', capacity: 'All', type: 'All', available: false, noiseLevel: 'All'
                })}
              >
                Clear All Filters
              </button>
            </div>
          ) : viewMode === 'map' ? (
            <BuildingsMap spaces={allSpaces} />
          ) : (
            <div className={`${styles['spaces-grid']}`}>
              {spaces.map(space => (
                <div key={space.spaceId} className={`${styles['space-card']}`}>

                  {space.status === 'Available' ? (
                    <div className={`${styles['landing-status-indicator']} ${styles['available']}`} title="Available Now">
                      <div className={`${styles['landing-status-dot']}`}></div>
                    </div>
                  ) : space.status === 'Maintenance' ? (
                    <div className={`${styles['landing-status-indicator']} ${styles['maintenance']}`} title="Under Maintenance">
                      <div className={`${styles['landing-status-dot']}`}></div>
                    </div>
                  ) : (
                    <div className={`${styles['landing-status-indicator']} ${styles['booked']}`} title="Unavailable">
                      <div className={`${styles['landing-status-dot']}`}></div>
                    </div>
                  )}

                  <div className={`${styles['card-header']}`}>
                    <h3 className={`${styles['card-title']}`}>{space.spaceName}</h3>
                    <p className={`${styles['card-subtitle']}`}>{space.building?.buildingName}, {space.building?.campus?.campusName}</p>
                  </div>

                  <div className={`${styles['card-details']}`}>
                    <div className={`${styles['detail-item']}`}>
                      <span className={`material-symbols-outlined`}>groups</span>
                      <span>{space.capacity} Capacity</span>
                    </div>
                    <div className={`${styles['detail-item']}`}>
                      <span className={`material-symbols-outlined`}>meeting_room</span>
                      <span>{space.roomType?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className={`${styles['detail-item']}`}>
                      <span className={`material-symbols-outlined`}>graphic_eq</span>
                      <span>{space.noiseLevel}</span>
                    </div>
                    <div className={`${styles['detail-item']}`}>
                      <span className={`material-symbols-outlined`}>schedule</span>
                      <span>Until {space.operatingHours?.weekday?.end || '22:00'}</span>
                    </div>
                  </div>

                  <button
                    className={`${styles['view-details-btn']}`}
                    onClick={() => handleViewDetails(space)}
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pagination - Only show in list view */}
          {viewMode === 'list' && (
            <div className={`${styles['pagination']}`}>
              <p className={`${styles['pagination-text']}`}>
                Showing page <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{currentPage}</span> of <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{paginationInfo.totalPages}</span>
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`${styles['page-btn']}`}
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  <span className={`material-symbols-outlined`}>chevron_left</span>
                </button>

                <button
                  className={`${styles['page-btn']}`}
                  disabled={currentPage === paginationInfo.totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  <span className={`material-symbols-outlined`}>chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div >
  );
};

export default LandingPage;