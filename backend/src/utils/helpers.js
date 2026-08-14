export const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

// Pull a human-friendly requester name/contact out of a request's metadata or
// linked user. Public submissions have no user row, so the name lives in
// metadata.studentInfo as written by doc-request.html.
export const extractRequester = (request) => {
  const student = request.metadata?.studentInfo;
  const name =
    request.user?.name ||
    [student?.firstName, student?.middleName, student?.lastName].filter(Boolean).join(' ') ||
    'Unknown';
  const email = request.user?.email || student?.email || null;
  const phone = student?.phone || student?.phoneNumber || null;
  return { name, email, phone };
};

// Build the public-facing base URL for the site (used in email links).
// Prioritizes explicit env config, then derives from the sending email domain,
// and finally falls back to the incoming request host (for local development).
export const getBaseUrl = (req) => {
  let baseUrl = process.env.FRONTEND_URL || process.env.APP_URL;

  if (!baseUrl) {
    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM;
    if (fromEmail && fromEmail.includes('@')) {
      const emailDomain = fromEmail.split('@')[1];
      const protocol = (emailDomain.includes('localhost') || emailDomain.includes('127.0.0.1'))
        ? 'http'
        : 'https';
      baseUrl = `${protocol}://${emailDomain}`;
    } else if (req) {
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      baseUrl = `${protocol}://${host}`;
    } else {
      baseUrl = 'https://www.yorkcastlehighschool.org';
    }
  }

  // Strip any trailing slash for consistent concatenation
  return baseUrl.replace(/\/+$/, '');
};

export const paginate = (page, limit) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);
  return { skip, take };
};

// Cursor-based pagination utilities for better performance
export const createCursorPagination = (options = {}) => {
  const {
    cursorField = 'id',
    limit = 20,
    direction = 'desc'
  } = options;

  return {
    take: limit + 1, // Take one extra to check if there are more results
    ...(options.cursor && {
      where: {
        [cursorField]: {
          [direction === 'desc' ? 'lt' : 'gt']: options.cursor
        }
      }
    }),
    orderBy: {
      [cursorField]: direction
    }
  };
};

export const processCursorResults = (results, limit) => {
  const hasNextPage = results.length > limit;
  const data = hasNextPage ? results.slice(0, -1) : results;
  const nextCursor = hasNextPage ? data[data.length - 1].id : null;

  return {
    data,
    pagination: {
      hasNextPage,
      nextCursor,
      limit
    }
  };
};





