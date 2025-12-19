const pool = require('../config/db');
const recommendationService = require('../services/recommendationService');

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
    
    building: {
      buildingId: row.building_id,
      buildingName: row.building_name,
      campus: { 
        campusId: row.campus_id,
        campusName: row.campus_name 
      }
    },
    
    currentAvailability: row.status === 'Available' ? 'Available' : row.status, 
    nextAvailableTime: null 
  };
};

// 1. LİSTELEME
exports.getAllSpaces = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const { campus, building, type, capacity, available, noiseLevel } = req.query;
    const userId = req.user?.id || req.query.userId; 

    let query = `
      SELECT s.*, b.building_name, b.campus_id, c.campus_name
      FROM study_spaces s
      JOIN buildings b ON s.building_id = b.building_id
      JOIN campuses c ON b.campus_id = c.campus_id
      WHERE s.status != 'Deleted'
    `;
    
    const params = [];
    let paramIndex = 1;

    if (campus) {
      query += ` AND c.campus_name ILIKE $${paramIndex}`;
      params.push(`%${campus}%`);
      paramIndex++;
    }

    if (building) {
      query += ` AND b.building_name ILIKE $${paramIndex}`;
      params.push(`%${building}%`);
      paramIndex++;
    }

    if (type) {
      query += ` AND s.room_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (capacity) {
      query += ` AND s.capacity >= $${paramIndex}`;
      params.push(capacity);
      paramIndex++;
    }

    if (noiseLevel) {
      query += ` AND s.noise_level = $${paramIndex}`;
      params.push(noiseLevel);
      paramIndex++;
    }

    if (available === 'true') {
      query += ` AND s.status = 'Available'`;
    }

    const result = await pool.query(query, params);
    let spaces = result.rows;

    spaces = await recommendationService.scoreAndSortSpaces(spaces, userId || null);

    const totalCount = spaces.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSpaces = spaces.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: {
        spaces: paginatedSpaces.map(formatSpace),
        pagination: {
          page, limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
};

exports.searchSpaces = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const userId = req.user?.id || req.query.userId; 

    if (!q) {
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Search query 'q' is required" } });
    }

    const keyword = `%${q}%`;
    
    const query = `
      SELECT s.*, b.building_name, b.campus_id, c.campus_name
      FROM study_spaces s
      JOIN buildings b ON s.building_id = b.building_id
      JOIN campuses c ON b.campus_id = c.campus_id
      WHERE s.status != 'Deleted'
      AND (
        s.space_name ILIKE $1 OR
        s.description ILIKE $1 OR
        b.building_name ILIKE $1 OR
        c.campus_name ILIKE $1
      )
    `;

    const result = await pool.query(query, [keyword]);
    let spaces = result.rows;

    spaces = await recommendationService.scoreAndSortSpaces(spaces, userId || null);

    const totalCount = spaces.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedSpaces = spaces.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: {
        spaces: paginatedSpaces.map(formatSpace),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
};

const getDatesInRange = (startDate, endDate) => {
  const dates = [];
  let currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
};

const generateDailySlots = (dateObj, space, bookings) => {
  const dateStr = dateObj.toISOString().split('T')[0];
  const dayOfWeek = dateObj.getDay(); // 0: Pazar, 6: Cumartesi
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let startStr, endStr;

  if (isWeekend) {
    startStr = space.operating_hours_weekend_start;
    endStr = space.operating_hours_weekend_end;
  } else {
    startStr = space.operating_hours_weekday_start;
    endStr = space.operating_hours_weekday_end;
  }

  if (!startStr || !endStr) return { date: dateStr, slots: [] };

  const slots = [];
  let currentHour = parseInt(startStr.split(':')[0]);
  const endHour = parseInt(endStr.split(':')[0]);

  while (currentHour < endHour) {
    const slotStart = `${currentHour.toString().padStart(2, '0')}:00`;
    const slotEnd = `${(currentHour + 1).toString().padStart(2, '0')}:00`;
    
    const isBooked = bookings.some(b => {
      const bStart = new Date(b.start_time);
      const bEnd = new Date(b.end_time);
      
      if (bStart.toISOString().split('T')[0] !== dateStr) return false;

      const bStartHour = bStart.getUTCHours() + 3; // TR saati (UTC+3) fix - TODO: Timezone yönetimi
      const bEndHour = bEnd.getUTCHours() + 3;

      return (bStartHour < currentHour + 1) && (bEndHour > currentHour);
    });

    slots.push({
      start: slotStart,
      end: slotEnd,
      available: !isBooked
    });

    currentHour++;
  }

  return { date: dateStr, slots };
};


// 2. DETAY GETİRME 
exports.getSpaceById = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT s.*, b.building_name, b.campus_id, c.campus_name
      FROM study_spaces s
      JOIN buildings b ON s.building_id = b.building_id
      JOIN campuses c ON b.campus_id = c.campus_id
      WHERE s.space_id = $1
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Space not found" } });
    }

    const spaceData = formatSpace(result.rows[0]);

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const bookingsQuery = `
      SELECT start_time, end_time 
      FROM bookings 
      WHERE space_id = $1 
      AND status = 'Confirmed'
      AND start_time >= CURRENT_DATE
      AND end_time < CURRENT_DATE + INTERVAL '2 days'
    `;
    const bookingsResult = await pool.query(bookingsQuery, [id]);

    const availabilityData = [
      generateDailySlots(today, result.rows[0], bookingsResult.rows),
      generateDailySlots(tomorrow, result.rows[0], bookingsResult.rows)
    ];

    const currentStatus = result.rows[0].status === 'Available' ? 'Available' : 'Unavailable';
    
    res.status(200).json({ 
      success: true, 
      data: {
        space: spaceData,
        availability: {
          currentStatus,
          nextAvailableTime: null,
          availableTimeSlots: availabilityData
        }
      } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
};

exports.getSpaceAvailability = async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "startDate and endDate are required" } });
  }

  try {
    const spaceCheck = await pool.query('SELECT * FROM study_spaces WHERE space_id = $1', [id]);
    if (spaceCheck.rows.length === 0) {
       return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Space not found" } });
    }
    const space = spaceCheck.rows[0];

    const bookingsQuery = `
      SELECT start_time, end_time 
      FROM bookings 
      WHERE space_id = $1 
      AND status = 'Confirmed'
      AND (start_time < $3 AND end_time > $2)
    `;
    const bookingsResult = await pool.query(bookingsQuery, [id, startDate, endDate]);

    const dates = getDatesInRange(startDate, endDate);
    const availability = dates.map(date => generateDailySlots(date, space, bookingsResult.rows));

    res.status(200).json({
      success: true,
      data: {
        spaceId: parseInt(id),
        dateRange: { start: startDate, end: endDate },
        availability: availability
      }
    });
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