import { LanguageCode, UserRole } from '../utils/ethiopianRules';
export type { LanguageCode, UserRole };

export type CalendarDisplayMode = 'ETHIOPIAN' | 'GREGORIAN' | 'BOTH';

export type ActiveTabId =
  | 'overview'
  | 'access_control'
  | 'student_portal'
  | 'teacher_portal'
  | 'schools'
  | 'students'
  | 'teachers'
  | 'attendance'
  | 'exams'
  | 'finance'
  | 'operations'
  | 'portals'
  | 'sync'
  | 'deliverables';

export interface SchoolRecord {
  id: number;
  code: string;
  nameEn: string;
  nameAm: string;
  schoolType: string;
  schoolLevel: string;
  region: string;
  city: string;
  subCity: string;
  woreda: string;
  phone: string;
  email: string;
  calendarSystem: string;
  currency: string;
  timezone: string;
  subscriptionStatus: string;
  academicYearLabel: string;
  currentTerm: string;
}

export interface StudentRecord {
  id: number;
  schoolId: number;
  studentCode: string;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  fullNameAm: string;
  gender: string;
  dateOfBirth: string;
  gradeLevel: string;
  sectionName: string;
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  emergencyContactPhone: string;
  subCity: string;
  woreda: string;
  previousSchool: string;
  enrollmentStatus: string;
}

export interface TeacherRecord {
  id: number;
  schoolId: number;
  staffCode: string;
  fullName: string;
  fullNameAm: string;
  roleTitle: string;
  department: string;
  qualification: string;
  assignedSubjects: string;
  assignedGrades: string;
  phone: string;
  email: string;
  employmentStatus: string;
}

export interface ClassSectionRecord {
  id: number;
  schoolId: number;
  gradeLevel: string;
  sectionName: string;
  stream: string;
  roomNumber: string;
  capacity: number;
  homeroomTeacherName: string;
  academicYear: string;
}

export interface SubjectRecord {
  id: number;
  schoolId: number;
  code: string;
  nameEn: string;
  nameAm: string;
  gradeLevel: string;
  periodsPerWeek: number;
  continuousWeight: number;
  midtermWeight: number;
  finalWeight: number;
  passingMark: number;
}

export interface AttendanceRecordItem {
  id: number;
  schoolId: number;
  studentId: number;
  attendanceDate: string;
  status: string;
  gradeLevel: string;
  sectionName: string;
  remarks: string;
  recordedBy: string;
  syncOperationId: string;
}

export interface StudentMarkRecord {
  id: number;
  schoolId: number;
  studentId: number;
  subjectCode: string;
  subjectNameEn: string;
  subjectNameAm: string;
  academicYear: string;
  term: string;
  continuousMark: string;
  midtermMark: string;
  finalMark: string;
  totalMark: string;
  gradeLetter: string;
  status: string;
  approvedBy: string;
}

export interface InvoiceRecord {
  id: number;
  schoolId: number;
  invoiceNumber: string;
  studentId: number;
  feeCategory: string;
  academicYear: string;
  term: string;
  totalAmountEtb: string;
  discountEtb: string;
  paidAmountEtb: string;
  balanceEtb: string;
  dueDate: string;
  status: string;
}

export interface PaymentRecord {
  id: number;
  schoolId: number;
  invoiceId: number;
  studentId: number;
  receiptNumber: string;
  idempotencyKey: string;
  amountEtb: string;
  paymentMethod: string;
  transactionReference: string;
  recordedBy: string;
  entryType: string;
  reversalReason: string;
  reversedPaymentId: number | null;
  paidAt: string;
}

export interface LibraryBookRecord {
  id: number;
  schoolId: number;
  isbn: string;
  copyCode: string;
  titleEn: string;
  titleAm: string;
  author: string;
  category: string;
  gradeLevel: string;
  status: string;
  borrowerStudentId: number | null;
  borrowerName: string;
  dueDate: string;
}

export interface TransportRouteRecord {
  id: number;
  schoolId: number;
  routeCode: string;
  routeName: string;
  stopsList: string;
  vehiclePlate: string;
  driverName: string;
  driverPhone: string;
  capacity: number;
  assignedCount: number;
  termFeeEtb: string;
}

export interface InventoryAssetRecord {
  id: number;
  schoolId: number;
  assetCode: string;
  name: string;
  category: string;
  department: string;
  quantity: number;
  minimumThreshold: number;
  conditionStatus: string;
  unitValueEtb: string;
}

export interface AnnouncementRecord {
  id: number;
  schoolId: number;
  titleEn: string;
  titleAm: string;
  bodyEn: string;
  bodyAm: string;
  audience: string;
  channel: string;
  priority: string;
  publishedBy: string;
  createdAt: string;
}

export interface SyncOperationRecord {
  id: number;
  schoolId: number;
  operationId: string;
  deviceId: string;
  entityType: string;
  entityId: string;
  action: string;
  payloadJson: string;
  versionNumber: number;
  syncStatus: string;
  conflictReason: string;
  clientTimestamp: string;
  syncedAt: string;
}

export interface AuditLogRecord {
  id: number;
  schoolId: number | null;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  entityRef: string;
  details: string;
  createdAt: string;
}

export interface OfflineQueuedOperation {
  operationId: string;
  deviceId: string;
  entityType: 'ATTENDANCE' | 'STUDENT_MARK_DRAFT';
  entityId: string;
  action: 'UPSERT';
  payload: Record<string, any>;
  versionNumber: number;
  clientTimestamp: string;
}

export interface PortalAccountRecord {
  id: number;
  schoolId: number;
  email: string;
  accessCode: string;
  fullName: string;
  fullNameAm: string;
  role: UserRole;
  linkedStudentId: number | null;
  linkedTeacherId: number | null;
  isActive: boolean;
}

export interface EBookRecord {
  id: number;
  schoolId: number;
  code: string;
  titleEn: string;
  titleAm: string;
  subjectCode: string;
  gradeLevel: string;
  author: string;
  summary: string;
  contentBody: string;
  createdAt: string;
}

export interface HomeworkSubmissionFileRecord {
  id: string;
  homeworkId: number;
  homeworkTitle: string;
  subjectCode: string;
  studentId: number;
  studentCode: string;
  studentName: string;
  fileName: string;
  fileSizeBytes: number;
  fileType: string;
  fileContentPreview: string;
  notes: string;
  status: 'SUBMITTED' | 'REVIEWED' | 'NEEDS_REVISION';
  teacherFeedback: string;
  gradeScore?: string;
  submittedAt: string;
}

export interface HomeworkRecord {
  id: number;
  schoolId: number;
  title: string;
  subjectCode: string;
  gradeLevel: string;
  sectionName: string;
  dueDate: string;
  instructions: string;
  postedBy: string;
  createdAt: string;
  submissions?: HomeworkSubmissionFileRecord[];
}

export interface OnlineExamQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface OnlineExamRecord {
  id: number;
  schoolId: number;
  title: string;
  subjectCode: string;
  gradeLevel: string;
  durationMinutes: number;
  questionsJson: string;
  postedBy: string;
  isActive: boolean;
  createdAt: string;
}

export interface OnlineExamSubmissionRecord {
  id: number;
  schoolId: number;
  examId: number;
  studentId: number;
  score: number;
  totalQuestions: number;
  submittedAt: string;
}

export interface WorkspacePayload {
  school: SchoolRecord | null;
  students: StudentRecord[];
  teachers: TeacherRecord[];
  classSections: ClassSectionRecord[];
  subjects: SubjectRecord[];
  attendance: AttendanceRecordItem[];
  marks: StudentMarkRecord[];
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
  libraryBooks: LibraryBookRecord[];
  transportRoutes: TransportRouteRecord[];
  inventoryAssets: InventoryAssetRecord[];
  announcements: AnnouncementRecord[];
  syncOperations: SyncOperationRecord[];
  auditLogs: AuditLogRecord[];
  portalAccounts: PortalAccountRecord[];
  ebooks: EBookRecord[];
  homeworks: HomeworkRecord[];
  onlineExams: OnlineExamRecord[];
  onlineExamSubmissions: OnlineExamSubmissionRecord[];
}

export interface SharedViewProps {
  lang: LanguageCode;
  calendarMode: CalendarDisplayMode;
  role: UserRole;
  activeSchoolId: number;
  schools: SchoolRecord[];
  workspace: WorkspacePayload;
  onRefresh: () => Promise<void>;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  onNavigateTab: (tab: ActiveTabId) => void;
}

