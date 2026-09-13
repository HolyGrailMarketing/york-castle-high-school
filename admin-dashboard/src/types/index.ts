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

