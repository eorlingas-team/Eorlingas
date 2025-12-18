const db = require('../config/db');
const bcrypt = require('bcrypt');

// İstatistikleri Getir (Dashboard için)
exports.getSystemStats = async (req, res) => {
  try {
    
    const [userCounts, spaceCounts, bookingCounts] = await Promise.all([
      db.query('SELECT COUNT(*) as total FROM users'),
      db.query('SELECT COUNT(*) as total FROM study_spaces'),
      db.query('SELECT COUNT(*) as total FROM bookings')
    ]);

    // Detaylı istatistikler (Aktif kullanıcılar, onaylı rezervasyonlar vb.)
    
    const stats = {
      totalUsers: parseInt(userCounts.rows[0].total),
      totalSpaces: parseInt(spaceCounts.rows[0].total),
      totalBookings: parseInt(bookingCounts.rows[0].total),
      // Şimdilik dummy (sabit) veriler, ileride detaylı sorgu yazılabilir
      activeUsers: parseInt(userCounts.rows[0].total), 
      availableSpaces: parseInt(spaceCounts.rows[0].total),
      recentActivity: {
        newUsersLast7Days: 0, // İleride eklenecek
        newBookingsLast7Days: 0 // İleride eklenecek
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

//  Kullanıcı Üzerinde Yönetici İşlemi (Banlama, Rol Değiştirme)
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
        // Kullanıcıyı suspend et (İleride aktif rezervasyonlarını iptal eden kod buraya eklenecek)
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