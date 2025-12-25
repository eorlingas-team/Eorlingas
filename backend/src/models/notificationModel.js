const pool = require('../config/db');

/**
 * Format notification row from database to API format
 * @param {Object} row - Database row
 * @returns {Object} Formatted notification object
 */
const formatNotification = (row) => {
  return {
    notificationId: row.notification_id,
    userId: row.user_id,
    bookingId: row.booking_id,
    type: row.notification_type,
    subject: row.subject,
    message: row.message,
    status: row.status,
    isRead: row.is_read,
    relatedEntityId: row.related_entity_id,
    relatedEntityType: row.related_entity_type,
    relatedData: row.related_data,
    createdAt: row.created_at,
  };
};

/**
 * Create a new notification
 * @param {Object} data 
 * @returns {Object} Created notification
 */
const create = async (data) => {
  const {
    userId,
    bookingId = null,
    type,
    subject,
    message,
    relatedEntityId = null,
    relatedEntityType = null,
    relatedData = null
  } = data;

  const result = await pool.query(
    `INSERT INTO notifications (
      user_id, booking_id, notification_type, subject, message, 
      related_entity_id, related_entity_type, related_data, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Sent')
    RETURNING *`,
    [userId, bookingId, type, subject, message, relatedEntityId, relatedEntityType, relatedData]
  );

  return formatNotification(result.rows[0]);
};

/**
 * Find notifications by user ID
 * @param {number} userId 
 * @param {Object} options 
 * @returns {Array} List of notifications
 */
const findByUserId = async (userId, { limit = 50, offset = 0 } = {}) => {
  const result = await pool.query(
    `SELECT * FROM notifications 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return result.rows.map(formatNotification);
};

/**
 * Get unread count for a user
 * @param {number} userId 
 * @returns {number} Unread count
 */
const countUnread = async (userId) => {
  const result = await pool.query(
    'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
};

/**
 * Mark a notification as read
 * @param {number} notificationId 
 * @param {number} userId 
 * @returns {Object|null} Updated notification
 */
const markAsRead = async (notificationId, userId) => {
  const result = await pool.query(
    `UPDATE notifications 
     SET is_read = TRUE 
     WHERE notification_id = $1 AND user_id = $2 
     RETURNING *`,
    [notificationId, userId]
  );

  return result.rows.length > 0 ? formatNotification(result.rows[0]) : null;
};

/**
 * Mark all notifications as read for a user
 * @param {number} userId 
 */
const markAllAsRead = async (userId) => {
  await pool.query(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
    [userId]
  );
};

module.exports = {
  create,
  findByUserId,
  countUnread,
  markAsRead,
  markAllAsRead
};
