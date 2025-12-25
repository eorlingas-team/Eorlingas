const notificationModel = require('../models/notificationModel');
const userModel = require('../models/userModel');

/**
 * Create a new in-app notification if user has web notifications enabled
 * @param {number} userId 
 * @param {string} type 
 * @param {Object} data 
 */
const createNotification = async (userId, type, data) => {
  try {
    const user = await userModel.findById(userId);
    if (!user) return null;

    // Check preferences - default to true if not set
    const prefs = user.notification_preferences || {};
    const webNotifEnabled = prefs.webNotifications !== false;

    if (!webNotifEnabled) {
      console.log(`[NotificationService] Web notifications disabled for user ${userId}. Skipping.`);
      return null;
    }

    const notificationData = {
      userId,
      type,
      subject: data.subject,
      message: data.message,
      bookingId: data.bookingId || null,
      relatedEntityId: data.relatedEntityId || null,
      relatedEntityType: data.relatedEntityType || null,
      relatedData: data.relatedData || null
    };

    return await notificationModel.create(notificationData);
  } catch (error) {
    console.error('[NotificationService] Error creating notification:', error);
    // Don't throw, we don't want to break the main flow if notification fails
    return null;
  }
};

/**
 * Get user's notifications
 * @param {number} userId 
 * @param {Object} query 
 */
const getUserNotifications = async (userId, query = {}) => {
  const limit = parseInt(query.limit) || 20;
  const offset = parseInt(query.offset) || 0;
  
  const notifications = await notificationModel.findByUserId(userId, { limit, offset });
  const unreadCount = await notificationModel.countUnread(userId);

  return {
    notifications,
    unreadCount,
    pagination: {
      limit,
      offset
    }
  };
};

/**
 * Mark a notification as read
 * @param {number} notificationId 
 * @param {number} userId 
 */
const markAsRead = async (notificationId, userId) => {
  return await notificationModel.markAsRead(notificationId, userId);
};

/**
 * Mark all notifications as read
 * @param {number} userId 
 */
const markAllAsRead = async (userId) => {
  await notificationModel.markAllAsRead(userId);
  return { success: true };
};

/**
 * Get unread count
 * @param {number} userId 
 */
const getUnreadCount = async (userId) => {
  const count = await notificationModel.countUnread(userId);
  return { unreadCount: count };
};

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount
};
