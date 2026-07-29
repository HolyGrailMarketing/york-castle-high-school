import prisma from '../utils/prisma.js';
import { slugify } from '../utils/helpers.js';
import { invalidateBlogPostsCache } from '../services/cacheService.js';

export const getBlogPosts = async (req, res, next) => {
  try {
    const { published, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    
    // If not admin/staff, only show published posts
    if (!req.user || !['ADMIN', 'STAFF'].includes(req.user.role)) {
      where.published = true;
    } else if (published !== undefined) {
      where.published = published === 'true';
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          featuredImage: true,
          published: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          authorId: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { publishedAt: 'desc' },
      }),
      prisma.blogPost.count({ where }),
    ]);

    res.json({
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBlogPost = async (req, res, next) => {
  try {
    const { id } = req.params;

    const post = await prisma.blogPost.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    // If not published and user is not admin/staff, deny access
    if (!post.published && (!req.user || !['ADMIN', 'STAFF'].includes(req.user.role))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ post });
  } catch (error) {
    next(error);
  }
};

export const createBlogPost = async (req, res, next) => {
  try {
    const { title, content, excerpt, featuredImage, published } = req.body;

    const isPublished = published === true || published === 'true';

    const slug = slugify(title);

    // Ensure slug is unique
    const existingPost = await prisma.blogPost.findUnique({
      where: { slug },
    });

    if (existingPost) {
      return res.status(409).json({ error: 'A post with this title already exists' });
    }

    const post = await prisma.blogPost.create({
      data: {
        title,
        slug,
        content,
        excerpt,
        featuredImage,
        published: isPublished,
        publishedAt: isPublished ? new Date() : null,
        authorId: req.user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    invalidateBlogPostsCache();

    res.status(201).json({
      message: 'Blog post created successfully',
      post,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBlogPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, excerpt, featuredImage, published } = req.body;

    const existing = await prisma.blogPost.findUnique({
      where: { id },
      select: { published: true, publishedAt: true, slug: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    const updateData = {};
    if (title) {
      updateData.title = title;
      // Renaming a live post would break its public URL and any inbound
      // links, so the slug is only regenerated while it is still a draft.
      if (!existing.published) updateData.slug = slugify(title);
    }
    if (content !== undefined) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (featuredImage !== undefined) updateData.featuredImage = featuredImage;

    if (published !== undefined) {
      const isPublished = published === true || published === 'true';
      updateData.published = isPublished;
      // Keep the original publication date when re-saving a live post.
      updateData.publishedAt = isPublished
        ? (existing.publishedAt || new Date())
        : null;
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    invalidateBlogPostsCache();

    res.json({
      message: 'Blog post updated successfully',
      post,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Blog post not found' });
    }
    next(error);
  }
};

export const deleteBlogPost = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.blogPost.delete({
      where: { id },
    });

    invalidateBlogPostsCache();

    res.json({ message: 'Blog post deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Blog post not found' });
    }
    next(error);
  }
};

export const publishBlogPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { published } = req.body;

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        published: published === true || published === 'true',
        publishedAt: published === true || published === 'true' ? new Date() : null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    invalidateBlogPostsCache();

    res.json({
      message: `Blog post ${published ? 'published' : 'unpublished'} successfully`,
      post,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Blog post not found' });
    }
    next(error);
  }
};





