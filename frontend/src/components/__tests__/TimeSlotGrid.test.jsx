import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TimeSlotGrid from '../TimeSlotGrid';
import { getIstanbulNow, getIstanbulHourMinute, getTodayIstanbul } from '../../utils/dateUtils';

// Mock dateUtils
jest.mock('../../utils/dateUtils');

// Mock CSS Modules
jest.mock('../styles/TimeSlotGrid.module.css', () => ({
    slot: 'slot',
    booked: 'booked',
    'hour-start': 'hour-start',
    'selection-block': 'selection-block',
    'dragging': 'dragging',
    'grid-wrapper': 'grid-wrapper',
    'grid-header': 'grid-header',
    'grid-content': 'grid-content',
    'slot-column': 'slot-column'
}));

describe('TimeSlotGrid Component', () => {
    const mockOnSelectionChange = jest.fn();
    const selectedDate = '2025-12-25'; // A Wednesday

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup default mocks for date utils
        getTodayIstanbul.mockReturnValue('2025-12-25');
        getIstanbulNow.mockReturnValue(new Date('2025-12-25T08:00:00'));
        getIstanbulHourMinute.mockReturnValue({ hour: 8, minute: 0 });
    });

    const defaultProps = {
        operatingHours: { weekday: { start: '08:00', end: '22:00' } },
        bookedSlots: [],
        selectedDate,
        onSelectionChange: mockOnSelectionChange,
        readOnly: false
    };

    it('renders slots correctly for given operating hours', () => {
        render(<TimeSlotGrid {...defaultProps} />);
        const slots = document.getElementsByClassName('slot');
        expect(slots.length).toBe(56);
    });

    it('renders booked slots as disabled/booked', () => {
        const bookedSlots = [{ start: '09:00', end: '10:00' }];
        render(<TimeSlotGrid {...defaultProps} bookedSlots={bookedSlots} />);

        const bookedElements = document.getElementsByClassName('booked');
        expect(bookedElements.length).toBe(4);
    });

    it('allows selecting a valid slot', () => {
        render(<TimeSlotGrid {...defaultProps} />);
        // Clear the initial call from useEffect
        mockOnSelectionChange.mockClear();

        const slots = document.getElementsByClassName('slot');
        // 10:00 slot -> index 8
        const targetSlot = slots[8];

        fireEvent.click(targetSlot);

        expect(mockOnSelectionChange).toHaveBeenCalledWith({
            start: '10:00',
            end: '11:00',
            durationMinutes: 60
        });
    });

    it('does not allow selecting a booked slot', () => {
        const bookedSlots = [{ start: '10:00', end: '11:00' }];
        render(<TimeSlotGrid {...defaultProps} bookedSlots={bookedSlots} />);
        mockOnSelectionChange.mockClear();

        const slots = document.getElementsByClassName('slot');
        const bookedSlot = slots[8];

        expect(bookedSlot.className).toContain('booked');
        fireEvent.click(bookedSlot);

        expect(mockOnSelectionChange).not.toHaveBeenCalled();
    });

    it('does not allow selection if duration overlaps with existing booking', () => {
        const bookedSlots = [{ start: '10:30', end: '12:00' }];
        render(<TimeSlotGrid {...defaultProps} bookedSlots={bookedSlots} />);
        mockOnSelectionChange.mockClear();

        // Click 10:00. Default duration 60 mins -> End 11:00. Overlaps with 10:30 booking.
        const slots = document.getElementsByClassName('slot');
        const slot1000 = slots[8];

        fireEvent.click(slot1000);

        expect(mockOnSelectionChange).not.toHaveBeenCalled();
    });

    it('enforces past time restriction for today', () => {
        getIstanbulHourMinute.mockReturnValue({ hour: 12, minute: 30 });
        render(<TimeSlotGrid {...defaultProps} />);
        mockOnSelectionChange.mockClear();

        const slots = document.getElementsByClassName('slot');

        // Slot 12:00 (index 0) should be past
        const pastSlot = slots[0];
        expect(pastSlot.className).toContain('booked');

        fireEvent.click(pastSlot);
        expect(mockOnSelectionChange).not.toHaveBeenCalled();

        // Slot 12:30 (index 2) should be available
        const futureSlot = slots[2];
        expect(futureSlot.className).not.toContain('booked');

        fireEvent.click(futureSlot);
        expect(mockOnSelectionChange).toHaveBeenCalledWith({
            start: '12:30',
            end: '13:30',
            durationMinutes: 60
        });
    });
});
