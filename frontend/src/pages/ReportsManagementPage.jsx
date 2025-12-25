import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { reportsApi } from '../api/reports';
import { adminApi } from '../api/admin';
import { formatDateTime } from '../utils/dateUtils';
import styles from '../styles/ReportsManagementPage.module.css';

const ReportsManagementPage = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { confirm } = useConfirm();

    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [statusFilter, setStatusFilter] = useState('Pending');
    const [selectedReport, setSelectedReport] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [suspendLoading, setSuspendLoading] = useState(false);

    const fetchReports = useCallback(async () => {
        try {
            setLoading(true);
            const response = await reportsApi.getAll({ status: statusFilter });
            if (response.data?.success) {
                setReports(response.data.data.reports);
                setPendingCount(response.data.data.pendingCount);
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
            addToast('Failed to fetch reports', 'error');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, addToast]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const handleViewDetails = async (report) => {
        setDetailLoading(true);
        try {
            const response = await reportsApi.getById(report.reportId);
            if (response.data?.success) {
                setSelectedReport({
                    ...response.data.data.report,
                    stats: response.data.data.reportedUserStats
                });
            }
        } catch (error) {
            console.error('Error fetching report details:', error);
            addToast('Failed to fetch report details', 'error');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleMarkAsReviewed = async (reportId) => {
        setActionLoading(true);
        try {
            await reportsApi.markAsReviewed(reportId);
            addToast('Report marked as reviewed', 'success');
            setSelectedReport(null);
            fetchReports();
        } catch (error) {
            console.error('Error marking report as reviewed:', error);
            addToast('Action failed', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSuspendUser = async (userId) => {
        await confirm({
            title: 'Suspend User',
            message: 'Are you sure you want to suspend this user for 1 week?',
            confirmText: 'Suspend',
            variant: 'danger',
            onConfirm: async () => {
                setSuspendLoading(true);
                try {
                    await adminApi.updateUser(userId, 'suspend');
                    addToast('User suspended for 1 week', 'success');
                    fetchReports();
                } catch (error) {
                    console.error('Error suspending user:', error);
                    addToast('Failed to suspend user', 'error');
                } finally {
                    setSuspendLoading(false);
                }
            }
        });
    };

    // Card rendering helper
    const renderReportCard = (report) => (
        <div key={report.reportId} className={styles['report-card']} onClick={() => handleViewDetails(report)}>
            <div className={styles['card-header']}>
                <span className={styles['report-date']}>{formatDateTime(report.createdAt)}</span>
                <span className={`${styles['status-badge']} ${styles[report.status.toLowerCase()]}`}>
                    {report.status}
                </span>
            </div>

            <div className={styles['card-body']}>
                <div className={styles['card-row']}>
                    <span className="material-symbols-outlined">location_on</span>
                    <span>{report.space?.spaceName}</span>
                </div>
                <div className={styles['card-row']}>
                    <span className="material-symbols-outlined">person</span>
                    <span>Reported: {report.reportedUser?.email}</span>
                </div>
                <div className={styles['card-row']}>
                    <span className="material-symbols-outlined">schedule</span>
                    <span>Booking: {formatDateTime(report.booking?.startTime)}</span>
                </div>
                {report.defenseMessage && (
                    <div className={styles['defense-indicator']}>
                        <span className="material-symbols-outlined">gavel</span>
                        Defense Submitted
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={styles['reports-container']}>
            <Header />
            <main className={styles['reports-main']}>
                <div className={styles['content-wrapper']}>
                    <div className={styles['page-header']}>
                        <h1 className={styles['page-title']}>
                            Reports
                            {pendingCount > 0 && (
                                <span className={styles['pending-badge']}>{pendingCount}</span>
                            )}
                        </h1>
                        <div className={styles['filter-group']}>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className={styles['filter-select']}
                            >
                                <option value="Pending">Pending</option>
                                <option value="Reviewed">Reviewed</option>
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <LoadingSpinner fullHeight text="Loading reports..." />
                    ) : (
                        <div className={styles['reports-grid']}>
                            {reports.length > 0 ? (
                                reports.map(renderReportCard)
                            ) : (
                                <div className={styles['empty-state']}>
                                    <span className="material-symbols-outlined">inbox</span>
                                    <p>No {statusFilter.toLowerCase()} reports found.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Detail Modal */}
            {selectedReport && (
                <div className={styles['modal-overlay']} onClick={() => setSelectedReport(null)}>
                    <div className={styles['modal-content']} onClick={(e) => e.stopPropagation()}>
                        <div className={styles['modal-header']}>
                            <h2>Report Details</h2>
                            <button
                                className={styles['close-btn']}
                                onClick={() => setSelectedReport(null)}
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {detailLoading ? (
                            <LoadingSpinner text="Loading..." />
                        ) : (
                            <div className={styles['modal-body']}>
                                <div className={styles['info-section']}>
                                    <h3>Booking Information</h3>
                                    <div className={styles['info-grid']}>
                                        <div>
                                            <span className={styles['label']}>Space</span>
                                            <span>{selectedReport.space?.spaceName} - Room {selectedReport.space?.roomNumber}</span>
                                        </div>
                                        <div>
                                            <span className={styles['label']}>Location</span>
                                            <span>{selectedReport.space?.buildingName}, {selectedReport.space?.campusName}</span>
                                        </div>
                                        <div>
                                            <span className={styles['label']}>Time</span>
                                            <span>{formatDateTime(selectedReport.booking?.startTime)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles['info-section']}>
                                    <h3>Reporter</h3>
                                    <p>{selectedReport.reporter?.fullName} ({selectedReport.reporter?.email})</p>
                                </div>

                                <div className={styles['info-section']}>
                                    <h3>Report Message</h3>
                                    <p className={styles['message-box']}>{selectedReport.message}</p>
                                </div>

                                <div className={styles['info-section']}>
                                    <h3>Reported User</h3>
                                    <p>{selectedReport.reportedUser?.fullName} ({selectedReport.reportedUser?.email})</p>
                                    {selectedReport.stats && (
                                        <div className={styles['user-stats']}>
                                            <span>Total Bookings: {selectedReport.stats.totalBookings}</span>
                                            <span>Reports Received: {selectedReport.stats.totalReportsReceived}</span>
                                        </div>
                                    )}
                                </div>

                                {selectedReport.defenseMessage && (
                                    <div className={styles['info-section']}>
                                        <h3>Defense</h3>
                                        <p className={styles['message-box']}>{selectedReport.defenseMessage}</p>
                                        <small>Submitted at: {formatDateTime(selectedReport.defenseSubmittedAt)}</small>
                                    </div>
                                )}

                                <div className={styles['modal-actions']}>
                                    {selectedReport.status === 'Pending' && (
                                        <>
                                            <button
                                                className={styles['action-btn-secondary']}
                                                onClick={() => handleMarkAsReviewed(selectedReport.reportId)}
                                                disabled={actionLoading || suspendLoading}
                                            >
                                                {actionLoading ? <LoadingSpinner size="sm" /> : 'Mark as Reviewed'}
                                            </button>
                                            <button
                                                className={styles['action-btn-danger']}
                                                onClick={() => handleSuspendUser(selectedReport.reportedUserId)}
                                                disabled={actionLoading || suspendLoading}
                                            >
                                                {suspendLoading ? <LoadingSpinner size="sm" /> : 'Suspend User'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsManagementPage;
