import { body, param, query, validationResult } from 'express-validator';

// XSS sanitization helper
const sanitizeInput = (value) => {
  if (typeof value !== 'string') return value;
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log validation errors for monitoring
    const errorDetails = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value ? '[REDACTED]' : undefined
    }));

    req.logger?.warn('Validation failed', {
      errors: errorDetails,
      ip: req.ip,
      userId: req.user?.id
    });

    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

// Enhanced input sanitization middleware
export const sanitizeBody = (req, res, next) => {
  // Recursively sanitize string values in request body
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeInput(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  next();
};

export const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email must be valid and less than 254 characters'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required and must be less than 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
];

export const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

export const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('A valid email is required'),
];

export const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
];

export const applicationValidation = [
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  body('middleName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Middle name must be less than 50 characters')
    .matches(/^[a-zA-Z\s'-]*$/)
    .withMessage('Middle name can only contain letters, spaces, hyphens, and apostrophes'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Valid email is required and must be less than 254 characters'),
  body('phone')
    .trim()
    .isLength({ min: 7, max: 30 })
    .withMessage('Valid phone number is required'),
  body('dateOfBirth')
    .isISO8601()
    .withMessage('Valid date of birth is required')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 5 || age > 25) {
        throw new Error('Age must be between 5 and 25 years');
      }
      return true;
    }),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  body('gender')
    .optional()
    .trim()
    .isIn(['Male', 'Female', 'Other', 'Prefer not to say'])
    .withMessage('Invalid gender value'),
  body('religion')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Religion must be less than 100 characters'),
  body('nationality')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Nationality must be less than 100 characters'),
  body('yearsOfResidence')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Years of residence must be a number between 0 and 100'),
  body('previousSchool')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Previous school name must be less than 200 characters'),
  body('gradeApplying')
    .optional()
    .isInt({ min: 1, max: 13 })
    .withMessage('Grade applying must be between 1 and 13'),
];

export const sixthFormValidation = [
  ...applicationValidation, // Include all application validations
  body('positionsHeld').optional().trim().isLength({ max: 1000 }).withMessage('Positions held must be less than 1000 characters'),
  body('guardianInfo').optional().isObject().withMessage('Guardian info must be a valid object'),
  body('careerGoals').optional().trim().isLength({ max: 2000 }).withMessage('Career goals must be less than 2000 characters'),
  body('strengthsWeaknesses').optional().trim().isLength({ max: 2000 }).withMessage('Strengths and weaknesses must be less than 2000 characters'),
  body('reasonForAttending').optional().trim().isLength({ max: 2000 }).withMessage('Reason for attending must be less than 2000 characters'),
  body('csecResults')
    .optional()
    .custom(val => Array.isArray(val) || (typeof val === 'object' && val !== null))
    .withMessage('CSEC results must be a valid array or object'),
  body('subjectChoices')
    .isObject()
    .withMessage('Subject choices are required'),
];

// Validation for a student editing their own sixth form application.
// All fields are optional (PUT may send a partial record) and `email` is
// intentionally omitted — it stays tied to the login account and is never editable.
export const sixthFormUpdateValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be less than 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  body('middleName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Middle name must be less than 50 characters')
    .matches(/^[a-zA-Z\s'-]*$/)
    .withMessage('Middle name can only contain letters, spaces, hyphens, and apostrophes'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be less than 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  body('phone')
    .optional()
    .trim()
    .isLength({ min: 7, max: 30 })
    .withMessage('Valid phone number is required'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Valid date of birth is required')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 5 || age > 25) {
        throw new Error('Age must be between 5 and 25 years');
      }
      return true;
    }),
  body('address').optional().trim().isLength({ max: 500 }).withMessage('Address must be less than 500 characters'),
  body('gender').optional().trim().isIn(['Male', 'Female', 'Other', 'Prefer not to say']).withMessage('Invalid gender value'),
  body('religion').optional().trim().isLength({ max: 100 }).withMessage('Religion must be less than 100 characters'),
  body('nationality').optional().trim().isLength({ max: 100 }).withMessage('Nationality must be less than 100 characters'),
  body('yearsOfResidence').optional().isInt({ min: 0, max: 100 }).withMessage('Years of residence must be a number between 0 and 100'),
  body('previousSchool').optional().trim().isLength({ max: 200 }).withMessage('Previous school name must be less than 200 characters'),
  body('positionsHeld').optional().trim().isLength({ max: 1000 }).withMessage('Positions held must be less than 1000 characters'),
  body('guardianInfo').optional().isObject().withMessage('Guardian info must be a valid object'),
  body('careerGoals').optional().trim().isLength({ max: 2000 }).withMessage('Career goals must be less than 2000 characters'),
  body('strengthsWeaknesses').optional().trim().isLength({ max: 2000 }).withMessage('Strengths and weaknesses must be less than 2000 characters'),
  body('reasonForAttending').optional().trim().isLength({ max: 2000 }).withMessage('Reason for attending must be less than 2000 characters'),
  body('csecResults')
    .optional()
    .custom(val => Array.isArray(val) || (typeof val === 'object' && val !== null))
    .withMessage('CSEC results must be a valid array or object'),
  body('subjectChoices').optional().isObject().withMessage('Subject choices must be a valid object'),
  // Names which of the account's applications to save when siblings share a login.
  body('applicationId').optional().isUUID().withMessage('Invalid application reference'),
];

export const sixthFormBulkNotifyValidation = [
  body('applicationIds')
    .isArray({ min: 1 })
    .withMessage('applicationIds must be a non-empty array'),
  body('applicationIds.*')
    .isUUID()
    .withMessage('Each applicationId must be a valid UUID'),
  body('type')
    .isIn(['INTERVIEW_INVITATION', 'CXC_RESULTS_RELEASED', 'CUSTOM'])
    .withMessage('Invalid notification type'),
  body('subject')
    .if(body('type').equals('CUSTOM'))
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Subject is required for a custom announcement (max 200 characters)'),
  body('message')
    .if(body('type').equals('CUSTOM'))
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message is required for a custom announcement (max 5000 characters)'),
];

export const userUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be less than 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email format required'),
  body('phone')
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage('Valid phone number format required'),
];

export const blogValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must be less than 200 characters'),
  body('slug')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Slug is required and must be less than 100 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
  body('content')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Content is required'),
  body('excerpt')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Excerpt must be less than 500 characters'),
];

export const requestValidation = [
  body('type')
    .isIn(['DOCUMENT', 'DEVICE', 'LAB', 'GENERAL'])
    .withMessage('Invalid request type'),
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must be less than 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
];

export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

export const idValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
];





