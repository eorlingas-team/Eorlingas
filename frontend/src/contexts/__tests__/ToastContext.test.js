import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../ToastContext';
import styles from '../../styles/Toast.module.css';

// Mock CSS Module
jest.mock('../../styles/Toast.module.css', () => ({
    container: 'container',
    success: 'success',
    error: 'error',
    warning: 'warning',
    info: 'info',
    message: 'message',
    closeBtn: 'closeBtn',
    progressBar: 'progressBar'
}));

const TestComponent = () => {
    const { addToast, removeToast } = useToast();
    return (
        <div>
            <button onClick={() => addToast('Success Message', 'success')}>Add Success</button>
            <button onClick={() => addToast('Error Message', 'error', 1000)}>Add Error</button>
        </div>
    );
};

describe('ToastContext', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('should add a toast', () => {
        render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        );

        act(() => {
            screen.getByText('Add Success').click();
        });

        expect(screen.getByText('Success Message')).toBeInTheDocument();
    });

    it('should remove toast automatically after duration', () => {
        render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        );

        act(() => {
            screen.getByText('Add Error').click();
        });

        expect(screen.getByText('Error Message')).toBeInTheDocument();

        // Fast forward time
        act(() => {
            jest.advanceTimersByTime(1500);
        });

        expect(screen.queryByText('Error Message')).not.toBeInTheDocument();
    });

    it('should remove toast manually', () => {
        render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        );

        act(() => {
            screen.getByText('Add Success').click();
        });

        const closeBtn = screen.getByTitle('Close');
        act(() => {
            closeBtn.click();
        });

        expect(screen.queryByText('Success Message')).not.toBeInTheDocument();
    });
});
