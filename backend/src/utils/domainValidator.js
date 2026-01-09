/**
 * Domain Validator Utility
 * Validates email domains against allowed whitelist
 */

/**
 * Get allowed email domains from environment variable
 * @returns {string[]} Array of allowed domains
 */
export function getAllowedDomains() {
  const domains = process.env.ALLOWED_EMAIL_DOMAINS || 'moeschools.edu.jm,yorkcastlehighschool.org';
  return domains.split(',').map(domain => domain.trim().toLowerCase());
}

/**
 * Extract domain from email address
 * @param {string} email - Email address
 * @returns {string|null} Domain or null if invalid email
 */
export function extractDomain(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }
  
  const parts = email.toLowerCase().trim().split('@');
  if (parts.length !== 2) {
    return null;
  }
  
  return parts[1];
}

/**
 * Validate if email domain is in allowed list
 * @param {string} email - Email address to validate
 * @returns {boolean} True if domain is allowed
 */
export function isAllowedDomain(email) {
  const domain = extractDomain(email);
  if (!domain) {
    return false;
  }
  
  const allowedDomains = getAllowedDomains();
  return allowedDomains.includes(domain);
}

/**
 * Validate email domain and return error message if invalid
 * @param {string} email - Email address to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateEmailDomain(email) {
  if (!email || typeof email !== 'string') {
    return {
      valid: false,
      error: 'Email is required',
    };
  }
  
  const domain = extractDomain(email);
  if (!domain) {
    return {
      valid: false,
      error: 'Invalid email format',
    };
  }
  
  if (!isAllowedDomain(email)) {
    const allowedDomains = getAllowedDomains();
    return {
      valid: false,
      error: `Email domain must be one of: ${allowedDomains.join(', ')}`,
    };
  }
  
  return { valid: true };
}
