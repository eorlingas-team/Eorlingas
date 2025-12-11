const pool = require('../config/db');

//  DB snake_case verisi -> API camelCase 
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
    
    // SQL sütunları API'nin istediği obje
    operatingHours: {
      weekday: {
        start: row.operating_hours_weekday_start?.slice(0, 5), // "08:00:00" -> "08:00"
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
    
    // Mock Building Data 
    building: {
      buildingId: row.building_id,
      buildingName: "Merkez Kütüphane",
      campus: { campusName: "Ayazağa Kampüsü" }
    }
  };
};

// 1. LİSTELEME 
exports.getAllSpaces = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;


    const result = await pool.query(
      "SELECT * FROM study_spaces WHERE status != 'Deleted' ORDER BY space_id ASC LIMIT $1 OFFSET $2",
      [limit, offset]
    );

    const totalCount = await pool.query("SELECT COUNT(*) FROM study_spaces WHERE status != 'Deleted'");

    res.status(200).json({
      success: true,
      data: {
        spaces: result.rows.map(formatSpace),
        pagination: {
          page, limit,
          total: parseInt(totalCount.rows[0].count),
          totalPages: Math.ceil(parseInt(totalCount.rows[0].count) / limit)
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
};

// 2. DETAY GETİRME 
exports.getSpaceById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM study_spaces WHERE space_id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Space not found" } });
    }

    res.status(200).json({ success: true, data: formatSpace(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
};

// 3. MEKAN OLUŞTURMA 
exports.createSpace = async (req, res) => {
  const body = req.body;
  try {
    // Saatleri parçala
    const weekdayStart = body.operatingHours?.weekday?.start || '08:00';
    const weekdayEnd = body.operatingHours?.weekday?.end || '22:00';
    const weekendStart = body.operatingHours?.weekend?.start || null;
    const weekendEnd = body.operatingHours?.weekend?.end || null;

    const query = `
      INSERT INTO study_spaces (
        building_id, space_name, room_number, floor, capacity, 
        room_type, noise_level, description, amenities, 
        accessibility_features, status,
        operating_hours_weekday_start, operating_hours_weekday_end,
        operating_hours_weekend_start, operating_hours_weekend_end
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Available', $11, $12, $13, $14) 
      RETURNING *`;
    
    const values = [
      1, // Building ID (Sabit)
      body.spaceName, 
      body.roomNumber || 'Z-00', 
      body.floor || 0, 
      body.capacity, 
      body.roomType, 
      body.noiseLevel || 'Quiet',
      body.description, 
      JSON.stringify(body.amenities || []),
      JSON.stringify(body.accessibilityFeatures || []),
      weekdayStart, weekdayEnd, weekendStart, weekendEnd
    ];

    const newSpace = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: "Study space created successfully",
      data: formatSpace(newSpace.rows[0])
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: "CREATE_ERROR", message: err.message } });
  }
};

// 4. MEKAN GÜNCELLEME 
exports.updateSpace = async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  try {
    const weekdayStart = body.operatingHours?.weekday?.start || '08:00';
    const weekdayEnd = body.operatingHours?.weekday?.end || '22:00';
    const weekendStart = body.operatingHours?.weekend?.start || null;
    const weekendEnd = body.operatingHours?.weekend?.end || null;

    const query = `
      UPDATE study_spaces 
      SET 
        space_name = $1, 
        room_number = $2, 
        floor = $3, 
        capacity = $4, 
        room_type = $5, 
        noise_level = $6, 
        description = $7, 
        amenities = $8, 
        accessibility_features = $9,
        operating_hours_weekday_start = $10,
        operating_hours_weekday_end = $11,
        operating_hours_weekend_start = $12,
        operating_hours_weekend_end = $13,
        updated_at = CURRENT_TIMESTAMP
      WHERE space_id = $14
      RETURNING *
    `;

    const values = [
      body.spaceName, 
      body.roomNumber, 
      body.floor, 
      body.capacity, 
      body.roomType, 
      body.noiseLevel, 
      body.description, 
      JSON.stringify(body.amenities || []),
      JSON.stringify(body.accessibilityFeatures || []),
      weekdayStart, weekdayEnd, weekendStart, weekendEnd,
      id
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Güncellenecek mekan bulunamadı." } });
    }

    res.status(200).json({
      success: true,
      message: "Mekan başarıyla güncellendi",
      data: formatSpace(result.rows[0])
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: err.message } });
  }
};

// 5. MEKAN SİLME 
exports.deleteSpace = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      UPDATE study_spaces 
      SET status = 'Deleted', deleted_at = CURRENT_TIMESTAMP 
      WHERE space_id = $1 
      RETURNING space_id, status
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Silinecek mekan bulunamadı." } });
    }

    res.status(200).json({
      success: true,
      message: "Mekan başarıyla silindi (Soft Delete)",
      data: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: "DELETE_ERROR", message: err.message } });
  }
};