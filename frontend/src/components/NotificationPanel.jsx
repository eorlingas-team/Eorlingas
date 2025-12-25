import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/dateUtils';
import LoadingSpinner from './LoadingSpinner';
import styles from '../styles/NotificationPanel.module.css';

const NotificationPanel = ({ notifications, loading, onMarkAsRead, onMarkAllAsRead, onClose }) => {
    const navigate = useNavigate();

    const handleNotificationClick = async (notification) => {
        // Mark as read first
        if (!notification.isRead) {
            await onMarkAsRead(notification.notificationId);
        }

        // Navigate based on type
        switch (notification.type) {
            case 'Booking_Confirmation':
            case 'Booking_Reminder':
            case 'Booking_Cancellation':
                if (notification.relatedEntityId) {
                    navigate(`/bookings/${notification.relatedEntityId}`);
                } else {
                    navigate('/bookings');
                }
                break;
            case 'Report':
                if (notification.relatedData?.defenseToken) {
                    navigate(`/report-defense/${notification.relatedData.defenseToken}`);
                } else {
                    navigate('/profile'); // Fallback
                }
                break;
            default:
                break;
        }
        onClose();
    };

    return (
        <div className={styles['notification-panel']} onClick={(e) => e.stopPropagation()}>
            <div className={styles['panel-header']}>
                <h3>Notifications</h3>
                {notifications.length > 0 && (
                    <button className={styles['mark-all-btn']} onClick={onMarkAllAsRead}>
                        Mark all as read
                    </button>
                )}
            </div>

            <div className={styles['notification-list']}>
                {loading ? (
                    <div className={styles['loading-state']}>
                        <LoadingSpinner size="sm" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className={styles['empty-state']}>
                        <span className="material-symbols-outlined">notifications_off</span>
                        <p>No notifications yet</p>
                    </div>
                ) : (
                    notifications.map((notif) => (
                        <div
                            key={notif.notificationId}
                            className={`${styles['notification-item']} ${!notif.isRead ? styles.unread : ''}`}
                            onClick={() => handleNotificationClick(notif)}
                        >
                            <div className={styles['notif-icon-wrapper']}>
                                <span className={`material-symbols-outlined ${styles['notif-type-icon']}`}>
                                    {getIconName(notif.type)}
                                </span>
                                {!notif.isRead && <span className={styles['unread-dot']} />}
                            </div>
                            <div className={styles['notif-content']}>
                                <p className={styles['notif-subject']}>{notif.subject}</p>
                                <p className={styles['notif-message']}>{notif.message}</p>
                                <span className={styles['notif-time']}>{formatDate(notif.createdAt)}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const getIconName = (type) => {
    switch (type) {
        case 'Booking_Confirmation': return 'check_circle';
        case 'Booking_Reminder': return 'alarm';
        case 'Booking_Cancellation': return 'cancel';
        case 'Report': return 'report';
        case 'Account_Suspension': return 'person_off';
        case 'Account_Recovery': return 'person_check';
        default: return 'notifications';
    }
};

export default NotificationPanel;
