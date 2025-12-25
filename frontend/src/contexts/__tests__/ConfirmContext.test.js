import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ConfirmProvider, useConfirm } from '../ConfirmContext';

// Mock CSS Module
jest.mock('../../styles/ConfirmDialog.module.css', () => ({
    overlay: 'overlay',
    dialog: 'dialog',
    danger: 'danger',
    warning: 'warning',
    info: 'info',
    header: 'header',
    title: 'title',
    message: 'message',
    actions: 'actions',
    button: 'button',
    confirmButton: 'confirmButton',
    cancelButton: 'cancelButton'
}));

const TestComponent = () => {
    const { confirm } = useConfirm();
    const [result, setResult] = React.useState(null);

    const handleAction = async () => {
        const confirmed = await confirm({
            title: 'Delete Item',
            message: 'Are you sure?',
            confirmText: 'Yes, Delete',
            variant: 'danger'
        });
        setResult(confirmed ? 'Confirmed' : 'Cancelled');
    };

    return (
        <div>
            <div data-testid="result">{result}</div>
            <button onClick={handleAction}>Trigger Confirm</button>
        </div>
    );
};

describe('ConfirmContext', () => {
    it('should show dialog and resolve true on confirm', async () => {
        render(
            <ConfirmProvider>
                <TestComponent />
            </ConfirmProvider>
        );

        // Click trigger
        await act(async () => {
            screen.getByText('Trigger Confirm').click();
        });

        // Check dialog content
        expect(screen.getByText('Delete Item')).toBeInTheDocument();
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();

        // Click confirm
        await act(async () => {
            screen.getByText('Yes, Delete').click();
        });

        expect(screen.getByTestId('result')).toHaveTextContent('Confirmed');
        expect(screen.queryByText('Delete Item')).not.toBeInTheDocument();
    });

    it('should resolve false on cancel', async () => {
        render(
            <ConfirmProvider>
                <TestComponent />
            </ConfirmProvider>
        );

        await act(async () => {
            screen.getByText('Trigger Confirm').click();
        });

        await act(async () => {
            screen.getByText('Cancel').click();
        });

        expect(screen.getByTestId('result')).toHaveTextContent('Cancelled');
    });
});
