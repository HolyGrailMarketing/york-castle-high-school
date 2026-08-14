import path from 'path';
import { randomUUID } from 'crypto';
import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { slugify } from '../utils/helpers.js';
import { invalidateBooklistCache } from '../services/cacheService.js';
import { uploadPublicFile, removeFile, isStorageConfigured } from '../services/storageService.js';

// Conventional ordering when an admin hasn't set sortOrder explicitly, so a
// freshly uploaded set of grades comes out in the order a parent expects.
const DEFAULT_GRADE_ORDER = [
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Sixth Form',
];

// Booklists get their own bucket rather than sharing SUPABASE_STORAGE_BUCKET,
// which points at blog images. Must exist in Supabase and be public-read.
const BOOKLIST_BUCKET = process.env.SUPABASE_BOOKLIST_BUCKET || 'booklists';

const defaultSortOrderFor = (gradeLabel) => {
  const index = DEFAULT_GRADE_ORDER.indexOf(gradeLabel);
  return index === -1 ? DEFAULT_GRADE_ORDER.length : index;
};

/**
 * The school year to show when the caller doesn't name one: the newest year
 * that actually has published entries. Years sort correctly as strings given
 * the "2025-2026" format.
 */
const resolveCurrentSchoolYear = async () => {
  const newest = await prisma.booklistEntry.findFirst({
    where: { isPublished: true },
    orderBy: { schoolYear: 'desc' },
    select: { schoolYear: true },
  });
  return newest?.schoolYear || null;
};

const listEntries = (where) =>
  prisma.booklistEntry.findMany({
    where,
    orderBy: [{ schoolYear: 'desc' }, { sortOrder: 'asc' }, { gradeLabel: 'asc' }],
  });

/**
 * GET /api/booklist - public. Feeds the grid on booklist.html.
 *
 * Published entries only, for a single school year: the one named by ?year=, or
 * the newest year that has any.
 */
export const getBooklist = async (req, res, next) => {
  try {
    const schoolYear = req.query.year?.trim() || (await resolveCurrentSchoolYear());

    const entries = schoolYear ? await listEntries({ isPublished: true, schoolYear }) : [];

    res.json({ schoolYear, entries });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/booklist/all - admin listing. Every year, including unpublished
 * entries, so the dashboard can manage drafts and past years.
 */
export const getAllBooklistEntries = async (req, res, next) => {
  try {
    const schoolYear = req.query.year?.trim() || null;
    const entries = await listEntries(schoolYear ? { schoolYear } : {});

    res.json({ schoolYear, entries });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/booklist - upload a booklist file for one grade.
 *
 * Upserts on (schoolYear, gradeLabel): re-uploading a grade replaces the file
 * rather than creating a duplicate row, which is what "update the booklist"
 * means in practice. The superseded object is removed from storage afterwards.
 */
export const createBooklistEntry = async (req, res, next) => {
  let uploadedPath = null;

  try {
    if (!isStorageConfigured()) {
      return res.status(503).json({
        error: 'File storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const schoolYear = req.body.schoolYear?.trim();
    const gradeLabel = req.body.gradeLabel?.trim();

    if (!schoolYear || !gradeLabel) {
      return res.status(400).json({ error: 'School year and grade are required' });
    }

    const extension = path.extname(req.file.originalname).toLowerCase();
    // The unique segment matters: the CDN caches these aggressively, so reusing
    // a key would keep serving last year's file.
    const storagePath = `${slugify(schoolYear)}/${slugify(gradeLabel)}-${randomUUID()}${extension}`;

    const { url } = await uploadPublicFile(req.file.buffer, {
      path: storagePath,
      contentType: req.file.mimetype,
      bucket: BOOKLIST_BUCKET,
    });
    uploadedPath = storagePath;

    const existing = await prisma.booklistEntry.findUnique({
      where: { schoolYear_gradeLabel: { schoolYear, gradeLabel } },
      select: { id: true, storagePath: true },
    });

    const data = {
      fileName: req.file.originalname,
      fileUrl: url,
      storagePath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.id,
    };

    const entry = await prisma.booklistEntry.upsert({
      where: { schoolYear_gradeLabel: { schoolYear, gradeLabel } },
      update: data,
      create: {
        ...data,
        schoolYear,
        gradeLabel,
        sortOrder: Number.isInteger(Number(req.body.sortOrder))
          ? Number(req.body.sortOrder)
          : defaultSortOrderFor(gradeLabel),
        isPublished: req.body.isPublished !== 'false' && req.body.isPublished !== false,
      },
    });

    // The row now points at the new file, so the old object is safe to drop.
    if (existing?.storagePath && existing.storagePath !== storagePath) {
      await removeFile(existing.storagePath, BOOKLIST_BUCKET);
    }

    invalidateBooklistCache(schoolYear);

    res.status(201).json({
      message: existing ? 'Booklist updated successfully' : 'Booklist uploaded successfully',
      entry,
    });
  } catch (error) {
    // Don't leave an orphaned object behind if the database write failed.
    if (uploadedPath) {
      await removeFile(uploadedPath, BOOKLIST_BUCKET);
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A booklist already exists for that grade and school year' });
    }
    next(error);
  }
};

/**
 * PUT /api/booklist/:id - metadata only. Replacing the file is an upload.
 */
export const updateBooklistEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { schoolYear, gradeLabel, sortOrder, isPublished } = req.body;

    const updateData = {};
    if (schoolYear !== undefined) updateData.schoolYear = String(schoolYear).trim();
    if (gradeLabel !== undefined) updateData.gradeLabel = String(gradeLabel).trim();
    if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder) || 0;
    if (isPublished !== undefined) updateData.isPublished = Boolean(isPublished);

    const entry = await prisma.booklistEntry.update({
      where: { id },
      data: updateData,
    });

    invalidateBooklistCache(entry.schoolYear);

    res.json({ message: 'Booklist entry updated successfully', entry });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Booklist entry not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A booklist already exists for that grade and school year' });
    }
    next(error);
  }
};

export const deleteBooklistEntry = async (req, res, next) => {
  try {
    const { id } = req.params;

    const entry = await prisma.booklistEntry.findUnique({ where: { id } });
    if (!entry) {
      return res.status(404).json({ error: 'Booklist entry not found' });
    }

    await prisma.booklistEntry.delete({ where: { id } });

    if (entry.storagePath) {
      const removed = await removeFile(entry.storagePath, BOOKLIST_BUCKET);
      if (!removed) {
        logger.warn('Booklist row deleted but storage object remains', {
          id,
          storagePath: entry.storagePath,
        });
      }
    }

    invalidateBooklistCache(entry.schoolYear);

    res.json({ message: 'Booklist entry deleted successfully' });
  } catch (error) {
    next(error);
  }
};
