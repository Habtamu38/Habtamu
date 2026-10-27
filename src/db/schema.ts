import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. Schools (Multi-Tenant Root)
export const schools = pgTable('schools', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameAm: text('name_am').notNull(),
  schoolType: text('school_type').notNull(), // 'GOVERNMENT' | 'PRIVATE' | 'COMMUNITY'
  schoolLevel: text('school_level').notNull(), // 'PRIMARY' | 'SECONDARY' | 'K12'
  region: text('region').notNull(),
  city: text('city').notNull(),
  subCity: text('sub_city').notNull(),
  woreda: text('woreda').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  calendarSystem: text('calendar_system').notNull().default('BOTH'), // 'ETHIOPIAN' | 'GREGORIAN' | 'BOTH'
  currency: text('currency').notNull().default('ETB'),
  timezone: text('timezone').notNull().default('Africa/Addis_Ababa'),
  subscriptionStatus: text('subscription_status').notNull().default('ACTIVE'), // 'ACTIVE' | 'SUSPENDED' | 'TRIAL'
  academicYearLabel: text('academic_year_label').notNull().default('2019 E.C. (2026/27)'),
  currentTerm: text('current_term').notNull().default('Term 1 (Meskerem - Tahsas)'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Users (Linked to Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('SCHOOL_ADMIN'), // SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, REGISTRAR, TEACHER, FINANCE_OFFICER, LIBRARIAN, PARENT, STUDENT
  schoolId: integer('school_id').references(() => schools.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Grade Levels & Class Sections
export const classSections = pgTable('class_sections', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  gradeLevel: text('grade_level').notNull(), // e.g., 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
  sectionName: text('section_name').notNull(), // e.g., 'Section A', 'Section B'
  stream: text('stream').notNull().default('General'), // 'Natural Science', 'Social Science', 'General'
  roomNumber: text('room_number').notNull(),
  capacity: integer('capacity').notNull().default(45),
  homeroomTeacherName: text('homeroom_teacher_name').notNull(),
  academicYear: text('academic_year').notNull().default('2019 E.C.'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Students (Ethiopian 3-part naming convention: First, Father, Grandfather)
export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  studentCode: text('student_code').notNull().unique(),
  firstName: text('first_name').notNull(),
  fatherName: text('father_name').notNull(),
  grandfatherName: text('grandfather_name').notNull(),
  fullNameAm: text('full_name_am').notNull(),
  gender: text('gender').notNull(), // 'Male' | 'Female'
  dateOfBirth: text('date_of_birth').notNull(), // Canonical YYYY-MM-DD
  gradeLevel: text('grade_level').notNull(),
  sectionName: text('section_name').notNull(),
  guardianName: text('guardian_name').notNull(),
  guardianRelationship: text('guardian_relationship').notNull(),
  guardianPhone: text('guardian_phone').notNull(),
  emergencyContactPhone: text('emergency_contact_phone').notNull(),
  subCity: text('sub_city').notNull(),
  woreda: text('woreda').notNull(),
  previousSchool: text('previous_school').notNull().default('None'),
  enrollmentStatus: text('enrollment_status').notNull().default('ACTIVE'), // 'ACTIVE' | 'TRANSFERRED' | 'WITHDRAWN' | 'GRADUATED'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Teachers & Staff
export const teachers = pgTable('teachers', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  staffCode: text('staff_code').notNull().unique(),
  fullName: text('full_name').notNull(),
  fullNameAm: text('full_name_am').notNull(),
  roleTitle: text('role_title').notNull(), // 'Senior Teacher', 'Department Head', 'Librarian', 'Finance Officer'
  department: text('department').notNull(),
  qualification: text('qualification').notNull(), // 'B.Ed', 'M.Sc', 'B.Sc', 'M.A'
  assignedSubjects: text('assigned_subjects').notNull(),
  assignedGrades: text('assigned_grades').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  employmentStatus: text('employment_status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Subjects & Curriculum
export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  code: text('code').notNull(),
  nameEn: text('name_en').notNull(),
  nameAm: text('name_am').notNull(),
  gradeLevel: text('grade_level').notNull(),
  periodsPerWeek: integer('periods_per_week').notNull().default(5),
  continuousWeight: integer('continuous_weight').notNull().default(30),
  midtermWeight: integer('midterm_weight').notNull().default(20),
  finalWeight: integer('final_weight').notNull().default(50),
  passingMark: integer('passing_mark').notNull().default(50),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Attendance Records (Unique constraint per school, student, date)
export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: serial('id').primaryKey(),
    schoolId: integer('school_id')
      .references(() => schools.id)
      .notNull(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    attendanceDate: text('attendance_date').notNull(), // YYYY-MM-DD
    status: text('status').notNull(), // 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
    gradeLevel: text('grade_level').notNull(),
    sectionName: text('section_name').notNull(),
    remarks: text('remarks').notNull().default(''),
    recordedBy: text('recorded_by').notNull(),
    syncOperationId: text('sync_operation_id').notNull().unique(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    studentDateUnique: uniqueIndex('attendance_student_date_idx').on(
      table.schoolId,
      table.studentId,
      table.attendanceDate
    ),
  })
);

// 8. Examination Marks & Results
export const studentMarks = pgTable(
  'student_marks',
  {
    id: serial('id').primaryKey(),
    schoolId: integer('school_id')
      .references(() => schools.id)
      .notNull(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    subjectCode: text('subject_code').notNull(),
    subjectNameEn: text('subject_name_en').notNull(),
    subjectNameAm: text('subject_name_am').notNull(),
    academicYear: text('academic_year').notNull(),
    term: text('term').notNull(),
    continuousMark: numeric('continuous_mark', { precision: 5, scale: 2 }).notNull(), // max 30
    midtermMark: numeric('midterm_mark', { precision: 5, scale: 2 }).notNull(), // max 20
    finalMark: numeric('final_mark', { precision: 5, scale: 2 }).notNull(), // max 50
    totalMark: numeric('total_mark', { precision: 5, scale: 2 }).notNull(), // max 100
    gradeLetter: text('grade_letter').notNull(),
    status: text('status').notNull().default('DRAFT'), // 'DRAFT' | 'PUBLISHED' | 'FINALIZED'
    approvedBy: text('approved_by').notNull().default('Pending Approval'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    studentSubjectTermUnique: uniqueIndex('marks_student_subject_term_idx').on(
      table.schoolId,
      table.studentId,
      table.subjectCode,
      table.academicYear,
      table.term
    ),
  })
);

// 9. Finance: Student Invoices (ETB)
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  studentId: integer('student_id')
    .references(() => students.id)
    .notNull(),
  feeCategory: text('fee_category').notNull(), // 'Term Tuition Fee', 'Registration Fee', 'Transport Service Fee', 'Laboratory & Stem Fee'
  academicYear: text('academic_year').notNull(),
  term: text('term').notNull(),
  totalAmountEtb: numeric('total_amount_etb', { precision: 12, scale: 2 }).notNull(),
  discountEtb: numeric('discount_etb', { precision: 12, scale: 2 }).notNull().default('0.00'),
  paidAmountEtb: numeric('paid_amount_etb', { precision: 12, scale: 2 }).notNull().default('0.00'),
  balanceEtb: numeric('balance_etb', { precision: 12, scale: 2 }).notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('UNPAID'), // 'UNPAID' | 'PARTIAL' | 'PAID' | 'REVERSED'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Finance: Payments & Reversals (Immutable Ledger with Idempotency)
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  invoiceId: integer('invoice_id')
    .references(() => invoices.id)
    .notNull(),
  studentId: integer('student_id')
    .references(() => students.id)
    .notNull(),
  receiptNumber: text('receipt_number').notNull().unique(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  amountEtb: numeric('amount_etb', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').notNull(), // 'Telebirr' | 'CBE Birr' | 'Commercial Bank of Ethiopia Transfer' | 'Abyssinia Bank' | 'Cashier Receipt'
  transactionReference: text('transaction_reference').notNull(),
  recordedBy: text('recorded_by').notNull(),
  entryType: text('entry_type').notNull().default('PAYMENT'), // 'PAYMENT' | 'REVERSAL'
  reversalReason: text('reversal_reason').notNull().default(''),
  reversedPaymentId: integer('reversed_payment_id'),
  paidAt: timestamp('paid_at').defaultNow().notNull(),
});

// 11. Library Books & Circulation
export const libraryBooks = pgTable('library_books', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  isbn: text('isbn').notNull(),
  copyCode: text('copy_code').notNull().unique(),
  titleEn: text('title_en').notNull(),
  titleAm: text('title_am').notNull(),
  author: text('author').notNull(),
  category: text('category').notNull(),
  gradeLevel: text('grade_level').notNull(),
  status: text('status').notNull().default('AVAILABLE'), // 'AVAILABLE' | 'BORROWED' | 'OVERDUE'
  borrowerStudentId: integer('borrower_student_id').references(() => students.id),
  borrowerName: text('borrower_name').notNull().default(''),
  dueDate: text('due_date').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Transport Routes & Fleet
export const transportRoutes = pgTable('transport_routes', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  routeCode: text('route_code').notNull(),
  routeName: text('route_name').notNull(),
  stopsList: text('stops_list').notNull(),
  vehiclePlate: text('vehicle_plate').notNull(),
  driverName: text('driver_name').notNull(),
  driverPhone: text('driver_phone').notNull(),
  capacity: integer('capacity').notNull(),
  assignedCount: integer('assigned_count').notNull().default(0),
  termFeeEtb: numeric('term_fee_etb', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. Inventory & School Assets
export const inventoryAssets = pgTable('inventory_assets', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  assetCode: text('asset_code').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'Laboratory Equipment', 'ICT & Computers', 'Classroom Furniture', 'Library Media'
  department: text('department').notNull(),
  quantity: integer('quantity').notNull(),
  minimumThreshold: integer('minimum_threshold').notNull().default(5),
  conditionStatus: text('condition_status').notNull().default('GOOD'), // 'GOOD' | 'MAINTENANCE_REQUIRED' | 'LOW_STOCK'
  unitValueEtb: numeric('unit_value_etb', { precision: 12, scale: 2 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 14. Announcements & Notifications
export const announcements = pgTable('announcements', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  titleEn: text('title_en').notNull(),
  titleAm: text('title_am').notNull(),
  bodyEn: text('body_en').notNull(),
  bodyAm: text('body_am').notNull(),
  audience: text('audience').notNull(), // 'ALL' | 'PARENTS' | 'TEACHERS' | 'STUDENTS'
  channel: text('channel').notNull().default('IN_APP_AND_SMS'), // 'IN_APP' | 'IN_APP_AND_SMS' | 'EMAIL'
  priority: text('priority').notNull().default('NORMAL'), // 'NORMAL' | 'URGENT'
  publishedBy: text('published_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 15. Offline Synchronization Operations Log & Conflict Queue
export const syncOperations = pgTable('sync_operations', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  operationId: text('operation_id').notNull().unique(),
  deviceId: text('device_id').notNull(),
  entityType: text('entity_type').notNull(), // 'ATTENDANCE' | 'STUDENT_MARK_DRAFT' | 'STUDENT_REGISTRATION'
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(), // 'UPSERT' | 'CREATE' | 'UPDATE'
  payloadJson: text('payload_json').notNull(),
  versionNumber: integer('version_number').notNull().default(1),
  syncStatus: text('sync_status').notNull().default('SYNCED'), // 'SYNCED' | 'CONFLICT' | 'RESOLVED'
  conflictReason: text('conflict_reason').notNull().default(''),
  clientTimestamp: text('client_timestamp').notNull(),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
});

// 16. Security & Operational Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').references(() => schools.id),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  module: text('module').notNull(), // 'AUTH' | 'TENANT_ISOLATION' | 'FINANCE' | 'EXAMINATIONS' | 'ATTENDANCE' | 'SYNC'
  entityRef: text('entity_ref').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 17. Admin-Registered Portal Accounts & 6-Digit Role Access Codes (STU-, TEA-, FIN-, LIN-)
export const portalAccounts = pgTable('portal_accounts', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  email: text('email').notNull(),
  accessCode: text('access_code').notNull().unique(), // e.g., STU-482910, TEA-739201, FIN-518392, LIN-629405, ADM-100001
  fullName: text('full_name').notNull(),
  fullNameAm: text('full_name_am').notNull(),
  role: text('role').notNull(), // 'SCHOOL_ADMIN' | 'STUDENT' | 'TEACHER' | 'FINANCE_OFFICER' | 'LIBRARIAN'
  linkedStudentId: integer('linked_student_id').references(() => students.id),
  linkedTeacherId: integer('linked_teacher_id').references(() => teachers.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. Digital EBooks for Student EBook Reader & Library Portal
export const ebooks = pgTable('ebooks', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  code: text('code').notNull(),
  titleEn: text('title_en').notNull(),
  titleAm: text('title_am').notNull(),
  subjectCode: text('subject_code').notNull(),
  gradeLevel: text('grade_level').notNull(),
  author: text('author').notNull(),
  summary: text('summary').notNull(),
  contentBody: text('content_body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 19. Homework Assignments Posted by Teachers for Students
export const homeworks = pgTable('homeworks', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  title: text('title').notNull(),
  subjectCode: text('subject_code').notNull(),
  gradeLevel: text('grade_level').notNull(),
  sectionName: text('section_name').notNull(),
  dueDate: text('due_date').notNull(),
  instructions: text('instructions').notNull(),
  postedBy: text('posted_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 20. Interactive Online Exams Posted by Teachers for Student Exam Space
export const onlineExams = pgTable('online_exams', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  title: text('title').notNull(),
  subjectCode: text('subject_code').notNull(),
  gradeLevel: text('grade_level').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(30),
  questionsJson: text('questions_json').notNull(), // JSON array of { q, options, correctIndex }
  postedBy: text('posted_by').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 21. Student Online Exam Submissions
export const onlineExamSubmissions = pgTable('online_exam_submissions', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  examId: integer('exam_id')
    .references(() => onlineExams.id)
    .notNull(),
  studentId: integer('student_id')
    .references(() => students.id)
    .notNull(),
  score: integer('score').notNull(),
  totalQuestions: integer('total_questions').notNull(),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
});

// Relations
export const schoolsRelations = relations(schools, ({ many }) => ({
  students: many(students),
  teachers: many(teachers),
  invoices: many(invoices),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  school: one(schools, {
    fields: [students.schoolId],
    references: [schools.id],
  }),
  attendance: many(attendanceRecords),
  marks: many(studentMarks),
  invoices: many(invoices),
}));

