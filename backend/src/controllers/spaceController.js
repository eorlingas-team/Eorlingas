const pool = require('../config/db');
const recommendationService = require('../services/recommendationService');
const bookingModel = require('../models/bookingModel');
const emailService = require('../services/emailService');
const logAuditEvent = require('../utils/auditLogger');
const { toIstanbulDate, getIstanbulHourMinute, getIstanbulNow } = require('../utils/dateHelpers');
const { addDays } = require('date-fns');
const { formatInTimeZone } = require('date-fns-tz');

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
        start: (row.operating_hours_weekday_start || row.building_weekday_start)?.slice(0, 5), 
        end: (row.operating_hours_weekday_end || row.building_weekday_end)?.slice(0, 5)
      },
      weekend: {
        start: (row.operating_hours_weekend_start || row.building_weekend_start)?.slice(0, 5),
        end: (row.operating_hours_weekend_end || row.building_weekend_end)?.slice(0, 5)
      }
    },
    
    images: [], 
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    
    building: {
      buildingId: row.building_id,
      buildingName: row.building_name,
      latitude: row.building_latitude ? parseFloat(row.building_latitude) : null,
      longitude: row.building_longitude ? parseFloat(row.building_longitude) : null,
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

    const { campus, building, type, capacity, available, noiseLevel, status } = req.query;
    const userId = req.user?.userId || req.query.userId; 

    // 1. Build Dynamic WHERE Clause
    let whereConditions = [];
    const params = [];
    let paramIndex = 1;

    // Specific Status Filter
    if (status && status !== 'All') {
      whereConditions.push(`s.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    } else if (req.query.includeDeleted !== 'true') {
      whereConditions.push(`s.status != 'Deleted'`);
    }

    if (campus && campus !== 'All') {
      whereConditions.push(`c.campus_name ILIKE $${paramIndex}`);
      params.push(`%${campus}%`);
      paramIndex++;
    }

    if (building && building !== 'All') {
      whereConditions.push(`b.building_name ILIKE $${paramIndex}`);
      params.push(`%${building}%`);
      paramIndex++;
    }

    if (type && type !== 'All') {
      const formattedType = type.replace(/ /g, '_');
      whereConditions.push(`s.room_type = $${paramIndex}`);
      params.push(formattedType);
      paramIndex++;
    }

    if (req.query.minCapacity !== undefined && req.query.minCapacity !== 'All' && req.query.minCapacity !== '') {
      whereConditions.push(`s.capacity >= $${paramIndex}`);
      params.push(req.query.minCapacity);
      paramIndex++;
    }

    if (req.query.maxCapacity !== undefined && req.query.maxCapacity !== 'All') {
      whereConditions.push(`s.capacity <= $${paramIndex}`);
      params.push(req.query.maxCapacity);
      paramIndex++;
    }

    if (capacity && req.query.minCapacity === undefined && capacity !== 'All') {
      whereConditions.push(`s.capacity >= $${paramIndex}`);
      params.push(capacity);
      paramIndex++;
    }

    if (noiseLevel && noiseLevel !== 'All') {
      whereConditions.push(`s.noise_level = $${paramIndex}`);
      params.push(noiseLevel);
      paramIndex++;
    }

    if (available === 'true') {
      if (!status) {
         whereConditions.push(`s.status = 'Available'`);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    if (userId) {
      const query = `
        SELECT s.*, b.building_name, b.campus_id, c.campus_name,
               b.latitude as building_latitude, b.longitude as building_longitude,
               b.operating_hours_weekday_start as building_weekday_start,
               b.operating_hours_weekday_end as building_weekday_end,
               b.operating_hours_weekend_start as building_weekend_start,
               b.operating_hours_weekend_end as building_weekend_end
        FROM study_spaces s
        JOIN buildings b ON s.building_id = b.building_id
        JOIN campuses c ON b.campus_id = c.campus_id
        ${whereClause}
      `;
      const result = await pool.query(query, params);
      let spaces = result.rows;

      spaces = await recommendationService.scoreAndSortSpaces(spaces, userId);

      const totalCount = spaces.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedSpaces = spaces.slice(startIndex, endIndex);

      return res.status(200).json({
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
    }

    const countQuery = `
      SELECT COUNT(*)
      FROM study_spaces s
      JOIN buildings b ON s.building_id = b.building_id
      JOIN campuses c ON b.campus_id = c.campus_id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    const offset = (page - 1) * limit;
    
    const limitParamIndex = paramIndex;
    const offsetParamIndex = paramIndex + 1;
    const dataParams = [...params, limit, offset];

    const dataQuery = `
      SELECT s.*, b.building_name, b.campus_id, c.campus_name,
             b.latitude as building_latitude, b.longitude as building_longitude,
             b.operating_hours_weekday_start as building_weekday_start,
             b.operating_hours_weekday_end as building_weekday_end,
             b.operating_hours_weekend_start as building_weekend_start,
             b.operating_hours_weekend_end as building_weekend_end,
             (SELECT COUNT(*) FROM bookings bk WHERE bk.space_id = s.space_id) as popularity_score
      FROM study_spaces s
      JOIN buildings b ON s.building_id = b.building_id
      JOIN campuses c ON b.campus_id = c.campus_id
      ${whereClause}
      ORDER BY popularity_score DESC
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

    const result = await pool.query(dataQuery, dataParams);

    res.status(200).json({
      success: true,
      data: {
        spaces: result.rows.map(formatSpace),
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

exports.getStats = async (req, res) => {
  try {
    const query = `
      SELECT
        COUNT(*) as total_spaces,
        COUNT(CASE WHEN status = 'Available' THEN 1 END) as available,
        COUNT(CASE WHEN status = 'Maintenance' THEN 1 END) as maintenance,
        COUNT(CASE WHEN status = 'Deleted' THEN 1 END) as deleted
      FROM study_spaces
    `;
    const result = await pool.query(query);
    const row = result.rows[0];
    
    res.status(200).json({
        success: true,
        data: {
          totalSpaces: parseInt(row.total_spaces),
          available: parseInt(row.available),
          maintenance: parseInt(row.maintenance),
          deleted: parseInt(row.deleted)
        }
    });
  } catch (err) {
    console.error('Get Stats Error:', err);
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
};

exports.searchSpaces = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const userId = req.user?.userId || req.query.userId; 

    if (!q) {
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Search query 'q' is required" } });
    }

    const keyword = `%${q}%`;
    
    const query = `
      SELECT s.*, b.building_name, b.campus_id, c.campus_name,
             b.latitude as building_latitude, b.longitude as building_longitude,
             b.operating_hours_weekday_start as building_weekday_start,
             b.operating_hours_weekday_end as building_weekday_end,
             b.operating_hours_weekend_start as building_weekend_start,
             b.operating_hours_weekend_end as building_weekend_end
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
  const dateStr = toIstanbulDate(dateObj);
  const dayOfWeek = dateObj.getDay(); // 0: Pazar, 6: Cumartesi
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let startStr, endStr;

  if (isWeekend) {
    startStr = space.operating_hours_weekend_start || space.building_weekend_start;
    endStr = space.operating_hours_weekend_end || space.building_weekend_end;
  } else {
    startStr = space.operating_hours_weekday_start || space.building_weekday_start;
    endStr = space.operating_hours_weekday_end || space.building_weekday_end;
  }

  // If still no operating hours, the space is closed on this day
  if (!startStr || !endStr) return { date: dateStr, slots: [], closed: true };

  // Check if space is in maintenance
  const isInMaintenance = space.status === 'Maintenance';

  const slots = [];
  
  // Parse start/end times into total minutes from midnight
  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);
  
  const startMin = startH * 60 + (startM || 0);
  let endMin = endH * 60 + (endM || 0);
  if (endH === 23 && endM === 59) endMin = 1440; // Treat 23:59 as end of day

  let currentMin = startMin;
  while (currentMin < endMin) {
    const slotStartTotal = currentMin;
    const slotEndTotal = currentMin + 15;

    const hour = Math.floor(slotStartTotal / 60);
    const min = slotStartTotal % 60;
    const nextHour = Math.floor(slotEndTotal / 60);
    const nextMin = slotEndTotal % 60;

    const slotStartStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    const slotEndStr = `${nextHour.toString().padStart(2, '0')}:${nextMin.toString().padStart(2, '0')}`;
    
    // If in maintenance, mark all slots as booked
    let isBooked = isInMaintenance;
    
    // Otherwise, check regular bookings
    if (!isBooked) {
      isBooked = bookings.some(b => {
        const bStart = new Date(b.start_time);
        const bEnd = new Date(b.end_time);
        
        if (toIstanbulDate(bStart) !== dateStr) return false;

        const { hour: trStartHour, minute: trStartMinute } = getIstanbulHourMinute(bStart);
        const { hour: trEndHour, minute: trEndMinute } = getIstanbulHourMinute(bEnd);

        const bStartTotal = trStartHour * 60 + trStartMinute; 
        const bEndTotal = trEndHour * 60 + trEndMinute;

        return (bStartTotal < slotEndTotal) && (bEndTotal > slotStartTotal);
      });
    }

    slots.push({
      start: slotStartStr,
      end: slotEndStr,
      available: !isBooked
    });

    currentMin += 15;
  }

  return { date: dateStr, slots, closed: slots.length === 0 };
};


// 2. DETAY GETİRME 
exports.getSpaceById = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT s.*, 
             b.building_name, b.campus_id,
             b.latitude as building_latitude, b.longitude as building_longitude,
             b.operating_hours_weekday_start as building_weekday_start,
             b.operating_hours_weekday_end as building_weekday_end,
             b.operating_hours_weekend_start as building_weekend_start,
             b.operating_hours_weekend_end as building_weekend_end,
             c.campus_name
      FROM study_spaces s
      JOIN buildings b ON s.building_id = b.building_id
      JOIN campuses c ON b.campus_id = c.campus_id
      WHERE s.space_id = $1
    `;

    const bookingsQuery = `
      SELECT start_time, end_time 
      FROM bookings 
      WHERE space_id = $1 
      AND status = 'Confirmed'
      AND start_time >= CURRENT_DATE
      AND end_time < CURRENT_DATE + INTERVAL '2 days'
    `;

    const [spaceResult, bookingsResult] = await Promise.all([
      pool.query(query, [id]),
      pool.query(bookingsQuery, [id])
    ]);
    
    if (spaceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Space not found" } });
    }

    const spaceRow = spaceResult.rows[0];
    const spaceData = formatSpace(spaceRow);

    const today = getIstanbulNow();
    const tomorrow = addDays(today, 1);

    const availabilityData = [
      generateDailySlots(today, spaceRow, bookingsResult.rows),
      generateDailySlots(tomorrow, spaceRow, bookingsResult.rows)
    ];

    const currentStatus = spaceRow.status === 'Available' ? 'Available' : 'Unavailable';
    
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
    const query = `
      SELECT s.*,
             b.operating_hours_weekday_start as building_weekday_start,
             b.operating_hours_weekday_end as building_weekday_end,
             b.operating_hours_weekend_start as building_weekend_start,
             b.operating_hours_weekend_end as building_weekend_end
      FROM study_spaces s
      JOIN buildings b ON s.building_id = b.building_id
      WHERE s.space_id = $1
    `;
    const spaceCheck = await pool.query(query, [id]);
    
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

    // 0. Validations
    if (body.capacity < 1 || body.capacity > 100) {
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Capacity must be between 1 and 100." } });
    }

    // 1. Unique Room in Building Check
    const uniqueCheck = await pool.query(
      'SELECT 1 FROM study_spaces WHERE building_id = $1 AND room_number = $2 AND status != \'Deleted\'',
      [body.buildingId, body.roomNumber]
    );
    if (uniqueCheck.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: "DUPLICATE_ROOM", 
          message: `Room number '${body.roomNumber}' already exists in the selected building. Please enter a different room number.` 
        } 
      });
    }

    const query = `
      INSERT INTO study_spaces (
        building_id, space_name, room_number, floor, capacity, 
        room_type, noise_level, description, amenities, 
        accessibility_features, status,
        operating_hours_weekday_start, operating_hours_weekday_end,
        operating_hours_weekend_start, operating_hours_weekend_end,
        created_by
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Available', $11, $12, $13, $14, $15) 
      RETURNING *`;
    
    const values = [
      body.buildingId, 
      body.spaceName, 
      body.roomNumber || 'Z-00', 
      body.floor || 0, 
      body.capacity, 
      body.roomType, 
      body.noise_level || body.noiseLevel || 'Quiet',
      body.description, 
      JSON.stringify(body.amenities || []),
      JSON.stringify(body.accessibilityFeatures || []),
      weekdayStart, weekdayEnd, weekendStart, weekendEnd,
      req.user?.userId || null
    ];

    const newSpace = await pool.query(query, values);

    // Audit Log: Space_Created
    await logAuditEvent({
      userId: req.user?.userId || null,
      actionType: 'Space_Created',
      targetEntityType: 'Space',
      targetEntityId: newSpace.rows[0].space_id,
      ipAddress: req.ip || req.connection.remoteAddress,
      result: 'Success',
      afterState: formatSpace(newSpace.rows[0])
    });

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
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentResult = await client.query('SELECT * FROM study_spaces WHERE space_id = $1', [id]);
    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Space to be updated not found." } });
    }
    const current = currentResult.rows[0];

    const weekdayStart = body.operatingHours?.weekday?.start || body.operating_hours_weekday_start || current.operating_hours_weekday_start;
    const weekdayEnd = body.operatingHours?.weekday?.end || body.operating_hours_weekday_end || current.operating_hours_weekday_end;
    const weekendStart = body.operatingHours?.weekend?.start !== undefined ? body.operatingHours.weekend.start : (body.operating_hours_weekend_start || current.operating_hours_weekend_start);
    const weekendEnd = body.operatingHours?.weekend?.end !== undefined ? body.operatingHours.weekend.end : (body.operating_hours_weekend_end || current.operating_hours_weekend_end);

    // 0. Validation: Capacity
    const finalCapacity = body.capacity !== undefined ? body.capacity : current.capacity;
    if (finalCapacity < 1 || finalCapacity > 100) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Capacity must be between 1 and 100." } });
    }

    // 1. Validation: Unique Room in Building (if changed)
    const finalBuildingId = body.buildingId !== undefined ? body.buildingId : current.building_id;
    const finalRoomNumber = body.roomNumber !== undefined ? body.roomNumber : current.room_number;
    
    if (finalBuildingId !== current.building_id || finalRoomNumber !== current.room_number) {
      const uniqueCheck = await client.query(
        'SELECT 1 FROM study_spaces WHERE building_id = $1 AND room_number = $2 AND space_id != $3 AND status != \'Deleted\'',
        [finalBuildingId, finalRoomNumber, id]
      );
      if (uniqueCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: "DUPLICATE_ROOM", 
            message: `Room number '${finalRoomNumber}' already exists in the selected building. Please enter a different room number.` 
          } 
        });
      }
    }

    // Status validation
    const finalStatus = body.status !== undefined ? body.status : current.status;

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
        status = $14,
        building_id = $15,
        updated_at = CURRENT_TIMESTAMP
      WHERE space_id = $16
      RETURNING *
    `;

    const values = [
      body.spaceName !== undefined ? body.spaceName : current.space_name, 
      body.roomNumber !== undefined ? body.roomNumber : current.room_number,
      body.floor !== undefined ? body.floor : current.floor, 
      body.capacity !== undefined ? body.capacity : current.capacity, 
      body.roomType !== undefined ? body.roomType : current.room_type, 
      body.noiseLevel !== undefined ? body.noiseLevel : current.noise_level, 
      body.description !== undefined ? body.description : current.description, 
      body.amenities !== undefined ? JSON.stringify(body.amenities) : current.amenities,
      body.accessibilityFeatures !== undefined ? JSON.stringify(body.accessibilityFeatures) : current.accessibility_features,
      weekdayStart, weekdayEnd, weekendStart, weekendEnd,
      finalStatus,
      finalBuildingId,
      id
    ];

    const result = await client.query(query, values);
    const updatedSpace = result.rows[0];

    // Handle Maintenance Cancellations - cancel ALL future bookings if status is Maintenance
    let affectedBookings = [];
    if (finalStatus === 'Maintenance') {
      const now = getIstanbulNow();
      // Find all future confirmed bookings for this space
      affectedBookings = await bookingModel.findFutureBySpaceIdWithUser(id, now, client);

      if (affectedBookings.length > 0) {
        const cancelQuery = `
          UPDATE bookings
          SET status = 'Cancelled',
              cancelled_at = CURRENT_TIMESTAMP,
              cancellation_reason = 'Space_Maintenance'
          WHERE space_id = $1
            AND status = 'Confirmed'
            AND start_time > $2
        `;
        await client.query(cancelQuery, [id, now]);
      }
    }

    await client.query('COMMIT');

    // Audit Log: Space_Updated
    await logAuditEvent({
      userId: req.user?.userId || null,
      actionType: 'Space_Updated',
      targetEntityType: 'Space',
      targetEntityId: updatedSpace.space_id,
      ipAddress: req.ip || req.connection.remoteAddress,
      result: 'Success',
      beforeState: formatSpace(current),
      afterState: formatSpace(updatedSpace)
    });

    // 4. Send Notification Emails (Async)
    if (affectedBookings.length > 0) {
      Promise.all(affectedBookings.map(async (booking) => {
        try {
          if (booking.user.emailVerified && booking.user.notificationPreferences?.emailNotifications !== false) {
            const fullBooking = await bookingModel.findByIdWithSpace(booking.bookingId);
            if (fullBooking) {
              fullBooking.cancellationReason = 'Space_Maintenance';
              await emailService.sendBookingCancellationEmail({
                to: booking.user.email,
                fullName: booking.user.fullName,
                booking: fullBooking
              });
            }
          }
        } catch (emailErr) {
          console.error(`Failed to send maintenance cancellation email for booking ${booking.bookingId}:`, emailErr);
        }
      })).catch(err => console.error('Error in batch maintenance email processing:', err));
    }

    res.status(200).json({
      success: true,
      message: affectedBookings.length > 0 
        ? `Space updated successfully. ${affectedBookings.length} overlapping bookings were cancelled due to maintenance.` 
        : "Space updated successfully",
      data: formatSpace(updatedSpace)
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, error: { code: "UPDATE_ERROR", message: err.message } });
  } finally {
    if (client) client.release();
  }
};

// 5. MEKAN SİLME 
exports.deleteSpace = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get upcoming bookings for this space BEFORE deleting
    // We need user info for emails later
    const upcomingBookings = await bookingModel.findUpcomingBySpaceIdWithUser(id, client);

    // 2. Soft delete the space
    const deleteSpaceQuery = `
      UPDATE study_spaces 
      SET status = 'Deleted', deleted_at = CURRENT_TIMESTAMP 
      WHERE space_id = $1 
      RETURNING space_id, status
    `;
    const deleteResult = await client.query(deleteSpaceQuery, [id]);

    if (deleteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Space to be deleted not found." } });
    }

    // 3. Cancel all upcoming bookings
    if (upcomingBookings.length > 0) {
      const cancelBookingsQuery = `
        UPDATE bookings
        SET status = 'Cancelled', 
            cancelled_at = CURRENT_TIMESTAMP, 
            cancellation_reason = 'Administrative'
        WHERE space_id = $1 
          AND status = 'Confirmed'
          AND start_time > NOW()
      `;
      await client.query(cancelBookingsQuery, [id]);
    }

    await client.query('COMMIT');

    // 4. Audit Log: Space_Deleted
    await logAuditEvent({
      userId: req.user?.userId || null,
      actionType: 'Space_Deleted',
      targetEntityType: 'Space',
      targetEntityId: deleteResult.rows[0].space_id,
      ipAddress: req.ip || req.connection.remoteAddress,
      result: 'Success',
      afterState: { status: 'Deleted', deletedAt: formatInTimeZone(getIstanbulNow(), 'Europe/Istanbul', "yyyy-MM-dd'T'HH:mm:ssXXX") }
    });

    // 5. Send Cancellation Emails (Async, outside transaction)
    if (upcomingBookings.length > 0) {
      // Background email sending
      Promise.all(upcomingBookings.map(async (booking) => {
        try {
          // If the user has email notifications enabled
          if (booking.user.emailVerified && booking.user.notificationPreferences?.emailNotifications !== false) {
            const fullBooking = await bookingModel.findByIdWithSpace(booking.bookingId);
            if (fullBooking) {
              // Set the cancellation reason to Administrative for the email
              fullBooking.cancellationReason = 'Administrative';
              await emailService.sendBookingCancellationEmail({
                to: booking.user.email,
                fullName: booking.user.fullName,
                booking: fullBooking
              });
            }
          }
        } catch (emailErr) {
          console.error(`Failed to send cancellation email for booking ${booking.bookingId}:`, emailErr);
        }
      })).catch(err => console.error('Error in batch email processing:', err));
    }

    res.status(200).json({
      success: true,
      message: `Space deleted successfully. ${upcomingBookings.length} upcoming bookings were cancelled and users notified.`,
      data: deleteResult.rows[0]
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, error: { code: "DELETE_ERROR", message: err.message } });
  } finally {
    if (client) client.release();
  }
};

exports.getFilterOptions = async (req, res) => {
  try {
    const campusesQuery = 'SELECT campus_id, campus_name FROM campuses ORDER BY campus_name';
    const buildingsQuery = 'SELECT building_id, building_name, campus_id FROM buildings ORDER BY building_name';
    const roomTypesQuery = 'SELECT DISTINCT room_type FROM study_spaces WHERE status != \'Deleted\' AND room_type IS NOT NULL';
    const noiseLevelsQuery = 'SELECT DISTINCT noise_level FROM study_spaces WHERE status != \'Deleted\' AND noise_level IS NOT NULL';

    const [campusesRes, buildingsRes, roomTypesRes, noiseLevelsRes] = await Promise.all([
      pool.query(campusesQuery),
      pool.query(buildingsQuery),
      pool.query(roomTypesQuery),
      pool.query(noiseLevelsQuery)
    ]);

    res.status(200).json({
      success: true,
      data: {
        campuses: campusesRes.rows,
        buildings: buildingsRes.rows,
        roomTypes: roomTypesRes.rows.map(r => r.room_type),
        noiseLevels: noiseLevelsRes.rows.map(r => r.noise_level)
      }
    });
  } catch (err) {
    console.error("Filter Options Error:", err);
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
};