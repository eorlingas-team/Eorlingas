/**
 * Validation schemas for request validation
 * Simple validation functions (can be replaced with Joi or similar library later)
 */

/**
 * Validate email format and domain
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
const isValidEmail = (email) => {
  const emailRegex = /^[A-Za-z0-9._%+-]+@itu\.edu\.tr$/i;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} { valid: boolean, message?: string }
 */
const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }

  return { valid: true };
};

/**
 * Validate student number format
 * @param {string} studentNumber
 * @returns {boolean} True if valid
 */
const isValidStudentNumber = (studentNumber) => {
  if (!studentNumber) return true;
  const trimmed = String(studentNumber).trim();
  return /^\d{6,12}$/.test(trimmed);
};

/**
 * Validate phone number format
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} True if valid
 */
const isValidPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return true;
  
  const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
  
  const internationalFormat = /^\+\d{1,3}\d{7,15}$/;
  
  const turkishWithCountryCode = /^\+90[5]\d{9}$/;
  
  const turkishWithZero = /^0[5]\d{9}$/;
  
  const turkishDirect = /^[5]\d{9}$/;
  
  return (
    internationalFormat.test(cleaned) ||
    turkishWithCountryCode.test(cleaned) ||
    turkishWithZero.test(cleaned) ||
    turkishDirect.test(cleaned)
  );
};

/**
 * Validate registration request
 * @param {Object} data - Registration data
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
const validateRegistration = (data) => {
  const errors = [];

  if (!data.email || !isValidEmail(data.email)) {
    errors.push('Valid ITU email address (@itu.edu.tr) is required');
  }

  if (!data.password) {
    errors.push('Password is required');
  } else {
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      errors.push(passwordValidation.message);
    }
  }

  if (data.password !== data.passwordConfirmation) {
    errors.push('Passwords do not match');
  }

  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters long');
  }

  if (data.studentNumber && !isValidStudentNumber(data.studentNumber)) {
    errors.push('Invalid student number format');
  }

  if (data.phoneNumber && !isValidPhoneNumber(data.phoneNumber)) {
    errors.push('Invalid phone number format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate login request
 * @param {Object} data - Login data
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
const validateLogin = (data) => {
  const errors = [];

  if (!data.email || !isValidEmail(data.email)) {
    errors.push('Valid ITU email address is required');
  }

  if (!data.password) {
    errors.push('Password is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate profile update request
 * @param {Object} data - Profile update data
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
const validateProfileUpdate = (data) => {
  const errors = [];

  if (data.fullName !== undefined) {
    if (!data.fullName || typeof data.fullName !== 'string') {
      errors.push('Full name must be a non-empty string');
    } else {
      const trimmed = data.fullName.trim();
      if (trimmed.length === 0) {
        errors.push('Full name cannot be empty');
      } else if (trimmed.length > 255) {
        errors.push('Full name must be at most 255 characters long');
      }
    }
  }

  if (data.phoneNumber !== undefined && data.phoneNumber !== null) {
    if (data.phoneNumber !== '' && !isValidPhoneNumber(data.phoneNumber)) {
      errors.push('Invalid phone number format');
    }
  }

  if (data.notificationPreferences !== undefined) {
    if (
      typeof data.notificationPreferences !== 'object' ||
      data.notificationPreferences === null
    ) {
      errors.push('notificationPreferences must be an object');
    } else {
      if (
        data.notificationPreferences.emailNotifications !== undefined &&
        typeof data.notificationPreferences.emailNotifications !== 'boolean'
      ) {
        errors.push('emailNotifications must be a boolean');
      }

      if (
        data.notificationPreferences.webNotifications !== undefined &&
        typeof data.notificationPreferences.webNotifications !== 'boolean'
      ) {
        errors.push('webNotifications must be a boolean');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate password change request
 * @param {Object} data - Password change data
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
const validatePasswordChange = (data) => {
  const errors = [];

  if (!data.currentPassword) {
    errors.push('Current password is required');
  }

  if (!data.newPassword) {
    errors.push('New password is required');
  } else {
    const passwordValidation = validatePassword(data.newPassword);
    if (!passwordValidation.valid) {
      errors.push(passwordValidation.message);
    }
  }

  if (data.newPassword !== data.newPasswordConfirmation) {
    errors.push('New passwords do not match');
  }

  if (data.currentPassword === data.newPassword) {
    errors.push('New password must be different from current password');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate forgot password request
 * @param {Object} data - Forgot password data
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
const validateForgotPassword = (data) => {
  const errors = [];

  if (!data.email || !isValidEmail(data.email)) {
    errors.push('Valid ITU email address is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate reset password request
 * @param {Object} data - Reset password data
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
const validateResetPassword = (data) => {
  const errors = [];

  if (!data.token) {
    errors.push('Reset token is required');
  }

  if (!data.newPassword) {
    errors.push('New password is required');
  } else {
    const passwordValidation = validatePassword(data.newPassword);
    if (!passwordValidation.valid) {
      errors.push(passwordValidation.message);
    }
  }

  if (data.newPassword !== data.confirmPassword) {
    errors.push('New passwords do not match');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate booking creation request
 * @param {Object} data - Booking data
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
const validateBookingRequest = (data) => {
  const errors = [];

  if (!data.spaceId || typeof data.spaceId !== 'number') {
    errors.push('Valid spaceId is required');
  }

  if (!data.startTime) {
    errors.push('startTime is required');
  } else {
    const startTime = new Date(data.startTime);
    if (isNaN(startTime.getTime())) {
      errors.push('Invalid startTime format (must be ISO 8601)');
    } else {
      if (startTime <= new Date()) {
        errors.push('startTime must be in the future');
      }

      const maxDaysAhead = 14;
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + maxDaysAhead);
      if (startTime > maxDate) {
        errors.push(`startTime must be within ${maxDaysAhead} days`);
      }
    }
  }

  if (!data.endTime) {
    errors.push('endTime is required');
  } else {
    const endTime = new Date(data.endTime);
    if (isNaN(endTime.getTime())) {
      errors.push('Invalid endTime format (must be ISO 8601)');
    } else {
      const startTime = new Date(data.startTime);
      if (endTime <= startTime) {
        errors.push('endTime must be after startTime');
      }

      const durationMinutes = (endTime - startTime) / (1000 * 60);
      if (durationMinutes < 60) {
        errors.push('Booking duration must be at least 60 minutes');
      }
      if (durationMinutes > 180) {
        errors.push('Booking duration must be at most 180 minutes');
      }
    }
  }

  if (data.purpose !== undefined && data.purpose !== null) {
    if (typeof data.purpose !== 'string') {
      errors.push('purpose must be a string');
    } else if (data.purpose.length > 500) {
      errors.push('purpose must be at most 500 characters');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate booking cancellation request
 * @param {Object} data - Cancellation data
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
const validateBookingCancellation = (data) => {
  const errors = [];

  if (data.reason !== undefined && data.reason !== null) {
    const validReasons = ['User_Requested', 'Administrative', 'Space_Maintenance'];
    if (!validReasons.includes(data.reason)) {
      errors.push(`reason must be one of: ${validReasons.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

module.exports = {
  isValidEmail,
  validatePassword,
  isValidStudentNumber,
  isValidPhoneNumber,
  validateRegistration,
  validateLogin,
  validateProfileUpdate,
  validatePasswordChange,
  validateForgotPassword,
  validateResetPassword,
  validateBookingRequest,
  validateBookingCancellation,
};

