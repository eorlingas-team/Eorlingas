import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import styles from '../styles/TimeSlotGrid.module.css';
import { getTodayIstanbul, getIstanbulNow, getIstanbulHourMinute } from '../utils/dateUtils';
import { format } from 'date-fns';

const SLOT_HEIGHT = 24; // pixels per 15-minute slot
const MINUTES_PER_SLOT = 15;
const MIN_DURATION_MINUTES = 60;
const MAX_DURATION_MINUTES = 180;

/**
 * TimeSlotGrid - A time slot selector
 * 
 * Props:
 * - operatingHours: { weekday: { start, end }, weekend: { start, end } }
 * - bookedSlots: Array of { start: "HH:MM", end: "HH:MM" }
 * - selectedDate: string (YYYY-MM-DD)
 * - onSelectionChange: (selection: { start, end, durationMinutes } | null) => void
 * - externalSelection: { start, end, durationMinutes } | null - allows parent to control selection
 * - readOnly: boolean - if true, disabled selection (for guests)
 */
const TimeSlotGrid = ({
    operatingHours = { weekday: { start: '08:00', end: '22:00' } },
    bookedSlots = [],
    selectedDate,
    onSelectionChange,
    externalSelection,
    readOnly = false
}) => {
    const [selectionStart, setSelectionStart] = useState(null);
    const [selectionEnd, setSelectionEnd] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartY, setDragStartY] = useState(0);
    const [initialEndMinutes, setInitialEndMinutes] = useState(0);

    const gridRef = useRef(null);
    const slotColumnRef = useRef(null);

    // Determine if selected date is weekend
    const isWeekend = useMemo(() => {
        if (!selectedDate) return false;
        const day = new Date(selectedDate).getDay();
        return day === 0 || day === 6;
    }, [selectedDate]);

    // Get operating hours for the selected day
    const dayOperatingHours = useMemo(() => {
        if (isWeekend && operatingHours.weekend?.start && operatingHours.weekend?.end) {
            return operatingHours.weekend;
        }
        return operatingHours.weekday || { start: '08:00', end: '22:00' };
    }, [isWeekend, operatingHours]);

    // Parse time string to minutes from midnight
    const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        if (h === 23 && m === 59) return 1440;
        return h * 60 + (m || 0);
    };

    // Convert minutes to time string
    const minutesToTime = (minutes) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    // Generate all slots for the day
    const slots = useMemo(() => {
        let startMinutes = timeToMinutes(dayOperatingHours.start);
        const endMinutes = timeToMinutes(dayOperatingHours.end);
        const result = [];

        // Current time in Istanbul timezone
        const istanbulNow = getIstanbulNow();
        const { hour, minute } = getIstanbulHourMinute(istanbulNow);
        const currentTurkeyMinutes = hour * 60 + minute;

        // Today's date in Istanbul timezone
        const todayStr = getTodayIstanbul();
        const isToday = selectedDate === todayStr;

        // If today, start from the current hour or operating start, whichever is later
        if (isToday) {
            const currentHourStartMinutes = Math.floor(currentTurkeyMinutes / 60) * 60;
            startMinutes = Math.max(startMinutes, currentHourStartMinutes);
        }

        for (let min = startMinutes; min < endMinutes; min += MINUTES_PER_SLOT) {
            const slotTime = minutesToTime(min);
            const isHourStart = min % 60 === 0;

            // Check if this slot overlaps with any booking
            const isBooked = bookedSlots.some(booking => {
                const bookStart = timeToMinutes(booking.start);
                const bookEnd = timeToMinutes(booking.end);
                return min >= bookStart && min < bookEnd;
            });

            // Check if slot is in the past for today
            const isPast = isToday && min < currentTurkeyMinutes;

            result.push({
                minutes: min,
                time: slotTime,
                isHourStart,
                isBooked: isBooked || isPast
            });
        }

        return result;
    }, [dayOperatingHours, bookedSlots, selectedDate]);

    // Calculate max possible end time from a given start
    const calculateMaxEnd = useCallback((startMinutes) => {
        const absoluteMax = startMinutes + MAX_DURATION_MINUTES;
        const operatingEnd = timeToMinutes(dayOperatingHours.end);

        // Find next booked slot after start
        let nextBookedStart = operatingEnd;
        for (const booking of bookedSlots) {
            const bookStart = timeToMinutes(booking.start);
            if (bookStart > startMinutes && bookStart < nextBookedStart) {
                nextBookedStart = bookStart;
            }
        }

        return Math.min(absoluteMax, operatingEnd, nextBookedStart);
    }, [dayOperatingHours, bookedSlots]);

    // Check if a slot can be clicked (not booked and enough space for min duration)
    const canStartAt = useCallback((slotMinutes) => {
        // Check if slot itself is booked or in the past
        const slot = slots.find(s => s.minutes === slotMinutes);
        if (!slot || slot.isBooked) return false;

        // Check if there's at least 1 hour of continuous availability
        const minEnd = slotMinutes + MIN_DURATION_MINUTES;
        for (const booking of bookedSlots) {
            const bookStart = timeToMinutes(booking.start);
            const bookEnd = timeToMinutes(booking.end);
            if (bookStart < minEnd && bookEnd > slotMinutes) {
                return false;
            }
        }

        const operatingEnd = timeToMinutes(dayOperatingHours.end);
        return minEnd <= operatingEnd;
    }, [slots, bookedSlots, dayOperatingHours]);

    // Handle slot click - create a new selection
    const handleSlotClick = (slotMinutes) => {
        if (readOnly || !canStartAt(slotMinutes)) return;

        const newStart = slotMinutes;
        const newEnd = newStart + MIN_DURATION_MINUTES;

        setSelectionStart(newStart);
        setSelectionEnd(newEnd);

        if (onSelectionChange) {
            onSelectionChange({
                start: minutesToTime(newStart),
                end: minutesToTime(newEnd),
                durationMinutes: newEnd - newStart
            });
        }
    };

    // Handle resize start
    const handleResizeStart = (e) => {
        if (readOnly) return;
        e.preventDefault();
        e.stopPropagation();

        setIsDragging(true);
        setDragStartY(e.clientY || e.touches?.[0]?.clientY || 0);
        setInitialEndMinutes(selectionEnd);
    };

    // Handle resize move
    const handleResizeMove = useCallback((e) => {
        if (!isDragging || selectionStart === null) return;

        const clientY = e.clientY || e.touches?.[0]?.clientY || 0;
        const deltaY = clientY - dragStartY;
        const deltaSlots = Math.round(deltaY / SLOT_HEIGHT);
        const deltaMinutes = deltaSlots * MINUTES_PER_SLOT;

        let newEnd = initialEndMinutes + deltaMinutes;

        // Enforce minimum duration
        const minEnd = selectionStart + MIN_DURATION_MINUTES;
        if (newEnd < minEnd) newEnd = minEnd;

        // Enforce maximum constraints
        const maxEnd = calculateMaxEnd(selectionStart);
        if (newEnd > maxEnd) newEnd = maxEnd;

        // Snap to grid
        newEnd = Math.round(newEnd / MINUTES_PER_SLOT) * MINUTES_PER_SLOT;

        if (newEnd !== selectionEnd) {
            setSelectionEnd(newEnd);

            if (onSelectionChange) {
                onSelectionChange({
                    start: minutesToTime(selectionStart),
                    end: minutesToTime(newEnd),
                    durationMinutes: newEnd - selectionStart
                });
            }
        }
    }, [isDragging, dragStartY, initialEndMinutes, selectionStart, selectionEnd, calculateMaxEnd, onSelectionChange]);

    // Handle resize end
    const handleResizeEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeEnd);
            window.addEventListener('touchmove', handleResizeMove);
            window.addEventListener('touchend', handleResizeEnd);

            return () => {
                window.removeEventListener('mousemove', handleResizeMove);
                window.removeEventListener('mouseup', handleResizeEnd);
                window.removeEventListener('touchmove', handleResizeMove);
                window.removeEventListener('touchend', handleResizeEnd);
            };
        }
    }, [isDragging, handleResizeMove, handleResizeEnd]);

    // Clear selection when date changes
    useEffect(() => {
        setSelectionStart(null);
        setSelectionEnd(null);
        if (onSelectionChange) {
            onSelectionChange(null);
        }
    }, [selectedDate]);

    // Sync with external selection (for clearing from parent)
    useEffect(() => {
        if (externalSelection === null) {
            setSelectionStart(null);
            setSelectionEnd(null);
        }
    }, [externalSelection]);

    // Format duration for display
    const formatDuration = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (mins === 0) {
            return `${hours} hour${hours > 1 ? 's' : ''}`;
        }
        return `${hours}h ${mins}m`;
    };

    // Calculate selection block position and height
    const selectionStyle = useMemo(() => {
        if (selectionStart === null || selectionEnd === null) return null;

        const startSlotIndex = slots.findIndex(s => s.minutes === selectionStart);
        if (startSlotIndex === -1) return null;

        const top = startSlotIndex * SLOT_HEIGHT;
        const height = ((selectionEnd - selectionStart) / MINUTES_PER_SLOT) * SLOT_HEIGHT;

        return {
            top: `${top}px`,
            height: `${height}px`
        };
    }, [selectionStart, selectionEnd, slots]);

    // Calculate deadzone line position
    const deadzoneStyle = useMemo(() => {
        if (selectionStart === null) return null;

        const maxDurationLimit = selectionStart + MAX_DURATION_MINUTES;
        const actualAvailableEnd = calculateMaxEnd(selectionStart);

        // If something else blocks before the 3-hour limit, don't show the 3-hour line
        if (actualAvailableEnd < maxDurationLimit) return null;

        const startSlotIndex = slots.findIndex(s => s.minutes === selectionStart);
        if (startSlotIndex === -1) return null;

        const slotsUntilLimit = (maxDurationLimit - selectionStart) / MINUTES_PER_SLOT;
        const top = (startSlotIndex + slotsUntilLimit) * SLOT_HEIGHT;

        return {
            top: `${top}px`
        };
    }, [selectionStart, slots, calculateMaxEnd]);

    // Check if operating hours are set (space is open)
    const isOpen = dayOperatingHours.start && dayOperatingHours.end;

    if (!isOpen) {
        return (
            <div className={styles['grid-wrapper']}>
                <div className={styles['grid-header']}>
                    <h3>Availability</h3>
                </div>
                <div className={styles['empty-message']}>
                    <span className="material-symbols-outlined">event_busy</span>
                    <p>This space is closed on the selected date</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles['grid-wrapper']} ${readOnly ? styles['read-only'] : ''}`} ref={gridRef}>
            <div className={styles['grid-header']}>
                <h3>Select Time</h3>
            </div>

            <div className={styles['grid-scroll-container']}>
                <div className={styles['grid-content']}>
                    {/* Time Ruler */}
                    <div className={styles['time-ruler']}>
                        {slots.filter(slot => slot.isHourStart).map((slot, index) => (
                            <div
                                key={slot.minutes}
                                className={styles['time-label']}
                                style={{ top: `${slots.findIndex(s => s.minutes === slot.minutes) * SLOT_HEIGHT}px` }}
                            >
                                {slot.time}
                            </div>
                        ))}
                    </div>

                    {/* Slot Column */}
                    <div className={styles['slot-column']} ref={slotColumnRef}>
                        {slots.map((slot) => (
                            <div
                                key={slot.minutes}
                                className={`
                  ${styles['slot']} 
                  ${slot.isBooked ? styles['booked'] : ''} 
                  ${slot.isHourStart ? styles['hour-start'] : ''}
                `}
                                onClick={() => !slot.isBooked && handleSlotClick(slot.minutes)}
                            />
                        ))}

                        {/* Selection Block */}
                        {selectionStyle && (
                            <div
                                className={`${styles['selection-block']} ${isDragging ? styles['dragging'] : ''}`}
                                style={selectionStyle}
                            >
                                <div className={styles['selection-content']}>
                                    <span className={styles['selection-time']}>
                                        {minutesToTime(selectionStart)} - {minutesToTime(selectionEnd)}
                                    </span>
                                    <span className={styles['selection-duration']}>
                                        {formatDuration(selectionEnd - selectionStart)}
                                    </span>
                                </div>

                                {/* Resize Handle */}
                                <div
                                    className={styles['resize-handle']}
                                    onMouseDown={handleResizeStart}
                                    onTouchStart={handleResizeStart}
                                >
                                    <div className={styles['resize-handle-bar']} />
                                </div>

                                {/* Duration Tooltip (visible while dragging) */}
                                {isDragging && (
                                    <div
                                        className={styles['duration-tooltip']}
                                        style={{ bottom: '0px' }}
                                    >
                                        {formatDuration(selectionEnd - selectionStart)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Deadzone Line (3-hour max) */}
                        {deadzoneStyle && selectionStart !== null && (
                            <div className={styles['deadzone-line']} style={deadzoneStyle}>
                                <span className={styles['deadzone-label']}>Max 3 hours</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimeSlotGrid;
