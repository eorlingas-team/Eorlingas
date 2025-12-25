import React, { useEffect } from 'react';
import { useAdmin } from '../contexts/AdminContext';
import DataTable from '../components/DataTable';
import Header from '../components/Header';
import { formatDateTime } from '../utils/dateUtils';
import { useToast } from '../contexts/ToastContext';
import styles from '../styles/AuditLogsPage.module.css';

const AuditLogsPage = () => {
  const {
    auditLogs,
    auditLogsLoading,
    auditLogsFilters,
    actions
  } = useAdmin();

  const { addToast } = useToast();

  const cleanDeletedEmail = (email) => {
    if (!email) return email;
    const match = email.match(/^(.*)_deleted_\d+(@.+)$/);
    if (match) {
      return match[1] + match[2];
    }
    return email.split('_deleted_')[0];
  };

  useEffect(() => {
    actions.fetchAuditLogs(false, true);
  }, [auditLogsFilters]);


  const handleExport = async () => {
    try {
      const result = await actions.exportAuditLogs('csv');

      if (result.success) {
        const blob = new Blob([result.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit-logs-${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        addToast("Audit logs exported successfully.", "success");
      } else {
        addToast('Export failed: ' + result.error, "error");
      }
    } catch (err) {
      console.error("Export error:", err);
      addToast("Export failed", "error");
    }
  };

  const columns = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      width: '15%',
      render: (log) => <span style={{ whiteSpace: 'nowrap' }}>{formatDateTime(log.timestamp)}</span>
    },
    {
      key: 'user',
      label: 'User',
      width: '20%',
      color: 'var(--text-muted)',
      sortAccessor: (log) => log.user ? cleanDeletedEmail(log.user.email) : 'System',
      render: (log) => <span style={{ color: 'var(--text-muted)' }}>{log.user ? cleanDeletedEmail(log.user.email) : 'System'}</span>
    },
    {
      key: 'action',
      label: 'Action',
      width: '20%',
      sortAccessor: (log) => log.actionType?.replace(/_/g, ' ') || 'N/A',
      render: (log) => log.actionType?.replace(/_/g, ' ') || 'N/A'
    },
    {
      key: 'target',
      label: 'Target',
      width: '20%',
      color: 'var(--text-muted)',
      sortAccessor: (log) => {
        if (log.targetUser) return cleanDeletedEmail(log.targetUser.email);
        if (log.actionType === 'Login_Failed' && log.beforeState?.attemptedEmail) {
          return `${cleanDeletedEmail(log.beforeState.attemptedEmail)} (Attempt)`;
        }
        if (!log.targetEntityType) return 'N/A';
        const targetId = log.targetEntityId ? ` #${log.targetEntityId}` : '';
        return `${log.targetEntityType}${targetId}`;
      },
      render: (log) => {
        if (log.targetUser) return <span style={{ color: 'var(--text-muted)' }}>{cleanDeletedEmail(log.targetUser.email)}</span>;

        if (log.actionType === 'Login_Failed' && log.beforeState?.attemptedEmail) {
          return <span style={{ color: 'var(--text-muted)' }}>{cleanDeletedEmail(log.beforeState.attemptedEmail)} (Attempt)</span>;
        }

        if (!log.targetEntityType) return 'N/A';

        const targetId = log.targetEntityId ? ` #${log.targetEntityId}` : '';
        return <span style={{ color: 'var(--text-muted)' }}>{`${log.targetEntityType}${targetId}`}</span>;
      }
    },
    {
      key: 'result',
      label: 'Result',
      width: '15%',
      render: (log) => (
        <div className={`${styles['status-badge']} ${log.result === 'Failed' ? styles.failed : styles.success}`}>
          <div className={`${styles['status-dot']} ${log.result === 'Failed' ? styles['status-failure'] : styles['status-success']}`}></div>
          {log.result || 'Success'}
        </div>
      )
    }
  ];

  const actionTypeOptions = [
    'User_Registered',
    'Login_Success',
    'Login_Failed',
    'Booking_Created',
    'Booking_Cancelled',
    'Space_Created',
    'Space_Updated',
    'Space_Deleted',
    'Status_Changed',
    'Role_Changed',
    'Account_Suspended',
    'Password_Reset'
  ];

  const targetEntityOptions = [
    'User',
    'Space',
    'Booking',
    'System'
  ];

  const filters = [
    {
      title: 'Action Type',
      type: 'select',
      filterKey: 'actionType',
      options: [
        { value: 'All', label: 'All' },
        ...actionTypeOptions.map(type => ({ value: type, label: type.replace(/_/g, ' ') }))
      ]
    },
    {
      title: 'Target Entity',
      type: 'select',
      filterKey: 'targetEntity',
      options: [
        { value: 'All', label: 'All' },
        ...targetEntityOptions.map(entity => ({ value: entity, label: entity }))
      ]
    },
    {
      title: 'Result',
      type: 'select',
      filterKey: 'result',
      options: [
        { value: 'All', label: 'All' },
        { value: 'Success', label: 'Success' },
        { value: 'Failed', label: 'Failed' }
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

  const handleClearFilters = () => {
    actions.updateAuditLogsFilters({
      actionType: 'All',
      targetEntity: 'All',
      result: 'All',
      startDate: null,
      endDate: null,
      search: ''
    });
  };

  return (
    <div className={`${styles['audit-container']}`}>
      <Header />

      {/* Main Content */}
      <main className={`${styles['audit-main']}`}>
        <div className={`${styles['content-wrapper']}`}>

          {/* Page Heading */}
          <div className={`${styles['page-heading']}`}>
            <div>
              <h1 className={`${styles['page-title']}`}>Audit Logs</h1>
              <p className={`${styles['page-subtitle']}`}>Monitor all system activities and user actions.</p>
            </div>
            <button className={`${styles['export-btn']}`} onClick={handleExport}>
              <span className={`material-symbols-outlined`}>download</span>
              Export to CSV
            </button>
          </div>

          {/* DataTable Component */}
          <DataTable
            columns={columns}
            data={auditLogs}
            loading={auditLogsLoading}
            filters={filters}
            onClearFilters={handleClearFilters}
            onFilterChange={(newFilters) => {
              actions.updateAuditLogsFilters({
                ...auditLogsFilters,
                ...newFilters
              });
            }}
            activeFilters={auditLogsFilters}
            emptyMessage="No audit logs found"
            containerClass={styles['logs-table']}
            clientSide={true}
            itemsPerPage={20}
          />

        </div>
      </main>
    </div>
  );
};

export default AuditLogsPage;