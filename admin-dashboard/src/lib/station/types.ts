import type { BookCondition, StudentVerification } from '../../types';

/** What a counter station can record. */
export type OpKind = 'ISSUE' | 'RETURN';

/**
 * One scan, as recorded at the counter.
 *
 * `opId` is generated the moment the librarian scans, before anything touches
 * the network. It is the idempotency key: if the request is sent and the reply
 * is lost, sending it again lands on the same loan instead of making a second
 * one.
 *
 * `seq` orders operations within this station. It is a counter, not a clock, so
 * fixing the laptop's date mid-shift cannot reorder the queue.
 */
export interface QueuedOp {
  opId: string;
  seq: number;
  kind: OpKind;
  stationId: string;
  barcode: string;
  copyId?: string;
  studentId?: string;
  /** Carried so a rejection can still be shown after the cached roster is gone. */
  studentLabel?: string;
  /** The loan this station believed was active. Distinguishes a stale return
   *  from a good one. */
  expectedLoanId?: string | null;
  condition?: BookCondition;
  note?: string;
  clientAt: string;
  state: 'pending' | 'sending' | 'applied' | 'rejected' | 'error';
  attempts: number;
}

/** The server's verdict on one operation. */
export interface OpResult {
  opId: string;
  status: 'applied' | 'rejected' | 'error';
  duplicate?: boolean;
  loanId?: string;
  reason?: string;
  message?: string;
  retryable?: boolean;
  barcode?: string;
  title?: string;
  dueAt?: string;
  overdueDays?: number;
  condition?: BookCondition;
  needsReview?: boolean;
  reviewReason?: string;
  student?: { id: string; name: string; formClass: string | null };
  charge?: { id: string; type: string; amount: number } | null;
  detail?: {
    heldBy?: string;
    formClass?: string | null;
    since?: string;
    loanId?: string;
    barcode?: string;
    title?: string;
    withdrawnReason?: string;
    withdrawnAt?: string;
  };
}

export interface DeskStudent {
  id: string;
  profileId: string;
  name: string;
  studentNumber: string | null;
  formClass: string | null;
  yearGroup: number | null;
  verification: StudentVerification;
  loanCap: number | null;
  outstandingTotal: number;
  activeLoans: { id: string; barcode: string; title: string; dueAt: string; overdue: boolean }[];
}
