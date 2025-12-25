import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { bookingsApi } from '../api/bookings';
import { useBooking } from '../contexts/BookingContext';
import LoadingSpinner from '../components/LoadingSpinner';
import styles from '../styles/BookingDetailsPage.module.css';
import Header from '../components/Header';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { formatDate, formatTime, formatDateTime, getIstanbulNow } from '../utils/dateUtils';
import LocationMap from '../components/Map/LocationMap';

const BookingDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const { bookings, loading: contextLoading } = useBooking(); // Use global context

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBooking = async () => {
      try {
        if (!id) return;

        const foundInUpcoming = bookings.upcoming?.find(b => b.bookingId.toString() === id);
        const foundInPast = bookings.past?.find(b => b.bookingId.toString() === id);
        const foundInCancelled = bookings.cancelled?.find(b => b.bookingId.toString() === id);

        const cachedBooking = foundInUpcoming || foundInPast || foundInCancelled;

        if (cachedBooking) {
          setBooking(cachedBooking);
          setLoading(false);
          return;
        }

        if (contextLoading) {
          return;
        }

        const response = await bookingsApi.getById(id);
        if (response.data.success) {
          setBooking(response.data.data.booking);
        }
      } catch (err) {
        console.error("Fetch Booking Error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadBooking();
  }, [id, bookings, contextLoading]);

  const handleCancel = async () => {
    if (!booking) return;

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
        await bookingsApi.cancel(id, "User_Requested");
        addToast("Booking cancelled successfully.", "success");
        navigate('/bookings');
      }
    });
  };

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'active':
        return styles['status-confirmed'];
      case 'cancelled':
        return styles['status-cancelled'];
      case 'completed':
        return styles['status-completed'];
      default:
        return '';
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours}h ${mins}m`;
  };

  const formatRoomType = (type) => {
    if (!type) return 'N/A';
    return type.replace(/_/g, ' ');
  };

  return (
    <div className={styles['booking-container']}>
      <Header />

      <main className={styles['booking-main']}>
        <div className={styles['content-wrapper']}>

          {/* Back Button */}
          <button className={styles['back-btn']} onClick={() => navigate('/bookings')}>
            <span className="material-symbols-outlined">arrow_back</span>
            Back to My Bookings
          </button>

          {loading ? (
            <div className={styles['loading-state']}>
              <LoadingSpinner fullHeight text="Loading booking details..." />
            </div>
          ) : !booking ? (
            <div className={styles['error-state']}>
              <span className="material-symbols-outlined">error</span>
              <p>Booking not found</p>
            </div>
          ) : (
            <div className={styles['details-layout']}>
              {/* Left Column - Booking Info */}
              <div className={styles['info-column']}>
                {/* Header Card */}
                <div className={styles['header-card']}>
                  <div className={styles['header-top']}>
                    <h1 className={styles['confirmation-number']}>
                      #{booking.confirmationNumber || booking.bookingId}
                    </h1>
                    <span className={`${styles['status-badge']} ${getStatusClass(booking.status)}`}>
                      {booking.status}
                    </span>
                  </div>
                  <p className={styles['booked-date']}>
                    Booked on {formatDateTime(booking.createdAt)}
                  </p>
                </div>

                {/* Space Card */}
                <div className={styles['details-card']}>
                  <h2 className={styles['section-title']}>Space Information</h2>

                  <div className={styles['space-header']}>
                    <h3 className={styles['space-name']}>{booking.space?.spaceName}</h3>
                    <p className={styles['space-location']}>
                      {booking.space?.building?.buildingName}, {booking.space?.building?.campus?.campusName}
                    </p>
                  </div>

                  <div className={styles['info-grid']}>
                    <div className={styles['info-item']}>
                      <span className="material-symbols-outlined">meeting_room</span>
                      <div>
                        <span className={styles['info-label']}>Room</span>
                        <span className={styles['info-value']}>{booking.space?.roomNumber}</span>
                      </div>
                    </div>
                    <div className={styles['info-item']}>
                      <span className="material-symbols-outlined">stairs</span>
                      <div>
                        <span className={styles['info-label']}>Floor</span>
                        <span className={styles['info-value']}>{booking.space?.floor}</span>
                      </div>
                    </div>
                    <div className={styles['info-item']}>
                      <span className="material-symbols-outlined">groups</span>
                      <div>
                        <span className={styles['info-label']}>Capacity</span>
                        <span className={styles['info-value']}>{booking.space?.capacity} People</span>
                      </div>
                    </div>
                    <div className={styles['info-item']}>
                      <span className="material-symbols-outlined">category</span>
                      <div>
                        <span className={styles['info-label']}>Type</span>
                        <span className={styles['info-value']}>{formatRoomType(booking.space?.roomType)}</span>
                      </div>
                    </div>
                    <div className={styles['info-item']}>
                      <span className="material-symbols-outlined">graphic_eq</span>
                      <div>
                        <span className={styles['info-label']}>Noise Level</span>
                        <span className={styles['info-value']}>{booking.space?.noiseLevel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Amenities */}
                  {booking.space?.amenities && booking.space.amenities.length > 0 && (
                    <div className={styles['amenities-section']}>
                      <span className={styles['info-label']}>Amenities</span>
                      <div className={styles['amenities-list']}>
                        {booking.space.amenities.map((amenity, index) => (
                          <span key={index} className={styles['amenity-tag']}>{amenity}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Schedule Card */}
                <div className={styles['details-card']}>
                  <h2 className={styles['section-title']}>Reservation Schedule</h2>

                  <div className={styles['schedule-display']}>
                    <div className={styles['date-display']}>
                      <span className="material-symbols-outlined">calendar_today</span>
                      <span>{formatDate(booking.startTime)}</span>
                    </div>
                    <div className={styles['time-display']}>
                      <div className={styles['time-badge']}>
                        <span>{formatTime(booking.startTime)}</span>
                      </div>
                      <span className={styles['time-separator']}>→</span>
                      <div className={styles['time-badge']}>
                        <span>{formatTime(booking.endTime)}</span>
                      </div>
                      <span className={styles['duration-badge']}>
                        {formatDuration(booking.durationMinutes)}
                      </span>
                    </div>
                  </div>

                  {/* Attendee Count */}
                  <div className={styles['attendee-info']}>
                    <span className="material-symbols-outlined">group</span>
                    <div>
                      <span className={styles['info-label']}>Number of People</span>
                      <span className={styles['info-value']}>{booking.attendeeCount || 1} {booking.attendeeCount === 1 ? 'Person' : 'People'}</span>
                    </div>
                  </div>

                  {/* Purpose */}
                  {booking.purpose && (
                    <div className={styles['purpose-section']}>
                      <span className={styles['info-label']}>Purpose</span>
                      <p className={styles['purpose-text']}>{booking.purpose}</p>
                    </div>
                  )}

                  {/* Cancellation Info */}
                  {booking.status === 'Cancelled' && (
                    <div className={styles['cancellation-info']}>
                      <span className="material-symbols-outlined">info</span>
                      <div className={styles['cancellation-details']}>
                        <div className={styles['cancellation-item']}>
                          <span className={styles['info-label']}>Cancellation Reason</span>
                          <span className={styles['info-value']}>
                            {booking.cancellationReason?.replace(/_/g, ' ') || 'Not specified'}
                          </span>
                        </div>
                        {booking.cancelledAt && (
                          <div className={styles['cancellation-item']}>
                            <span className={styles['info-label']}>Cancelled On</span>
                            <span className={styles['info-value']}>
                              {formatDateTime(booking.cancelledAt)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Cancel Button */}
                {(booking.status === 'Confirmed' || booking.status === 'Active') && (
                  <button className={styles['btn-cancel']} onClick={handleCancel}>
                    <span className="material-symbols-outlined">close</span>
                    Cancel Booking
                  </button>
                )}
              </div>

              {/* Right Column - Map */}
              <div className={styles['map-column']}>
                <LocationMap
                  latitude={booking.space?.building?.latitude}
                  longitude={booking.space?.building?.longitude}
                  buildingName={booking.space?.building?.buildingName}
                  campusName={booking.space?.building?.campus?.campusName}
                  roomNumber={booking.space?.roomNumber}
                  floor={booking.space?.floor}
                />
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default BookingDetailsPage;