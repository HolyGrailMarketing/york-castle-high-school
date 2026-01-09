export type UserRole = 'ADMIN' | 'STAFF' | 'STUDENT' | 'PARENT';

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

export interface SixthFormApplication {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address?: string;
  previousSchool?: string;
  csecResults?: any;
  subjectChoices: any;
  status: ApplicationStatus;
  notes?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  userId?: string;
  user?: User;
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

export interface Request {
  id: string;
  type: 'DOCUMENT' | 'DEVICE' | 'LAB' | 'GENERAL';
  title: string;
  description?: string;
  status: RequestStatus;
  userId?: string | null;
  user?: User | null;
  metadata?: any;
  response?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

