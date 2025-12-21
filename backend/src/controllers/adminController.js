const db = require('../config/db');
const bcrypt = require('bcrypt');

// İstatistikleri Getir 
exports.getSystemStats = async (req, res) => {
  try {
    
    const [userCounts, spaceCounts, bookingCounts] = await Promise.all([
      db.query('SELECT COUNT(*) as total FROM users'),
      db.query('SELECT COUNT(*) as total FROM study_spaces'),
      db.query('SELECT COUNT(*) as total FROM bookings')
    ]);

    // Detaylı istatistikler 
    
    const stats = {
      totalUsers: parseInt(userCounts.rows[0].total),
      totalSpaces: parseInt(spaceCounts.rows[0].total),
      totalBookings: parseInt(bookingCounts.rows[0].total),
    
      activeUsers: parseInt(userCounts.rows[0].total), 
      availableSpaces: parseInt(spaceCounts.rows[0].total),
      recentActivity: {
        newUsersLast7Days: 0, 
        newBookingsLast7Days: 0 
      }
    };

    res.status(200).json({
      success: true,
      data: { statistics: stats }
    });

  } catch (error) {
    console.error('Stats Error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'İstatistikler alınamadı.' }
    });
  }
};

// 2. Tüm Kullanıcıları Listele (Filtreleme ile)
exports.getAllUsers = async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Dinamik sorgu oluşturma
    let queryText = 'SELECT user_id, email, full_name, student_number, phone_number, role, status, registration_date, last_login FROM users WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    if (role) {
      queryText += ` AND role = $${paramIndex}`;
      queryParams.push(role);
      paramIndex++;
    }

    if (status) {
      queryText += ` AND status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    if (search) {
      queryText += ` AND (full_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Sıralama ve Sayfalama ekle
    queryText += ` ORDER BY user_id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await db.query(queryText, queryParams);
    
   
    const countResult = await db.query('SELECT COUNT(*) FROM users');

    res.status(200).json({
      success: true,
      data: {
        users: result.rows, 
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count)
        }
      }
    });

  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Kullanıcılar listelenemedi.' }
    });
  }
};

//  Kullanıcı Üzerinde Yönetici İşlemi 
exports.updateUser = async (req, res) => {
  const userId = req.params.id;
  const { action, params } = req.body; 

  try {
    let queryText = '';
    let queryParams = [];


    switch (action) {
      case 'changeRole':
        queryText = 'UPDATE users SET role = $1 WHERE user_id = $2 RETURNING *';
        queryParams = [params.role, userId];
        break;

      case 'suspend':
       
        queryText = 'UPDATE users SET status = $1 WHERE user_id = $2 RETURNING *';
        queryParams = ['Suspended', userId];
        break;

      case 'restore':
        queryText = 'UPDATE users SET status = $1 WHERE user_id = $2 RETURNING *';
        queryParams = ['Verified', userId];
        break;
      
      case 'resetPassword':
        // Geçici şifre oluştur 
        const tempPass = 'Itu12345';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(tempPass, salt);
        
        queryText = 'UPDATE users SET password_hash = $1 WHERE user_id = $2 RETURNING *';
        queryParams = [hash, userId];
        break;

      default:
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Geçersiz aksiyon türü.' }
        });
    }

    
    const result = await db.query(queryText, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Kullanıcı bulunamadı.' } });
    }

    res.status(200).json({
      success: true,
      message: 'Kullanıcı güncellendi.',
      data: { user: result.rows[0] }
    });

  } catch (error) {
    console.error('Update User Error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'İşlem başarısız oldu.' }
    });
  }
};

// --- ADMIN SPACE YÖNETİMİ ---

// Tüm Mekanları Getir 
exports.getAllSpacesAdmin = async (req, res) => {
  try {
    const { campus, building, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let queryText = `
      SELECT s.*, b.building_name, c.campus_name 
      FROM study_spaces s
      JOIN buildings b ON s.building_id = b.building_id
      JOIN campuses c ON b.campus_id = c.campus_id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    // Filtreler
    if (campus) {
      queryText += ` AND c.campus_name ILIKE $${paramIndex}`;
      queryParams.push(`%${campus}%`);
      paramIndex++;
    }
    if (building) {
      queryText += ` AND b.building_name ILIKE $${paramIndex}`;
      queryParams.push(`%${building}%`);
      paramIndex++;
    }
    if (status) {
      queryText += ` AND s.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Sıralama ve Sayfalama
    queryText += ` ORDER BY s.space_id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await db.query(queryText, queryParams);
    const countResult = await db.query('SELECT COUNT(*) FROM study_spaces');

    res.status(200).json({
      success: true,
      data: {
        spaces: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count)
        }
      }
    });

  } catch (error) {
    console.error('Admin Get Spaces Error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Mekanlar alınamadı.' } });
  }
};

//  Yeni Mekan Oluştur 
exports.createSpace = async (req, res) => {
  const client = await db.connect(); 
  try {
    await client.query('BEGIN'); 

    const { 
      buildingId, spaceName, roomNumber, floor, capacity, 
      roomType, noiseLevel, description, amenities, 
      operatingHours, accessibilityFeatures 
    } = req.body;

    // Oda numarası çakışma kontrolü 
    const checkQuery = 'SELECT * FROM study_spaces WHERE building_id = $1 AND room_number = $2';
    const checkResult = await client.query(checkQuery, [buildingId, roomNumber]);

    if (checkResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        success: false, 
        error: { code: 'DUPLICATE_ENTRY', message: 'Bu binada bu oda numarası zaten var.' } 
      });
    }

    const insertQuery = `
      INSERT INTO study_spaces (
        building_id, space_name, room_number, floor, capacity, 
        room_type, noise_level, description, amenities, 
        operating_hours, accessibility_features, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Available')
      RETURNING *
    `;

    const values = [
      buildingId, spaceName, roomNumber, floor, capacity, 
      roomType, noiseLevel, description, amenities, 
      operatingHours, accessibilityFeatures
    ];

    const result = await client.query(insertQuery, values);
    
   

    await client.query('COMMIT'); 

    res.status(201).json({
      success: true,
      message: 'Mekan başarıyla oluşturuldu.',
      data: { space: result.rows[0] }
    });

  } catch (error) {
    await client.query('ROLLBACK'); 
    console.error('Create Space Error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Mekan oluşturulamadı.' } });
  } finally {
    client.release();
  }
};

//  Mekan Güncelle
exports.updateSpace = async (req, res) => {
  const spaceId = req.params.id;
  const updates = req.body;

  try {
 
 
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Güncellenecek veri yok.' });
    }

   
    const setClause = fields.map((field, index) => {
     
      const dbField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      return `${dbField} = $${index + 1}`;
    }).join(', ');

    const queryText = `UPDATE study_spaces SET ${setClause}, updated_at = NOW() WHERE space_id = $${fields.length + 1} RETURNING *`;
    
    const result = await db.query(queryText, [...values, spaceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Mekan bulunamadı.' } });
    }

    res.status(200).json({
      success: true,
      message: 'Mekan güncellendi.',
      data: { space: result.rows[0] }
    });

  } catch (error) {
    console.error('Update Space Error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Güncelleme başarısız.' } });
  }
};

// Mekan Statüsü Değiştir 
exports.updateSpaceStatus = async (req, res) => {
  const spaceId = req.params.id;
  const { status, maintenanceStartDate, maintenanceEndDate } = req.body; 

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Mekanı güncelle
    const updateQuery = `
      UPDATE study_spaces 
      SET status = $1, maintenance_start_date = $2, maintenance_end_date = $3, updated_at = NOW()
      WHERE space_id = $4
      RETURNING *
    `;
    const result = await client.query(updateQuery, [status, maintenanceStartDate, maintenanceEndDate, spaceId]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Mekan bulunamadı.' } });
    }

    let cancelledCount = 0;

    
    if (status === 'Maintenance' || status === 'Deleted') {
      const cancelQuery = `
        UPDATE bookings 
        SET status = 'Cancelled', cancellation_reason = 'Space_Maintenance'
        WHERE space_id = $1 AND status = 'Confirmed' AND start_time >= NOW()
      `;
  
      
      const cancelResult = await client.query(cancelQuery, [spaceId]);
      cancelledCount = cancelResult.rowCount;
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Mekan durumu güncellendi.',
      data: { 
        space: result.rows[0],
        cancelledBookingsCount: cancelledCount
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Status Update Error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Durum güncellenemedi.' } });
  } finally {
    client.release();
  }
};

//  Mekan Sil 
exports.deleteSpaceAdmin = async (req, res) => {

  req.body.status = 'Deleted';
  req.body.maintenanceStartDate = null;
  req.body.maintenanceEndDate = null;
  return exports.updateSpaceStatus(req, res);
};

// --- AUDIT LOGS (DENETİM KAYITLARI) ---

// Denetim Kayıtlarını Getir 
exports.getAuditLogs = async (req, res) => {
  try {
    const { dateFrom, dateTo, actionType, userId, targetEntityType, result, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let queryText = `
      SELECT a.*, u.email, u.full_name, u.role 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.user_id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    // Filtreler
    if (dateFrom) {
      queryText += ` AND a.timestamp >= $${paramIndex}`;
      queryParams.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      queryText += ` AND a.timestamp <= $${paramIndex}`;
      queryParams.push(dateTo);
      paramIndex++;
    }
    if (actionType) {
      queryText += ` AND a.action_type = $${paramIndex}`;
      queryParams.push(actionType);
      paramIndex++;
    }
    if (userId) {
      queryText += ` AND a.user_id = $${paramIndex}`;
      queryParams.push(userId);
      paramIndex++;
    }
    if (targetEntityType) {
      queryText += ` AND a.target_entity_type = $${paramIndex}`;
      queryParams.push(targetEntityType);
      paramIndex++;
    }
    if (result) {
      queryText += ` AND a.result = $${paramIndex}`;
      queryParams.push(result);
      paramIndex++;
    }

    // Sıralama ve Sayfalama
    queryText += ` ORDER BY a.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const resultData = await db.query(queryText, queryParams);
    
    // Toplam kayıt sayısı 
   
    const countResult = await db.query('SELECT COUNT(*) FROM audit_logs');

    res.status(200).json({
      success: true,
      data: {
        logs: resultData.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count)
        }
      }
    });

  } catch (error) {
    console.error('Get Audit Logs Error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Kayıtlar alınamadı.' } });
  }
};

//  Audit Logları Dışa Aktar 
exports.exportAuditLogs = async (req, res) => {
  try {
    const { format = 'json', filters = {} } = req.body; 
    const { dateFrom, dateTo, actionType, userId } = filters;

    let queryText = `
      SELECT a.log_id, a.action_type, a.user_id, u.email, a.target_entity_type, 
             a.target_entity_id, a.result, a.timestamp, a.ip_address 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.user_id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    
    if (dateFrom) { queryText += ` AND a.timestamp >= $${paramIndex}`; queryParams.push(dateFrom); paramIndex++; }
    if (dateTo) { queryText += ` AND a.timestamp <= $${paramIndex}`; queryParams.push(dateTo); paramIndex++; }
    if (actionType) { queryText += ` AND a.action_type = $${paramIndex}`; queryParams.push(actionType); paramIndex++; }
    if (userId) { queryText += ` AND a.user_id = $${paramIndex}`; queryParams.push(userId); paramIndex++; }

    queryText += ` ORDER BY a.timestamp DESC LIMIT 1000`; // Güvenlik için max 1000 

    const dbResult = await db.query(queryText, queryParams);
    const logs = dbResult.rows;

    if (format.toLowerCase() === 'csv') {
     
      const fields = ['log_id', 'action_type', 'email', 'target_entity_type', 'result', 'timestamp', 'ip_address'];
      const header = fields.join(',');
      const rows = logs.map(row => {
        return fields.map(field => {
          const val = row[field] ? String(row[field]).replace(/,/g, ';') : ''; 
          return val;
        }).join(',');
      });
      
      const csvContent = [header, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      return res.status(200).send(csvContent);
    } else {
     
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.json"');
      return res.status(200).json(logs);
    }

  } catch (error) {
    console.error('Export Error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Export başarısız.' } });
  }
};