import helmet from 'helmet';

// Configure security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net"
      ],
      fontSrc: [
        "'self'", 
        "https://fonts.gstatic.com",
        "data:"
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "'unsafe-eval'",
        "https://ajax.googleapis.com",
        "https://d3e54v103j8qbb.cloudfront.net",
        "https://cdn.jsdelivr.net",
        "https://cdn.voiceflow.com",
        "https://www.googletagmanager.com",
        "https://www.google.com",
        "https://cdn.embedly.com",
        "https://vercel.live", // Allow Vercel Live Preview feedback scripts
        "https://*.vercel.live" // Allow Vercel Live Preview subdomains
      ],
      connectSrc: [
        "'self'",
        "https://general-runtime.voiceflow.com",
        "https://www.google-analytics.com",
        "https://*.voiceflow.com",
        "https://cdn.jsdelivr.net"
      ],
      frameSrc: [
        "'self'",
        "https://www.youtube.com",
        "https://youtube.com",
        "https://cdn.embedly.com",
        "https://www.google.com"
      ],
      mediaSrc: ["'self'", "https:", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for compatibility
  // Only force HTTPS in production. On a plain-HTTP localhost dev server, sending
  // Strict-Transport-Security makes the browser upgrade all requests to
  // https://localhost, which then fail with a TLS error.
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  frameguard: {
    action: 'sameorigin', // Allow same-origin iframes
  },
});





