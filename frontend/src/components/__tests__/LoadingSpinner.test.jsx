import React from 'react';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../LoadingSpinner';

describe('LoadingSpinner Component', () => {
    it('renders without crashing', () => {
        render(<LoadingSpinner />);
        // It renders a div with spinner class, implicit check by render succeeding
        const spinner = document.querySelector('.spinner');
        expect(spinner).toBeInTheDocument();
    });

    it('renders text when provided', () => {
        render(<LoadingSpinner text="Process is loading..." />);
        expect(screen.getByText('Process is loading...')).toBeInTheDocument();
    });

    it('applies full height class when prop is true', () => {
        render(<LoadingSpinner fullHeight={true} />);
        const container = document.querySelector('.spinner-container');
        expect(container).toHaveClass('full-height');
    });

    it('applies custom color styles', () => {
        render(<LoadingSpinner color="#ff0000" />);
        const spinner = document.querySelector('.spinner');
        expect(spinner).toHaveStyle({ borderTopColor: '#ff0000' });
    });
});
