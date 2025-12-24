
import { format, addDays } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

const ISTANBUL_TZ = 'Europe/Istanbul';

/**
 * Get today's date in Istanbul timezone (YYYY-MM-DD)
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export const getTodayIstanbul = () => {
  const now = toZonedTime(new Date(), ISTANBUL_TZ);
  return format(now, 'yyyy-MM-dd');
};

/**
 * Get current Istanbul time
 * @returns {Date} Current time in Istanbul timezone
 */
export const getIstanbulNow = () => {
  return toZonedTime(new Date(), ISTANBUL_TZ);
};

/**
 * Get date range starting from today in Istanbul timezone
 * @param {number} days - Number of days to include
 * @returns {{ startDate: string, endDate: string }} Date range in YYYY-MM-DD format
 */
export const getDateRangeIstanbul = (days = 14) => {
  const now = toZonedTime(new Date(), ISTANBUL_TZ);
  const startDate = format(now, 'yyyy-MM-dd');
  const endDate = format(addDays(now, days), 'yyyy-MM-dd');
  return { startDate, endDate };
};

/**
 * Create an ISO datetime string from Istanbul date and time
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {string} timeStr - Time in HH:mm format
 * @returns {string} ISO string in UTC
 */
export const createIstanbulDateTime = (dateStr, timeStr) => {
  const istanbulDateTimeStr = `${dateStr}T${timeStr}:00`;
  // Parse as Istanbul time, convert to UTC
  const utcDate = fromZonedTime(new Date(istanbulDateTimeStr), ISTANBUL_TZ);
  return utcDate.toISOString();
};

/**
 * Formats a date string or object to DD/MM/YYYY format
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  
  return formatInTimeZone(d, ISTANBUL_TZ, 'dd/MM/yyyy');
};

/**
 * Formats a date string or object to DD/MM/YYYY HH:mm format (Istanbul time)
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date & time string
 */
export const formatDateTime = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  
  return formatInTimeZone(d, ISTANBUL_TZ, 'dd/MM/yyyy HH:mm');
};

/**
 * Formats a date string or object to HH:mm format (Istanbul time)
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted time string
 */
export const formatTime = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  
  return formatInTimeZone(d, ISTANBUL_TZ, 'HH:mm');
};
