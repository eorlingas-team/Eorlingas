const pool = require('../config/db');

// DB verisini API formatına çevir
const formatSpace = (row) => {
  return {
    spaceId: row.space_id,
    spaceName: row.space_name,
    roomNumber: row.room_number,
    floor: row.floor,
    capacity: row.capacity,
    roomType: row.room_type,
    noiseLevel: row.noise_level,
    description: row.description,
    amenities: row.amenities || [],
    accessibilityFeatures: row.accessibility_features || [],
    status: row.status,
    
    operatingHours: {
      weekday: {
        start: row.operating_hours_weekday_start?.slice(0, 5),
        end: row.operating_hours_weekday_end?.slice(0, 5)
      },
      weekend: {
        start: row.operating_hours_weekend_start?.slice(0, 5),
        end: row.operating_hours_weekend_end?.slice(0, 5)
      }
    },
    images: [], 
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    
    // AYAZAĞA ÖZEL YAPILANDIRMA:
    building: {
      buildingId: row.building_id,
      buildingName: row.building_name, 
      campus: { 
        campusId: 1, 
        campusName: "Ayazağa Kampüsü" 
      }
    }
  };
};

// 1. LİSTELEME VE FİLTRELEME (Ayazağa İçi)
exports.getAllSpaces = async (req, res) => {
  try {
    const { 
      buildingId, 
      noiseLevel, 
      minCapacity, 
      roomType,
      search,
      page = 1, 
      limit = 20 
    } = req.query;

    const offset = (page - 1) * limit;

    let queryText = `
      SELECT s.*, b.building_name 
      FROM study_spaces s
      JOIN buildings b ON s.building_id = b.building_id
      WHERE s.status != 'Deleted'
    `;
    
    const queryParams = [];
    let paramIndex = 1;

    if (buildingId) {
      queryText += ` AND s.building_id = $${paramIndex}`;
      queryParams.push(buildingId);
      paramIndex++;
    }
    if (noiseLevel) {
      queryText += ` AND s.noise_level = $${paramIndex}`;
      queryParams.push(noiseLevel);
      paramIndex++;
    }
    if (roomType) {
      queryText += ` AND s.room_type = $${paramIndex}`;
      queryParams.push(roomType);
      paramIndex++;
    }
    if (minCapacity) {
      queryText += ` AND s.capacity >= $${paramIndex}`;
      queryParams.push(minCapacity);
      paramIndex++;
    }
    if (search) {
      queryText += ` AND (s.space_name ILIKE $${paramIndex} OR s.room_number ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const countQueryText = queryText.replace('SELECT s.*, b.building_name', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQueryText, queryParams);

    queryText += ` ORDER BY s.space_id ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(queryText, queryParams);

    res.status(200).json({
      success: true,
      data: {
        spaces: result.rows.map(formatSpace),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
        }
      }
    });
  } catch (err) {
    console.error('Get All Spaces Error:', err);
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Mekanlar listelenemedi." } });
  }
};

// 2. DETAY GETİRME
exports.getSpaceById = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT s.*, b.building_name
      FROM study_spaces s
      JOIN buildings b ON s.building_id = b.building_id
      WHERE s.space_id = $1
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Space not found" } });
    }
    res.status(200).json({ success: true, data: formatSpace(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
};