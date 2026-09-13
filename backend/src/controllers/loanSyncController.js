import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { applyOperation, getCurrentTerm, SYNC_REJECT_REASONS } from '../services/loanEngine.js';

/**
 * Draining a counter station's offline queue.
 *
 * A station that has been working without internet sends the operations it
 * recorded, in the order it recorded them. This endpoint replays them through
 * exactly the same engine the online desk uses.
 *
 * What it does NOT do is decide who really has a book. When two stations that
 * could not see each other both issued the same copy, one of them is wrong, and
 * only a person standing in the room knows which. The server reports the clash
 * and leaves it to a human. Auto-resolving on timestamp would be wrong about
 * half the time and would silently move who owes a replacement fee.
 */

/** Operations per request. The client chunks; larger batches risk the timeout. */
export const MAX_OPS_PER_SYNC = 200;

export const syncOperations = async (req, res, next) => {
  try {
    const { stationId, ops } = req.body;

    if (!Array.isArray(ops)) return res.status(400).json({ error: 'ops must be an array' });
    if (ops.length === 0) return res.json({ serverTime: new Date().toISOString(), results: [] });
    if (ops.length > MAX_OPS_PER_SYNC) {
      return res.status(422).json({
        error: `Send at most ${MAX_OPS_PER_SYNC} operations at a time`,
        maxPerSync: MAX_OPS_PER_SYNC,
      });
    }

    const term = await getCurrentTerm();
    if (!term) {
      // Refusing the whole batch is right here: without a term there is no due
      // date, and inventing one would put wrong dates on every loan in the
      // batch. The station keeps its queue and tries again.
      return res.status(409).json({ error: SYNC_REJECT_REASONS.NO_CURRENT_TERM, reason: 'NO_CURRENT_TERM' });
    }

    // In the order the station recorded them. `seq` is a per-station counter,
    // not a clock, so this survives someone fixing the laptop's date mid-shift.
    const ordered = [...ops].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

    const results = [];
    for (const op of ordered) {
      if (!op.opId) {
        results.push({ opId: null, status: 'rejected', reason: 'MISSING_OP_ID', message: 'The operation had no id.' });
        continue;
      }
      try {
        // One transaction per operation, deliberately. One big transaction
        // would mean a single rejection rolls back the other 199; running them
        // in parallel would open a connection per operation and exhaust the
        // pool on a serverless invocation.
        const result = await prisma.$transaction((tx) =>
          applyOperation(tx, { ...op, source: 'OFFLINE_SYNC', stationId: op.stationId || stationId }, {
            operatorId: op.operatorId || req.user.id,
            term,
          })
        );
        results.push({ opId: op.opId, ...result });
      } catch (error) {
        // A failure here is the server's, not the station's. Report it as
        // retryable so the operation stays in the queue rather than being
        // silently dropped.
        logger.error('Sync operation failed', { opId: op.opId, error: error.message });
        results.push({
          opId: op.opId,
          status: 'error',
          retryable: true,
          message: 'The school\'s records could not be updated. This scan is still saved and will be sent again.',
        });
      }
    }

    const appliedCount = results.filter((r) => r.status === 'applied').length;
    const rejectedCount = results.filter((r) => r.status === 'rejected').length;
    logger.info('Station sync drained', {
      stationId, received: ops.length, applied: appliedCount, rejected: rejectedCount, by: req.user.id,
    });

    res.json({
      serverTime: new Date().toISOString(),
      received: ops.length,
      applied: appliedCount,
      rejected: rejectedCount,
      results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/loans/sync/resolve - a human's decision about a rejected operation.
 *
 * FORCE means "the scan was right, the records were wrong": close whatever loan
 * the records think is live and open the one the station recorded. Both loans
 * are flagged for review and the whole thing is audited, because this is
 * someone overriding the system on the strength of what they can see.
 */
export const resolveConflict = async (req, res, next) => {
  try {
    const { action, opId, copyId, barcode, studentId, condition, reason } = req.body;

    if (!['FORCE', 'DISCARD'].includes(action)) {
      return res.status(400).json({ error: 'action must be FORCE or DISCARD' });
    }
    if (action === 'DISCARD') {
      // Nothing to write: the station drops the operation locally and keeps it
      // in its own resolved list. Recorded here only so the decision is audited.
      logger.info('Sync conflict discarded', { opId, by: req.user.id, reason });
      return res.json({ status: 'discarded', opId });
    }

    if (!studentId) return res.status(400).json({ error: 'Say which student should have the book' });
    if (!copyId && !barcode) return res.status(400).json({ error: 'Say which copy' });

    const term = await getCurrentTerm();
    if (!term) return res.status(409).json({ error: SYNC_REJECT_REASONS.NO_CURRENT_TERM });

    const result = await prisma.$transaction(async (tx) => {
      const copy = await tx.bookCopy.findFirst({ where: copyId ? { id: copyId } : { barcode } });
      if (!copy) throw Object.assign(new Error('Copy not found'), { statusCode: 404 });

      const live = await tx.bookLoan.findFirst({ where: { copyId: copy.id, status: 'ACTIVE' } });
      if (live) {
        await tx.bookLoan.update({
          where: { id: live.id },
          data: {
            status: 'RETURNED',
            returnedAt: new Date(),
            returnedServerAt: new Date(),
            returnedById: req.user.id,
            // No condition: nobody inspected the book, this is a paperwork
            // correction. Recording a condition would be inventing evidence.
            returnedCondition: null,
            conditionNote: `Closed at the desk while sorting out who had this book. ${reason || ''}`.trim(),
            needsReview: true,
            reviewReason: 'Closed by a reconciliation decision, not by the book coming back.',
          },
        });
      }

      const opened = await applyOperation(tx, {
        kind: 'ISSUE',
        opId: opId ? `${opId}:forced` : `forced:${copy.id}:${Date.now()}`,
        copyId: copy.id,
        studentId,
        condition: condition || copy.condition,
        source: 'OFFLINE_SYNC',
      }, { operatorId: req.user.id, term });

      if (opened.status === 'applied') {
        await tx.bookLoan.update({
          where: { id: opened.loanId },
          data: {
            needsReview: true,
            reviewReason: `Opened by a reconciliation decision at the desk. ${reason || ''}`.trim(),
          },
        });
      }
      return { closedLoanId: live?.id ?? null, opened };
    });

    logger.info('Sync conflict forced', {
      opId, closed: result.closedLoanId, opened: result.opened.loanId, by: req.user.id, reason,
    });

    res.json({ status: 'forced', ...result });
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ error: error.message });
    next(error);
  }
};
