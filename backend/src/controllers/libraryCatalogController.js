import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';

/**
 * The textbook catalogue: titles (Book) and the individual physical copies of
 * them (BookCopy), each with its own barcode.
 *
 * Copies are never hard-deleted. A copy that is destroyed or lost for good is
 * set to WITHDRAWN with a reason, which keeps its loan history and stops the
 * barcode being reused. `onDelete: Restrict` on BookLoan.copy enforces that at
 * the database level even if this code is wrong.
 */

/** One call cannot generate more than this many copies. See generateCopies. */
export const MAX_COPIES_PER_REQUEST = 500;

const COPY_STATUSES = ['AVAILABLE', 'ON_LOAN', 'REPAIR', 'LOST', 'WITHDRAWN'];
const CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];

/** Decimal columns come back as Prisma Decimal; send plain numbers to the client. */
const money = (value) => (value === null || value === undefined ? null : Number(value));

const serialiseBook = (book) => ({
  ...book,
  replacementCost: money(book.replacementCost),
  rentalFee: money(book.rentalFee),
});

/**
 * Copy counts per status for a set of books, as
 * { [bookId]: { AVAILABLE: 12, ON_LOAN: 3, ... , total: 15 } }.
 *
 * One groupBy rather than a count per book, so listing the catalogue stays a
 * fixed two queries however many titles there are.
 */
const copyCountsByBook = async (bookIds) => {
  if (bookIds.length === 0) return {};

  const rows = await prisma.bookCopy.groupBy({
    by: ['bookId', 'status'],
    where: { bookId: { in: bookIds } },
    _count: { _all: true },
  });

  const empty = () => Object.fromEntries([...COPY_STATUSES.map((s) => [s, 0]), ['total', 0]]);
  const counts = Object.fromEntries(bookIds.map((id) => [id, empty()]));

  for (const row of rows) {
    counts[row.bookId][row.status] = row._count._all;
    // WITHDRAWN copies are deliberately excluded from the total: the number a
    // member of staff wants is "how many books do we have", not "how many rows".
    if (row.status !== 'WITHDRAWN') counts[row.bookId].total += row._count._all;
  }
  return counts;
};

/**
 * GET /api/library/books
 * Filters: q, subject, yearGroup, isActive.
 */
export const getBooks = async (req, res, next) => {
  try {
    const { q, subject, yearGroup, isActive } = req.query;

    const where = {};
    if (subject) where.subject = subject;
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;
    if (yearGroup) where.yearGroups = { has: Number(yearGroup) };
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { author: { contains: term, mode: 'insensitive' } },
        { isbn: { contains: term, mode: 'insensitive' } },
        { subject: { contains: term, mode: 'insensitive' } },
      ];
    }

    const books = await prisma.book.findMany({ where, orderBy: [{ subject: 'asc' }, { title: 'asc' }] });
    const counts = await copyCountsByBook(books.map((b) => b.id));

    res.json({ books: books.map((b) => ({ ...serialiseBook(b), copies: counts[b.id] })) });
  } catch (error) {
    next(error);
  }
};

export const getBook = async (req, res, next) => {
  try {
    const book = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const counts = await copyCountsByBook([book.id]);
    res.json({ book: { ...serialiseBook(book), copies: counts[book.id] } });
  } catch (error) {
    next(error);
  }
};

/** Shared field handling for create and update. */
const bookPayload = (body) => {
  const payload = {
    title: body.title?.trim(),
    author: body.author?.trim() || null,
    publisher: body.publisher?.trim() || null,
    edition: body.edition?.trim() || null,
    // Empty string would collide with another blank ISBN on the unique index,
    // so an unknown ISBN has to be null rather than ''.
    isbn: body.isbn?.trim() || null,
    subject: body.subject?.trim(),
    notes: body.notes?.trim() || null,
  };
  if (body.yearGroups !== undefined) {
    payload.yearGroups = (Array.isArray(body.yearGroups) ? body.yearGroups : [body.yearGroups])
      .map(Number)
      .filter((n) => Number.isInteger(n));
  }
  if (body.replacementCost !== undefined) payload.replacementCost = Number(body.replacementCost);
  if (body.rentalFee !== undefined) payload.rentalFee = Number(body.rentalFee);
  if (body.isActive !== undefined) payload.isActive = Boolean(body.isActive);
  return payload;
};

export const createBook = async (req, res, next) => {
  try {
    const payload = bookPayload(req.body);

    if (!payload.title || !payload.subject) {
      return res.status(400).json({ error: 'Title and subject are required' });
    }
    if (!Number.isFinite(payload.replacementCost) || payload.replacementCost < 0) {
      return res.status(400).json({ error: 'A replacement cost is required, so a lost book can be charged for' });
    }

    const book = await prisma.book.create({ data: payload });
    logger.info('Textbook created', { bookId: book.id, title: book.title, by: req.user?.id });
    res.status(201).json({ book: serialiseBook(book) });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Another title already has that ISBN' });
    }
    next(error);
  }
};

export const updateBook = async (req, res, next) => {
  try {
    const payload = bookPayload(req.body);
    // Only overwrite what was actually sent, so a partial edit cannot blank a
    // field the form did not include.
    for (const key of Object.keys(payload)) {
      if (req.body[key] === undefined) delete payload[key];
    }

    const book = await prisma.book.update({ where: { id: req.params.id }, data: payload });
    res.json({ book: serialiseBook(book) });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Book not found' });
    if (error.code === 'P2002') return res.status(409).json({ error: 'Another title already has that ISBN' });
    next(error);
  }
};

/**
 * DELETE /api/library/books/:id - retires a title.
 *
 * Soft only. The copies and their loan history stay; the title stops being
 * offered. Refused while any copy is still with a student, because the record
 * of who owes that book is the whole point of the system.
 */
export const deleteBook = async (req, res, next) => {
  try {
    const onLoan = await prisma.bookCopy.count({ where: { bookId: req.params.id, status: 'ON_LOAN' } });
    if (onLoan > 0) {
      return res.status(409).json({
        error: `${onLoan} cop${onLoan === 1 ? 'y is' : 'ies are'} still out with students. Take them back first.`,
      });
    }

    const book = await prisma.book.update({ where: { id: req.params.id }, data: { isActive: false } });
    logger.info('Textbook retired', { bookId: book.id, by: req.user?.id });
    res.json({ book: serialiseBook(book), message: 'Title retired. Its copies and loan history are kept.' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Book not found' });
    next(error);
  }
};

/**
 * GET /api/library/books/:id/copies - every copy, and who holds it.
 *
 * The holder is read from the ACTIVE loan rather than from BookCopy.status,
 * because the loan is the authoritative record. Where the two disagree the
 * loan is right and scripts/reconcile-copy-status.js will say so.
 */
export const getBookCopies = async (req, res, next) => {
  try {
    const copies = await prisma.bookCopy.findMany({
      where: { bookId: req.params.id },
      orderBy: { copyNumber: 'asc' },
      include: {
        loans: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            issuedAt: true,
            dueAt: true,
            student: { select: { id: true, name: true, studentProfile: { select: { formClass: true, studentNumber: true } } } },
          },
        },
      },
    });

    res.json({
      copies: copies.map(({ loans, ...copy }) => ({
        ...copy,
        currentLoan: loans[0]
          ? {
              id: loans[0].id,
              issuedAt: loans[0].issuedAt,
              dueAt: loans[0].dueAt,
              student: {
                id: loans[0].student.id,
                name: loans[0].student.name,
                formClass: loans[0].student.studentProfile?.formClass ?? null,
                studentNumber: loans[0].student.studentProfile?.studentNumber ?? null,
              },
            }
          : null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/library/books/:id/copies - bulk-generate copies with barcodes.
 *
 * Barcodes come from the single BarcodeCounter row, reserved inside the same
 * transaction as the insert. Deliberately not MAX(barcode)+1, which races: two
 * admins adding copies at the same time would both read the same maximum and
 * generate colliding barcodes.
 *
 * Capped per request so one call stays a single fast INSERT well inside the
 * Vercel function timeout. The dashboard loops for larger orders.
 */
export const generateCopies = async (req, res, next) => {
  try {
    const count = Number(req.body.count);
    if (!Number.isInteger(count) || count < 1) {
      return res.status(400).json({ error: 'Enter how many copies to add' });
    }
    if (count > MAX_COPIES_PER_REQUEST) {
      return res.status(422).json({
        error: `Add at most ${MAX_COPIES_PER_REQUEST} copies at a time`,
        maxPerRequest: MAX_COPIES_PER_REQUEST,
      });
    }

    const condition = CONDITIONS.includes(req.body.condition) ? req.body.condition : 'NEW';
    const acquiredAt = req.body.acquiredAt ? new Date(req.body.acquiredAt) : new Date();
    if (Number.isNaN(acquiredAt.getTime())) {
      return res.status(400).json({ error: 'Acquired date is not a valid date' });
    }

    const book = await prisma.book.findUnique({ where: { id: req.params.id }, select: { id: true, title: true } });
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const result = await prisma.$transaction(async (tx) => {
      // Reserve the barcode range first. The update is what serialises
      // concurrent callers: the second one blocks on this row until the first
      // commits, then reads the advanced value.
      const counter = await tx.barcodeCounter.upsert({
        where: { id: 'copy' },
        update: { nextValue: { increment: count } },
        create: { id: 'copy', nextValue: 1 + count },
      });
      const firstValue = counter.nextValue - count;

      const lastCopy = await tx.bookCopy.findFirst({
        where: { bookId: book.id },
        orderBy: { copyNumber: 'desc' },
        select: { copyNumber: true },
      });
      const firstCopyNumber = (lastCopy?.copyNumber ?? 0) + 1;

      const batchId = `${book.id}:${Date.now()}`;
      const rows = Array.from({ length: count }, (_, i) => ({
        bookId: book.id,
        barcode: `${counter.prefix}${String(firstValue + i).padStart(6, '0')}`,
        copyNumber: firstCopyNumber + i,
        condition,
        status: 'AVAILABLE',
        acquiredAt,
        batchId,
      }));

      await tx.bookCopy.createMany({ data: rows });
      return { batchId, barcodes: rows.map((r) => r.barcode) };
    });

    logger.info('Textbook copies generated', {
      bookId: book.id, count, batchId: result.batchId, by: req.user?.id,
    });

    res.status(201).json({
      batchId: result.batchId,
      count,
      firstBarcode: result.barcodes[0],
      lastBarcode: result.barcodes[result.barcodes.length - 1],
      barcodes: result.barcodes,
      message: `Added ${count} cop${count === 1 ? 'y' : 'ies'} of ${book.title}.`,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      // Should be unreachable now barcodes come from the counter; if it does
      // happen the counter is behind the copies and needs resetting.
      logger.error('Barcode collision during bulk generation', { bookId: req.params.id, meta: error.meta });
      return res.status(409).json({ error: 'Barcode collision. The barcode counter is out of step with the copies on record.' });
    }
    next(error);
  }
};

/**
 * PATCH /api/library/copies/:id - condition, or take a copy out of circulation.
 *
 * Withdrawing a copy that is with a student is refused: the loan is the record
 * of who owes it, and retiring the copy underneath a live loan would strand it.
 */
export const updateCopy = async (req, res, next) => {
  try {
    const { condition, status, withdrawnReason } = req.body;
    const data = {};

    if (condition !== undefined) {
      if (!CONDITIONS.includes(condition)) return res.status(400).json({ error: 'Unknown condition' });
      data.condition = condition;
    }

    if (status !== undefined) {
      if (!COPY_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' });
      if (status === 'ON_LOAN') {
        return res.status(400).json({ error: 'Issue the copy at the desk instead of setting it to On loan here' });
      }

      const copy = await prisma.bookCopy.findUnique({
        where: { id: req.params.id },
        select: { status: true, barcode: true },
      });
      if (!copy) return res.status(404).json({ error: 'Copy not found' });

      if (copy.status === 'ON_LOAN' && status !== 'LOST') {
        return res.status(409).json({
          error: `${copy.barcode} is with a student. Take it back first, or mark the loan lost.`,
        });
      }

      data.status = status;
      if (status === 'WITHDRAWN') {
        if (!withdrawnReason?.trim()) {
          return res.status(400).json({ error: 'Give a reason for withdrawing the copy' });
        }
        data.withdrawnAt = new Date();
        data.withdrawnReason = withdrawnReason.trim();
      } else {
        data.withdrawnAt = null;
        data.withdrawnReason = null;
      }
    }

    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' });

    const copy = await prisma.bookCopy.update({ where: { id: req.params.id }, data });
    logger.info('Textbook copy updated', { copyId: copy.id, barcode: copy.barcode, data, by: req.user?.id });
    res.json({ copy });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Copy not found' });
    next(error);
  }
};

/**
 * GET /api/library/copies/labels?batchId=... | ?ids=a,b,c
 *
 * Returns the data for a label sheet as JSON. The browser lays the sheet out
 * and prints it - rendering a PDF server-side would mean a PDF toolchain in a
 * serverless function for something a print stylesheet does perfectly well.
 */
export const getCopyLabels = async (req, res, next) => {
  try {
    const { batchId, ids } = req.query;
    const where = {};
    if (batchId) where.batchId = batchId;
    else if (ids) where.id = { in: String(ids).split(',').map((s) => s.trim()).filter(Boolean) };
    else return res.status(400).json({ error: 'Give a batchId or a list of copy ids' });

    const copies = await prisma.bookCopy.findMany({
      where,
      orderBy: { copyNumber: 'asc' },
      include: { book: { select: { title: true, subject: true } } },
    });

    res.json({
      labels: copies.map((c) => ({
        barcode: c.barcode,
        copyNumber: c.copyNumber,
        title: c.book.title,
        subject: c.book.subject,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/** Minimal RFC 4180 quoting - fields may contain commas, quotes or newlines. */
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * GET /api/library/copies/export.csv - the whole inventory, for stocktaking.
 */
export const exportCopiesCsv = async (req, res, next) => {
  try {
    const copies = await prisma.bookCopy.findMany({
      orderBy: { barcode: 'asc' },
      include: {
        book: { select: { title: true, subject: true, replacementCost: true } },
        loans: {
          where: { status: 'ACTIVE' },
          select: { dueAt: true, student: { select: { name: true, studentProfile: { select: { formClass: true } } } } },
        },
      },
    });

    const header = ['Barcode', 'Title', 'Subject', 'Copy number', 'Condition', 'Status', 'Replacement cost', 'Held by', 'Form class', 'Due'];
    const lines = [header.join(',')];

    for (const c of copies) {
      const loan = c.loans[0];
      lines.push([
        c.barcode, c.book.title, c.book.subject, c.copyNumber, c.condition, c.status,
        money(c.book.replacementCost),
        loan?.student.name ?? '',
        loan?.student.studentProfile?.formClass ?? '',
        loan?.dueAt ? loan.dueAt.toISOString().slice(0, 10) : '',
      ].map(csvCell).join(','));
    }

    const filename = `textbook-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Excel needs the BOM to read UTF-8 names correctly.
    res.send(`﻿${lines.join('\r\n')}\r\n`);
  } catch (error) {
    next(error);
  }
};

/** GET /api/library/subjects - distinct subjects, for the filter dropdown. */
export const getSubjects = async (req, res, next) => {
  try {
    const rows = await prisma.book.findMany({
      distinct: ['subject'],
      orderBy: { subject: 'asc' },
      select: { subject: true },
    });
    res.json({ subjects: rows.map((r) => r.subject) });
  } catch (error) {
    next(error);
  }
};
