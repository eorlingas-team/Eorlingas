const pool = require('../config/db');
const crypto = require('crypto');

/**
 * Hash token using SHA-256
 * @param {string} token 
 * @returns {string} Hashed token
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

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
      'verification_code',
      'verification_token_expiry',
      'password_reset_token',
      'password_reset_token_expiry',
      'refresh_token',
      'last_login',
      'notification_preferences',
      'suspended_until',
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
    const hashedToken = hashToken(token);
    const result = await pool.query(
      'SELECT * FROM users WHERE verification_token = $1',
      [hashedToken]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding user by verification token:', error);
    throw error;
  }
};

/**
 * Set verification token and code for user
 * @param {number} userId
 * @param {string} token - Verification token
 * @param {string} code - 6-digit verification code
 * @param {Date} expiryDate - Token expiry date
 */
const setVerificationToken = async (userId, token, code, expiryDate) => {
  try {
    const hashedToken = hashToken(token);
    await pool.query(
      'UPDATE users SET verification_token = $1, verification_code = $2, verification_token_expiry = $3 WHERE user_id = $4',
      [hashedToken, code, expiryDate, userId]
    );
  } catch (error) {
    console.error('Error setting verification token:', error);
    throw error;
  }
};

/**
 * Clear verification token and code after successful verification
 * @param {number} userId
 */
const clearVerificationToken = async (userId) => {
  try {
    await pool.query(
      'UPDATE users SET verification_token = NULL, verification_code = NULL, verification_token_expiry = NULL WHERE user_id = $1',
      [userId]
    );
  } catch (error) {
    console.error('Error clearing verification token:', error);
    throw error;
  }
};

/**
 * Find user by email and verification code
 * @param {string} email - User email
 * @param {string} code - Verification code
 * @returns {Object|null} User object or null
 */
const findByEmailAndCode = async (email, code) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND verification_code = $2',
      [email.toLowerCase(), code]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding user by email and code:', error);
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

/**
 * Find user by password reset token
 * @param {string} token - Password reset token
 * @returns {Object|null} User object or null
 */
const findByPasswordResetToken = async (token) => {
  try {
    const hashedToken = hashToken(token);
    const result = await pool.query(
      'SELECT * FROM users WHERE password_reset_token = $1',
      [hashedToken]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding user by password reset token:', error);
    throw error;
  }
};

/**
 * Set password reset token for user
 * @param {number} userId
 * @param {string} token - Password reset token
 * @param {Date} expiryDate - Token expiry date
 */
const setPasswordResetToken = async (userId, token, expiryDate) => {
  try {
    const hashedToken = hashToken(token);
    await pool.query(
      'UPDATE users SET password_reset_token = $1, password_reset_token_expiry = $2 WHERE user_id = $3',
      [hashedToken, expiryDate, userId]
    );
  } catch (error) {
    console.error('Error setting password reset token:', error);
    throw error;
  }
};

/**
 * Clear password reset token after successful reset
 * @param {number} userId
 */
const clearPasswordResetToken = async (userId) => {
  try {
    await pool.query(
      'UPDATE users SET password_reset_token = NULL, password_reset_token_expiry = NULL WHERE user_id = $1',
      [userId]
    );
  } catch (error) {
    console.error('Error clearing password reset token:', error);
    throw error;
  }
};

/**
 * Set refresh token for user
 * @param {number} userId
 * @param {string} refreshToken - Refresh token
 */
const setRefreshToken = async (userId, refreshToken) => {
  try {
    await pool.query(
      'UPDATE users SET refresh_token = $1 WHERE user_id = $2',
      [refreshToken, userId]
    );
  } catch (error) {
    console.error('Error setting refresh token:', error);
    throw error;
  }
};

/**
 * Clear refresh token (invalidate on logout)
 * @param {number} userId
 */
const clearRefreshToken = async (userId) => {
  try {
    await pool.query(
      'UPDATE users SET refresh_token = NULL WHERE user_id = $1',
      [userId]
    );
  } catch (error) {
    console.error('Error clearing refresh token:', error);
    throw error;
  }
};

/**
 * Check if refresh token is valid (matches stored token)
 * @param {number} userId
 * @param {string} refreshToken - Refresh token to check
 * @returns {boolean} True if token matches
 */
const isRefreshTokenValid = async (userId, refreshToken) => {
  try {
    const result = await pool.query(
      'SELECT refresh_token FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return false;
    }
    
    const storedToken = result.rows[0].refresh_token;
    return storedToken === refreshToken;
  } catch (error) {
    console.error('Error checking refresh token:', error);
    return false;
  }
};

module.exports = {
  findByEmail,
  findById,
  create,
  update,
  updateLastLogin,
  findByVerificationToken,
  findByEmailAndCode,
  setVerificationToken,
  clearVerificationToken,
  getRecentFailedLoginAttempts,
  findByPasswordResetToken,
  setPasswordResetToken,
  clearPasswordResetToken,
  setRefreshToken,
  clearRefreshToken,
  isRefreshTokenValid,
};

