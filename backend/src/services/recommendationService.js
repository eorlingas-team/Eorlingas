const pool = require('../config/db');

/**
 * Calculates preference statistics from user history
 * @param {Array} historyRows 
 * @returns {Object} Preference stats
 */
const calculateUserPreferences = (historyRows) => {
  const stats = {
    roomTypes: {},
    noiseLevels: {},
    buildings: {},
    campuses: {},
    visitedSpaceIds: new Set()
  };

  historyRows.forEach(row => {
    stats.visitedSpaceIds.add(row.space_id);

    stats.roomTypes[row.room_type] = (stats.roomTypes[row.room_type] || 0) + 1;
    
    stats.noiseLevels[row.noise_level] = (stats.noiseLevels[row.noise_level] || 0) + 1;
    
    stats.buildings[row.building_id] = (stats.buildings[row.building_id] || 0) + 1;

    stats.campuses[row.campus_id] = (stats.campuses[row.campus_id] || 0) + 1;
  });

  return stats;
};

/**
 * Score and sort a list of spaces based on user history
 * @param {Array} candidateSpaces - The list of spaces to sort
 * @param {number|string} userId - The user ID to base recommendations on
 * @returns {Promise<Array>} Sorted and scored spaces
 */
const scoreAndSortSpaces = async (candidateSpaces, userId) => {
  try {
    if (candidateSpaces.length === 0) {
      return candidateSpaces;
    }

    let hasHistory = false;
    let historyRows = [];

    // If we have a user check its history
    if (userId) {
      const historyQuery = `
        SELECT 
          s.space_id, s.room_type, s.noise_level, 
          s.building_id, b.campus_id
        FROM bookings bk
        JOIN study_spaces s ON bk.space_id = s.space_id
        JOIN buildings b ON s.building_id = b.building_id
        WHERE bk.user_id = $1
      `;
      const historyResult = await pool.query(historyQuery, [userId]);
      if (historyResult.rows.length > 0) {
        hasHistory = true;
        historyRows = historyResult.rows;
      }
    }

    // If no user or no history sort by global popularity
    if (!userId || !hasHistory) {
      const popularityQuery = `
        SELECT space_id, COUNT(*) as count 
        FROM bookings 
        GROUP BY space_id
      `;
      const popResult = await pool.query(popularityQuery);
      const popMap = {};
      popResult.rows.forEach(r => popMap[r.space_id] = parseInt(r.count));

      return candidateSpaces.sort((a, b) => (popMap[b.space_id] || 0) - (popMap[a.space_id] || 0));
    }

    const userPrefs = calculateUserPreferences(historyRows);

    // Score each candidate
    const scoredSpaces = candidateSpaces.map(space => {
      let score = 0;
      
      // Past Visits
      if (userPrefs.visitedSpaceIds.has(space.space_id)) {
        const visitCount = historyRows.filter(h => h.space_id === space.space_id).length;
        score += visitCount * 10;
      }

      // Building Preference
      if (userPrefs.buildings[space.building_id]) {
        score += userPrefs.buildings[space.building_id] * 5;
      }

      // Room Type Preference
      if (userPrefs.roomTypes[space.room_type]) {
        score += userPrefs.roomTypes[space.room_type] * 3;
      }

      // Noise Level Preference
      if (userPrefs.noiseLevels[space.noise_level]) {
        score += userPrefs.noiseLevels[space.noise_level] * 3;
      }

      // Campus Preference
      if (space.campus_id && userPrefs.campuses[space.campus_id]) {
        score += userPrefs.campuses[space.campus_id] * 1;
      } else if (space.building && space.building.campus && userPrefs.campuses[space.building.campus.campusId]) {
         score += userPrefs.campuses[space.building.campus.campusId] * 1;
      }

      return { ...space, matchScore: score };
    });

    // Sort by score descending
    scoredSpaces.sort((a, b) => b.matchScore - a.matchScore);

    return scoredSpaces;

  } catch (error) {
    console.error('Scoring Error:', error);
    return candidateSpaces;
  }
};

/**
 * Get popular spaces based on total booking count
 * @param {number} limit 
 */
const getPopularSpaces = async (limit = 10) => {
  try {
    const query = `
      SELECT 
        s.*, 
        b.building_name, 
        c.campus_name,
        COUNT(bk.booking_id) as booking_count
      FROM study_spaces s
      JOIN buildings b ON s.building_id = b.building_id
      JOIN campuses c ON b.campus_id = c.campus_id
      LEFT JOIN bookings bk ON s.space_id = bk.space_id
      WHERE s.status = 'Available'
      GROUP BY s.space_id, b.building_id, c.campus_id, b.building_name, c.campus_name
      ORDER BY booking_count DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error('Popular Spaces Error:', error);
    throw error;
  }
};

module.exports = {
  scoreAndSortSpaces,
  getPopularSpaces
};
