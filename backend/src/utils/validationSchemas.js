const Joi = require('joi');

/**
 * Helper to format Joi error to match existing interface
 * @param {Object} schema - Joi schema
 * @param {Object} data - Data to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
const validateWithJoi = (schema, data) => {
  const { error } = schema.validate(data, { abortEarly: false });
  if (!error) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: error.details.map(detail => detail.message.replace(/"/g, ''))
  };
};

// --- Schemas ---

const registrationSchema = Joi.object({
  email: Joi.string().email().pattern(/@itu\.edu\.tr$/).required().messages({
    'string.pattern.base': 'Valid ITU email address (@itu.edu.tr) is required'
  }),
  password: Joi.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  }),
  passwordConfirmation: Joi.any().valid(Joi.ref('password')).required().messages({
    'any.only': 'Passwords do not match'
  }),
  fullName: Joi.string().trim().min(2).max(255).required(),
  studentNumber: Joi.string().trim().pattern(/^\d{6,12}$/).allow(null, '').optional(),
  phoneNumber: Joi.string().trim().pattern(/^(\+?\d{1,3})?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?$/).allow(null, '').optional(), // Simplified generic phone regex or use custom
  role: Joi.string().valid('Student', 'Academician').optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const profileUpdateSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(255).optional(),
  phoneNumber: Joi.string().trim().pattern(/^(\+?\d{1,3})?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?$/).allow(null, '').optional(),
  notificationPreferences: Joi.object({
    emailNotifications: Joi.boolean().optional(),
    webNotifications: Joi.boolean().optional()
  }).optional()
});

const passwordChangeSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).disallow(Joi.ref('currentPassword')).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    'any.invalid': 'New password must be different from current password'
  }),
  newPasswordConfirmation: Joi.any().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'New passwords do not match'
  })
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).required(),
  confirmPassword: Joi.any().valid(Joi.ref('newPassword')).required()
});

const bookingRequestSchema = Joi.object({
  spaceId: Joi.number().integer().required(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
  purpose: Joi.string().max(500).allow(null, '').optional(),
  attendeeCount: Joi.number().integer().min(1).optional()
});

const bookingCancellationSchema = Joi.object({
  reason: Joi.string().valid('User_Requested', 'Administrative', 'Space_Maintenance').optional()
});

// --- Exports with Adapter ---

module.exports = {
  isValidEmail: (email) => !Joi.string().email().pattern(/@itu\.edu\.tr$/).validate(email).error,
  isValidGenericEmail: (email) => !Joi.string().email().validate(email).error,
  isValidStudentNumber: (sn) => !Joi.string().pattern(/^\d{6,12}$/).validate(sn).error,
  isValidPhoneNumber: (pn) => !Joi.string().pattern(/^(\+?\d{1,3})?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?$/).validate(pn).error,
  validatePassword: (pw) => {
    const { error } = Joi.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).validate(pw);
    return { valid: !error, message: error ? error.details[0].message : undefined };
  },
  
  validateRegistration: (data) => validateWithJoi(registrationSchema, data),
  validateLogin: (data) => validateWithJoi(loginSchema, data),
  validateProfileUpdate: (data) => validateWithJoi(profileUpdateSchema, data),
  validatePasswordChange: (data) => validateWithJoi(passwordChangeSchema, data),
  validateForgotPassword: (data) => validateWithJoi(forgotPasswordSchema, data),
  validateResetPassword: (data) => validateWithJoi(resetPasswordSchema, data),
  validateBookingRequest: (data) => validateWithJoi(bookingRequestSchema, data),
  validateBookingCancellation: (data) => validateWithJoi(bookingCancellationSchema, data)
};
