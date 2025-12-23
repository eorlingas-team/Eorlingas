const pool = require('../config/db');

/**
 * Helper function to log audit events
 * @param {Object} logData - Audit log data
 * @param {number|null} logData.userId - ID of the user performing the action (or affected user)
 * @param {string} logData.actionType - Type of action (must match audit_action_type enum)
 * @param {string} logData.targetEntityType - Type of entity affected (e.g., 'User', 'Space', 'Booking')
 * @param {number|null} logData.targetEntityId - ID of the entity affected
 * @param {string|null} logData.ipAddress - IP address of the user
 * @param {Object|null} logData.beforeState - State before the action
 * @param {Object|null} logData.afterState - State after the action
 * @param {string} [logData.result='Success'] - Result of the action ('Success' or 'Failed')
 * @param {string|null} logData.errorMessage - Error message if failed
 */
const logAuditEvent = async (logData) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (
        user_id, action_type, target_entity_type, target_entity_id,
        ip_address, before_state, after_state, result, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        logData.userId || null,
        logData.actionType,
        logData.targetEntityType,
        logData.targetEntityId || null,
        logData.ipAddress || null,
        logData.beforeState ? JSON.stringify(logData.beforeState) : null,
        logData.afterState ? JSON.stringify(logData.afterState) : null,
        logData.result || 'Success',
        logData.errorMessage || null,
      ]
    );
  } catch (error) {
    console.error('Error logging audit event:', error);
  }
};

module.exports = logAuditEvent;
