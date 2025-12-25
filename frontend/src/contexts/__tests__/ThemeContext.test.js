import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeContext';

// Test consumer component
const TestComponent = () => {
    const { theme, toggleTheme, setTheme } = useTheme();
    return (
        <div>
            <div data-testid="theme-value">{theme}</div>
            <button onClick={toggleTheme}>Toggle</button>
            <button onClick={() => setTheme('dark')}>Set Dark</button>
            <button onClick={() => setTheme('light')}>Set Light</button>
        </div>
    );
};

describe('ThemeContext', () => {
    beforeEach(() => {
        // Clear localStorage and reset mocks
        localStorage.clear();
        document.documentElement.setAttribute('data-theme', '');
        document.body.className = '';
        
        // Mock matchMedia
        window.matchMedia = jest.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }));
    });

    it('should use default light theme when no storage or system preference', () => {
        render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );
        expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    });

    it('should load theme from localStorage', () => {
        localStorage.setItem('theme', 'dark');
        render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );
        expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should toggle theme', () => {
        render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );
        
        const toggleBtn = screen.getByText('Toggle');
        
        // Light -> Dark
        act(() => {
            toggleBtn.click();
        });
        expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
        expect(localStorage.getItem('theme')).toBe('dark');

        // Dark -> Light
        act(() => {
            toggleBtn.click();
        });
        expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    });

    it('should respect system preference if no localStorage', () => {
        window.matchMedia.mockImplementation(query => ({
            matches: true, // Simulate dark mode preference
            media: query,
            addListener: jest.fn(), 
            removeListener: jest.fn()
        }));

        render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );
        expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
    });
});
