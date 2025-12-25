module.exports = {
  toZonedTime: jest.fn((date) => date),
  fromZonedTime: jest.fn((date) => date),
  formatInTimeZone: jest.fn(() => '2025-01-01 00:00:00'),
};
