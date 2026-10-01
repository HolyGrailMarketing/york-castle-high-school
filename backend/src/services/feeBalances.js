/**
 * What a fee assessment currently stands at.
 *
 * FeeAssessment.paidAmount, waivedAmount and status are derived caches of the
 * FeePayment rows beneath them, in the same spirit as BookCopy.status being a
 * cache of BookLoan. "Who still owes" is the most-run query in this feature and
 * it is run over every student in a year group, so a correlated SUM per row on
 * every page load is not acceptable.
 *
 * The deal that makes a cache safe is that exactly one function writes it and
 * every caller is already inside the transaction that changed the payments.
 * That function is recomputeAssessment. scripts/reconcile-fee-balances.js
 * recomputes the same values straight from FeePayment, so drift is something
 * that gets detected rather than something that gets believed.
 */

/**
 * Money in, money out.
 *
 * Prisma hands back Decimal objects, and `decimal + decimal` in JavaScript
 * concatenates two objects into a string instead of adding them. Everything
 * below goes through Number() first and is rounded back to cents afterwards, so
 * a long run of part-payments cannot drift a balance by a fraction of a cent.
 */
export const money = (value) => (value === null || value === undefined ? null : Number(value));

/** Round to cents. Guards the usual binary-floating-point surprises. */
export const toCents = (value) => Math.round(Number(value || 0) * 100) / 100;

/**
 * Recompute an assessment's cached totals and status from its payments.
 *
 * Call inside the transaction that changed something: recording a payment,
 * reversing one, waiving, or cancelling. Returns the updated row.
 */
export const recomputeAssessment = async (tx, assessmentId) => {
  const assessment = await tx.feeAssessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) return null;

  // A reversed payment is still on the record, but it is not money.
  const sum = await tx.feePayment.aggregate({
    where: { assessmentId, reversedAt: null },
    _sum: { amount: true },
  });

  const paidAmount = toCents(money(sum._sum.amount) || 0);
  const waivedAmount = toCents(money(assessment.waivedAmount) || 0);
  const totalAmount = toCents(money(assessment.totalAmount) || 0);

  const status = statusFor({ assessment, paidAmount, waivedAmount, totalAmount });

  return tx.feeAssessment.update({
    where: { id: assessmentId },
    data: { paidAmount, status },
  });
};

/**
 * The status rule, in one place.
 *
 * Cancelled wins over everything: a cancelled assessment is one that should
 * never have been raised, and what was paid against it is a separate problem
 * for the office rather than a reason to call it settled.
 *
 * A waive and a part-payment can jointly settle a bill, which is why SETTLED
 * tests the sum of the two rather than either alone.
 */
export const statusFor = ({ assessment, paidAmount, waivedAmount, totalAmount }) => {
  if (assessment.cancelledAt) return 'CANCELLED';
  if (waivedAmount >= totalAmount && totalAmount > 0) return 'WAIVED';
  if (paidAmount + waivedAmount >= totalAmount) return 'SETTLED';
  return 'OUTSTANDING';
};

/** What is still owed. Negative when a parent has rounded up; see shape(). */
export const balanceOf = (assessment) =>
  toCents(
    toCents(money(assessment.totalAmount))
    - toCents(money(assessment.paidAmount))
    - toCents(money(assessment.waivedAmount))
  );

/**
 * One assessment, as the dashboard and the student page see it.
 *
 * Every Decimal is converted here so no caller ever has to remember. Paid and
 * waived stay separate all the way to the screen: rolled into one "credited"
 * figure, the office reads a waiver as money received and goes looking for it.
 */
export const shapeAssessment = (a) => {
  const balance = balanceOf(a);
  return {
    id: a.id,
    kind: a.kind,
    label: a.schedule?.label ?? null,
    academicYear: a.academicYear,
    term: a.term,
    yearGroup: a.yearGroup,
    currency: a.currency,
    totalAmount: money(a.totalAmount),
    paidAmount: money(a.paidAmount),
    waivedAmount: money(a.waivedAmount),
    balance,
    // A parent who rounds J$7,950 up to J$8,000 leaves a credit the school has
    // no way to refund, so it is surfaced rather than hidden behind a zero.
    overpaid: balance < 0,
    status: a.status,
    lines: Array.isArray(a.lines) ? a.lines : [],
    issuedAt: a.issuedAt,
    waivedAt: a.waivedAt,
    waiveReason: a.waiveReason,
    cancelledAt: a.cancelledAt,
    cancelReason: a.cancelReason,
    student: a.student
      ? {
          id: a.student.id,
          name: a.student.name,
          formClass: a.student.studentProfile?.formClass ?? null,
          studentNumber: a.student.studentProfile?.studentNumber ?? null,
        }
      : null,
    payments: a.payments ? a.payments.map(shapePayment) : undefined,
    vouchers: a.vouchers ? a.vouchers.map(shapeVoucher) : undefined,
  };
};

export const shapePayment = (p) => ({
  id: p.id,
  amount: money(p.amount),
  currency: p.currency,
  method: p.method,
  paidOn: p.paidOn,
  recordedAt: p.recordedAt,
  bankReference: p.bankReference,
  paidInBy: p.paidInBy,
  slipSeen: p.slipSeen,
  reversedAt: p.reversedAt,
  reverseReason: p.reverseReason,
  voucherSerial: p.voucher?.serial ?? null,
  assessment: p.assessment
    ? {
        id: p.assessment.id,
        kind: p.assessment.kind,
        academicYear: p.assessment.academicYear,
        term: p.assessment.term,
        student: p.assessment.student
          ? {
              id: p.assessment.student.id,
              name: p.assessment.student.name,
              formClass: p.assessment.student.studentProfile?.formClass ?? null,
              studentNumber: p.assessment.student.studentProfile?.studentNumber ?? null,
            }
          : null,
      }
    : undefined,
});

export const shapeVoucher = (v) => ({
  id: v.id,
  serial: v.serial,
  amountShown: money(v.amountShown),
  issuedAt: v.issuedAt,
  printedCount: v.printedCount,
  lastPrintedAt: v.lastPrintedAt,
  voidedAt: v.voidedAt,
  voidReason: v.voidReason,
});

export const shapeSchedule = (s) => ({
  id: s.id,
  kind: s.kind,
  academicYear: s.academicYear,
  yearGroup: s.yearGroup,
  term: s.term,
  label: s.label,
  currency: s.currency,
  totalAmount: money(s.totalAmount),
  isPublished: s.isPublished,
  notes: s.notes,
  items: (s.items || []).map((i) => ({
    id: i.id,
    label: i.label,
    amount: money(i.amount),
    sortOrder: i.sortOrder,
  })),
  assessmentCount: s._count?.assessments ?? undefined,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
});

/**
 * The three terms, as the slip prints them.
 *
 * AcademicTerm stores 1 | 2 | 3, but the voucher header reads
 * "2026-2027|CHRISTMAS", so the word has to come from somewhere. Here, once.
 */
export const TERM_LABELS = { 1: 'CHRISTMAS', 2: 'EASTER', 3: 'SUMMER' };

export const termLabel = (term) => (term ? TERM_LABELS[term] || `TERM ${term}` : null);
