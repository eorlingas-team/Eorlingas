import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { spacesApi } from '../api/spaces';
import { bookingsApi } from '../api/bookings';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useToast } from '../contexts/ToastContext';
import { getTodayIstanbul, getDateRangeIstanbul, createIstanbulDateTime, getIstanbulNow, getIstanbulHourMinute } from '../utils/dateUtils';
import { addDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import styles from '../styles/SpaceDetailsPage.module.css';
import Header from '../components/Header';
import TimeSlotGrid from '../components/TimeSlotGrid';
import StickyBookingPanel from '../components/StickyBookingPanel';
import LoadingSpinner from '../components/LoadingSpinner';
import LocationMap from '../components/Map/LocationMap';

const SpaceDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { addToast } = useToast();
  const authState = useAuth();

  const isAuthenticated = authState?.isAuthenticated;
  const { fetchUnreadCount } = useNotifications();

  const [space, setSpace] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [date, setDate] = useState(getTodayIstanbul());
  const [selection, setSelection] = useState(null);
  const [isBooking, setIsBooking] = useState(false);
  const [minDate, setMinDate] = useState(getTodayIstanbul());

  // Fetch space and availability data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const cachedSpace = location.state?.spaceData;

        if (cachedSpace && cachedSpace.spaceId === parseInt(id)) {
          setSpace(cachedSpace);
          setLoading(false);
          setAvailabilityLoading(true);

          const { startDate, endDate } = getDateRangeIstanbul(14);
          const availabilityResponse = await spacesApi.getAvailability(id, {
            startDate,
            endDate
          });

          if (availabilityResponse.data.success) {
            setAvailability(availabilityResponse.data.data.availability);
          }
          setAvailabilityLoading(false);
        } else {
          setLoading(true);
          setAvailabilityLoading(true);
          const { startDate, endDate } = getDateRangeIstanbul(14);
          const [spaceRes, availRes] = await Promise.all([
            spacesApi.getById(id),
            spacesApi.getAvailability(id, {
              startDate,
              endDate
            })
          ]);

          if (spaceRes.data.success) {
            setSpace(spaceRes.data.data.space);
          }
          if (availRes.data.success) {
            setAvailability(availRes.data.data.availability);
          }
          setLoading(false);
          setAvailabilityLoading(false);
        }
      } catch (err) {
        console.error("Error fetching space details:", err);
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id, location.state]);

  useEffect(() => {
    setSelection(null);
  }, [date]);

  const bookedSlots = useMemo(() => {
    if (!availability) return [];

    const dateData = availability.find(d => d.date === date);
    if (!dateData || !dateData.slots) return [];

    const booked = [];
    let currentBooking = null;

    dateData.slots.forEach((slot, index) => {
      if (!slot.available) {
        if (!currentBooking) {
          currentBooking = { start: slot.start, end: slot.end };
        } else {
          currentBooking.end = slot.end;
        }
      } else {
        if (currentBooking) {
          booked.push(currentBooking);
          currentBooking = null;
        }
      }
    });

    if (currentBooking) {
      booked.push(currentBooking);
    }

    return booked;
  }, [availability, date]);

  const operatingHours = useMemo(() => {
    if (!space?.operatingHours) {
      return { weekday: { start: '08:00', end: '22:00' } };
    }
    return space.operatingHours;
  }, [space]);

  const isClosed = useMemo(() => {
    if (!availability) return false;
    const dateData = availability.find(d => d.date === date);
    return dateData?.closed === true || (dateData?.slots?.length === 0);
  }, [availability, date]);

  useEffect(() => {
    const checkTimeCutoff = () => {
      const now = getIstanbulNow();
      const todayStr = getTodayIstanbul();
      const { hour: currentHour, minute: currentMinute } = getIstanbulHourMinute(now);

      const day = new Date(now);
      // We need the Istanbul day of week for operating hours check
      // (Day might be different if it's after midnight in Istanbul but not in UTC)
      // Actually, getTodayIstanbul() is already reliable.
      const dayOfWeek = toZonedTime(now, 'Europe/Istanbul').getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const hours = isWeekend ? operatingHours?.weekend : operatingHours?.weekday;

      let shouldSkipToday = false;

      if (!hours || !hours.end) {
        shouldSkipToday = true;
      } else {
        let [endHour, endMinute] = hours.end.split(':').map(Number);

        if (endHour === 0 && endMinute === 0) {
          endHour = 24;
        }

        const currentTotalMinutes = currentHour * 60 + currentMinute;
        const closingTotalMinutes = endHour * 60 + endMinute;

        if (closingTotalMinutes - currentTotalMinutes < 60) {
          shouldSkipToday = true;
        }
      }

      if (shouldSkipToday) {
        const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');

        setMinDate(tomorrowStr);

        setDate((prevDate) => {
          return prevDate === todayStr ? tomorrowStr : prevDate;
        });
      } else {
        setMinDate(todayStr);

        const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');
        setDate((prevDate) => {
          return prevDate === tomorrowStr ? todayStr : prevDate;
        });
      }
    };

    checkTimeCutoff();
  }, [operatingHours]);

  const mapAmenityToIcon = (amenity) => {
    const lower = amenity.toLowerCase();
    if (lower.includes('wifi') || lower.includes('internet')) return 'wifi';
    if (lower.includes('power') || lower.includes('outlet')) return 'power';
    if (lower.includes('whiteboard') || lower.includes('board')) return 'edit';
    if (lower.includes('projector')) return 'videocam';
    if (lower.includes('tv') || lower.includes('monitor') || lower.includes('screen')) return 'tv';
    if (lower.includes('computer') || lower.includes('pc')) return 'desktop_windows';
    if (lower.includes('printer') || lower.includes('print')) return 'print';
    if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('kitchen')) return 'coffee';
    if (lower.includes('water')) return 'water_drop';
    if (lower.includes('accessible') || lower.includes('wheelchair')) return 'accessible';
    if (lower.includes('air') || lower.includes('ac')) return 'ac_unit';
    if (lower.includes('quiet') || lower.includes('silence')) return 'volume_off';
    if (lower.includes('sound') || lower.includes('audio')) return 'volume_up';
    return 'check_circle';
  };

  const handleSelectionChange = (newSelection) => {
    setSelection(newSelection);
  };

  const handleConfirmBooking = async (purpose, attendeeCount) => {
    if (!selection || !isAuthenticated) return;

    setIsBooking(true);
    try {
      const startTime = createIstanbulDateTime(date, selection.start);
      const endTime = createIstanbulDateTime(date, selection.end);

      const response = await bookingsApi.create({
        spaceId: parseInt(id),
        startTime,
        endTime,
        purpose: purpose || null,
        attendeeCount: attendeeCount || 1
      });

      if (response.data.success) {
        addToast(`Booking confirmed! Confirmation number: ${response.data.data.confirmationNumber}`, "success");
        fetchUnreadCount();
        navigate('/bookings', { state: { forceRefresh: true } });
      }
    } catch (err) {
      console.error("Booking error:", err);
      addToast("Booking failed: " + (err.response?.data?.error?.message || err.message), "error");
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelSelection = () => {
    setSelection(null);
  };

  if (loading) {
    return (
      <div className={`${styles['details-page-container']} ${styles.dark}`}>
        <div className={`${styles['details-page-container']} ${styles.dark}`}>
          <Header />
          <LoadingSpinner fullHeight text="Loading space details..." />
        </div>
      </div>
    );
  }

  if (!space) {
    return (
      <div className={`${styles['details-page-container']} ${styles.dark}`}>
        <Header />
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Space not found
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles['details-page-container']} ${styles.dark}`}>
      <Header />

      <main className={styles['details-main']}>
        <div className={styles['content-wrapper']}>


          <button onClick={() => navigate('/')} className={styles['back-btn']} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem' }}>
            <span className="material-symbols-outlined">arrow_back</span>
            Back to all spaces
          </button>

          <div className={styles['details-grid']}>

            {/* Left Column: Space Details */}
            <div className={styles['space-info-col']}>


              {/* Title Section */}
              <div className={styles['title-section']}>
                <h1 className={styles['space-title']}>{space.spaceName}</h1>
                <p className={styles['space-location']}>
                  {space.building?.buildingName}, {space.building?.campus?.campusName}
                </p>
              </div>

              {/* Stats Grid */}
              <div className={styles['stats-grid']}>
                <div className={styles['stat-item']}>
                  <span className={`material-symbols-outlined ${styles['stat-icon']}`}>groups</span>
                  <div className={styles['stat-text']}>
                    <span className={styles['stat-label']}>Capacity</span>
                    <span className={styles['stat-value']}>{space.capacity} People</span>
                  </div>
                </div>
                <div className={styles['stat-item']}>
                  <span className={`material-symbols-outlined ${styles['stat-icon']}`}>meeting_room</span>
                  <div className={styles['stat-text']}>
                    <span className={styles['stat-label']}>Type</span>
                    <span className={styles['stat-value']}>{space.roomType?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div className={styles['stat-item']}>
                  <span className={`material-symbols-outlined ${styles['stat-icon']}`}>graphic_eq</span>
                  <div className={styles['stat-text']}>
                    <span className={styles['stat-label']}>Noise Level</span>
                    <span className={styles['stat-value']}>{space.noiseLevel}</span>
                  </div>
                </div>
                <div className={styles['stat-item']}>
                  <span className={`material-symbols-outlined ${styles['stat-icon']}`}>location_on</span>
                  <div className={styles['stat-text']}>
                    <span className={styles['stat-label']}>Floor</span>
                    <span className={styles['stat-value']}>{space.floor}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className={styles['info-block']}>
                <h3>Description</h3>
                <p className={styles['description-text']}>{space.description || 'No description available.'}</p>
              </div>

              {/* Amenities */}
              {space.amenities && space.amenities.length > 0 && (
                <div className={styles['info-block']}>
                  <h3>Amenities</h3>
                  <div className={styles['amenities-grid']}>
                    {space.amenities.map((item, index) => (
                      <div key={index} className={styles['amenity-item']}>
                        <span className={`material-symbols-outlined ${styles['amenity-icon']}`}>
                          {mapAmenityToIcon(item)}
                        </span>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Operating Hours */}
              <div className={styles['info-block']}>
                <h3>Operating Hours</h3>
                <div className={styles['hours-list']}>
                  <div className={styles['hours-row']}>
                    <span>Monday - Friday</span>
                    <span style={{ fontWeight: 500 }}>
                      {operatingHours.weekday?.start || '08:00'} - {operatingHours.weekday?.end || '22:00'}
                    </span>
                  </div>
                  <div className={styles['hours-row']}>
                    <span>Saturday - Sunday</span>
                    <span style={{ fontWeight: 500 }}>
                      {operatingHours.weekend?.start && operatingHours.weekend?.end
                        ? `${operatingHours.weekend.start} - ${operatingHours.weekend.end}`
                        : 'Closed'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Map */}
              <div style={{ width: '50%' }}>
                <LocationMap
                  latitude={space.building?.latitude}
                  longitude={space.building?.longitude}
                  buildingName={space.building?.buildingName}
                  campusName={space.building?.campus?.campusName}
                  roomNumber={space.roomNumber}
                  floor={space.floor}
                />
              </div>



            </div>

            {/* Right Column: Booking Calendar */}
            <div className={styles['sidebar-col']}>

              {/* Date Picker */}
              <div className={styles['date-picker-card']}>
                <div className={styles['input-group']}>
                  <label className={styles['stat-label']} style={{ marginBottom: '8px', display: 'block' }}>
                    Select Date
                  </label>
                  <div className={styles['date-input-wrapper']}>
                    <input
                      type="date"
                      className={styles['date-input']}
                      value={date}
                      min={minDate}
                      max={getDateRangeIstanbul(14).endDate}
                      onChange={(e) => setDate(e.target.value)}
                    />
                    <span className={`material-symbols-outlined ${styles['calendar-icon']}`}>calendar_today</span>
                  </div>
                </div>
              </div>

              {/* Time Slot Grid */}
              {availabilityLoading ? (
                <LoadingSpinner text="Loading availability..." />
              ) : isClosed ? (
                <div className={styles['login-prompt-box']}>
                  <span className={`material-symbols-outlined ${styles['lock-icon']}`}>event_busy</span>
                  <p className={styles['prompt-text']}>This space is closed on the selected date</p>
                </div>
              ) : (
                <>
                  <TimeSlotGrid
                    operatingHours={operatingHours}
                    bookedSlots={bookedSlots}
                    selectedDate={date}
                    onSelectionChange={handleSelectionChange}
                    externalSelection={selection}
                    readOnly={!isAuthenticated}
                  />
                  {!isAuthenticated && (
                    <div className={styles['guest-info-box']}>
                      <span className="material-symbols-outlined">info</span>
                      <p>You need to <button onClick={() => navigate('/login')} className={styles['inline-login-btn']}>log in</button> to make a reservation.</p>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Sticky Booking Panel */}
      {isAuthenticated && (
        <StickyBookingPanel
          selection={selection}
          spaceName={space.spaceName}
          maxCapacity={space.capacity}
          onConfirm={handleConfirmBooking}
          onCancel={handleCancelSelection}
          isLoading={isBooking}
        />
      )}
    </div>
  );
};

export default SpaceDetailsPage;