import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { SpacesProvider, useSpaces } from '../SpacesContext';
import { spacesApi } from '../../api/spaces';

// Mock API
jest.mock('../../api/spaces', () => ({
    spacesApi: {
        getAll: jest.fn(),
        getFilterOptions: jest.fn()
    }
}));

const TestComponent = () => {
    const { spaces, allSpaces, loading, actions, filters, paginationInfo } = useSpaces();
    return (
        <div>
            <div data-testid="loading">{loading ? 'Loading...' : 'Loaded'}</div>
            <div data-testid="total-spaces">{allSpaces.length}</div>
            <div data-testid="visible-spaces">{spaces.length}</div>
            <div data-testid="pagination-total">{paginationInfo.total}</div>
            <button onClick={() => actions.updateFilters({ campus: 'Ayazaga' })}>Filter Campus</button>
            <button onClick={() => actions.updateSearchTerm('Comp')}>Search</button>
            <ul>
                {spaces.map(s => <li key={s.spaceId}>{s.spaceName}</li>)}
            </ul>
        </div>
    );
};

describe('SpacesContext', () => {
    const mockSpaces = [
        { spaceId: 1, spaceName: 'Computer Lab', building: { buildingName: 'EE', campus: { campusName: 'Ayazaga' } }, roomType: 'Lab', capacity: 30, status: 'Available' },
        { spaceId: 2, spaceName: 'Study Room', building: { buildingName: 'MED', campus: { campusName: 'Ayazaga' } }, roomType: 'Study', capacity: 10, status: 'Available' },
        { spaceId: 3, spaceName: 'Physics Lab', building: { buildingName: 'Science', campus: { campusName: 'Gumussuyu' } }, roomType: 'Lab', capacity: 20, status: 'Available' }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should fetch all spaces and metadata on mount', async () => {
        spacesApi.getAll.mockResolvedValue({
            data: { success: true, data: { spaces: mockSpaces } }
        });
        spacesApi.getFilterOptions.mockResolvedValue({
            data: { success: true, data: { campuses: [], buildings: [] } }
        });

        render(
            <SpacesProvider>
                <TestComponent />
            </SpacesProvider>
        );

        await act(async () => {
            jest.runAllTimers(); // Resolve initial async effects
        });

        expect(spacesApi.getAll).toHaveBeenCalled();
        expect(screen.getByTestId('total-spaces')).toHaveTextContent('3');
        expect(screen.getByTestId('loading')).toHaveTextContent('Loaded');
    });

    it('should filter spaces by campus', async () => {
        spacesApi.getAll.mockResolvedValue({
            data: { success: true, data: { spaces: mockSpaces } }
        });
        spacesApi.getFilterOptions.mockResolvedValue({ data: { success: true, data: {} } });

        render(
            <SpacesProvider>
                <TestComponent />
            </SpacesProvider>
        );
        
        await act(async () => {
            jest.runAllTimers();
        });

        // Apply filter
        await act(async () => {
            screen.getByText('Filter Campus').click();
        });

        // Should filter to Ayazaga (2 spaces)
        expect(screen.getByTestId('total-spaces')).toHaveTextContent('2');
        expect(screen.queryByText('Physics Lab')).not.toBeInTheDocument();
    });

    it('should filter spaces by search term with debounce', async () => {
        spacesApi.getAll.mockResolvedValue({
            data: { success: true, data: { spaces: mockSpaces } }
        });
        spacesApi.getFilterOptions.mockResolvedValue({ data: { success: true, data: {} } });

        render(
            <SpacesProvider>
                <TestComponent />
            </SpacesProvider>
        );

        await act(async () => {
            jest.runAllTimers();
        });

        // Perform Search 'Comp' -> matches Computer Lab only
        await act(async () => {
            screen.getByText('Search').click();
        });

        // Should not update immediately due to debounce
        expect(screen.getByTestId('total-spaces')).toHaveTextContent('3');

        // Advance debounce timer
        await act(async () => {
            jest.advanceTimersByTime(500); 
        });

        expect(screen.getByTestId('total-spaces')).toHaveTextContent('1');
        expect(screen.getByText('Computer Lab')).toBeInTheDocument();
        expect(screen.queryByText('Study Room')).not.toBeInTheDocument();
    });
});
