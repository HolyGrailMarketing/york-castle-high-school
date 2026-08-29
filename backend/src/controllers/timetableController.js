import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { invalidateTimetableCache } from '../services/cacheService.js';

// The payload shaping and the clash check are shared with the build pipeline, so
// the API, the importer and the pre-rendered page can never disagree about what
// a timetable means.
import { buildPayloads } from '../timetable/payload.js';
import { findClashes } from '../timetable/clashes.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const versionInclude = {
  periods: { orderBy: { sortOrder: 'asc' } },
  groups: { orderBy: { sortOrder: 'asc' } },
  activities: { include: { placement: true } },
};

/**
 * Turn a stored version into the shape ../timetable/payload.js expects -
 * the same shape parse-fet.js emits. Keeping one shape means the exporter, the
 * API and the build all run the same code over the same data.
 */
const toParsedShape = (version) => {
  const periodIndex = new Map(version.periods.map((p, i) => [p.key, i]));

  const byYear = new Map();
  for (const g of version.groups) {
    if (!byYear.has(g.yearName)) {
      byYear.set(g.yearName, { name: g.yearName, groups: [], undivided: g.undivided });
    }
    byYear.get(g.yearName).groups.push(g.name);
  }

  return {
    days: DAYS,
    periods: version.periods.map((p) => ({
      id: p.key,
      label: p.label,
      start: p.startTime ?? undefined,
      end: p.endTime ?? undefined,
      ...(p.altStart ? { altStart: p.altStart, altEnd: p.altEnd } : {}),
      ...(p.lunchSitting ? { lunchSitting: p.lunchSitting } : {}),
      ...(p.regStart ? { registration: { start: p.regStart, end: p.regEnd } } : {}),
      kind: p.kind,
      unused: p.unused,
    })),
    years: [...byYear.values()],
    groups: version.groups.map((g) => g.name),
    placements: version.activities
      .filter((a) => a.placement)
      .map((a) => ({
        activityId: a.id,
        placementId: a.placement.id,
        sourceId: a.sourceId,
        day: a.placement.day,
        periodId: a.placement.periodKey,
        periodIndex: periodIndex.get(a.placement.periodKey),
        duration: a.duration,
        subject: a.subject,
        teachers: a.teacherNames,
        groups: a.groupNames,
        room: a.room,
        candidateRooms: a.room ? [a.room] : [],
        staffOnly: a.staffOnly,
      })),
  };
};

const loadVersion = (where) =>
  prisma.timetableVersion.findFirst({ where, orderBy: { publishedAt: 'desc' }, include: versionInclude });

// --- public -----------------------------------------------------------------

/**
 * The published class timetable. Lunch duty and CPS are excluded here - they are
 * staff roster entries, not lessons, and "where is this member of staff all
 * week" is not public.
 */
export const getPublicTimetable = async (req, res, next) => {
  try {
    const version = await loadVersion({ status: 'PUBLISHED', ...(req.query.year ? { schoolYear: req.query.year } : {}) });
    if (!version) return res.status(404).json({ message: 'No published timetable' });

    const { publicPayload } = buildPayloads(toParsedShape(version), { schoolYear: version.schoolYear });
    res.json(publicPayload);
  } catch (error) {
    next(error);
  }
};

// --- staff ------------------------------------------------------------------

/**
 * Everything the public view has, plus the two views that are the reason staff
 * open this at all: each teacher's week including their lunch duty, and what
 * occupies each room.
 */
export const getStaffTimetable = async (req, res, next) => {
  try {
    const where = req.query.versionId
      ? { id: req.query.versionId }
      : { status: 'PUBLISHED', ...(req.query.year ? { schoolYear: req.query.year } : {}) };
    const version = await loadVersion(where);
    if (!version) return res.status(404).json({ message: 'No timetable found' });

    // The editor moves lessons by placement id, so the staff view carries them.
    const { staffPayload } = buildPayloads(toParsedShape(version),
      { schoolYear: version.schoolYear, withPlacementIds: true });
    res.json({
      ...staffPayload,
      version: { id: version.id, label: version.label, status: version.status, publishedAt: version.publishedAt },
    });
  } catch (error) {
    next(error);
  }
};

// --- admin ------------------------------------------------------------------

export const listVersions = async (req, res, next) => {
  try {
    const versions = await prisma.timetableVersion.findMany({
      orderBy: [{ schoolYear: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { activities: true } } },
    });
    res.json({ versions });
  } catch (error) {
    next(error);
  }
};

/** A draft to work in, optionally copied from an existing version. */
export const createVersion = async (req, res, next) => {
  try {
    const { schoolYear, label, cloneFrom } = req.body;
    if (!schoolYear || !label) return res.status(400).json({ message: 'schoolYear and label are required' });

    const source = cloneFrom ? await loadVersion({ id: cloneFrom }) : null;
    if (cloneFrom && !source) return res.status(404).json({ message: 'Version to clone not found' });

    const created = await prisma.$transaction(async (tx) => {
      const v = await tx.timetableVersion.create({
        data: { schoolYear, label, status: 'DRAFT', createdBy: req.user?.id ?? null,
                notes: source ? `Cloned from "${source.label}".` : null },
      });
      if (!source) return v;

      await tx.timetablePeriod.createMany({
        data: source.periods.map(({ id, versionId, ...p }) => ({ ...p, versionId: v.id })),
      });
      await tx.timetableGroup.createMany({
        data: source.groups.map(({ id, versionId, ...g }) => ({ ...g, versionId: v.id })),
      });
      const [teachers, rooms] = await Promise.all([
        tx.timetableTeacher.findMany({ where: { versionId: source.id } }),
        tx.timetableRoom.findMany({ where: { versionId: source.id } }),
      ]);
      await tx.timetableTeacher.createMany({
        data: teachers.map(({ id, versionId, ...t }) => ({ ...t, versionId: v.id })),
      });
      await tx.timetableRoom.createMany({
        data: rooms.map(({ id, versionId, ...r }) => ({ ...r, versionId: v.id })),
      });
      await tx.timetableActivity.createMany({
        data: source.activities.map(({ id, versionId, placement, ...a }) => ({ ...a, versionId: v.id })),
      });

      // createMany returns no ids, so match the copies back by sourceId.
      const copies = await tx.timetableActivity.findMany({
        where: { versionId: v.id }, select: { id: true, sourceId: true },
      });
      const idBySource = new Map(copies.map((a) => [a.sourceId, a.id]));
      await tx.timetablePlacement.createMany({
        data: source.activities
          .filter((a) => a.placement && idBySource.has(a.sourceId))
          .map((a) => ({ versionId: v.id, activityId: idBySource.get(a.sourceId),
                         day: a.placement.day, periodKey: a.placement.periodKey })),
      });
      return v;
    }, { timeout: 120000 });

    res.status(201).json({ version: created });
  } catch (error) {
    next(error);
  }
};

/** Move one lesson. The editor checks for clashes first; this re-checks. */
export const movePlacement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { day, periodKey } = req.body;
    if (!DAYS.includes(day)) return res.status(400).json({ message: `day must be one of ${DAYS.join(', ')}` });

    const existing = await prisma.timetablePlacement.findUnique({
      where: { id }, include: { activity: true },
    });
    if (!existing) return res.status(404).json({ message: 'Placement not found' });

    const version = await loadVersion({ id: existing.versionId });
    if (version.status === 'ARCHIVED') {
      return res.status(409).json({ message: 'This version is archived and cannot be edited' });
    }
    if (!version.periods.some((p) => p.key === periodKey)) {
      return res.status(400).json({ message: `Unknown period "${periodKey}"` });
    }

    // Check the move against the version as it would be afterwards, using the
    // same clash rules the importer and the editor use.
    const data = toParsedShape(version);
    const after = data.placements.map((p) => (p.activityId === existing.activityId
      ? { ...p, day, periodId: periodKey, periodIndex: version.periods.findIndex((x) => x.key === periodKey) }
      : p));
    const clashes = findClashes({ periods: data.periods, placements: after })
      .filter((c) => c.activities.some((a) => a.id === existing.activityId));

    if (clashes.length && !req.body.force) {
      return res.status(409).json({ message: 'That move would clash', clashes });
    }

    const updated = await prisma.timetablePlacement.update({
      where: { id }, data: { day, periodKey },
    });
    invalidateTimetableCache();
    logger.info('Timetable placement moved', { id, day, periodKey, by: req.user?.id });
    res.json({ placement: updated, clashes });
  } catch (error) {
    next(error);
  }
};

/** Full clash report for a version. */
export const validateVersion = async (req, res, next) => {
  try {
    const version = await loadVersion({ id: req.params.id });
    if (!version) return res.status(404).json({ message: 'Version not found' });
    const data = toParsedShape(version);
    const clashes = findClashes(data);
    res.json({
      versionId: version.id,
      placements: data.placements.length,
      clashes,
      ok: clashes.length === 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Promote a draft. Refuses to publish a timetable with clashes - the whole point
 * of the check is that a broken timetable never reaches students.
 */
export const publishVersion = async (req, res, next) => {
  try {
    const version = await loadVersion({ id: req.params.id });
    if (!version) return res.status(404).json({ message: 'Version not found' });

    const clashes = findClashes(toParsedShape(version));
    if (clashes.length && !req.body?.force) {
      return res.status(409).json({ message: `Cannot publish: ${clashes.length} clash(es)`, clashes });
    }

    await prisma.$transaction([
      prisma.timetableVersion.updateMany({
        where: { schoolYear: version.schoolYear, status: 'PUBLISHED', NOT: { id: version.id } },
        data: { status: 'ARCHIVED' },
      }),
      prisma.timetableVersion.update({
        where: { id: version.id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      }),
    ]);
    invalidateTimetableCache();
    logger.info('Timetable published', { id: version.id, by: req.user?.id });

    res.json({
      message: 'Published. The public page updates on the next deploy — ' +
        'run "npm run timetable:export" and deploy to publish it to the website.',
      versionId: version.id,
    });
  } catch (error) {
    next(error);
  }
};
