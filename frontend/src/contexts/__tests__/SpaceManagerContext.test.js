import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { SpaceManagerProvider, useSpaceManager } from '../SpaceManagerContext';
import { spacesApi } from '../../api/spaces';

// Mock API
jest.mock('../../api/spaces', () => ({
    spacesApi: {
        getAll: jest.fn(),
        getFilterOptions: jest.fn(),
        getStats: jest.fn(),
        updateStatus: jest.fn(),
        create: jest.fn(),
        remove: jest.fn()
    }
}));

const TestComponent = () => {
    const { spaces, actions } = useSpaceManager();
    return (
        <div>
            <div data-testid="space-count">{spaces.length}</div>
            <button onClick={() => actions.fetchSpaces()}>Fetch</button>
            <button onClick={() => actions.createSpace({ name: 'New Space' })}>Create</button>
            <button onClick={() => actions.updateSpaceStatus(1, 'Maintenance')}>Set Maintenance</button>
            <ul>
                {spaces.map(s => <li key={s.spaceId}>{s.status}</li>)}
            </ul>
        </div>
    );
};

describe('SpaceManagerContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch managed spaces', async () => {
        spacesApi.getAll.mockResolvedValue({
            data: { success: true, data: { spaces: [{ spaceId: 1 }] } }
        });

        render(
            <SpaceManagerProvider>
                <TestComponent />
            </SpaceManagerProvider>
        );

        await act(async () => {
            screen.getByText('Fetch').click();
        });

        await waitFor(() => {
            expect(screen.getByTestId('space-count')).toHaveTextContent('1');
        });
    });

    it('should update space status optimistically', async () => {
        // Initial load
        spacesApi.getAll.mockResolvedValue({
            data: { success: true, data: { spaces: [{ spaceId: 1, status: 'Available' }] } }
        });
        spacesApi.updateStatus.mockResolvedValue({
            data: { success: true, data: { spaceId: 1, status: 'Maintenance' } }
        });
        spacesApi.getStats.mockResolvedValue({ data: { success: true, data: {} } });

        render(
            <SpaceManagerProvider>
                <TestComponent />
            </SpaceManagerProvider>
        );

        await act(async () => {
            screen.getByText('Fetch').click();
        });

        await waitFor(() => expect(screen.getByText('Available')).toBeInTheDocument());

        await act(async () => {
            screen.getByText('Set Maintenance').click();
        });

        // Should update to Maintenance
        await waitFor(() => {
            expect(screen.getByText('Maintenance')).toBeInTheDocument();
        });
        expect(spacesApi.updateStatus).toHaveBeenCalledWith(1, 'Maintenance');
        // Should also refetch stats
        expect(spacesApi.getStats).toHaveBeenCalled();
    });

    it('should create space and refresh', async () => {
        spacesApi.create.mockResolvedValue({
            data: { success: true, data: {} }
        });
        spacesApi.getAll.mockResolvedValueOnce({
            data: { success: true, data: { spaces: [] } }
        });
        spacesApi.getAll.mockResolvedValueOnce({
            data: { success: true, data: { spaces: [{ spaceId: 1 }] } }
        });
        spacesApi.getStats.mockResolvedValue({ data: { success: true, data: {} } });

        render(
            <SpaceManagerProvider>
                <TestComponent />
            </SpaceManagerProvider>
        );

        await act(async () => {
            screen.getByText('Create').click();
        });

        expect(spacesApi.create).toHaveBeenCalled();
        expect(spacesApi.getAll).toHaveBeenCalled();
    });
});
