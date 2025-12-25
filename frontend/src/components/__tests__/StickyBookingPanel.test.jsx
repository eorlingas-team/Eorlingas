import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StickyBookingPanel from '../StickyBookingPanel';

describe('StickyBookingPanel Component', () => {
    const mockOnConfirm = jest.fn();
    const mockOnCancel = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should be hidden when no selection is provided', () => {
        render(<StickyBookingPanel selection={null} />);
        const wrapper = document.querySelector('.panel-wrapper');
        expect(wrapper).toHaveClass('hidden');
        // Or check for empty state message if it renders differently when visible but empty
        // In current implementation, !hasSelection adds hidden class but children might look different
    });

    it('should render selection details when provided', () => {
        const selection = { start: '10:00', end: '12:00', durationMinutes: 120 };
        render(
            <StickyBookingPanel
                selection={selection}
                spaceName="Test Room"
            />
        );

        expect(screen.getByText('10:00')).toBeInTheDocument();
        expect(screen.getByText('12:00')).toBeInTheDocument();
        expect(screen.getByText('2 hours')).toBeInTheDocument();
    });

    it('should handle attendee count changes', () => {
        const selection = { start: '10:00', end: '11:00', durationMinutes: 60 };
        render(
            <StickyBookingPanel
                selection={selection}
                maxCapacity={5}
            />
        );

        const input = screen.getByDisplayValue('1');
        fireEvent.change(input, { target: { value: '3' } });
        expect(input.value).toBe('3');

        // Test max capacity constraint
        fireEvent.change(input, { target: { value: '10' } });
        expect(input.value).toBe('5'); // Should be capped at maxCapacity
    });

    it('should call onConfirm with correct data', () => {
        const selection = { start: '10:00', end: '11:00', durationMinutes: 60 };
        render(
            <StickyBookingPanel
                selection={selection}
                onConfirm={mockOnConfirm}
            />
        );

        // Enter purpose
        const purposeInput = screen.getByPlaceholderText(/Purpose/i);
        fireEvent.change(purposeInput, { target: { value: 'Team Meeting' } });

        // Click Book
        fireEvent.click(screen.getByText('Book Now'));

        expect(mockOnConfirm).toHaveBeenCalledWith('Team Meeting', 1);
    });

    it('should call onCancel when cancel clicked', () => {
        const selection = { start: '10:00', end: '11:00', durationMinutes: 60 };
        render(
            <StickyBookingPanel
                selection={selection}
                onCancel={mockOnCancel}
            />
        );

        fireEvent.click(screen.getByText('Cancel'));
        expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should disable inputs when loading', () => {
        const selection = { start: '10:00', end: '11:00', durationMinutes: 60 };
        render(
            <StickyBookingPanel
                selection={selection}
                isLoading={true}
            />
        );

        expect(screen.getByPlaceholderText(/Purpose/i)).toBeDisabled();
        expect(screen.getByText('Booking...')).toBeDisabled();
    });
});
