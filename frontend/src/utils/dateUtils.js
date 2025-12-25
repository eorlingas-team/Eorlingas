
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
  return new Date();
};

/**
 * Get Istanbul hour and minute from a Date
 * @param {Date|string} date - Date to extract time from
 * @returns {{ hour: number, minute: number }} Hour and minute in Istanbul time
 */
export const getIstanbulHourMinute = (date) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const timeStr = formatInTimeZone(d, ISTANBUL_TZ, 'HH:mm');
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour, minute };
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
  let targetTimeStr = timeStr;
  let addDay = false;

  if (timeStr === '24:00') {
    targetTimeStr = '00:00';
    addDay = true;
  }

  const istanbulDateTimeStr = `${dateStr}T${targetTimeStr}:00`;
  // Parse as Istanbul time, convert to UTC
  let utcDate = fromZonedTime(new Date(istanbulDateTimeStr), ISTANBUL_TZ);
  
  if (addDay) {
    utcDate = addDays(utcDate, 1);
  }

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
