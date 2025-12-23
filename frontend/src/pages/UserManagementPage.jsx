import React, { useEffect, useState } from 'react';
import { useAdmin } from '../contexts/AdminContext';
import DataTable from '../components/DataTable';
import Header from '../components/Header';
import { formatDate } from '../utils/dateUtils';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import styles from '../styles/UserManagementPage.module.css';

const UserManagementPage = () => {
  const {
    users,
    usersLoading,
    usersFilters,
    actions
  } = useAdmin();

  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const [localSearch, setLocalSearch] = useState('');
  const [activeRolePopup, setActiveRolePopup] = useState(null);

  useEffect(() => {
    handleClearFilters();
  }, []);

  useEffect(() => {
    const fetchParams = {
      role: usersFilters.role !== 'All' ? usersFilters.role : undefined,
      status: usersFilters.status !== 'All' ? usersFilters.status : undefined,
      search: usersFilters.search || undefined
    };
    actions.fetchUsers(false, true, fetchParams);
  }, [usersFilters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== usersFilters.search) {
        actions.updateUsersFilters({ search: localSearch });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [localSearch]);

  const filteredUsers = React.useMemo(() => {
    return users;
  }, [users]);

  // Helper for badges
  const getRoleClass = (role) => {
    if (role === 'Student') return 'student';
    if (role === 'Space_Manager' || role === 'Space Manager') return 'manager';
    return 'admin';
  };

  const getStatusClass = (status) => {
    return status.toLowerCase(); // verified, suspended, pending
  };

  const roleToBackend = (displayRole) => {
    if (displayRole === 'Space Manager') return 'Space_Manager';
    return displayRole;
  };

  const cleanDeletedField = (value) => {
    if (!value) return value;
    if (value.includes('@')) {
      const match = value.match(/^(.*)_deleted_\d+(@.+)$/);
      if (match) {
        return match[1] + match[2];
      }
      return value.split('_deleted_')[0];
    }
    return value.split('_deleted_')[0];
  };

  const roleToDisplay = (backendRole) => {
    if (backendRole === 'Space_Manager') return 'Space Manager';
    return backendRole;
  };

  const handleRoleChange = async (userId, newRole) => {
    const backendRole = roleToBackend(newRole);

    await confirm({
      title: "Change User Role",
      message: `Are you sure you want to change user role to ${newRole}?`,
      confirmText: "Change Role",
      variant: "warning",
      onConfirm: async () => {
        const result = await actions.updateUser(userId, 'changeRole', { role: backendRole });

        if (result.success) {
          addToast(`Role updated to ${newRole}`, "success");
        } else {
          addToast(`Failed to update user role: ${result.error}`, "error");
          throw new Error(result.error);
        }
      }
    });
  };

  const handleSuspendToggle = async (userId, currentStatus) => {
    const action = currentStatus === 'Suspended' ? 'restore' : 'suspend';
    const actionText = currentStatus === 'Suspended' ? 'restore' : 'suspend';

    await confirm({
      title: currentStatus === 'Suspended' ? "Restore User" : "Suspend User",
      message: `Are you sure you want to ${actionText} this user?`,
      confirmText: currentStatus === 'Suspended' ? "Restore" : "Suspend",
      variant: "warning",
      onConfirm: async () => {
        const result = await actions.updateUser(userId, action, {});

        if (result.success) {
          addToast(`User ${actionText}ed successfully`, "success");
        } else {
          addToast(`Failed to ${actionText} user: ${result.error}`, "error");
          throw new Error(result.error);
        }
      }
    });
  };

  const handleDeleteUser = async (userId) => {
    await confirm({
      title: "Delete User",
      message: "Are you sure you want to delete this user? This action cannot be undone.",
      confirmText: "Delete User",
      variant: "danger",
      onConfirm: async () => {
        const result = await actions.deleteUser(userId);
        if (!result.success) {
          addToast(result.error, "error");
          throw new Error(result.error);
        } else {
          addToast("User deleted successfully", "success");
        }
      }
    });
  };

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'Space_Manager',
    phoneNumber: ''
  });

  const handleAddUserChange = (e) => {
    setNewUserForm({ ...newUserForm, [e.target.name]: e.target.value });
  };

  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    const result = await actions.createUser(newUserForm);
    if (result.success) {
      addToast('User created successfully', "success");
      setIsAddUserModalOpen(false);
      setNewUserForm({
        email: '',
        password: '',
        fullName: '',
        role: 'Space_Manager',
        phoneNumber: ''
      });
    } else {
      addToast(result.error, "error");
    }
  };

  const columns = React.useMemo(() => {
    const baseColumns = [
      {
        key: 'fullName',
        label: 'Full Name',
        render: (user) => <span style={{ whiteSpace: 'nowrap' }}>{user.fullName}</span>
      },
      {
        key: 'userId',
        label: 'ID',
        color: 'var(--text-muted)',
        render: (user) => <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>#{user.userId}</span>
      },
      {
        key: 'studentNumber',
        label: 'Student ID',
        color: 'var(--text-muted)',
        render: (user) => <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{cleanDeletedField(user.studentNumber) || 'N/A'}</span>,
        sortAccessor: (user) => cleanDeletedField(user.studentNumber) || 'N/A'
      },
      {
        key: 'role',
        label: 'Role',
        render: (user) => (
          <span className={`${styles['role-badge']} ${styles[getRoleClass(user.role)]}`} style={{ whiteSpace: 'nowrap' }}>
            {roleToDisplay(user.role)}
          </span>
        ),
        sortAccessor: (user) => roleToDisplay(user.role)
      },
      {
        key: 'status',
        label: 'Status',
        render: (user) => (
          <span className={`${styles['status-badge']} ${styles[getStatusClass(user.status)]}`} style={{ whiteSpace: 'nowrap' }}>
            {user.status}
          </span>
        )
      },
      {
        key: 'contact',
        label: 'Contact Info',
        sortAccessor: (user) => cleanDeletedField(user.email),
        render: (user) => (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ whiteSpace: 'nowrap' }}>{cleanDeletedField(user.email)}</span>
            {user.phoneNumber && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{user.phoneNumber}</span>}
          </div>
        )
      },
      {
        key: 'registrationDate',
        label: 'Registration Date',
        color: 'var(--text-muted)',
        render: (user) => <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(user.registrationDate)}</span>
      }
    ];

    if (usersFilters.status === 'Deleted') {
      baseColumns.push({
        key: 'updatedAt',
        label: 'Deletion Date',
        align: 'right',
        color: 'var(--text-muted)',
        render: (user) => <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{user.updatedAt ? formatDate(user.updatedAt) : 'N/A'}</span>
      });
      return baseColumns;
    }
    baseColumns.push({
      key: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      render: (user) => (
        <div className={`${styles['action-buttons-wrapper']}`}>
          {/* Change Role Button & Popover */}
          <div style={{ position: 'relative' }}>
            <button
              className={`${styles['action-icon-btn']} ${styles.edit} ${activeRolePopup === user.userId ? styles.active : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveRolePopup(activeRolePopup === user.userId ? null : user.userId);
              }}
              title="Change Role"
            >
              <span className={`material-symbols-outlined`} style={{ fontSize: '20px' }}>manage_accounts</span>
            </button>

            {activeRolePopup === user.userId && (
              <div className={`${styles['role-popover']}`} onClick={(e) => e.stopPropagation()}>
                <button
                  className={`${styles['role-option']} ${styles.student} ${user.role === 'Student' ? styles.active : ''}`}
                  onClick={() => {
                    handleRoleChange(user.userId, 'Student');
                    setActiveRolePopup(null);
                  }}
                >
                  <span className={`material-symbols-outlined`} style={{ fontSize: '18px' }}>school</span>
                  Student
                </button>
                <button
                  className={`${styles['role-option']} ${styles.manager} ${user.role === 'Space_Manager' ? styles.active : ''}`}
                  onClick={() => {
                    handleRoleChange(user.userId, 'Space_Manager');
                    setActiveRolePopup(null);
                  }}
                >
                  <span className={`material-symbols-outlined`} style={{ fontSize: '18px' }}>supervised_user_circle</span>
                  Space Manager
                </button>
                <button
                  className={`${styles['role-option']} ${styles.admin} ${user.role === 'Administrator' ? styles.active : ''}`}
                  onClick={() => {
                    handleRoleChange(user.userId, 'Administrator');
                    setActiveRolePopup(null);
                  }}
                >
                  <span className={`material-symbols-outlined`} style={{ fontSize: '18px' }}>admin_panel_settings</span>
                  Administrator
                </button>
              </div>
            )}
          </div>

          {/* Suspend/Restore Button */}
          <button
            className={`${styles['action-icon-btn']} ${user.status === 'Suspended' ? styles.restore : styles.suspend}`}
            onClick={() => handleSuspendToggle(user.userId, user.status)}
            title={user.status === 'Suspended' ? 'Restore User' : 'Suspend User'}
          >
            <span className={`material-symbols-outlined`} style={{ fontSize: '20px' }}>
              {user.status === 'Suspended' ? 'check_circle' : 'block'}
            </span>
          </button>

          {/* Delete Button */}
          <button
            className={`${styles['action-icon-btn']} ${styles['delete']}`}
            onClick={() => handleDeleteUser(user.userId)}
            title="Delete User"
          >
            <span className={`material-symbols-outlined`} style={{ fontSize: '20px' }}>delete</span>
          </button>
        </div>
      )
    });

    return baseColumns;
  }, [usersFilters.status, activeRolePopup]);

  // Filters configuration
  const filters = [
    {
      title: 'Role',
      type: 'select',
      filterKey: 'role',
      options: [
        { value: 'All', label: 'All' },
        { value: 'Student', label: 'Student' },
        { value: 'Space_Manager', label: 'Space Manager' },
        { value: 'Administrator', label: 'Administrator' }
      ]
    },
    {
      title: 'Status',
      type: 'select',
      filterKey: 'status',
      options: [
        { value: 'All', label: 'All' },
        { value: 'Verified', label: 'Verified' },
        { value: 'Unverified', label: 'Unverified' },
        { value: 'Suspended', label: 'Suspended' },
        { value: 'Deleted', label: 'Deleted' }
      ]
    },
    {
      title: 'Start Date',
      type: 'date',
      filterKey: 'startDate'
    },
    {
      title: 'End Date',
      type: 'date',
      filterKey: 'endDate'
    }
  ];

  // Clear filters handler
  const handleClearFilters = () => {
    setLocalSearch('');
    actions.updateUsersFilters({
      role: 'All',
      status: 'All',
      search: '',
      startDate: null,
      endDate: null
    });
  };

  return (
    <div className={`${styles['users-container']}`}>
      <Header />

      {/* Main Content */}
      <main className={`${styles['users-main']}`}>
        <div className={`${styles['content-wrapper']}`}>

          {/* Page Heading */}
          <div className={`${styles['page-heading']}`}>
            <div>
              <h1 className={`${styles['page-title']}`}>User Management</h1>
              <p className={`${styles['page-subtitle']}`}>Manage user accounts, roles, and permissions.</p>
            </div>
            <button className={`${styles['add-user-btn']}`} onClick={() => setIsAddUserModalOpen(true)}>
              <span className={`material-symbols-outlined`}>add</span>
              Add User
            </button>
          </div>

          {/* DataTable Component */}
          <DataTable
            columns={columns}
            data={filteredUsers}
            loading={usersLoading}
            searchTerm={localSearch}
            onSearchChange={setLocalSearch}
            searchPlaceholder="Search users..."
            filters={filters}
            onClearFilters={handleClearFilters}
            onFilterChange={(newFilters) => {
              actions.updateUsersFilters({
                ...usersFilters,
                ...newFilters
              });
            }}
            activeFilters={usersFilters}
            clientSide={true}
            emptyMessage="No users found."
            containerClass={styles['users-table']}
          />

        </div>
      </main>

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <div className={`${styles['modal-overlay']}`} onClick={() => setIsAddUserModalOpen(false)}>
          <div className={`${styles['modal-content']}`} onClick={(e) => e.stopPropagation()}>
            <div className={`${styles['modal-header']}`}>
              <h2 className={`${styles['modal-title']}`}>Add New User</h2>
              <button className={`${styles['modal-close-btn']}`} onClick={() => setIsAddUserModalOpen(false)}>
                <span className={`material-symbols-outlined`}>close</span>
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit}>
              <div className={`${styles['form-group']}`}>
                <label className={`${styles['form-label']}`}>Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  className={`${styles['form-input']}`}
                  value={newUserForm.fullName}
                  onChange={handleAddUserChange}
                  required
                />
              </div>

              <div className={`${styles['form-group']}`}>
                <label className={`${styles['form-label']}`}>Email *</label>
                <input
                  type="email"
                  name="email"
                  className={`${styles['form-input']}`}
                  value={newUserForm.email}
                  onChange={handleAddUserChange}
                  required
                />
              </div>

              <div className={`${styles['form-group']}`}>
                <label className={`${styles['form-label']}`}>Password *</label>
                <input
                  type="password"
                  name="password"
                  className={`${styles['form-input']}`}
                  value={newUserForm.password}
                  onChange={handleAddUserChange}
                  required
                  minLength={6}
                />
              </div>

              <div className={`${styles['form-group']}`}>
                <label className={`${styles['form-label']}`}>Role *</label>
                <select
                  name="role"
                  className={`${styles['form-select']}`}
                  value={newUserForm.role}
                  onChange={handleAddUserChange}
                >
                  <option value="Space_Manager">Space Manager</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>

              <div className={`${styles['form-group']}`}>
                <label className={`${styles['form-label']}`}>Phone Number</label>
                <input
                  type="tel"
                  name="phoneNumber"
                  className={`${styles['form-input']}`}
                  value={newUserForm.phoneNumber}
                  onChange={handleAddUserChange}
                />
              </div>

              <div className={`${styles['modal-footer']}`}>
                <button type="button" className={`${styles['btn-cancel']}`} onClick={() => setIsAddUserModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles['btn-submit']}`}>
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Popover Backdrop  */}
      {activeRolePopup && (
        <div className={`${styles['popover-backdrop']}`} onClick={() => setActiveRolePopup(null)} />
      )}
    </div>
  );
};

export default UserManagementPage;