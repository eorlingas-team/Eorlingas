const {
  ISTANBUL_TZ,
  getIstanbulNow,
  toIstanbulDate,
  toIstanbulTime,
  parseIstanbulDateTime,
  getIstanbulDateRange,
  isOnIstanbulDate,
  getIstanbulHourMinute
} = require('../utils/dateHelpers');

describe('Date Helpers', () => {

  describe('ISTANBUL_TZ', () => {
    test('should be Europe/Istanbul', () => {
      expect(ISTANBUL_TZ).toBe('Europe/Istanbul');
    });
  });

  describe('getIstanbulNow', () => {
    test('should return a Date object', () => {
      const result = getIstanbulNow();
      expect(result).toBeInstanceOf(Date);
    });

    test('should return a date close to current time', () => {
      const before = Date.now();
      const result = getIstanbulNow();
      const after = Date.now();
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('toIstanbulDate', () => {
    test('should convert Date to YYYY-MM-DD format', () => {
      const date = new Date('2025-06-15T14:30:00Z');
      const result = toIstanbulDate(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('should accept string input', () => {
      const result = toIstanbulDate('2025-06-15T14:30:00Z');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('should handle UTC midnight correctly', () => {
      // UTC midnight on Jan 1 is 03:00 in Istanbul (UTC+3)
      const date = new Date('2025-01-01T00:00:00Z');
      const result = toIstanbulDate(date);
      expect(result).toBe('2025-01-01');
    });

    test('should handle late night UTC that crosses to next day in Istanbul', () => {
      // 23:00 UTC on Dec 31 is 02:00 Jan 1 in Istanbul (UTC+3)
      const date = new Date('2024-12-31T23:00:00Z');
      const result = toIstanbulDate(date);
      expect(result).toBe('2025-01-01');
    });
  });

  describe('toIstanbulTime', () => {
    test('should convert Date to HH:mm format', () => {
      const date = new Date('2025-06-15T14:30:00Z');
      const result = toIstanbulTime(date);
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    test('should accept string input', () => {
      const result = toIstanbulTime('2025-06-15T14:30:00Z');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    test('should add 3 hours for Istanbul timezone (standard time)', () => {
      // Note: This test might need adjustment during DST
      const date = new Date('2025-01-15T10:00:00Z');
      const result = toIstanbulTime(date);
      expect(result).toBe('13:00'); // UTC+3 in winter
    });
  });

  describe('parseIstanbulDateTime', () => {
    test('should parse date and time strings to UTC Date', () => {
      const result = parseIstanbulDateTime('2025-06-15', '14:30');
      expect(result).toBeInstanceOf(Date);
    });

    test('should correctly convert Istanbul time to UTC', () => {
      // 14:30 Istanbul time (UTC+3) = 11:30 UTC
      const result = parseIstanbulDateTime('2025-01-15', '14:30');
      expect(result.getUTCHours()).toBe(11);
      expect(result.getUTCMinutes()).toBe(30);
    });

    test('should handle midnight correctly', () => {
      const result = parseIstanbulDateTime('2025-01-15', '00:00');
      // 00:00 Istanbul = 21:00 UTC previous day
      expect(result.getUTCHours()).toBe(21);
      expect(result.getUTCDate()).toBe(14);
    });
  });

  describe('getIstanbulDateRange', () => {
    test('should return object with startDate and endDate', () => {
      const result = getIstanbulDateRange();
      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('endDate');
    });

    test('should return dates in YYYY-MM-DD format', () => {
      const result = getIstanbulDateRange();
      expect(result.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('should default to 14 days', () => {
      const result = getIstanbulDateRange();
      const start = new Date(result.startDate);
      const end = new Date(result.endDate);
      const diffDays = (end - start) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(14);
    });

    test('should accept custom number of days', () => {
      const result = getIstanbulDateRange(7);
      const start = new Date(result.startDate);
      const end = new Date(result.endDate);
      const diffDays = (end - start) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(7);
    });

    test('should handle 0 days', () => {
      const result = getIstanbulDateRange(0);
      expect(result.startDate).toBe(result.endDate);
    });
  });

  describe('isOnIstanbulDate', () => {
    test('should return true when dates match', () => {
      const bookingStart = new Date('2025-01-15T10:00:00Z');
      const targetDate = toIstanbulDate(bookingStart);
      const result = isOnIstanbulDate(bookingStart, targetDate);
      expect(result).toBe(true);
    });

    test('should return false when dates do not match', () => {
      const bookingStart = new Date('2025-01-15T10:00:00Z');
      const result = isOnIstanbulDate(bookingStart, '2025-01-16');
      expect(result).toBe(false);
    });

    test('should accept string input for bookingStart', () => {
      const result = isOnIstanbulDate('2025-01-15T10:00:00Z', '2025-01-15');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getIstanbulHourMinute', () => {
    test('should return object with hour and minute', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const result = getIstanbulHourMinute(date);
      expect(result).toHaveProperty('hour');
      expect(result).toHaveProperty('minute');
    });

    test('should return numbers', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const result = getIstanbulHourMinute(date);
      expect(typeof result.hour).toBe('number');
      expect(typeof result.minute).toBe('number');
    });

    test('should accept string input', () => {
      const result = getIstanbulHourMinute('2025-01-15T10:30:00Z');
      expect(result).toHaveProperty('hour');
      expect(result).toHaveProperty('minute');
    });

    test('should correctly convert to Istanbul time', () => {
      // 10:30 UTC = 13:30 Istanbul (UTC+3)
      const date = new Date('2025-01-15T10:30:00Z');
      const result = getIstanbulHourMinute(date);
      expect(result.hour).toBe(13);
      expect(result.minute).toBe(30);
    });

    test('should handle midnight UTC', () => {
      // 00:00 UTC = 03:00 Istanbul
      const date = new Date('2025-01-15T00:00:00Z');
      const result = getIstanbulHourMinute(date);
      expect(result.hour).toBe(3);
      expect(result.minute).toBe(0);
    });
  });
});
