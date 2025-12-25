const recommendationService = require('../services/recommendationService');
const pool = require('../config/db');

// Mock DB
jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

describe('Recommendation Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scoreAndSortSpaces', () => {
    const candidateSpaces = [
      { space_id: 1, building_id: 10, room_type: 'Quiet', noise_level: 'Low', campus_id: 100 },
      { space_id: 2, building_id: 20, room_type: 'Group', noise_level: 'High', campus_id: 200 },
      { space_id: 3, building_id: 10, room_type: 'Quiet', noise_level: 'Low', campus_id: 100 }
    ];

    it('should return spaces as is if candidates list is empty', async () => {
      const result = await recommendationService.scoreAndSortSpaces([], 1);
      expect(result).toEqual([]);
    });

    it('should sort by global popularity if no user provided', async () => {
      // Mock global popularity query
      pool.query.mockResolvedValueOnce({
        rows: [
          { space_id: 2, count: '50' },
          { space_id: 1, count: '10' }
        ]
      });

      const result = await recommendationService.scoreAndSortSpaces(candidateSpaces, null);
      
      // Expect space 2 (count 50) to be first
      expect(result[0].space_id).toBe(2);
      expect(result[1].space_id).toBe(1);
    });

    it('should sort by personal preference if user history exists', async () => {
      const mockHistory = [
        // User visited space 1 (building 10, Quiet, Low) many times
        { space_id: 1, building_id: 10, room_type: 'Quiet', noise_level: 'Low', campus_id: 100 },
        { space_id: 1, building_id: 10, room_type: 'Quiet', noise_level: 'Low', campus_id: 100 },
      ];

      pool.query.mockResolvedValueOnce({ rows: mockHistory });

      const result = await recommendationService.scoreAndSortSpaces(candidateSpaces, 123);

      // Space 1 matches history perfect (visited, building matches, type matches) -> Highest score
      // Space 3 matches building/type but not visited -> Medium score
      // Space 2 mismatch -> Low score
      
      expect(result[0].space_id).toBe(1);
      expect(result[0].matchScore).toBeGreaterThan(result[1].matchScore);
      expect(result[2].space_id).toBe(2);
    });

    it('should handle db errors gracefully and return candidates unsorted (or original order)', async () => {
        pool.query.mockRejectedValue(new Error('DB Error'));
        
        const result = await recommendationService.scoreAndSortSpaces(candidateSpaces, 123);
        
        // Should return original array (length match)
        expect(result).toHaveLength(3);
    });
  });

  describe('getPopularSpaces', () => {
    it('should return popular spaces', async () => {
      const mockRows = [{ space_id: 1, booking_count: '100' }];
      pool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await recommendationService.getPopularSpaces(5);

      expect(result).toEqual(mockRows);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY booking_count DESC'), [5]);
    });
  });
});
