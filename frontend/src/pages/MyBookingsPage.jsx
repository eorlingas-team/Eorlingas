import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBooking } from '../contexts/BookingContext';
import styles from '../styles/MyBookingsPage.module.css';
import LoadingSpinner from '../components/LoadingSpinner';
import StatsGrid from '../components/StatsGrid';
import Header from '../components/Header';
import { useToast } from '../contexts/ToastContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { formatDate, formatTime, getIstanbulNow } from '../utils/dateUtils';

const MyBookingsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const { bookings: data, loading, isInitialized, fetchBookings, refreshBookings, cancelBooking } = useBooking();
  const { fetchUnreadCount } = useNotifications();
  const [activeTab, setActiveTab] = useState('upcoming');

  useEffect(() => {
    if (location.state?.forceRefresh) {
      refreshBookings();
      window.history.replaceState({}, document.title);
    } else {
      fetchBookings();
    }
  }, [fetchBookings, refreshBookings, location.state]);

  const activeBookings = activeTab === 'upcoming' ? data.upcoming : activeTab === 'past' ? data.past : data.cancelled;

  const handleCancel = async (booking) => {
    const startTime = new Date(booking.startTime);
    const now = getIstanbulNow();
    const diffMinutes = (startTime - now) / (1000 * 60);

    if (diffMinutes <= 15) {
      addToast("You can only cancel your booking up to 15 minutes before the start time.", "error");
      return;
    }

    await confirm({
      title: "Cancel Booking",
      message: "Are you sure you want to cancel this booking?",
      confirmText: "Cancel Booking",
      variant: "warning",
      onConfirm: async () => {
        await cancelBooking(booking.bookingId, "User_Requested");
        addToast("Booking cancelled successfully.", "success");
        fetchUnreadCount();
      }
    });
  };

  const handleViewDetails = (id) => {
    navigate(`/bookings/${id}`);
  };

  return (
    <div className={`${styles['bookings-container']} ${styles['dark']}`}>
      <Header />

      <main className={`${styles['bookings-main']}`}>
        <div className={`${styles['content-wrapper']}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h1 className={`${styles['page-title']}`}>My Bookings</h1>
          </div>

          <div style={{ marginBottom: '24px', paddingLeft: '16px', paddingRight: '16px' }}>
            <StatsGrid stats={[
              { label: 'Total Bookings', value: data.statistics?.totalBookings || 0 },
              { label: 'Upcoming', value: data.statistics?.upcomingCount || 0 },
              { label: 'Past', value: data.statistics?.pastCount || 0 },
              { label: 'Cancelled', value: data.statistics?.cancelledCount || 0 }
            ]} loading={!isInitialized && loading} />
          </div>

          <div className={`${styles['bookings-section']}`}>
            <div className={`${styles['tabs-row']}`}>
              <button
                className={`${styles['tab-btn']} ${activeTab === 'upcoming' ? styles.active : ''}`}
                onClick={() => setActiveTab('upcoming')}
              >
                Upcoming Bookings
              </button>
              <button
                className={`${styles['tab-btn']} ${activeTab === 'past' ? styles.active : ''}`}
                onClick={() => setActiveTab('past')}
              >
                Past Bookings
              </button>
              <button
                className={`${styles['tab-btn']} ${activeTab === 'cancelled' ? styles.active : ''}`}
                onClick={() => setActiveTab('cancelled')}
              >
                Cancelled
              </button>
            </div>

            <div className={`${styles['bookings-list']}`}>
              {!isInitialized && loading ? (
                <LoadingSpinner fullHeight text="Loading bookings..." />
              ) : activeBookings.length > 0 ? (
                activeBookings.map(booking => (
                  <div key={booking.bookingId} className={`${styles['booking-card']}`}>
                    <div className={`${styles['card-content']}`}>
                      <div className={`${styles['card-header-row']}`}>
                        <div>
                          <h3 className={`${styles['space-name']}`}>{booking.space?.spaceName}</h3>
                          <p className={`${styles['space-location']}`}>{booking.space?.building?.buildingName}, {booking.space?.building?.campus?.campusName}</p>
                        </div>
                        {activeTab === 'upcoming' && (
                          <span className={`${styles['status-badge']} ${styles[booking.status.toLowerCase()]}`}>{booking.status}</span>
                        )}
                      </div>

                      <div className={`${styles['card-info-grid']}`}>
                        <div className={`${styles['info-item']}`}>
                          <span className={`material-symbols-outlined ${styles['info-icon']}`}>calendar_today</span>
                          {formatDate(booking.startTime)}
                        </div>
                        <div className={`${styles['info-item']}`}>
                          <span className={`material-symbols-outlined ${styles['info-icon']}`}>schedule</span>
                          {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                        </div>
                        <div className={`${styles['info-item']}`}>
                          <span className={`material-symbols-outlined ${styles['info-icon']}`}>hourglass_top</span>
                          {booking.durationMinutes} Mins
                        </div>
                      </div>
                    </div>

                    <div className={`${styles['card-actions']}`}>
                      {activeTab === 'upcoming' && booking.status === 'Confirmed' && (
                        <button className={`${styles['btn-cancel-booking']}`} onClick={() => handleCancel(booking)}>
                          Cancel Booking
                        </button>
                      )}
                      <button className={`${styles['btn-view-details']}`} onClick={() => handleViewDetails(booking.bookingId)}>
                        View Details
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  <span className={`material-symbols-outlined`} style={{ fontSize: '48px', marginBottom: '16px' }}>event_busy</span>
                  <p>No {activeTab} bookings found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MyBookingsPage;