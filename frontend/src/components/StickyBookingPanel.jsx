import React, { useState } from 'react';
import styles from '../styles/StickyBookingPanel.module.css';
import LoadingSpinner from './LoadingSpinner';

/**
 * StickyBookingPanel - Fixed bottom panel for booking confirmation
 * 
 * Props:
 * - selection: { start: "HH:MM", end: "HH:MM", durationMinutes: number } | null
 * - spaceName: string
 * - maxCapacity: number
 * - onConfirm: (purpose: string, attendeeCount: number) => Promise<void>
 * - onCancel: () => void
 * - isLoading: boolean
 */
const StickyBookingPanel = ({
    selection,
    spaceName,
    maxCapacity = 1,
    onConfirm,
    onCancel,
    isLoading = false
}) => {
    const [purpose, setPurpose] = useState('');
    const [attendeeCount, setAttendeeCount] = useState(1);

    const formatDuration = (minutes) => {
        if (!minutes) return '';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (mins === 0) {
            return `${hours} hour${hours > 1 ? 's' : ''}`;
        }
        return `${hours}h ${mins}m`;
    };

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm(purpose, attendeeCount);
        }
    };

    const handleCancel = () => {
        setPurpose('');
        setAttendeeCount(1);
        if (onCancel) {
            onCancel();
        }
    };

    const hasSelection = selection && selection.start && selection.end;

    return (
        <div className={`${styles['panel-wrapper']} ${!hasSelection ? styles['hidden'] : ''}`}>
            {hasSelection ? (
                <div className={styles['panel-content']}>
                    {/* Selection Info */}
                    <div className={styles['selection-info']}>
                        <div className={styles['time-display']}>
                            <div className={styles['time-badge']}>
                                <span className="material-symbols-outlined">schedule</span>
                                {selection.start}
                            </div>
                            <span className={styles['time-separator']}>→</span>
                            <div className={styles['time-badge']}>
                                <span className="material-symbols-outlined">schedule</span>
                                {selection.end}
                            </div>
                        </div>
                        <div className={styles['duration-badge']}>
                            {formatDuration(selection.durationMinutes)}
                        </div>
                    </div>

                    {/* Attendee Count */}
                    <div className={styles['attendee-count-wrapper']}>
                        <span className="material-symbols-outlined">group</span>
                        <input
                            type="number"
                            className={styles['attendee-input']}
                            min="1"
                            max={maxCapacity}
                            value={attendeeCount}
                            onChange={(e) => setAttendeeCount(Math.min(Math.max(1, parseInt(e.target.value) || 1), maxCapacity))}
                            disabled={isLoading}
                        />
                    </div>

                    {/* Purpose Input */}
                    <div className={styles['purpose-input-wrapper']}>
                        <input
                            type="text"
                            className={styles['purpose-input']}
                            placeholder="Purpose (optional): e.g., Project meeting..."
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className={styles['action-buttons']}>
                        <button
                            className={styles['btn-cancel']}
                            onClick={handleCancel}
                            disabled={isLoading}
                        >
                            <span className="material-symbols-outlined">close</span>
                            Cancel
                        </button>
                        <button
                            className={`${styles['btn-confirm']} ${isLoading ? styles['loading'] : ''}`}
                            onClick={handleConfirm}
                            disabled={isLoading}
                        >
                            {isLoading ? <LoadingSpinner size="sm" variant="white" /> : <span className="material-symbols-outlined">check_circle</span>}
                            {isLoading ? 'Booking...' : 'Book Now'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className={styles['empty-panel']}>
                    <span className="material-symbols-outlined">touch_app</span>
                    <span>Select a time slot to make a reservation</span>
                </div>
            )}
        </div>
    );
};

export default StickyBookingPanel;
