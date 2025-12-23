/**
 * Date/Time Helpers for Istanbul Timezone
 * All date operations should use these helpers for consistent timezone handling
 */

const { format, parse, addDays, startOfDay } = require('date-fns');
const { toZonedTime, fromZonedTime, formatInTimeZone } = require('date-fns-tz');

const ISTANBUL_TZ = 'Europe/Istanbul';

/**
 * Get the current time in Istanbul timezone
 * @returns {Date} Current Istanbul time as a Date object
 */
const getIstanbulNow = () => {
  return toZonedTime(new Date(), ISTANBUL_TZ);
};

/**
 * Convert a Date to Istanbul date string (YYYY-MM-DD)
 * @param {Date|string} date - Date to convert
 * @returns {string} Date string in YYYY-MM-DD format (Istanbul time)
 */
const toIstanbulDate = (date) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, ISTANBUL_TZ, 'yyyy-MM-dd');
};

/**
 * Convert a Date to Istanbul time string (HH:mm)
 * @param {Date|string} date - Date to convert
 * @returns {string} Time string in HH:mm format (Istanbul time)
 */
const toIstanbulTime = (date) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, ISTANBUL_TZ, 'HH:mm');
};

/**
 * Parse date and time strings as Istanbul time and return UTC Date
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {string} timeStr - Time in HH:mm format
 * @returns {Date} UTC Date object
 */
const parseIstanbulDateTime = (dateStr, timeStr) => {
  const istanbulDateTimeStr = `${dateStr}T${timeStr}:00`;
  // Parse as Istanbul time, get UTC equivalent
  return fromZonedTime(new Date(istanbulDateTimeStr), ISTANBUL_TZ);
};

/**
 * Get date range starting from today in Istanbul timezone
 * @param {number} days - Number of days to include
 * @returns {{ startDate: string, endDate: string }} Date range in YYYY-MM-DD format
 */
const getIstanbulDateRange = (days = 14) => {
  const now = getIstanbulNow();
  const startDate = toIstanbulDate(now);
  const endDate = toIstanbulDate(addDays(now, days));
  return { startDate, endDate };
};

/**
 * Check if a booking's Istanbul date matches the target date
 * @param {Date|string} bookingStart - Booking start time (UTC)
 * @param {string} targetDateStr - Target date in YYYY-MM-DD format (Istanbul)
 * @returns {boolean} True if booking is on the target date
 */
const isOnIstanbulDate = (bookingStart, targetDateStr) => {
  return toIstanbulDate(bookingStart) === targetDateStr;
};

/**
 * Get Istanbul hour and minute from a Date
 * @param {Date|string} date - Date to extract time from
 * @returns {{ hour: number, minute: number }} Hour and minute in Istanbul time
 */
const getIstanbulHourMinute = (date) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const timeStr = formatInTimeZone(d, ISTANBUL_TZ, 'HH:mm');
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour, minute };
};

module.exports = {
  ISTANBUL_TZ,
  getIstanbulNow,
  toIstanbulDate,
  toIstanbulTime,
  parseIstanbulDateTime,
  getIstanbulDateRange,
  isOnIstanbulDate,
  getIstanbulHourMinute
};
