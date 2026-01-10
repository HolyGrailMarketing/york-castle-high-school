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





