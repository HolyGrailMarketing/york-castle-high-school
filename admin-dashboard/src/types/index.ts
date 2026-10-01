export type UserRole = 'ADMIN' | 'STAFF' | 'TEACHER' | 'STUDENT' | 'PARENT';

export type ApplicationStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'WAITLISTED';

export type RequestStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  provider?: 'EMAIL' | 'GOOGLE';
  providerId?: string | null;
  picture?: string | null;
  notifyGeneralRequests?: boolean;
  notifySixthFormApps?: boolean;
  notifyAdmissions?: boolean;
  notifyOverdueRequests?: boolean;
  notifyOverdueBooks?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Application {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address?: string;
  previousSchool?: string;
  gradeApplying: number;
  status: ApplicationStatus;
  notes?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  userId?: string;
  user?: User;
}

export interface SixthFormInterview {
  id: string;
  applicationId: string;
  studentName: string;
  fullyMatriculated: boolean;
  awarenessMotivation?: number;
  knowledgeOfSchool?: number;
  appearance?: number;
  generalSuitability?: number;
  comments?: string;
  decision: 'RECOMMEND' | 'DO_NOT_RECOMMEND' | 'DEFER';
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SixthFormApplication {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address?: string;
  gender?: string;
  religion?: string;
  nationality?: string;
  yearsOfResidence?: number;
  previousSchool?: string;
  positionsHeld?: string;
  guardianInfo?: {
    firstName?: string;
    lastName?: string;
    relationship?: string;
    address?: string;
    town?: string;
    parish?: string;
    workPhone?: string;
    homePhone?: string;
    cellPhone?: string;
  };
  careerGoals?: string;
  strengthsWeaknesses?: string;
  reasonForAttending?: string;
  csecResults?: any;
  subjectChoices: any;
  /** Faculty the student has been placed in. The school's decision — distinct
   *  from subjectChoices, which is what the applicant asked for. */
  faculty?: string;
  status: ApplicationStatus;
  notes?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  interviewInvitedAt?: string;
  /** Set once the approved applicant has been made a student on the register.
   *  Deliberately separate from `status`: APPROVED stays true afterwards. */
  enrolledAt?: string | null;
  enrolledById?: string | null;
  enrolledUserId?: string | null;
  notifications?: SixthFormNotification[];
  userId?: string;
  user?: User;
}

export type SixthFormNotificationType = 'INTERVIEW_INVITATION' | 'CXC_RESULTS_RELEASED' | 'ACCEPTANCE_LETTER' | 'UNSUCCESSFUL_LETTER' | 'CUSTOM';

/** Everything on the acceptance letter that changes from one intake to the next. */
export interface AcceptanceLetterDetails {
  collectionStart: string; // YYYY-MM-DD
  collectionEnd: string;   // YYYY-MM-DD
  openFrom: string;
  openTo: string;
  cost: string;
}

export interface SixthFormNotification {
  type: SixthFormNotificationType;
  subject: string;
  sentAt: string;
}

/** Which readiness bucket the applications list is filtered to. */
export type SixthFormReadinessFilter =
  | ''
  | 'results-outstanding'
  | 'section-d-outstanding'
  | 'either-outstanding'
  | 'ready';

/**
 * How many applicants are still to act, counted server-side across every page
 * and ignoring the readiness filter itself so the figures don't move as staff
 * click through the buckets.
 */
export interface SixthFormReadiness {
  total: number;
  resultsOutstanding: number;
  sectionDOutstanding: number;
  ready: number;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  description?: string;
  pool?: number;
  teacher?: string;
  passRate?: number;
  capacity?: number;
  enrolled: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  published: boolean;
  publishedAt?: string;
  authorId: string;
  author: User;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  image?: string;
  isPublic: boolean;
  creatorId: string;
  creator: User;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  title: string;
  description?: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category?: string;
  isPublic: boolean;
  downloadCount: number;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BooklistEntry {
  id: string;
  schoolYear: string;
  gradeLabel: string;
  fileName: string;
  fileUrl: string;
  storagePath?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  sortOrder: number;
  isPublished: boolean;
  uploadedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Textbook rental -------------------------------------------------------

export type BookCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
export type CopyStatus = 'AVAILABLE' | 'ON_LOAN' | 'REPAIR' | 'LOST' | 'WITHDRAWN';
export type LoanStatus = 'ACTIVE' | 'RETURNED' | 'LOST' | 'WRITTEN_OFF';
export type ChargeType = 'RENTAL' | 'LOST' | 'DAMAGE';
export type ChargeStatus = 'OUTSTANDING' | 'WAIVED';
export type StudentVerification = 'UNVERIFIED' | 'VERIFIED' | 'REJECTED';

/** Copy counts per status. `total` excludes WITHDRAWN - it is "how many books
 *  do we have", not "how many rows are there". */
export interface CopyCounts {
  AVAILABLE: number;
  ON_LOAN: number;
  REPAIR: number;
  LOST: number;
  WITHDRAWN: number;
  total: number;
}

export interface Book {
  id: string;
  title: string;
  author?: string | null;
  publisher?: string | null;
  edition?: string | null;
  isbn?: string | null;
  subject: string;
  yearGroups: number[];
  replacementCost: number;
  rentalFee: number;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on list and detail responses, not on create/update. */
  copies?: CopyCounts;
}

export interface CopyHolder {
  id: string;
  name: string;
  formClass: string | null;
  studentNumber: string | null;
}

export interface BookCopy {
  id: string;
  bookId: string;
  barcode: string;
  copyNumber: number;
  condition: BookCondition;
  status: CopyStatus;
  acquiredAt?: string | null;
  batchId?: string | null;
  withdrawnAt?: string | null;
  withdrawnReason?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Read from the ACTIVE loan, which is the authoritative record of who holds
   *  the copy - not from `status`, which is a derived cache. */
  currentLoan?: {
    id: string;
    issuedAt: string;
    dueAt: string;
    student: CopyHolder;
  } | null;
}

export interface CopyLabel {
  barcode: string;
  copyNumber: number;
  title: string;
  subject: string;
}

export interface GenerateCopiesResult {
  batchId: string;
  count: number;
  firstBarcode: string;
  lastBarcode: string;
  barcodes: string[];
  message: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  studentNumber: string | null;
  /** What the office has confirmed. */
  yearGroup: number | null;
  formClass: string | null;
  /** What the student typed at sign-up. Kept even after the office corrects
   *  the confirmed fields, so the two can be compared. */
  claimedYearGroup: number | null;
  claimedFormClass: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  verification: StudentVerification;
  verifiedAt: string | null;
  registeredAtDesk: boolean;
  loanCap: number | null;
  notes?: string | null;
  createdAt: string;
  activeLoans: number;
}

export interface BookChargeRow {
  id: string;
  type: ChargeType;
  amount: number;
  currency: string;
  status: ChargeStatus;
  reason: string | null;
  academicYear: string;
  term: number | null;
  raisedAt: string;
  waivedAt: string | null;
  waiveReason: string | null;
  student: { id: string; name: string; formClass: string | null; studentNumber: string | null } | null;
  book: { title: string; barcode: string } | null;
}

export interface BookLoanRow {
  id: string;
  status: LoanStatus;
  issuedAt: string;
  dueAt: string;
  returnedAt: string | null;
  overdue: boolean;
  needsReview: boolean;
  reviewReason: string | null;
  issuedCondition: BookCondition;
  returnedCondition: BookCondition | null;
  barcode: string;
  title: string;
  subject: string;
  replacementCost: number;
  student: { id: string; name: string; formClass: string | null; studentNumber: string | null };
}

export interface LoanSummary {
  active: number;
  overdue: number;
  needsReview: number;
}

export interface StudentLoanSummary {
  id: string;
  status: LoanStatus;
  issuedAt: string;
  dueAt: string;
  returnedAt: string | null;
  barcode: string;
  title: string;
  subject: string;
}

export interface BookCharge {
  id: string;
  studentId: string;
  loanId: string | null;
  copyId: string | null;
  type: ChargeType;
  amount: number;
  currency: string;
  academicYear: string;
  term: number | null;
  status: ChargeStatus;
  reason: string | null;
  raisedAt: string;
  waivedAt: string | null;
  waiveReason: string | null;
}

export interface YearGroupOption {
  yearGroup: number;
  label: string;
  formClasses: string[];
  undivided: boolean;
}

export interface Request {
  id: string;
  type: 'DOCUMENT' | 'DEVICE' | 'LAB' | 'GENERAL';
  title: string;
  description?: string;
  status: RequestStatus;
  userId?: string | null;
  user?: User | null;
  assignedToId?: string | null;
  assignedTo?: Pick<User, 'id' | 'name' | 'email'> | null;
  assignedAt?: string | null;
  metadata?: any;
  response?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}


// ---------------------------------------------------------------------------
// School fees
//
// The school does not take this money: payment is made at the bank against a
// printed three-part voucher, and the stamped school's copy comes back as proof.
// ---------------------------------------------------------------------------

export type FeeKind = 'INCIDENTAL' | 'SCHOOL_FEE';
export type FeeAssessmentStatus = 'OUTSTANDING' | 'SETTLED' | 'WAIVED' | 'CANCELLED';
export type FeePaymentMethod = 'CASH' | 'CERTIFIED_CHEQUE';

export interface FeeScheduleItem {
  id?: string;
  label: string;
  amount: number;
  sortOrder?: number;
}

export interface FeeSchedule {
  id: string;
  kind: FeeKind;
  academicYear: string;
  yearGroup: number | null;
  term: number | null;
  label: string;
  currency: string;
  totalAmount: number;
  isPublished: boolean;
  notes: string | null;
  items: FeeScheduleItem[];
  /** How many students have already been charged this fee. */
  assessmentCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FeeStudentRef {
  id: string;
  name: string;
  formClass: string | null;
  studentNumber: string | null;
}

export interface FeeAssessmentRow {
  id: string;
  kind: FeeKind;
  label: string | null;
  academicYear: string;
  term: number | null;
  yearGroup: number | null;
  currency: string;
  totalAmount: number;
  paidAmount: number;
  /** Kept apart from paidAmount on screen: a waiver is not money received. */
  waivedAmount: number;
  balance: number;
  /** A parent rounded up. The school holds none of this money to refund. */
  overpaid: boolean;
  status: FeeAssessmentStatus;
  lines: { label: string; amount: number }[];
  issuedAt: string;
  waivedAt: string | null;
  waiveReason: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  student: FeeStudentRef | null;
  payments?: FeePaymentRow[];
  vouchers?: FeeVoucherRow[];
}

export interface FeePaymentRow {
  id: string;
  amount: number;
  currency: string;
  method: FeePaymentMethod;
  /** The date on the bank's stamp. */
  paidOn: string;
  /** When the office keyed it in, often days later. */
  recordedAt: string;
  bankReference: string | null;
  paidInBy: string | null;
  slipSeen: boolean;
  reversedAt: string | null;
  reverseReason: string | null;
  voucherSerial: number | null;
  assessment?: {
    id: string;
    kind: FeeKind;
    academicYear: string;
    term: number | null;
    student: FeeStudentRef | null;
  };
}

export interface FeeVoucherRow {
  id: string;
  serial: number;
  amountShown: number | null;
  issuedAt: string;
  printedCount: number;
  lastPrintedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

/** Everything the printed slip needs. The server owns every number on it. */
export interface VoucherPayload {
  id: string;
  serial: number;
  amountShown: number | null;
  issuedAt: string;
  printedCount: number;
  kind: FeeKind;
  label: string | null;
  academicYear: string;
  term: number | null;
  /** CHRISTMAS | EASTER | SUMMER - the slip header prints the word. */
  termLabel: string | null;
  currency: string;
  lines: { label: string; amount: number }[];
  total: number;
  alreadyPaid: number;
  balance: number;
  student: FeeStudentRef;
  bank: { name: string; branch: string; account: string };
}

export interface FeeSummary {
  charged: number;
  paid: number;
  waived: number;
  outstanding: number;
  studentsOwing: number;
}

export interface FeeSerialCounter {
  id: string;
  prefix: string;
  nextValue: number;
}

// ---------------------------------------------------------------------------
// The sixth form cohort — one record per student rather than per application.
// ---------------------------------------------------------------------------

export interface SixthFormFeeTotals {
  charged: number;
  paid: number;
  waived: number;
  balance: number;
  unpaidCount: number;
}

export interface SixthFormBookCounts {
  /** Active loans. */
  out: number;
  overdue: number;
  /** Outstanding book charges, in JMD. */
  owes: number;
}

export interface SixthFormStudentRow {
  id: string;
  name: string;
  /** Null when the record carries a placeholder .invalid address. */
  email: string | null;
  phone: string | null;
  formClass: string | null;
  yearGroup: number | null;
  studentNumber: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  verification: string | null;
  faculty: string | null;
  applicationId: string | null;
  interviewDecision: string | null;
  enrolledAt: string | null;
  fees: SixthFormFeeTotals;
  books: SixthFormBookCounts;
}

export interface SixthFormCohortSummary {
  students: number;
  owing: number;
  outstanding: number;
  booksOut: number;
  overdue: number;
  /** Enrolled but never placed in a faculty. */
  unplaced: number;
  unverified: number;
}

export interface SixthFormStudentDetail {
  student: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    joinedAt: string;
    faculty: string | null;
    profile: {
      id: string;
      studentNumber: string | null;
      yearGroup: number | null;
      formClass: string | null;
      guardianName: string | null;
      guardianPhone: string | null;
      guardianEmail: string | null;
      verification: string;
      verifiedAt: string | null;
      loanCap: number | null;
      notes: string | null;
    } | null;
  };
  application: {
    id: string;
    status: string;
    faculty: string | null;
    submittedAt: string;
    enrolledAt: string | null;
    previousSchool: string | null;
    csecResults: any;
    subjectChoices: any;
    careerGoals: string | null;
    guardianInfo: any;
    notes: string | null;
    notifications?: { type: string; subject: string; sentAt: string }[];
  } | null;
  interview: SixthFormInterview | null;
  fees: {
    assessments: {
      id: string;
      label: string | null;
      kind: FeeKind;
      academicYear: string;
      term: number | null;
      termLabel: string | null;
      totalAmount: number;
      paidAmount: number;
      waivedAmount: number;
      balance: number;
      status: FeeAssessmentStatus;
      lines: { label: string; amount: number }[];
      payments: {
        id: string; amount: number; method: FeePaymentMethod; paidOn: string;
        voucherSerial: number | null; reversedAt: string | null;
      }[];
      vouchers: { id: string; serial: number; issuedAt: string }[];
    }[];
    totals: { charged: number; paid: number; waived: number; balance: number };
  };
  books: {
    loans: {
      id: string; status: string; issuedAt: string; dueAt: string;
      returnedAt: string | null; overdue: boolean;
      barcode: string; title: string; subject: string;
    }[];
    charges: {
      id: string; type: string; amount: number; status: string;
      reason: string | null; raisedAt: string;
    }[];
    owed: number;
  };
}
