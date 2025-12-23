import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSpaceManager } from '../contexts/SpaceManagerContext';
import DataTable from '../components/DataTable';
import Header from '../components/Header';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import styles from '../styles/SpaceManagerDashboard.module.css';
import StatsGrid from '../components/StatsGrid';

const SpaceManagerDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const isAdmin = location.pathname.startsWith('/admin');

  const {
    spaces,
    spacesLoading,
    filters,
    stats,
    meta,
    actions
  } = useSpaceManager();

  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => {
    actions.fetchMeta();
    actions.fetchStats();
    actions.fetchSpaces();
    actions.updateFilters({
      status: 'All',
      campus: 'All',
      building: 'All',
      capacity: 'All',
      search: ''
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.search) {
        actions.updateFilters({ search: localSearch });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [localSearch]);

  // Client-Side Filtering
  const filteredSpaces = React.useMemo(() => {
    return spaces.filter(space => {
      // Status Filter
      if (filters.status !== 'All' && space.status !== filters.status) return false;

      // Campus Filter
      if (filters.campus !== 'All' && space.building?.campus?.campusName !== filters.campus) return false;

      // Building Filter
      if (filters.building !== 'All' && space.building?.buildingName !== filters.building) return false;

      // Capacity Filter (Min Capacity)
      if (filters.capacity !== 'All' && space.capacity < Number(filters.capacity)) return false;

      // Search Filter (Name, Building, Campus)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const nameMatch = space.spaceName?.toLowerCase().includes(searchLower);
        const buildingMatch = space.building?.buildingName?.toLowerCase().includes(searchLower);
        const campusMatch = space.building?.campus?.campusName?.toLowerCase().includes(searchLower);

        if (!nameMatch && !buildingMatch && !campusMatch) return false;
      }

      return true;
    });
  }, [spaces, filters]);

  const handleDelete = async (id) => {
    await confirm({
      title: "Delete Space",
      message: "Are you sure you want to delete this space?",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        const result = await actions.deleteSpace(id);

        if (result.success) {
          addToast("Space deleted successfully.", "success");
        } else {
          addToast("Failed to delete space: " + result.error, "error");
          throw new Error(result.error);
        }
      }
    });
  };

  // Table columns configuration
  const columns = [
    {
      key: 'spaceName',
      label: 'Space Name',
      width: '25%',
      render: (space) => space.spaceName
    },
    {
      key: 'building',
      label: 'Building',
      width: '15%',
      color: 'var(--text-muted)',
      render: (space) => <span style={{ color: 'var(--text-muted)' }}>{space.building?.buildingName || 'N/A'}</span>,
      sortAccessor: (space) => space.building?.buildingName || 'N/A'
    },
    {
      key: 'campus',
      label: 'Campus',
      width: '15%',
      color: 'var(--text-muted)',
      render: (space) => <span style={{ color: 'var(--text-muted)' }}>{space.building?.campus?.campusName || 'N/A'}</span>,
      sortAccessor: (space) => space.building?.campus?.campusName || 'N/A'
    },
    {
      key: 'capacity',
      label: 'Capacity',
      width: '10%',
      color: 'var(--text-muted)',
      render: (space) => <span style={{ color: 'var(--text-muted)' }}>{space.capacity}</span>
    },
    {
      key: 'status',
      label: 'Status',
      width: '15%',
      render: (space) => (
        <div className={`${styles['status-badge']} ${styles[space.status.toLowerCase()]}`}>
          <div className={`${styles['status-dot']}`}></div>
          {space.status}
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '20%',
      align: 'right',
      sortable: false,
      render: (space) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className={`${styles['action-btn']}`} onClick={() => navigate(isAdmin ? `/admin/space-management/edit/${space.spaceId}` : `/space-manager/edit/${space.spaceId}`)}>
            <span className={`material-symbols-outlined`} style={{ fontSize: '18px' }}>edit</span>
          </button>
          <button className={`${styles['action-btn']}`} onClick={() => handleDelete(space.spaceId)}>
            <span className={`material-symbols-outlined`} style={{ fontSize: '18px' }}>delete</span>
          </button>
        </div>
      )
    }
  ];

  // Filters configuration
  const tableFilters = [
    {
      title: 'Status',
      type: 'select',
      filterKey: 'status',
      options: [
        { value: 'All', label: 'All' },
        { value: 'Available', label: 'Available' },
        { value: 'Maintenance', label: 'Maintenance' },
        { value: 'Deleted', label: 'Deleted' }
      ]
    },
    {
      title: 'Campus',
      type: 'select',
      filterKey: 'campus',
      options: [
        { value: 'All', label: 'All' },
        ...meta.campuses.map(c => ({ value: c.campus_name, label: c.campus_name }))
      ]
    },
    {
      title: 'Building',
      type: 'select',
      filterKey: 'building',
      options: [
        { value: 'All', label: 'All' },
        ...meta.buildings
          .map(b => ({ value: b.building_name, label: b.building_name }))
      ]
    },
    {
      title: 'Min Capacity',
      type: 'number',
      filterKey: 'capacity',
      placeholder: 'Min',
      filterFunction: (item, value) => {
        if (!value) return true;
        return item.capacity >= Number(value);
      }
    }
  ];

  // Clear filters handler
  const handleClearFilters = () => {
    setLocalSearch('');
    actions.updateFilters({
      status: 'All',
      campus: 'All',
      building: 'All',
      capacity: 'All',
      search: ''
    });
  };

  return (
    <div className={`${styles['manager-container']}`}>
      <Header />

      {/* Main Content */}
      <main className={`${styles['manager-main']}`}>
        <div className={`${styles['content-wrapper']}`}>

          {/* Page Heading */}
          <div className={`${styles['page-heading']}`}>
            <div>
              <h1 className={`${styles['page-title']}`}>Space Management Dashboard</h1>
              <p className={`${styles['page-subtitle']}`}>Manage and monitor all study spaces.</p>
            </div>
            <button className={`${styles['create-btn']}`} onClick={() => navigate(isAdmin ? '/admin/space-management/create' : '/space-manager/create-space')}>
              <span className={`material-symbols-outlined`} style={{ fontSize: '1.25rem' }}>add</span>
              Create New Space
            </button>
          </div>

          {/* Stats Grid */}
          <div style={{ marginBottom: '24px' }}>
            <StatsGrid stats={[
              { label: 'Total Spaces', value: stats.totalSpaces },
              { label: 'Available', value: stats.available },
              { label: 'In Maintenance', value: stats.maintenance },
              { label: 'Deleted', value: stats.deleted }
            ]} loading={spacesLoading} />
          </div>

          {/* DataTable Component */}
          <DataTable
            columns={columns}
            data={filteredSpaces}
            loading={spacesLoading}
            searchTerm={localSearch}
            onSearchChange={setLocalSearch}
            searchPlaceholder="Search spaces..."
            filters={tableFilters}
            onClearFilters={handleClearFilters}
            onFilterChange={(newFilters) => {
              actions.updateFilters({
                ...filters,
                ...newFilters
              });
            }}
            activeFilters={filters}
            clientSide={true}
            emptyMessage="No spaces found"
            containerClass={styles['space-table']}
          />

        </div>
      </main>
    </div>
  );
};

export default SpaceManagerDashboard;