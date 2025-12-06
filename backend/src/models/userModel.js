const pool = require('../config/db');

/**
 * Find user by email
 * @param {string} email
 * @returns {Object|null} User object or null
 */
const findByEmail = async (email) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    throw error;
  }
};

/**
 * Find user by ID
 * @param {number} userId
 * @returns {Object|null} User object or null
 */
const findById = async (userId) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding user by ID:', error);
    throw error;
  }
};

/**
 * Create new user
 * @param {Object} userData
 * @param {string} userData.email
 * @param {string} userData.passwordHash
 * @param {string} userData.fullName
 * @param {string} userData.studentNumber
 * @param {string} [userData.phoneNumber]
 * @param {string} [userData.role]
 * @param {string} [userData.status]
 * @returns {Object} Created user object
 */
const create = async (userData) => {
  try {
    const {
      email,
      passwordHash,
      fullName,
      studentNumber,
      phoneNumber,
      role = 'Student',
      status = 'Unverified',
    } = userData;

    const result = await pool.query(
      `INSERT INTO users (
        email, password_hash, full_name, student_number, phone_number, role, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        email.toLowerCase(),
        passwordHash,
        fullName,
        studentNumber || null,
        phoneNumber || null,
        role,
        status,
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Update user
 * @param {number} userId
 * @param {Object} updates Fields to update
 * @returns {Object} Updated user object
 */
const update = async (userId, updates) => {
  try {
    const allowedFields = [
      'email',
      'password_hash',
      'full_name',
      'student_number',
      'phone_number',
      'role',
      'status',
      'email_verified',
      'verification_token',
      'verification_token_expiry',
      'last_login',
      'notification_preferences',
    ];

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (key === 'notification_preferences') {
          updateFields.push(`${dbKey} = $${paramIndex}::jsonb`);
        } else {
          updateFields.push(`${dbKey} = $${paramIndex}`);
        }
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(userId);

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

/**
 * Update user's last login timestamp
 * @param {number} userId
 */
const updateLastLogin = async (userId) => {
  try {
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );
  } catch (error) {
    console.error('Error updating last login:', error);
    throw error;
  }
};

/**
 * Find user by verification token
 * @param {string} token - Verification token
 * @returns {Object|null} User object or null
 */
const findByVerificationToken = async (token) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE verification_token = $1',
      [token]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding user by verification token:', error);
    throw error;
  }
};

/**
 * Set verification token for user
 * @param {number} userId
 * @param {string} token - Verification token
 * @param {Date} expiryDate - Token expiry date
 */
const setVerificationToken = async (userId, token, expiryDate) => {
  try {
    await pool.query(
      'UPDATE users SET verification_token = $1, verification_token_expiry = $2 WHERE user_id = $3',
      [token, expiryDate, userId]
    );
  } catch (error) {
    console.error('Error setting verification token:', error);
    throw error;
  }
};

/**
 * Clear verification token after successful verification
 * @param {number} userId
 */
const clearVerificationToken = async (userId) => {
  try {
    await pool.query(
      'UPDATE users SET verification_token = NULL, verification_token_expiry = NULL WHERE user_id = $1',
      [userId]
    );
  } catch (error) {
    console.error('Error clearing verification token:', error);
    throw error;
  }
};

/**
 * Get count of failed login attempts in the last 15 minutes
 * @param {number} userId
 * @returns {number} Count of failed attempts
 */
const getRecentFailedLoginAttempts = async (userId) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM audit_logs
       WHERE user_id = $1
         AND action_type = 'Login_Failed'
         AND result = 'Failed'
         AND timestamp > NOW() - INTERVAL '15 minutes'`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error('Error getting failed login attempts:', error);
    throw error;
  }
};

module.exports = {
  findByEmail,
  findById,
  create,
  update,
  updateLastLogin,
  findByVerificationToken,
  setVerificationToken,
  clearVerificationToken,
  getRecentFailedLoginAttempts,
};

