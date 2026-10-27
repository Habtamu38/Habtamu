import { desc, eq, and } from 'drizzle-orm';
import { db, ensureSchemaInitialized } from './index.ts';
import {
  announcements,
  attendanceRecords,
  auditLogs,
  classSections,
  ebooks,
  homeworks,
  inventoryAssets,
  invoices,
  libraryBooks,
  onlineExamSubmissions,
  onlineExams,
  payments,
  portalAccounts,
  schools,
  studentMarks,
  students,
  subjects,
  syncOperations,
  teachers,
  transportRoutes,
  users,
} from './schema.ts';
import {
  AccessCodePrefix,
  calculateAssessmentResult,
  calculateInvoiceBalance,
  fromSantim,
  generateRoleAccessCode,
  toSantim,
  validateEthiopianStudentName,
  validateRoleAccessCode,
} from '../utils/ethiopianRules.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  fullName: string = 'School Administrator',
  role: string = 'SCHOOL_ADMIN',
  schoolId: number | null = 1
) {
  try {
    await ensureInitialDataSeeded();
    let validSchoolId: number | null = null;
    if (schoolId !== null) {
      const found = await db.select().from(schools).where(eq(schools.id, schoolId));
      if (found.length > 0) {
        validSchoolId = found[0].id;
      } else {
        const all = await db.select().from(schools).limit(1);
        validSchoolId = all[0]?.id ?? null;
      }
    }
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        fullName,
        role,
        schoolId: validSchoolId,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          fullName,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Failed to synchronize user record.', { cause: error });
  }
}

export async function logAuditEvent(params: {
  schoolId: number | null;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  entityRef: string;
  details: string;
}) {
  try {
    await db.insert(auditLogs).values({
      schoolId: params.schoolId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: params.action,
      module: params.module,
      entityRef: params.entityRef,
      details: params.details,
    });
  } catch (error) {
    console.error('Audit log insert failed:', error);
  }
}

let isSeeded = false;

const LEGACY_EXAMPLE_STUDENT_CODES = new Set([
  'ET-BOLE-2019-001',
  'ET-BOLE-2019-002',
  'ET-BOLE-2019-003',
  'ET-BOLE-2019-004',
  'ET-TANA-2019-101',
  'STU-482910',
  'STU-593821',
  'STU-604932',
  'STU-715043',
  'STU-371809',
  'ABSS-2017-0001',
  'ABSS-2017-0002',
]);

const LEGACY_EXAMPLE_TEACHER_CODES = new Set([
  'TCH-BOLE-101',
  'TCH-BOLE-102',
  'TCH-BOLE-103',
  'TCH-TANA-201',
  'STF-BOLE-101',
  'STF-BOLE-102',
  'STF-BOLE-103',
  'STF-TANA-201',
  'TEA-739201',
  'TEA-739202',
  'TEA-739203',
  'TEA-840312',
  'TEA-951423',
  'TEA-918273',
]);

const LEGACY_EXAMPLE_EBOOK_CODES = new Set(['EBK-MATH-10', 'EBK-AMH-10', 'EBK-PHY-11']);

export async function ensureInitialDataSeeded() {
  if (isSeeded) return;
  try {
    await ensureSchemaInitialized();
    // Check if any pre-seeded example records from earlier builds exist and remove them
    // so ONLY user-entered data remains in the database.
    const [existingSchools, existingStudents, existingTeachers, existingEbooks] = await Promise.all([
      db.select().from(schools).orderBy(schools.id),
      db.select().from(students),
      db.select().from(teachers),
      db.select().from(ebooks),
    ]);

    const hasLegacyExampleData =
      existingSchools.some((s) => s.code === 'AM-TANA-AC-02') ||
      existingStudents.some(
        (s) =>
          LEGACY_EXAMPLE_STUDENT_CODES.has(s.studentCode) ||
          (s.firstName === 'Yohannes' && s.fatherName === 'Kebede' && s.grandfatherName === 'Worku') ||
          (s.firstName === 'Mekdes' && s.fatherName === 'Tadesse' && s.grandfatherName === 'Girma') ||
          (s.firstName === 'Dawit' && s.fatherName === 'Alemu' && s.grandfatherName === 'Tesfaye')
      ) ||
      existingTeachers.some((t) => LEGACY_EXAMPLE_TEACHER_CODES.has(t.staffCode)) ||
      existingEbooks.some((e) => LEGACY_EXAMPLE_EBOOK_CODES.has(e.code));

    if (hasLegacyExampleData) {
      await db.delete(onlineExamSubmissions);
      await db.delete(onlineExams);
      await db.delete(homeworks);
      await db.delete(ebooks);
      await db.delete(portalAccounts);
      await db.delete(auditLogs);
      await db.delete(syncOperations);
      await db.delete(announcements);
      await db.delete(inventoryAssets);
      await db.delete(transportRoutes);
      await db.delete(libraryBooks);
      await db.delete(payments);
      await db.delete(invoices);
      await db.delete(studentMarks);
      await db.delete(attendanceRecords);
      await db.delete(students);
      await db.delete(teachers);
      await db.delete(subjects);
      await db.delete(classSections);
      await db.update(users).set({ schoolId: null });
      await db.delete(schools).where(eq(schools.code, 'AM-TANA-AC-02'));
    }

    // Ensure at least 1 default school workspace shell exists so schoolId foreign keys work
    let currentSchools = await db.select().from(schools).orderBy(schools.id);
    if (currentSchools.length === 0) {
      currentSchools = await db
        .insert(schools)
        .values([
          {
            code: 'ESMS-SCHOOL-01',
            nameEn: 'Ethiopian School Management System',
            nameAm: 'የኢትዮጵያ ትምህርት ቤት አስተዳደር ሲስተም',
            schoolType: 'GOVERNMENT',
            schoolLevel: 'SECONDARY (Grades 9-12)',
            region: 'Addis Ababa City Administration',
            city: 'Addis Ababa',
            subCity: 'Bole',
            woreda: 'Woreda 01',
            phone: '+251-111-000-000',
            email: 'habteofat@gmail.com',
            calendarSystem: 'BOTH',
            currency: 'ETB',
            timezone: 'Africa/Addis_Ababa',
            subscriptionStatus: 'ACTIVE',
            academicYearLabel: '2019 E.C. (2026/27 G.C.)',
            currentTerm: 'Term 1 (Meskerem - Tahsas)',
          },
        ])
        .returning();
    }

    const primarySchoolId = currentSchools[0].id;

    // Ensure ONLY the primary System Administrator login account exists initially
    const existingAdmin = await db
      .select()
      .from(portalAccounts)
      .where(eq(portalAccounts.email, 'habteofat@gmail.com'));

    if (existingAdmin.length === 0) {
      await db
        .insert(portalAccounts)
        .values({
          schoolId: primarySchoolId,
          email: 'habteofat@gmail.com',
          accessCode: 'ADM-100001',
          fullName: 'Ato Habtamu (System Administrator)',
          fullNameAm: 'አቶ ሀብታሙ (የሲስተም አስተዳዳሪ)',
          role: 'SCHOOL_ADMIN',
          linkedStudentId: null,
          linkedTeacherId: null,
          isActive: true,
        })
        .onConflictDoNothing();
    } else if (!existingAdmin[0].isActive) {
      await db
        .update(portalAccounts)
        .set({ isActive: true })
        .where(eq(portalAccounts.id, existingAdmin[0].id));
    }

    isSeeded = true;
  } catch (error) {
    console.error('Error initializing ESMS workspace:', error);
    throw new Error('Failed to initialize school database records.', { cause: error });
  }
}

export async function getAllSchools() {
  try {
    await ensureInitialDataSeeded();
    const rows = await db.select().from(schools).orderBy(schools.id);
    return rows.map((s) => ({
      ...s,
      nameAm: s.nameEn,
    }));
  } catch (error) {
    console.error('Database query failed in getAllSchools:', error);
    throw new Error('Failed to load schools.', { cause: error });
  }
}

export async function createSchoolTenant(input: {
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
  actorName: string;
  actorRole: string;
}) {
  try {
    const [created] = await db
      .insert(schools)
      .values({
        code: input.code.trim().toUpperCase(),
        nameEn: input.nameEn.trim(),
        nameAm: input.nameAm.trim(),
        schoolType: input.schoolType,
        schoolLevel: input.schoolLevel,
        region: input.region,
        city: input.city,
        subCity: input.subCity,
        woreda: input.woreda,
        phone: input.phone,
        email: input.email,
      })
      .returning();

    await logAuditEvent({
      schoolId: created.id,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'CREATE_SCHOOL_TENANT',
      module: 'TENANT_ISOLATION',
      entityRef: created.code,
      details: `Onboarded new Ethiopian school tenant: ${created.nameEn} (${created.nameAm})`,
    });

    return created;
  } catch (error) {
    console.error('Failed to create school tenant:', error);
    throw new Error('Failed to register school. Verify the school code is unique.', {
      cause: error,
    });
  }
}

export async function getSchoolWorkspaceData(schoolId: number) {
  try {
    await ensureInitialDataSeeded();
    await ensurePortalAndLearningDataSeeded();

    const [
      schoolRows,
      studentRows,
      teacherRows,
      sectionRows,
      subjectRows,
      attendanceRows,
      markRows,
      invoiceRows,
      paymentRows,
      libraryRows,
      transportRows,
      inventoryRows,
      announcementRows,
      syncRows,
      auditRows,
      portalAccountRows,
      ebookRows,
      homeworkRows,
      onlineExamRows,
      submissionRows,
    ] = await Promise.all([
      db.select().from(schools).where(eq(schools.id, schoolId)),
      db.select().from(students).where(eq(students.schoolId, schoolId)).orderBy(desc(students.id)),
      db.select().from(teachers).where(eq(teachers.schoolId, schoolId)).orderBy(teachers.id),
      db
        .select()
        .from(classSections)
        .where(eq(classSections.schoolId, schoolId))
        .orderBy(classSections.id),
      db.select().from(subjects).where(eq(subjects.schoolId, schoolId)).orderBy(subjects.id),
      db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.schoolId, schoolId))
        .orderBy(desc(attendanceRecords.id)),
      db
        .select()
        .from(studentMarks)
        .where(eq(studentMarks.schoolId, schoolId))
        .orderBy(desc(studentMarks.id)),
      db.select().from(invoices).where(eq(invoices.schoolId, schoolId)).orderBy(desc(invoices.id)),
      db.select().from(payments).where(eq(payments.schoolId, schoolId)).orderBy(desc(payments.id)),
      db
        .select()
        .from(libraryBooks)
        .where(eq(libraryBooks.schoolId, schoolId))
        .orderBy(libraryBooks.id),
      db
        .select()
        .from(transportRoutes)
        .where(eq(transportRoutes.schoolId, schoolId))
        .orderBy(transportRoutes.id),
      db
        .select()
        .from(inventoryAssets)
        .where(eq(inventoryAssets.schoolId, schoolId))
        .orderBy(inventoryAssets.id),
      db
        .select()
        .from(announcements)
        .where(eq(announcements.schoolId, schoolId))
        .orderBy(desc(announcements.id)),
      db
        .select()
        .from(syncOperations)
        .where(eq(syncOperations.schoolId, schoolId))
        .orderBy(desc(syncOperations.id)),
      db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.schoolId, schoolId))
        .orderBy(desc(auditLogs.id)),
      db
        .select()
        .from(portalAccounts)
        .where(eq(portalAccounts.schoolId, schoolId))
        .orderBy(portalAccounts.id),
      db.select().from(ebooks).where(eq(ebooks.schoolId, schoolId)).orderBy(ebooks.id),
      db
        .select()
        .from(homeworks)
        .where(eq(homeworks.schoolId, schoolId))
        .orderBy(desc(homeworks.id)),
      db
        .select()
        .from(onlineExams)
        .where(eq(onlineExams.schoolId, schoolId))
        .orderBy(desc(onlineExams.id)),
      db
        .select()
        .from(onlineExamSubmissions)
        .where(eq(onlineExamSubmissions.schoolId, schoolId))
        .orderBy(desc(onlineExamSubmissions.id)),
    ]);

    // Parse student homework file submissions stored in sync_operations (entityType = 'HOMEWORK_SUBMISSION')
    // and attach them directly onto each HomeworkRecord in workspace.homeworks
    const parsedHwSubmissions = syncRows
      .filter((op) => op.entityType === 'HOMEWORK_SUBMISSION')
      .map((op) => {
        try {
          const parsed = JSON.parse(op.payloadJson);
          return {
            id: op.operationId,
            homeworkId: Number(parsed.homeworkId || op.entityId || 0),
            homeworkTitle: String(parsed.homeworkTitle || 'Homework Assignment'),
            subjectCode: String(parsed.subjectCode || 'MATH-10'),
            studentId: Number(parsed.studentId || 1),
            studentCode: String(parsed.studentCode || 'STU-482910'),
            studentName: String(parsed.studentName || 'Yohannes Kebede Worku'),
            fileName: String(parsed.fileName || 'Homework_Submission.pdf'),
            fileSizeBytes: Number(parsed.fileSizeBytes || 102400),
            fileType: String(parsed.fileType || 'application/pdf'),
            fileContentPreview: String(
              parsed.fileContentPreview || 'Submitted homework document.'
            ),
            notes: String(parsed.notes || ''),
            status: (parsed.status || 'SUBMITTED') as
              | 'SUBMITTED'
              | 'REVIEWED'
              | 'NEEDS_REVISION',
            teacherFeedback: String(parsed.teacherFeedback || ''),
            gradeScore: parsed.gradeScore ? String(parsed.gradeScore) : undefined,
            submittedAt: String(parsed.submittedAt || op.clientTimestamp || '2026-10-25'),
          };
        } catch {
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const enrichedHomeworks = homeworkRows.map((hw, index) => {
      const matchingSubs = parsedHwSubmissions.filter(
        (sub) => sub.homeworkId === hw.id || (index === 0 && !homeworkRows.some((h) => h.id === sub.homeworkId))
      );
      return {
        ...hw,
        submissions: matchingSubs,
      };
    });

    const primarySchool = schoolRows[0]
      ? { ...schoolRows[0], nameAm: schoolRows[0].nameEn }
      : null;

    return {
      school: primarySchool,
      students: studentRows.map((s) => ({
        ...s,
        fullNameAm: `${s.firstName} ${s.fatherName} ${s.grandfatherName}`,
      })),
      teachers: teacherRows.map((t) => ({
        ...t,
        fullNameAm: t.fullName,
      })),
      classSections: sectionRows,
      subjects: subjectRows.map((sub) => ({
        ...sub,
        nameAm: sub.nameEn,
      })),
      attendance: attendanceRows,
      marks: markRows.map((m) => ({
        ...m,
        subjectNameAm: m.subjectNameEn,
      })),
      invoices: invoiceRows,
      payments: paymentRows,
      libraryBooks: libraryRows.map((b) => ({
        ...b,
        titleAm: b.titleEn,
      })),
      transportRoutes: transportRows,
      inventoryAssets: inventoryRows,
      announcements: announcementRows.map((a) => ({
        ...a,
        titleAm: a.titleEn,
        bodyAm: a.bodyEn,
      })),
      syncOperations: syncRows,
      auditLogs: auditRows,
      portalAccounts: portalAccountRows.map((acc) => ({
        ...acc,
        fullNameAm: acc.fullName,
      })),
      ebooks: ebookRows.map((eb) => ({
        ...eb,
        titleAm: eb.titleEn,
      })),
      homeworks: enrichedHomeworks,
      onlineExams: onlineExamRows,
      onlineExamSubmissions: submissionRows,
    };
  } catch (error) {
    console.error('Database query failed in getSchoolWorkspaceData:', error);
    throw new Error('Failed to load tenant workspace data.', { cause: error });
  }
}

export function buildStudentLoginUserIdentifier(
  firstName: string,
  fatherName: string,
  studentCode: string,
  studentId?: number,
  explicitLoginUser?: string
): string {
  const cleanExplicit = (explicitLoginUser || '').trim().toLowerCase();
  if (cleanExplicit) {
    return cleanExplicit.includes('@') ? cleanExplicit : `${cleanExplicit}@student.edu.et`;
  }
  const asciiFirst = firstName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const asciiFather = fatherName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (asciiFirst && asciiFather) {
    return `${asciiFirst}.${asciiFather}@student.edu.et`;
  }
  const cleanCode = studentCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${cleanCode || `stu${studentId || 1}`}@student.edu.et`;
}

export async function registerStudentRecord(input: {
  schoolId: number;
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
  email?: string;
  accessCode?: string;
  actorName: string;
  actorRole: string;
}) {
  const nameCheck = validateEthiopianStudentName({
    firstName: input.firstName,
    fatherName: input.fatherName,
    grandfatherName: input.grandfatherName,
  });
  if (!nameCheck.valid) {
    throw new Error(nameCheck.error || 'Invalid student name.');
  }

  try {
    const rawAccessCode = (input.accessCode || '').trim();
    const stuAccessCode =
      rawAccessCode && /^STU-\d{6}$/i.test(rawAccessCode)
        ? rawAccessCode.toUpperCase()
        : rawAccessCode && rawAccessCode.length >= 4
          ? rawAccessCode.toUpperCase()
          : generateRoleAccessCode('STU');

    const [created] = await db
      .insert(students)
      .values({
        schoolId: input.schoolId,
        studentCode: stuAccessCode,
        firstName: input.firstName.trim(),
        fatherName: input.fatherName.trim(),
        grandfatherName: input.grandfatherName.trim(),
        fullNameAm:
          input.fullNameAm.trim() ||
          `${input.firstName.trim()} ${input.fatherName.trim()} ${input.grandfatherName.trim()}`,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth,
        gradeLevel: input.gradeLevel,
        sectionName: input.sectionName,
        guardianName: input.guardianName.trim(),
        guardianRelationship: input.guardianRelationship,
        guardianPhone: input.guardianPhone.trim(),
        emergencyContactPhone: input.emergencyContactPhone.trim() || input.guardianPhone.trim(),
        subCity: input.subCity.trim() || 'Bole',
        woreda: input.woreda.trim() || 'Woreda 03',
        previousSchool: input.previousSchool.trim() || 'Direct Admission',
        enrollmentStatus: 'ACTIVE',
      })
      .returning();

    const generatedEmail = buildStudentLoginUserIdentifier(
      input.firstName,
      input.fatherName,
      stuAccessCode,
      created.id,
      input.email
    );

    await db
      .insert(portalAccounts)
      .values({
        schoolId: input.schoolId,
        email: generatedEmail,
        accessCode: stuAccessCode,
        fullName: nameCheck.fullNameEn,
        fullNameAm: created.fullNameAm,
        role: 'STUDENT',
        linkedStudentId: created.id,
        linkedTeacherId: null,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: portalAccounts.accessCode,
        set: {
          email: generatedEmail,
          fullName: nameCheck.fullNameEn,
          fullNameAm: created.fullNameAm,
          linkedStudentId: created.id,
          isActive: true,
        },
      });

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'REGISTER_STUDENT',
      module: 'STUDENTS',
      entityRef: stuAccessCode,
      details: `Registered ${nameCheck.fullNameEn} (${created.fullNameAm}) with Login User ${generatedEmail} and Login Password ${stuAccessCode}`,
    });

    return {
      ...created,
      loginUser: generatedEmail,
      loginPassword: stuAccessCode,
    };
  } catch (error) {
    console.error('Failed to register student:', error);
    throw new Error('Database error while registering student.', { cause: error });
  }
}

export async function upsertAttendanceRecord(input: {
  schoolId: number;
  studentId: number;
  attendanceDate: string;
  status: string;
  remarks: string;
  recordedBy: string;
  actorRole: string;
  syncOperationId?: string;
}) {
  try {
    const studentRows = await db
      .select()
      .from(students)
      .where(and(eq(students.id, input.studentId), eq(students.schoolId, input.schoolId)));
    const student = studentRows[0];
    if (!student) {
      throw new Error('Student not found in active school tenant.');
    }

    const opId =
      input.syncOperationId ||
      `SYNC-ATT-${input.schoolId}-${input.studentId}-${input.attendanceDate}-${Date.now()}`;

    const [saved] = await db
      .insert(attendanceRecords)
      .values({
        schoolId: input.schoolId,
        studentId: input.studentId,
        attendanceDate: input.attendanceDate,
        status: input.status,
        gradeLevel: student.gradeLevel,
        sectionName: student.sectionName,
        remarks: input.remarks.trim(),
        recordedBy: input.recordedBy,
        syncOperationId: opId,
      })
      .onConflictDoUpdate({
        target: [
          attendanceRecords.schoolId,
          attendanceRecords.studentId,
          attendanceRecords.attendanceDate,
        ],
        set: {
          status: input.status,
          remarks: input.remarks.trim(),
          recordedBy: input.recordedBy,
          updatedAt: new Date(),
        },
      })
      .returning();

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.recordedBy,
      actorRole: input.actorRole,
      action: 'UPSERT_ATTENDANCE',
      module: 'ATTENDANCE',
      entityRef: `${student.studentCode}:${input.attendanceDate}`,
      details: `Recorded attendance status ${input.status} for ${student.firstName} ${student.fatherName} on ${input.attendanceDate}`,
    });

    return saved;
  } catch (error) {
    console.error('Failed to upsert attendance:', error);
    throw new Error('Failed to record attendance.', { cause: error });
  }
}

export async function upsertStudentExaminationMark(input: {
  schoolId: number;
  studentId: number;
  subjectCode: string;
  subjectNameEn: string;
  subjectNameAm: string;
  academicYear: string;
  term: string;
  continuousMark: number;
  midtermMark: number;
  finalMark: number;
  status: string;
  actorName: string;
  actorRole: string;
}) {
  // Validate and compute result using pure grading engine
  const computed = calculateAssessmentResult({
    continuousMark: input.continuousMark,
    midtermMark: input.midtermMark,
    finalMark: input.finalMark,
  });

  try {
    const [saved] = await db
      .insert(studentMarks)
      .values({
        schoolId: input.schoolId,
        studentId: input.studentId,
        subjectCode: input.subjectCode,
        subjectNameEn: input.subjectNameEn,
        subjectNameAm: input.subjectNameAm,
        academicYear: input.academicYear,
        term: input.term,
        continuousMark: input.continuousMark.toFixed(2),
        midtermMark: input.midtermMark.toFixed(2),
        finalMark: input.finalMark.toFixed(2),
        totalMark: computed.totalMark,
        gradeLetter: computed.gradeLetter,
        status: input.status || 'PUBLISHED',
        approvedBy: input.actorName,
      })
      .onConflictDoUpdate({
        target: [
          studentMarks.schoolId,
          studentMarks.studentId,
          studentMarks.subjectCode,
          studentMarks.academicYear,
          studentMarks.term,
        ],
        set: {
          continuousMark: input.continuousMark.toFixed(2),
          midtermMark: input.midtermMark.toFixed(2),
          finalMark: input.finalMark.toFixed(2),
          totalMark: computed.totalMark,
          gradeLetter: computed.gradeLetter,
          status: input.status || 'PUBLISHED',
          approvedBy: input.actorName,
          updatedAt: new Date(),
        },
      })
      .returning();

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'UPSERT_EXAM_MARK',
      module: 'EXAMINATIONS',
      entityRef: `${input.subjectCode}:STU-${input.studentId}`,
      details: `Saved marks (${input.continuousMark}+${input.midtermMark}+${input.finalMark} = ${computed.totalMark} / ${computed.gradeLetter})`,
    });

    return saved;
  } catch (error) {
    console.error('Failed to save student mark:', error);
    throw new Error('Failed to save examination mark.', { cause: error });
  }
}

export async function createStudentInvoiceRecord(input: {
  schoolId: number;
  studentId: number;
  feeCategory: string;
  academicYear: string;
  term: string;
  totalAmountEtb: number | string;
  discountEtb: number | string;
  dueDate: string;
  actorName: string;
  actorRole: string;
}) {
  const calc = calculateInvoiceBalance(input.totalAmountEtb, input.discountEtb, 0);
  try {
    const invoiceNumber = `INV-SCH${input.schoolId}-${Date.now().toString().slice(-6)}`;
    const [created] = await db
      .insert(invoices)
      .values({
        schoolId: input.schoolId,
        invoiceNumber,
        studentId: input.studentId,
        feeCategory: input.feeCategory,
        academicYear: input.academicYear,
        term: input.term,
        totalAmountEtb: fromSantim(toSantim(input.totalAmountEtb)),
        discountEtb: fromSantim(toSantim(input.discountEtb)),
        paidAmountEtb: '0.00',
        balanceEtb: calc.balanceEtb,
        dueDate: input.dueDate,
        status: calc.status,
      })
      .returning();

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'CREATE_INVOICE',
      module: 'FINANCE',
      entityRef: created.invoiceNumber,
      details: `Created invoice ${created.invoiceNumber} for net ETB ${calc.balanceEtb}`,
    });

    return created;
  } catch (error) {
    console.error('Failed to create invoice:', error);
    throw new Error('Failed to create student invoice.', { cause: error });
  }
}

export async function recordIdempotentPayment(input: {
  schoolId: number;
  invoiceId: number;
  amountEtb: number | string;
  paymentMethod: string;
  transactionReference: string;
  idempotencyKey: string;
  actorName: string;
  actorRole: string;
}) {
  const paySantim = toSantim(input.amountEtb);
  if (paySantim <= 0) {
    throw new Error('Payment amount must be greater than ETB 0.00.');
  }

  try {
    // 1. Check idempotency key first so duplicate network retries return existing payment safely
    const existingPayment = await db
      .select()
      .from(payments)
      .where(eq(payments.idempotencyKey, input.idempotencyKey));
    if (existingPayment.length > 0) {
      return { payment: existingPayment[0], idempotentReplay: true };
    }

    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, input.invoiceId), eq(invoices.schoolId, input.schoolId)));
    const inv = invoiceRows[0];
    if (!inv) {
      throw new Error('Invoice not found in this school tenant.');
    }

    const newPaidSantim = toSantim(inv.paidAmountEtb) + paySantim;
    const updatedCalc = calculateInvoiceBalance(
      inv.totalAmountEtb,
      inv.discountEtb,
      fromSantim(newPaidSantim)
    );

    const receiptNumber = `RCP-ETB-${Date.now().toString().slice(-6)}`;
    const [payment] = await db
      .insert(payments)
      .values({
        schoolId: input.schoolId,
        invoiceId: inv.id,
        studentId: inv.studentId,
        receiptNumber,
        idempotencyKey: input.idempotencyKey,
        amountEtb: fromSantim(paySantim),
        paymentMethod: input.paymentMethod,
        transactionReference: input.transactionReference.trim(),
        recordedBy: input.actorName,
        entryType: 'PAYMENT',
      })
      .returning();

    await db
      .update(invoices)
      .set({
        paidAmountEtb: updatedCalc.paidAmountEtb,
        balanceEtb: updatedCalc.balanceEtb,
        status: updatedCalc.status,
      })
      .where(eq(invoices.id, inv.id));

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'RECORD_PAYMENT',
      module: 'FINANCE',
      entityRef: receiptNumber,
      details: `Collected ETB ${fromSantim(paySantim)} via ${input.paymentMethod} (Ref: ${input.transactionReference}) against ${inv.invoiceNumber}`,
    });

    return { payment, idempotentReplay: false };
  } catch (error: any) {
    console.error('Failed to record payment:', error);
    throw new Error(error.message || 'Payment processing failed.', { cause: error });
  }
}

export async function reversePaymentTransaction(input: {
  schoolId: number;
  paymentId: number;
  reversalReason: string;
  actorName: string;
  actorRole: string;
}) {
  if (!input.reversalReason || input.reversalReason.trim().length < 5) {
    throw new Error('An explicit audit reason (min 5 characters) is required to reverse a payment.');
  }

  try {
    const paymentRows = await db
      .select()
      .from(payments)
      .where(and(eq(payments.id, input.paymentId), eq(payments.schoolId, input.schoolId)));
    const original = paymentRows[0];
    if (!original) {
      throw new Error('Original payment transaction not found.');
    }
    if (original.entryType === 'REVERSAL') {
      throw new Error('Cannot reverse a reversal entry.');
    }

    const existingReversal = await db
      .select()
      .from(payments)
      .where(eq(payments.reversedPaymentId, original.id));
    if (existingReversal.length > 0) {
      throw new Error('This payment has already been reversed.');
    }

    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, original.invoiceId));
    const inv = invoiceRows[0];
    if (!inv) {
      throw new Error('Associated invoice not found.');
    }

    const revSantim = toSantim(original.amountEtb);
    const updatedPaidSantim = Math.max(0, toSantim(inv.paidAmountEtb) - revSantim);
    const updatedCalc = calculateInvoiceBalance(
      inv.totalAmountEtb,
      inv.discountEtb,
      fromSantim(updatedPaidSantim)
    );

    const reversalReceipt = `REV-ETB-${Date.now().toString().slice(-6)}`;
    const [reversalEntry] = await db
      .insert(payments)
      .values({
        schoolId: input.schoolId,
        invoiceId: inv.id,
        studentId: inv.studentId,
        receiptNumber: reversalReceipt,
        idempotencyKey: `IDEMP-REV-${original.id}`,
        amountEtb: `-${original.amountEtb}`,
        paymentMethod: original.paymentMethod,
        transactionReference: `REVERSAL-OF-${original.receiptNumber}`,
        recordedBy: input.actorName,
        entryType: 'REVERSAL',
        reversalReason: input.reversalReason.trim(),
        reversedPaymentId: original.id,
      })
      .returning();

    await db
      .update(invoices)
      .set({
        paidAmountEtb: updatedCalc.paidAmountEtb,
        balanceEtb: updatedCalc.balanceEtb,
        status: updatedCalc.status,
      })
      .where(eq(invoices.id, inv.id));

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'AUTHORIZE_PAYMENT_REVERSAL',
      module: 'FINANCE',
      entityRef: reversalReceipt,
      details: `Reversed receipt ${original.receiptNumber} (ETB ${original.amountEtb}). Reason: ${input.reversalReason.trim()}`,
    });

    return reversalEntry;
  } catch (error: any) {
    console.error('Payment reversal failed:', error);
    throw new Error(error.message || 'Failed to reverse payment.', { cause: error });
  }
}

export async function toggleLibraryBookLoan(input: {
  schoolId: number;
  bookId: number;
  studentId: number | null;
  dueDate: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    const bookRows = await db
      .select()
      .from(libraryBooks)
      .where(and(eq(libraryBooks.id, input.bookId), eq(libraryBooks.schoolId, input.schoolId)));
    const book = bookRows[0];
    if (!book) {
      throw new Error('Library copy not found.');
    }

    if (book.status === 'AVAILABLE') {
      if (!input.studentId) {
        throw new Error('Select a student borrower to check out this copy.');
      }
      const studentRows = await db
        .select()
        .from(students)
        .where(and(eq(students.id, input.studentId), eq(students.schoolId, input.schoolId)));
      const borrower = studentRows[0];
      if (!borrower) {
        throw new Error('Borrower student not found in this school.');
      }

      const [updated] = await db
        .update(libraryBooks)
        .set({
          status: 'BORROWED',
          borrowerStudentId: borrower.id,
          borrowerName: `${borrower.firstName} ${borrower.fatherName} ${borrower.grandfatherName}`,
          dueDate: input.dueDate || '2026-11-15',
        })
        .where(eq(libraryBooks.id, book.id))
        .returning();

      await logAuditEvent({
        schoolId: input.schoolId,
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: 'CHECKOUT_LIBRARY_COPY',
        module: 'LIBRARY',
        entityRef: book.copyCode,
        details: `Checked out ${book.copyCode} (${book.titleEn}) to ${borrower.firstName} ${borrower.fatherName}`,
      });
      return updated;
    } else {
      const [updated] = await db
        .update(libraryBooks)
        .set({
          status: 'AVAILABLE',
          borrowerStudentId: null,
          borrowerName: '',
          dueDate: '',
        })
        .where(eq(libraryBooks.id, book.id))
        .returning();

      await logAuditEvent({
        schoolId: input.schoolId,
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: 'RETURN_LIBRARY_COPY',
        module: 'LIBRARY',
        entityRef: book.copyCode,
        details: `Returned library copy ${book.copyCode} (${book.titleEn}) to available shelf`,
      });
      return updated;
    }
  } catch (error: any) {
    console.error('Library circulation update failed:', error);
    throw new Error(error.message || 'Failed to update library book loan.', { cause: error });
  }
}

export async function createAnnouncementPost(input: {
  schoolId: number;
  titleEn: string;
  titleAm: string;
  bodyEn: string;
  bodyAm: string;
  audience: string;
  channel: string;
  priority: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    const [created] = await db
      .insert(announcements)
      .values({
        schoolId: input.schoolId,
        titleEn: input.titleEn.trim(),
        titleAm: input.titleAm.trim() || input.titleEn.trim(),
        bodyEn: input.bodyEn.trim(),
        bodyAm: input.bodyAm.trim() || input.bodyEn.trim(),
        audience: input.audience,
        channel: input.channel,
        priority: input.priority,
        publishedBy: input.actorName,
      })
      .returning();

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'PUBLISH_ANNOUNCEMENT',
      module: 'NOTIFICATIONS',
      entityRef: `ANN-${created.id}`,
      details: `Dispatched ${input.channel} announcement "${created.titleEn}" to ${input.audience}`,
    });

    return created;
  } catch (error) {
    console.error('Failed to publish announcement:', error);
    throw new Error('Failed to publish announcement.', { cause: error });
  }
}

export async function processOfflineSyncBatch(input: {
  schoolId: number;
  operations: Array<{
    operationId: string;
    deviceId: string;
    entityType: string;
    entityId: string;
    action: string;
    payload: any;
    versionNumber: number;
    clientTimestamp: string;
  }>;
  actorName: string;
  actorRole: string;
}) {
  try {
    const results = [];
    for (const op of input.operations) {
      const existing = await db
        .select()
        .from(syncOperations)
        .where(eq(syncOperations.operationId, op.operationId));
      if (existing.length > 0) {
        results.push({ operationId: op.operationId, status: 'IDEMPOTENT_SKIP', record: existing[0] });
        continue;
      }

      // If it's an offline attendance operation, apply it idempotently to attendance_records
      if (op.entityType === 'ATTENDANCE' && op.payload?.studentId && op.payload?.attendanceDate) {
        await upsertAttendanceRecord({
          schoolId: input.schoolId,
          studentId: Number(op.payload.studentId),
          attendanceDate: String(op.payload.attendanceDate),
          status: String(op.payload.status || 'PRESENT'),
          remarks: String(op.payload.remarks || 'Synced from offline classroom queue'),
          recordedBy: input.actorName,
          actorRole: input.actorRole,
          syncOperationId: op.operationId,
        });
      }

      const [savedOp] = await db
        .insert(syncOperations)
        .values({
          schoolId: input.schoolId,
          operationId: op.operationId,
          deviceId: op.deviceId,
          entityType: op.entityType,
          entityId: op.entityId,
          action: op.action,
          payloadJson: JSON.stringify(op.payload),
          versionNumber: op.versionNumber || 1,
          syncStatus: 'SYNCED',
          conflictReason: '',
          clientTimestamp: op.clientTimestamp,
        })
        .returning();

      results.push({ operationId: op.operationId, status: 'SYNCED', record: savedOp });
    }

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'BATCH_OFFLINE_SYNC',
      module: 'SYNC',
      entityRef: `BATCH-${results.length}`,
      details: `Synchronized ${results.length} offline operation(s) from local school node / Android queue.`,
    });

    return results;
  } catch (error) {
    console.error('Offline sync batch failed:', error);
    throw new Error('Failed to synchronize offline operations batch.', { cause: error });
  }
}

// ============================================================================
// ADMIN FULL CREATE & EDIT OPERATIONS FOR ALL ENTITIES
// ============================================================================

export async function updateSchoolTenant(input: {
  schoolId: number;
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
  academicYearLabel: string;
  currentTerm: string;
  subscriptionStatus: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    const [updated] = await db
      .update(schools)
      .set({
        code: input.code.trim().toUpperCase(),
        nameEn: input.nameEn.trim(),
        nameAm: input.nameAm.trim(),
        schoolType: input.schoolType,
        schoolLevel: input.schoolLevel,
        region: input.region,
        city: input.city,
        subCity: input.subCity,
        woreda: input.woreda,
        phone: input.phone.trim(),
        email: input.email.trim(),
        academicYearLabel: input.academicYearLabel.trim(),
        currentTerm: input.currentTerm.trim(),
        subscriptionStatus: input.subscriptionStatus,
      })
      .where(eq(schools.id, input.schoolId))
      .returning();

    if (!updated) {
      throw new Error('School record not found.');
    }

    await logAuditEvent({
      schoolId: updated.id,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'UPDATE_SCHOOL_TENANT',
      module: 'TENANT_ISOLATION',
      entityRef: updated.code,
      details: `Updated school profile & academic policy for ${updated.nameEn} (${updated.nameAm})`,
    });

    return updated;
  } catch (error: any) {
    console.error('Failed to update school tenant:', error);
    throw new Error(error.message || 'Failed to update school configuration.', { cause: error });
  }
}

export async function updateStudentRecord(input: {
  schoolId: number;
  studentId: number;
  studentCode?: string;
  email?: string;
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
  subCity: string;
  woreda: string;
  previousSchool: string;
  enrollmentStatus: string;
  actorName: string;
  actorRole: string;
}) {
  const nameCheck = validateEthiopianStudentName({
    firstName: input.firstName,
    fatherName: input.fatherName,
    grandfatherName: input.grandfatherName,
  });
  if (!nameCheck.valid) {
    throw new Error(nameCheck.error || 'Invalid student name.');
  }

  try {
    const cleanCode =
      input.studentCode && /^STU-\d{6}$/.test(input.studentCode.trim().toUpperCase())
        ? input.studentCode.trim().toUpperCase()
        : undefined;

    const [updated] = await db
      .update(students)
      .set({
        ...(cleanCode ? { studentCode: cleanCode } : {}),
        firstName: input.firstName.trim(),
        fatherName: input.fatherName.trim(),
        grandfatherName: input.grandfatherName.trim(),
        fullNameAm: input.fullNameAm.trim() || `${input.firstName} ${input.fatherName}`,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth,
        gradeLevel: input.gradeLevel,
        sectionName: input.sectionName,
        guardianName: input.guardianName.trim(),
        guardianRelationship: input.guardianRelationship,
        guardianPhone: input.guardianPhone.trim(),
        emergencyContactPhone: input.guardianPhone.trim(),
        subCity: input.subCity.trim() || 'Bole',
        woreda: input.woreda.trim() || 'Woreda 03',
        previousSchool: input.previousSchool.trim() || 'Direct Admission',
        enrollmentStatus: input.enrollmentStatus || 'ACTIVE',
      })
      .where(and(eq(students.id, input.studentId), eq(students.schoolId, input.schoolId)))
      .returning();

    if (!updated) {
      throw new Error('Student record not found in active school.');
    }

    // Keep linked Portal Login Account (Email + Generated Code Password) synchronized & active
    const cleanEmail = input.email?.trim().toLowerCase();
    const resolvedEmail = buildStudentLoginUserIdentifier(
      updated.firstName,
      updated.fatherName,
      updated.studentCode,
      updated.id,
      cleanEmail
    );
    const existingPortal = await db
      .select()
      .from(portalAccounts)
      .where(
        and(
          eq(portalAccounts.schoolId, input.schoolId),
          eq(portalAccounts.linkedStudentId, updated.id)
        )
      );

    if (existingPortal.length > 0) {
      await db
        .update(portalAccounts)
        .set({
          fullName: nameCheck.fullNameEn,
          fullNameAm: updated.fullNameAm,
          accessCode: updated.studentCode,
          email: cleanEmail ? resolvedEmail : existingPortal[0].email,
          isActive: true,
        })
        .where(eq(portalAccounts.id, existingPortal[0].id));
    } else {
      await db
        .insert(portalAccounts)
        .values({
          schoolId: input.schoolId,
          email: resolvedEmail,
          accessCode: updated.studentCode,
          fullName: nameCheck.fullNameEn,
          fullNameAm: updated.fullNameAm,
          role: 'STUDENT',
          linkedStudentId: updated.id,
          linkedTeacherId: null,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: portalAccounts.accessCode,
          set: {
            email: resolvedEmail,
            fullName: nameCheck.fullNameEn,
            fullNameAm: updated.fullNameAm,
            linkedStudentId: updated.id,
            role: 'STUDENT',
            isActive: true,
          },
        });
    }

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'UPDATE_STUDENT',
      module: 'STUDENTS',
      entityRef: updated.studentCode,
      details: `Updated student profile for ${nameCheck.fullNameEn} (${updated.fullNameAm}) — Password Code: ${updated.studentCode}, Status: ${updated.enrollmentStatus}`,
    });

    return updated;
  } catch (error: any) {
    console.error('Failed to update student:', error);
    throw new Error(error.message || 'Failed to update student record.', { cause: error });
  }
}

export async function createOrUpdateTeacher(input: {
  schoolId: number;
  teacherId?: number;
  staffCode?: string;
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
  actorName: string;
  actorRole: string;
}) {
  try {
    if (input.teacherId) {
      const cleanStaffCode =
        input.staffCode && /^(TEA|FIN|LIN)-\d{6}$/.test(input.staffCode.trim().toUpperCase())
          ? input.staffCode.trim().toUpperCase()
          : undefined;

      const [updated] = await db
        .update(teachers)
        .set({
          ...(cleanStaffCode ? { staffCode: cleanStaffCode } : {}),
          fullName: input.fullName.trim(),
          fullNameAm: input.fullNameAm.trim() || input.fullName.trim(),
          roleTitle: input.roleTitle.trim(),
          department: input.department.trim(),
          qualification: input.qualification.trim(),
          assignedSubjects: input.assignedSubjects.trim(),
          assignedGrades: input.assignedGrades.trim(),
          phone: input.phone.trim(),
          email: input.email.trim(),
          employmentStatus: input.employmentStatus || 'ACTIVE',
        })
        .where(and(eq(teachers.id, input.teacherId), eq(teachers.schoolId, input.schoolId)))
        .returning();

      if (!updated) {
        throw new Error('Teacher record not found.');
      }

      // Sync linked portal account email and generated code password
      await db
        .update(portalAccounts)
        .set({
          fullName: updated.fullName,
          fullNameAm: updated.fullNameAm,
          accessCode: updated.staffCode,
          ...(updated.email.includes('@') ? { email: updated.email.toLowerCase() } : {}),
        })
        .where(
          and(
            eq(portalAccounts.schoolId, input.schoolId),
            eq(portalAccounts.linkedTeacherId, updated.id)
          )
        );

      await logAuditEvent({
        schoolId: input.schoolId,
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: 'UPDATE_TEACHER',
        module: 'TEACHERS',
        entityRef: updated.staffCode,
        details: `Updated staff record for ${updated.fullName} (${updated.department}) — Password Code: ${updated.staffCode}`,
      });
      return updated;
    }

    const code =
      input.staffCode && /^(TEA|FIN|LIN)-\d{6}$/.test(input.staffCode.trim().toUpperCase())
        ? input.staffCode.trim().toUpperCase()
        : generateRoleAccessCode('TEA');

    const [created] = await db
      .insert(teachers)
      .values({
        schoolId: input.schoolId,
        staffCode: code,
        fullName: input.fullName.trim(),
        fullNameAm: input.fullNameAm.trim() || input.fullName.trim(),
        roleTitle: input.roleTitle.trim(),
        department: input.department.trim(),
        qualification: input.qualification.trim(),
        assignedSubjects: input.assignedSubjects.trim(),
        assignedGrades: input.assignedGrades.trim(),
        phone: input.phone.trim(),
        email: input.email.trim(),
        employmentStatus: input.employmentStatus || 'ACTIVE',
      })
      .returning();

    const mappedRole = code.startsWith('FIN-')
      ? 'FINANCE_OFFICER'
      : code.startsWith('LIN-')
        ? 'LIBRARIAN'
        : 'TEACHER';

    await db
      .insert(portalAccounts)
      .values({
        schoolId: input.schoolId,
        email:
          created.email.toLowerCase() ||
          `teacher.${created.id}@bolesecondary.edu.et`,
        accessCode: code,
        fullName: created.fullName,
        fullNameAm: created.fullNameAm,
        role: mappedRole,
        linkedStudentId: null,
        linkedTeacherId: created.id,
        isActive: true,
      })
      .onConflictDoNothing();

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'CREATE_TEACHER',
      module: 'TEACHERS',
      entityRef: created.staffCode,
      details: `Registered teacher/staff ${created.fullName} with Login Code ${created.staffCode} (${created.email})`,
    });
    return created;
  } catch (error: any) {
    console.error('Failed to save teacher:', error);
    throw new Error(error.message || 'Failed to save teacher record.', { cause: error });
  }
}

export async function createOrUpdateClassSection(input: {
  schoolId: number;
  sectionId?: number;
  gradeLevel: string;
  sectionName: string;
  stream: string;
  roomNumber: string;
  capacity: number;
  homeroomTeacherName: string;
  academicYear: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    if (input.sectionId) {
      const [updated] = await db
        .update(classSections)
        .set({
          gradeLevel: input.gradeLevel.trim(),
          sectionName: input.sectionName.trim(),
          stream: input.stream.trim(),
          roomNumber: input.roomNumber.trim(),
          capacity: Number(input.capacity) || 45,
          homeroomTeacherName: input.homeroomTeacherName.trim(),
          academicYear: input.academicYear.trim() || '2019 E.C.',
        })
        .where(
          and(eq(classSections.id, input.sectionId), eq(classSections.schoolId, input.schoolId))
        )
        .returning();

      if (!updated) throw new Error('Class section not found.');
      await logAuditEvent({
        schoolId: input.schoolId,
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: 'UPDATE_CLASS_SECTION',
        module: 'ACADEMICS',
        entityRef: `${updated.gradeLevel}-${updated.sectionName}`,
        details: `Updated class section ${updated.gradeLevel} ${updated.sectionName} (Room: ${updated.roomNumber})`,
      });
      return updated;
    }

    const [created] = await db
      .insert(classSections)
      .values({
        schoolId: input.schoolId,
        gradeLevel: input.gradeLevel.trim(),
        sectionName: input.sectionName.trim(),
        stream: input.stream.trim(),
        roomNumber: input.roomNumber.trim(),
        capacity: Number(input.capacity) || 45,
        homeroomTeacherName: input.homeroomTeacherName.trim(),
        academicYear: input.academicYear.trim() || '2019 E.C.',
      })
      .returning();

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'CREATE_CLASS_SECTION',
      module: 'ACADEMICS',
      entityRef: `${created.gradeLevel}-${created.sectionName}`,
      details: `Created class section ${created.gradeLevel} ${created.sectionName}`,
    });
    return created;
  } catch (error: any) {
    console.error('Failed to save class section:', error);
    throw new Error(error.message || 'Failed to save class section.', { cause: error });
  }
}

export async function createOrUpdateSubject(input: {
  schoolId: number;
  subjectId?: number;
  code: string;
  nameEn: string;
  nameAm: string;
  gradeLevel: string;
  periodsPerWeek: number;
  continuousWeight: number;
  midtermWeight: number;
  finalWeight: number;
  passingMark: number;
  actorName: string;
  actorRole: string;
}) {
  try {
    if (input.subjectId) {
      const [updated] = await db
        .update(subjects)
        .set({
          code: input.code.trim().toUpperCase(),
          nameEn: input.nameEn.trim(),
          nameAm: input.nameAm.trim() || input.nameEn.trim(),
          gradeLevel: input.gradeLevel.trim(),
          periodsPerWeek: Number(input.periodsPerWeek) || 5,
          continuousWeight: Number(input.continuousWeight) || 30,
          midtermWeight: Number(input.midtermWeight) || 20,
          finalWeight: Number(input.finalWeight) || 50,
          passingMark: Number(input.passingMark) || 50,
        })
        .where(and(eq(subjects.id, input.subjectId), eq(subjects.schoolId, input.schoolId)))
        .returning();

      if (!updated) throw new Error('Subject not found.');
      await logAuditEvent({
        schoolId: input.schoolId,
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: 'UPDATE_SUBJECT',
        module: 'ACADEMICS',
        entityRef: updated.code,
        details: `Updated curriculum subject ${updated.code} (${updated.nameEn})`,
      });
      return updated;
    }

    const [created] = await db
      .insert(subjects)
      .values({
        schoolId: input.schoolId,
        code: input.code.trim().toUpperCase(),
        nameEn: input.nameEn.trim(),
        nameAm: input.nameAm.trim() || input.nameEn.trim(),
        gradeLevel: input.gradeLevel.trim(),
        periodsPerWeek: Number(input.periodsPerWeek) || 5,
        continuousWeight: Number(input.continuousWeight) || 30,
        midtermWeight: Number(input.midtermWeight) || 20,
        finalWeight: Number(input.finalWeight) || 50,
        passingMark: Number(input.passingMark) || 50,
      })
      .returning();

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'CREATE_SUBJECT',
      module: 'ACADEMICS',
      entityRef: created.code,
      details: `Created curriculum subject ${created.code} (${created.nameEn})`,
    });
    return created;
  } catch (error: any) {
    console.error('Failed to save subject:', error);
    throw new Error(error.message || 'Failed to save subject.', { cause: error });
  }
}

export async function updateStudentInvoiceRecord(input: {
  schoolId: number;
  invoiceId: number;
  feeCategory: string;
  totalAmountEtb: number | string;
  discountEtb: number | string;
  dueDate: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    const existingRows = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, input.invoiceId), eq(invoices.schoolId, input.schoolId)));
    const existing = existingRows[0];
    if (!existing) {
      throw new Error('Invoice not found.');
    }

    const calc = calculateInvoiceBalance(
      input.totalAmountEtb,
      input.discountEtb,
      existing.paidAmountEtb
    );

    const [updated] = await db
      .update(invoices)
      .set({
        feeCategory: input.feeCategory.trim(),
        totalAmountEtb: fromSantim(toSantim(input.totalAmountEtb)),
        discountEtb: fromSantim(toSantim(input.discountEtb)),
        balanceEtb: calc.balanceEtb,
        dueDate: input.dueDate,
        status: calc.status,
      })
      .where(eq(invoices.id, existing.id))
      .returning();

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'UPDATE_INVOICE',
      module: 'FINANCE',
      entityRef: updated.invoiceNumber,
      details: `Updated invoice ${updated.invoiceNumber}: Gross ETB ${updated.totalAmountEtb}, Discount ETB ${updated.discountEtb}, New Balance ETB ${updated.balanceEtb}`,
    });

    return updated;
  } catch (error: any) {
    console.error('Failed to update invoice:', error);
    throw new Error(error.message || 'Failed to update invoice.', { cause: error });
  }
}

export async function createOrUpdateLibraryBook(input: {
  schoolId: number;
  bookId?: number;
  isbn: string;
  copyCode: string;
  titleEn: string;
  titleAm: string;
  author: string;
  category: string;
  gradeLevel: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    if (input.bookId) {
      const [updated] = await db
        .update(libraryBooks)
        .set({
          isbn: input.isbn.trim(),
          copyCode: input.copyCode.trim().toUpperCase(),
          titleEn: input.titleEn.trim(),
          titleAm: input.titleAm.trim() || input.titleEn.trim(),
          author: input.author.trim(),
          category: input.category.trim(),
          gradeLevel: input.gradeLevel.trim(),
        })
        .where(and(eq(libraryBooks.id, input.bookId), eq(libraryBooks.schoolId, input.schoolId)))
        .returning();

      if (!updated) throw new Error('Library book copy not found.');
      await logAuditEvent({
        schoolId: input.schoolId,
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: 'UPDATE_LIBRARY_BOOK',
        module: 'LIBRARY',
        entityRef: updated.copyCode,
        details: `Updated library book copy ${updated.copyCode} (${updated.titleEn})`,
      });
      return updated;
    }

    const [created] = await db
      .insert(libraryBooks)
      .values({
        schoolId: input.schoolId,
        isbn: input.isbn.trim(),
        copyCode:
          input.copyCode.trim().toUpperCase() || `LIB-CP-${Date.now().toString().slice(-4)}`,
        titleEn: input.titleEn.trim(),
        titleAm: input.titleAm.trim() || input.titleEn.trim(),
        author: input.author.trim(),
        category: input.category.trim(),
        gradeLevel: input.gradeLevel.trim(),
        status: 'AVAILABLE',
      })
      .returning();

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'CREATE_LIBRARY_BOOK',
      module: 'LIBRARY',
      entityRef: created.copyCode,
      details: `Cataloged new library copy ${created.copyCode} (${created.titleEn})`,
    });
    return created;
  } catch (error: any) {
    console.error('Failed to save library book:', error);
    throw new Error(error.message || 'Failed to save library book.', { cause: error });
  }
}

export async function createOrUpdateTransportRoute(input: {
  schoolId: number;
  routeId?: number;
  routeCode: string;
  routeName: string;
  stopsList: string;
  vehiclePlate: string;
  driverName: string;
  driverPhone: string;
  capacity: number;
  assignedCount: number;
  termFeeEtb: number | string;
  actorName: string;
  actorRole: string;
}) {
  try {
    const formattedFee = fromSantim(toSantim(input.termFeeEtb));
    if (input.routeId) {
      const [updated] = await db
        .update(transportRoutes)
        .set({
          routeCode: input.routeCode.trim().toUpperCase(),
          routeName: input.routeName.trim(),
          stopsList: input.stopsList.trim(),
          vehiclePlate: input.vehiclePlate.trim().toUpperCase(),
          driverName: input.driverName.trim(),
          driverPhone: input.driverPhone.trim(),
          capacity: Number(input.capacity) || 30,
          assignedCount: Number(input.assignedCount) || 0,
          termFeeEtb: formattedFee,
        })
        .where(
          and(eq(transportRoutes.id, input.routeId), eq(transportRoutes.schoolId, input.schoolId))
        )
        .returning();

      if (!updated) throw new Error('Transport route not found.');
      await logAuditEvent({
        schoolId: input.schoolId,
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: 'UPDATE_TRANSPORT_ROUTE',
        module: 'TRANSPORT',
        entityRef: updated.routeCode,
        details: `Updated transport route ${updated.routeCode} (${updated.routeName})`,
      });
      return updated;
    }

    const [created] = await db
      .insert(transportRoutes)
      .values({
        schoolId: input.schoolId,
        routeCode:
          input.routeCode.trim().toUpperCase() || `RT-${Date.now().toString().slice(-4)}`,
        routeName: input.routeName.trim(),
        stopsList: input.stopsList.trim(),
        vehiclePlate: input.vehiclePlate.trim().toUpperCase(),
        driverName: input.driverName.trim(),
        driverPhone: input.driverPhone.trim(),
        capacity: Number(input.capacity) || 30,
        assignedCount: Number(input.assignedCount) || 0,
        termFeeEtb: formattedFee,
      })
      .returning();

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'CREATE_TRANSPORT_ROUTE',
      module: 'TRANSPORT',
      entityRef: created.routeCode,
      details: `Added transport route ${created.routeCode} (${created.routeName})`,
    });
    return created;
  } catch (error: any) {
    console.error('Failed to save transport route:', error);
    throw new Error(error.message || 'Failed to save transport route.', { cause: error });
  }
}

export async function createOrUpdateInventoryAsset(input: {
  schoolId: number;
  assetId?: number;
  assetCode: string;
  name: string;
  category: string;
  department: string;
  quantity: number;
  minimumThreshold: number;
  unitValueEtb: number | string;
  actorName: string;
  actorRole: string;
}) {
  try {
    const qty = Number(input.quantity) || 0;
    const minT = Number(input.minimumThreshold) || 5;
    const status = qty <= minT ? 'LOW_STOCK' : 'GOOD';
    const formattedVal = fromSantim(toSantim(input.unitValueEtb));

    if (input.assetId) {
      const [updated] = await db
        .update(inventoryAssets)
        .set({
          assetCode: input.assetCode.trim().toUpperCase(),
          name: input.name.trim(),
          category: input.category.trim(),
          department: input.department.trim(),
          quantity: qty,
          minimumThreshold: minT,
          conditionStatus: status,
          unitValueEtb: formattedVal,
          updatedAt: new Date(),
        })
        .where(
          and(eq(inventoryAssets.id, input.assetId), eq(inventoryAssets.schoolId, input.schoolId))
        )
        .returning();

      if (!updated) throw new Error('Inventory asset not found.');
      await logAuditEvent({
        schoolId: input.schoolId,
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: 'UPDATE_INVENTORY_ASSET',
        module: 'INVENTORY',
        entityRef: updated.assetCode,
        details: `Updated inventory asset ${updated.assetCode} (${updated.name}) — Qty: ${updated.quantity}`,
      });
      return updated;
    }

    const [created] = await db
      .insert(inventoryAssets)
      .values({
        schoolId: input.schoolId,
        assetCode:
          input.assetCode.trim().toUpperCase() || `AST-${Date.now().toString().slice(-4)}`,
        name: input.name.trim(),
        category: input.category.trim(),
        department: input.department.trim(),
        quantity: qty,
        minimumThreshold: minT,
        conditionStatus: status,
        unitValueEtb: formattedVal,
      })
      .returning();

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'CREATE_INVENTORY_ASSET',
      module: 'INVENTORY',
      entityRef: created.assetCode,
      details: `Added inventory asset ${created.assetCode} (${created.name}) — Qty: ${created.quantity}`,
    });
    return created;
  } catch (error: any) {
    console.error('Failed to save inventory asset:', error);
    throw new Error(error.message || 'Failed to save inventory asset.', { cause: error });
  }
}

export async function updateAnnouncementPost(input: {
  schoolId: number;
  announcementId: number;
  titleEn: string;
  titleAm: string;
  bodyEn: string;
  bodyAm: string;
  audience: string;
  channel: string;
  priority: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    const [updated] = await db
      .update(announcements)
      .set({
        titleEn: input.titleEn.trim(),
        titleAm: input.titleAm.trim() || input.titleEn.trim(),
        bodyEn: input.bodyEn.trim(),
        bodyAm: input.bodyAm.trim() || input.bodyEn.trim(),
        audience: input.audience,
        channel: input.channel,
        priority: input.priority,
      })
      .where(
        and(eq(announcements.id, input.announcementId), eq(announcements.schoolId, input.schoolId))
      )
      .returning();

    if (!updated) throw new Error('Announcement not found.');
    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'UPDATE_ANNOUNCEMENT',
      module: 'NOTIFICATIONS',
      entityRef: `ANN-${updated.id}`,
      details: `Updated announcement "${updated.titleEn}"`,
    });
    return updated;
  } catch (error: any) {
    console.error('Failed to update announcement:', error);
    throw new Error(error.message || 'Failed to update announcement.', { cause: error });
  }
}

// ============================================================================
// PORTAL ACCESS CODES (STU-, TEA-, FIN-, LIN-), EBOOKS, HOMEWORKS & ONLINE EXAMS
// ============================================================================

let isPortalDataSeeded = false;

export async function ensurePortalAndLearningDataSeeded() {
  try {
    // Always synchronize every registered student in the database so all registered students have an active STUDENT portal login account.
    const [allStudents, existingAccounts] = await Promise.all([
      db.select().from(students).orderBy(students.id),
      db.select().from(portalAccounts),
    ]);

    for (const st of allStudents) {
      const stuCode =
        st.studentCode && st.studentCode.trim().length >= 4
          ? st.studentCode.trim().toUpperCase()
          : generateRoleAccessCode('STU');

      if (st.studentCode !== stuCode) {
        await db.update(students).set({ studentCode: stuCode }).where(eq(students.id, st.id));
      }

      const linkedAccount = existingAccounts.find(
        (acc) =>
          acc.linkedStudentId === st.id ||
          acc.accessCode.trim().toUpperCase() === stuCode
      );

      const loginUser = buildStudentLoginUserIdentifier(
        st.firstName,
        st.fatherName,
        stuCode,
        st.id
      );

      if (!linkedAccount) {
        await db
          .insert(portalAccounts)
          .values({
            schoolId: st.schoolId,
            email: loginUser,
            accessCode: stuCode,
            fullName: `${st.firstName} ${st.fatherName} ${st.grandfatherName}`,
            fullNameAm: st.fullNameAm,
            role: 'STUDENT',
            linkedStudentId: st.id,
            linkedTeacherId: null,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: portalAccounts.accessCode,
            set: {
              linkedStudentId: st.id,
              role: 'STUDENT',
              isActive: true,
            },
          });
      } else if (!linkedAccount.isActive || linkedAccount.linkedStudentId !== st.id) {
        await db
          .update(portalAccounts)
          .set({
            isActive: true,
            linkedStudentId: st.id,
            role: 'STUDENT',
          })
          .where(eq(portalAccounts.id, linkedAccount.id));
      }
    }
  } catch (error) {
    console.error('Error synchronizing student portal accounts:', error);
  }
}

export async function authorizeAllRegisteredStudentsLogin(input: {
  schoolId: number;
  actorName: string;
  actorRole: string;
}) {
  await ensureInitialDataSeeded();
  await ensurePortalAndLearningDataSeeded();

  const schoolStudents = await db
    .select()
    .from(students)
    .where(eq(students.schoolId, input.schoolId))
    .orderBy(students.id);

  // Activate all student portal accounts in this school
  await db
    .update(portalAccounts)
    .set({ isActive: true })
    .where(
      and(
        eq(portalAccounts.schoolId, input.schoolId),
        eq(portalAccounts.role, 'STUDENT')
      )
    );

  const updatedAccounts = await db
    .select()
    .from(portalAccounts)
    .where(
      and(
        eq(portalAccounts.schoolId, input.schoolId),
        eq(portalAccounts.role, 'STUDENT')
      )
    );

  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'AUTHORIZE_ALL_STUDENTS_LOGIN',
    module: 'AUTH',
    entityRef: `STUDENTS-${schoolStudents.length}`,
    details: `Authorized all ${schoolStudents.length} registered student(s) for Portal Login (${updatedAccounts.length} active student portal accounts).`,
  });

  return {
    authorizedStudentsCount: schoolStudents.length,
    activePortalAccountsCount: updatedAccounts.length,
    accounts: updatedAccounts,
  };
}

export async function authenticatePortalLogin(identifier: string, password?: string) {
  await ensureInitialDataSeeded();
  await ensurePortalAndLearningDataSeeded();

  const cleanedIdentifier = identifier.trim().toLowerCase();
  const cleanedPassword = (password ?? '').trim();

  if (!cleanedIdentifier || cleanedIdentifier.length < 3) {
    throw new Error('Please enter a valid Login User (email or student/staff ID).');
  }

  if (!cleanedPassword || cleanedPassword.length < 4) {
    throw new Error('Please enter your password.');
  }

  const [allAccounts, allStudents] = await Promise.all([
    db.select().from(portalAccounts),
    db.select().from(students),
  ]);

  let matched = allAccounts.find((acc) => {
    // Allow all registered students even if isActive was toggled off, and require isActive for non-student accounts
    if (!acc.isActive && acc.role !== 'STUDENT') return false;
    const accEmail = acc.email.trim().toLowerCase();
    const accUsername = accEmail.split('@')[0];
    // Strip trailing .<id> from auto-generated student usernames (e.g. abebe.kebede.1 -> abebe.kebede)
    const accBaseUsername = accUsername.replace(/\.\d+$/, '');
    const accCode = acc.accessCode.trim().toLowerCase();
    const accCodeDigitsOnly = accCode.replace(/^stu-/i, '');
    const accFullName = acc.fullName.trim().toLowerCase();

    if (
      accEmail === cleanedIdentifier ||
      accUsername === cleanedIdentifier ||
      accBaseUsername === cleanedIdentifier ||
      `${accBaseUsername}@student.edu.et` === cleanedIdentifier ||
      accCode === cleanedIdentifier ||
      (acc.role === 'STUDENT' &&
        (accFullName === cleanedIdentifier ||
          `stu-${cleanedIdentifier}` === accCode ||
          (accCodeDigitsOnly.length >= 6 && accCodeDigitsOnly === cleanedIdentifier)))
    ) {
      return true;
    }

    if (acc.role === 'STUDENT' && acc.linkedStudentId) {
      const stu = allStudents.find((s) => s.id === acc.linkedStudentId);
      if (stu) {
        const stuFirstFatherDot = `${stu.firstName.trim().toLowerCase()}.${stu.fatherName.trim().toLowerCase()}`;
        const stuFirstFatherSpace = `${stu.firstName.trim().toLowerCase()} ${stu.fatherName.trim().toLowerCase()}`;
        const stuFullEn = `${stu.firstName.trim()} ${stu.fatherName.trim()} ${stu.grandfatherName.trim()}`.toLowerCase();
        const stuCodeLower = stu.studentCode.trim().toLowerCase();
        if (
          cleanedIdentifier === stuCodeLower ||
          cleanedIdentifier === stuFirstFatherDot ||
          cleanedIdentifier === `${stuFirstFatherDot}@student.edu.et` ||
          cleanedIdentifier === stuFirstFatherSpace ||
          cleanedIdentifier === stuFullEn ||
          cleanedIdentifier === stu.fullNameAm.trim().toLowerCase()
        ) {
          return true;
        }
      }
    }

    return false;
  });

  if (matched && !matched.isActive && matched.role === 'STUDENT') {
    const [activated] = await db
      .update(portalAccounts)
      .set({ isActive: true })
      .where(eq(portalAccounts.id, matched.id))
      .returning();
    if (activated) matched = activated;
  }

  if (!matched) {
    await logAuditEvent({
      schoolId: 1,
      actorName: cleanedIdentifier,
      actorRole: 'UNREGISTERED',
      action: 'BLOCKED_UNREGISTERED_LOGIN',
      module: 'AUTH',
      entityRef: cleanedIdentifier,
      details: `Rejected login attempt for unregistered user: ${cleanedIdentifier}`,
    });
    throw new Error(
      'Invalid Login User or Password. Only users registered in the system can sign in.'
    );
  }

  const isAdminAccount =
    matched.role === 'SCHOOL_ADMIN' ||
    matched.role === 'SUPER_ADMIN' ||
    matched.email.toLowerCase() === 'habteofat@gmail.com';

  const linkedStudent =
    matched.role === 'STUDENT'
      ? allStudents.find(
          (s) =>
            s.id === matched!.linkedStudentId ||
            s.studentCode.trim().toUpperCase() === matched!.accessCode.trim().toUpperCase()
        )
      : undefined;

  const expectedCodeUpper = matched.accessCode.trim().toUpperCase();
  const expectedDigitsOnly = expectedCodeUpper.replace(/^(STU|TEA|FIN|LIN|ADM)-/i, '');
  const stuCodeUpper = linkedStudent?.studentCode.trim().toUpperCase() || '';

  // Admin account accepts the configured Admin password or Admin access code;
  // Student account accepts their STU-XXXXXX code, studentCode, or 6-digit numeric code
  const isPasswordValid = isAdminAccount
    ? matched.email.toLowerCase() === 'habteofat@gmail.com' &&
      (cleanedPassword === '85835452Ha&' ||
        cleanedPassword.toUpperCase() === expectedCodeUpper ||
        cleanedPassword.toUpperCase() === 'LIN-482910')
    : cleanedPassword.toUpperCase() === expectedCodeUpper ||
      cleanedPassword === matched.accessCode.trim() ||
      (matched.role === 'STUDENT' &&
        ((Boolean(stuCodeUpper) && cleanedPassword.toUpperCase() === stuCodeUpper) ||
          (expectedDigitsOnly.length >= 4 && cleanedPassword.toUpperCase() === expectedDigitsOnly) ||
          `STU-${cleanedPassword.toUpperCase()}` === expectedCodeUpper));

  if (!isPasswordValid) {
    await logAuditEvent({
      schoolId: matched.schoolId,
      actorName: matched.email,
      actorRole: matched.role,
      action: 'BLOCKED_INVALID_PASSWORD',
      module: 'AUTH',
      entityRef: matched.accessCode,
      details: `Rejected login attempt due to invalid password for ${matched.email}`,
    });
    throw new Error(
      'Invalid Login User or Password. Please check your credentials and try again.'
    );
  }

  await logAuditEvent({
    schoolId: matched.schoolId,
    actorName: matched.fullName,
    actorRole: matched.role,
    action: 'PORTAL_LOGIN_SUCCESS',
    module: 'AUTH',
    entityRef: matched.accessCode,
    details: `Authenticated ${matched.fullName} (${matched.role}) via Login User (${matched.email})`,
  });

  return matched;
}

export async function createOrUpdatePortalAccount(input: {
  schoolId: number;
  accountId?: number;
  email: string;
  accessCode?: string;
  codePrefix?: AccessCodePrefix | 'ADM';
  fullName: string;
  fullNameAm: string;
  role: string;
  linkedStudentId?: number | null;
  linkedTeacherId?: number | null;
  isActive?: boolean;
  actorName: string;
  actorRole: string;
}) {
  try {
    const cleanEmail = input.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('A valid email address is required to register a login account.');
    }

    let finalCode = input.accessCode?.trim().toUpperCase() || '';
    const roleUpper = input.role.trim().toUpperCase();

    if (
      (roleUpper === 'SCHOOL_ADMIN' || roleUpper === 'SUPER_ADMIN') &&
      cleanEmail !== 'habteofat@gmail.com'
    ) {
      throw new Error(
        'Only habteofat@gmail.com is permitted as the Admin login email.'
      );
    }

    const requiredPrefix: AccessCodePrefix | 'ADM' =
      roleUpper === 'STUDENT'
        ? 'STU'
        : roleUpper === 'TEACHER'
          ? 'TEA'
          : roleUpper === 'FINANCE_OFFICER'
            ? 'FIN'
            : roleUpper === 'LIBRARIAN'
              ? 'LIN'
              : 'ADM';

    if (!finalCode || !new RegExp(`^${requiredPrefix}-\\d{6}$`).test(finalCode)) {
      if (requiredPrefix === 'ADM') {
        const six = String(Math.floor(100000 + Math.random() * 900000));
        finalCode = `ADM-${six}`;
      } else {
        finalCode = generateRoleAccessCode(requiredPrefix);
      }
    }

    if (input.accountId) {
      const [updated] = await db
        .update(portalAccounts)
        .set({
          email: cleanEmail,
          accessCode: finalCode,
          fullName: input.fullName.trim(),
          fullNameAm: input.fullNameAm.trim() || input.fullName.trim(),
          role: roleUpper,
          linkedStudentId: input.linkedStudentId ?? null,
          linkedTeacherId: input.linkedTeacherId ?? null,
          isActive: input.isActive ?? true,
        })
        .where(
          and(eq(portalAccounts.id, input.accountId), eq(portalAccounts.schoolId, input.schoolId))
        )
        .returning();

      if (!updated) throw new Error('Portal account not found.');

      // Sync linked Student or Teacher code so the generated 6-digit password code is identical everywhere
      if (updated.linkedStudentId && /^STU-\d{6}$/.test(updated.accessCode)) {
        await db
          .update(students)
          .set({ studentCode: updated.accessCode })
          .where(eq(students.id, updated.linkedStudentId));
      }
      if (updated.linkedTeacherId && /^(TEA|FIN|LIN)-\d{6}$/.test(updated.accessCode)) {
        await db
          .update(teachers)
          .set({ staffCode: updated.accessCode, email: updated.email })
          .where(eq(teachers.id, updated.linkedTeacherId));
      }

      await logAuditEvent({
        schoolId: input.schoolId,
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: 'UPDATE_PORTAL_ACCOUNT',
        module: 'AUTH',
        entityRef: updated.accessCode,
        details: `Updated login account ${updated.email} -> Password Code: ${updated.accessCode} (${updated.role})`,
      });
      return updated;
    }

    const [created] = await db
      .insert(portalAccounts)
      .values({
        schoolId: input.schoolId,
        email: cleanEmail,
        accessCode: finalCode,
        fullName: input.fullName.trim(),
        fullNameAm: input.fullNameAm.trim() || input.fullName.trim(),
        role: roleUpper,
        linkedStudentId: input.linkedStudentId ?? null,
        linkedTeacherId: input.linkedTeacherId ?? null,
        isActive: input.isActive ?? true,
      })
      .returning();

    if (created.linkedStudentId && /^STU-\d{6}$/.test(created.accessCode)) {
      await db
        .update(students)
        .set({ studentCode: created.accessCode })
        .where(eq(students.id, created.linkedStudentId));
    }
    if (created.linkedTeacherId && /^(TEA|FIN|LIN)-\d{6}$/.test(created.accessCode)) {
      await db
        .update(teachers)
        .set({ staffCode: created.accessCode, email: created.email })
        .where(eq(teachers.id, created.linkedTeacherId));
    }

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'CREATE_PORTAL_ACCOUNT',
      module: 'AUTH',
      entityRef: created.accessCode,
      details: `Generated ${created.role} login account: Password Code ${created.accessCode} (${created.email}) for ${created.fullName}`,
    });

    return created;
  } catch (error: any) {
    console.error('Failed to save portal account:', error);
    throw new Error(error.message || 'Failed to save portal login account.', { cause: error });
  }
}

export async function createOrUpdateEBook(input: {
  schoolId: number;
  ebookId?: number;
  code: string;
  titleEn: string;
  titleAm: string;
  subjectCode: string;
  gradeLevel: string;
  author: string;
  summary: string;
  contentBody: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    if (input.ebookId) {
      const [updated] = await db
        .update(ebooks)
        .set({
          code: input.code.trim().toUpperCase(),
          titleEn: input.titleEn.trim(),
          titleAm: input.titleAm.trim() || input.titleEn.trim(),
          subjectCode: input.subjectCode.trim(),
          gradeLevel: input.gradeLevel.trim(),
          author: input.author.trim(),
          summary: input.summary.trim(),
          contentBody: input.contentBody.trim(),
        })
        .where(and(eq(ebooks.id, input.ebookId), eq(ebooks.schoolId, input.schoolId)))
        .returning();
      if (!updated) throw new Error('EBook not found.');
      return updated;
    }

    const [created] = await db
      .insert(ebooks)
      .values({
        schoolId: input.schoolId,
        code: input.code.trim().toUpperCase() || `EBK-${Date.now().toString().slice(-4)}`,
        titleEn: input.titleEn.trim(),
        titleAm: input.titleAm.trim() || input.titleEn.trim(),
        subjectCode: input.subjectCode.trim(),
        gradeLevel: input.gradeLevel.trim(),
        author: input.author.trim() || 'Ministry of Education',
        summary: input.summary.trim(),
        contentBody: input.contentBody.trim(),
      })
      .returning();

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'PUBLISH_EBOOK',
      module: 'LIBRARY',
      entityRef: created.code,
      details: `Published digital EBook "${created.titleEn}" for ${created.gradeLevel}`,
    });
    return created;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to save EBook.');
  }
}

export async function createOrUpdateHomework(input: {
  schoolId: number;
  homeworkId?: number;
  title: string;
  subjectCode: string;
  gradeLevel: string;
  sectionName: string;
  dueDate: string;
  instructions: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    if (input.homeworkId) {
      const [updated] = await db
        .update(homeworks)
        .set({
          title: input.title.trim(),
          subjectCode: input.subjectCode.trim(),
          gradeLevel: input.gradeLevel.trim(),
          sectionName: input.sectionName.trim(),
          dueDate: input.dueDate.trim(),
          instructions: input.instructions.trim(),
        })
        .where(and(eq(homeworks.id, input.homeworkId), eq(homeworks.schoolId, input.schoolId)))
        .returning();
      if (!updated) throw new Error('Homework not found.');
      return updated;
    }

    const [created] = await db
      .insert(homeworks)
      .values({
        schoolId: input.schoolId,
        title: input.title.trim(),
        subjectCode: input.subjectCode.trim(),
        gradeLevel: input.gradeLevel.trim(),
        sectionName: input.sectionName.trim() || 'Section A',
        dueDate: input.dueDate.trim() || '2026-10-30',
        instructions: input.instructions.trim(),
        postedBy: input.actorName,
      })
      .returning();

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'POST_HOMEWORK',
      module: 'ACADEMICS',
      entityRef: `HW-${created.id}`,
      details: `Posted homework "${created.title}" for ${created.gradeLevel} ${created.sectionName}`,
    });
    return created;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to save homework.');
  }
}

export async function submitStudentHomeworkFile(input: {
  schoolId: number;
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
  actorName: string;
  actorRole: string;
}) {
  if (!input.fileName || !input.fileName.trim()) {
    throw new Error('Please select or provide a homework file to upload.');
  }

  const operationId = `HW-SUB-${input.homeworkId}-${input.studentId}-${Date.now()}`;
  const submittedAt = new Date().toISOString().slice(0, 10);

  const payload = {
    homeworkId: input.homeworkId,
    homeworkTitle: input.homeworkTitle.trim() || 'Homework Assignment',
    subjectCode: input.subjectCode.trim() || 'MATH-10',
    studentId: input.studentId,
    studentCode: input.studentCode.trim() || 'STU-482910',
    studentName: input.studentName.trim() || input.actorName,
    fileName: input.fileName.trim(),
    fileSizeBytes: Math.max(1, Number(input.fileSizeBytes) || 1024),
    fileType: input.fileType.trim() || 'application/octet-stream',
    fileContentPreview:
      input.fileContentPreview.trim() ||
      `Uploaded file: ${input.fileName.trim()} (${input.subjectCode})`,
    notes: input.notes.trim(),
    status: 'SUBMITTED' as const,
    teacherFeedback: '',
    submittedAt,
  };

  await db.insert(syncOperations).values({
    schoolId: input.schoolId,
    operationId,
    deviceId: 'STU-PORTAL-WEB',
    entityType: 'HOMEWORK_SUBMISSION',
    entityId: String(input.homeworkId),
    action: 'CREATE',
    payloadJson: JSON.stringify(payload),
    versionNumber: 1,
    syncStatus: 'SYNCED',
    conflictReason: '',
    clientTimestamp: submittedAt,
  });

  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'UPLOAD_HOMEWORK_SUBMISSION',
    module: 'ACADEMICS',
    entityRef: operationId,
    details: `Student ${payload.studentName} (${payload.studentCode}) uploaded homework file "${payload.fileName}" for "${payload.homeworkTitle}"`,
  });

  return {
    id: operationId,
    ...payload,
  };
}

export async function updateHomeworkSubmissionFeedback(input: {
  schoolId: number;
  submissionId: string;
  status: 'SUBMITTED' | 'REVIEWED' | 'NEEDS_REVISION';
  teacherFeedback: string;
  gradeScore?: string;
  actorName: string;
  actorRole: string;
}) {
  const existing = await db
    .select()
    .from(syncOperations)
    .where(
      and(
        eq(syncOperations.operationId, input.submissionId),
        eq(syncOperations.schoolId, input.schoolId)
      )
    );
  if (existing.length === 0) {
    throw new Error('Homework submission record not found.');
  }

  const parsed = JSON.parse(existing[0].payloadJson);
  const updatedPayload = {
    ...parsed,
    status: input.status,
    teacherFeedback: input.teacherFeedback.trim(),
    gradeScore: input.gradeScore?.trim() || parsed.gradeScore,
  };

  await db
    .update(syncOperations)
    .set({
      payloadJson: JSON.stringify(updatedPayload),
      versionNumber: (existing[0].versionNumber || 1) + 1,
    })
    .where(eq(syncOperations.id, existing[0].id));

  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'REVIEW_HOMEWORK_SUBMISSION',
    module: 'ACADEMICS',
    entityRef: input.submissionId,
    details: `Updated feedback & status (${input.status}) on homework file "${updatedPayload.fileName}"`,
  });

  return {
    id: input.submissionId,
    ...updatedPayload,
  };
}

export async function deleteHomeworkSubmissionFile(input: {
  schoolId: number;
  submissionId: string;
  actorName: string;
  actorRole: string;
}) {
  const [deleted] = await db
    .delete(syncOperations)
    .where(
      and(
        eq(syncOperations.operationId, input.submissionId),
        eq(syncOperations.schoolId, input.schoolId)
      )
    )
    .returning();

  if (!deleted) {
    throw new Error('Homework submission file not found.');
  }

  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_HOMEWORK_SUBMISSION',
    module: 'ACADEMICS',
    entityRef: input.submissionId,
    details: `Removed homework submission record ${input.submissionId}`,
  });

  return deleted;
}

export async function createOrUpdateOnlineExam(input: {
  schoolId: number;
  examId?: number;
  title: string;
  subjectCode: string;
  gradeLevel: string;
  durationMinutes: number;
  questionsJson: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    if (input.examId) {
      const [updated] = await db
        .update(onlineExams)
        .set({
          title: input.title.trim(),
          subjectCode: input.subjectCode.trim(),
          gradeLevel: input.gradeLevel.trim(),
          durationMinutes: Math.max(1, Number(input.durationMinutes) || 25),
          questionsJson: input.questionsJson,
          isActive: true,
          createdAt: new Date(),
        })
        .where(and(eq(onlineExams.id, input.examId), eq(onlineExams.schoolId, input.schoolId)))
        .returning();
      if (!updated) throw new Error('Online exam not found.');
      return updated;
    }

    const [created] = await db
      .insert(onlineExams)
      .values({
        schoolId: input.schoolId,
        title: input.title.trim(),
        subjectCode: input.subjectCode.trim(),
        gradeLevel: input.gradeLevel.trim(),
        durationMinutes: Math.max(1, Number(input.durationMinutes) || 25),
        questionsJson: input.questionsJson,
        postedBy: input.actorName,
        isActive: true,
        createdAt: new Date(),
      })
      .returning();

    await logAuditEvent({
      schoolId: input.schoolId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: 'POST_ONLINE_EXAM',
      module: 'EXAMINATIONS',
      entityRef: `EXAM-${created.id}`,
      details: `Posted online exam "${created.title}" (${created.subjectCode}) for ${created.gradeLevel}`,
    });
    return created;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to save online exam.');
  }
}

export async function submitOnlineExamAttempt(input: {
  schoolId: number;
  examId: number;
  studentId: number;
  score: number;
  totalQuestions: number;
  actorName: string;
}) {
  const [saved] = await db
    .insert(onlineExamSubmissions)
    .values({
      schoolId: input.schoolId,
      examId: input.examId,
      studentId: input.studentId,
      score: Number(input.score),
      totalQuestions: Number(input.totalQuestions),
    })
    .returning();

  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: 'STUDENT',
    action: 'SUBMIT_ONLINE_EXAM',
    module: 'EXAMINATIONS',
    entityRef: `EXAM-${input.examId}:STU-${input.studentId}`,
    details: `Completed online exam #${input.examId} with score ${input.score}/${input.totalQuestions}`,
  });

  return saved;
}

// ============================================================================
// DELETE OPERATIONS FOR ALL EDITABLE ENTITIES
// ============================================================================

export async function deleteSchoolTenant(input: {
  schoolId: number;
  actorName: string;
  actorRole: string;
}) {
  const all = await db.select().from(schools);
  if (all.length <= 1) {
    throw new Error('Cannot delete the only remaining school tenant in the platform.');
  }
  const [deleted] = await db
    .delete(schools)
    .where(eq(schools.id, input.schoolId))
    .returning();
  if (!deleted) {
    throw new Error('School tenant not found.');
  }
  await logAuditEvent({
    schoolId: all.find((s) => s.id !== input.schoolId)?.id ?? 1,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_SCHOOL_TENANT',
    module: 'TENANT_ISOLATION',
    entityRef: deleted.code,
    details: `Deleted school tenant ${deleted.nameEn} (${deleted.code})`,
  });
  return deleted;
}

export async function deleteStudentRecord(input: {
  schoolId: number;
  studentId: number;
  actorName: string;
  actorRole: string;
}) {
  const existing = await db
    .select()
    .from(students)
    .where(and(eq(students.id, input.studentId), eq(students.schoolId, input.schoolId)));
  if (existing.length === 0) {
    throw new Error('Student record not found.');
  }

  // Clean up dependent records safely
  await db
    .delete(attendanceRecords)
    .where(and(eq(attendanceRecords.studentId, input.studentId), eq(attendanceRecords.schoolId, input.schoolId)));
  await db
    .delete(studentMarks)
    .where(and(eq(studentMarks.studentId, input.studentId), eq(studentMarks.schoolId, input.schoolId)));
  await db
    .delete(payments)
    .where(and(eq(payments.studentId, input.studentId), eq(payments.schoolId, input.schoolId)));
  await db
    .delete(invoices)
    .where(and(eq(invoices.studentId, input.studentId), eq(invoices.schoolId, input.schoolId)));
  await db
    .delete(onlineExamSubmissions)
    .where(
      and(
        eq(onlineExamSubmissions.studentId, input.studentId),
        eq(onlineExamSubmissions.schoolId, input.schoolId)
      )
    );
  await db
    .update(libraryBooks)
    .set({ status: 'AVAILABLE', borrowerStudentId: null, borrowerName: '', dueDate: '' })
    .where(and(eq(libraryBooks.borrowerStudentId, input.studentId), eq(libraryBooks.schoolId, input.schoolId)));
  await db
    .delete(portalAccounts)
    .where(
      and(
        eq(portalAccounts.linkedStudentId, input.studentId),
        eq(portalAccounts.schoolId, input.schoolId)
      )
    );

  const [deleted] = await db
    .delete(students)
    .where(and(eq(students.id, input.studentId), eq(students.schoolId, input.schoolId)))
    .returning();

  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_STUDENT',
    module: 'STUDENTS',
    entityRef: deleted.studentCode,
    details: `Deleted student ${deleted.firstName} ${deleted.fatherName} (${deleted.studentCode})`,
  });
  return deleted;
}

export async function deleteTeacherRecord(input: {
  schoolId: number;
  teacherId: number;
  actorName: string;
  actorRole: string;
}) {
  await db
    .delete(portalAccounts)
    .where(
      and(
        eq(portalAccounts.linkedTeacherId, input.teacherId),
        eq(portalAccounts.schoolId, input.schoolId)
      )
    );
  const [deleted] = await db
    .delete(teachers)
    .where(and(eq(teachers.id, input.teacherId), eq(teachers.schoolId, input.schoolId)))
    .returning();
  if (!deleted) {
    throw new Error('Teacher record not found.');
  }
  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_TEACHER',
    module: 'TEACHERS',
    entityRef: deleted.staffCode,
    details: `Deleted teacher/staff ${deleted.fullName} (${deleted.staffCode})`,
  });
  return deleted;
}

export async function deleteClassSection(input: {
  schoolId: number;
  sectionId: number;
  actorName: string;
  actorRole: string;
}) {
  const [deleted] = await db
    .delete(classSections)
    .where(and(eq(classSections.id, input.sectionId), eq(classSections.schoolId, input.schoolId)))
    .returning();
  if (!deleted) {
    throw new Error('Class section not found.');
  }
  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_CLASS_SECTION',
    module: 'ACADEMICS',
    entityRef: `${deleted.gradeLevel}-${deleted.sectionName}`,
    details: `Deleted class section ${deleted.gradeLevel} ${deleted.sectionName}`,
  });
  return deleted;
}

export async function deleteSubjectRecord(input: {
  schoolId: number;
  subjectId: number;
  actorName: string;
  actorRole: string;
}) {
  const [deleted] = await db
    .delete(subjects)
    .where(and(eq(subjects.id, input.subjectId), eq(subjects.schoolId, input.schoolId)))
    .returning();
  if (!deleted) {
    throw new Error('Subject not found.');
  }
  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_SUBJECT',
    module: 'ACADEMICS',
    entityRef: deleted.code,
    details: `Deleted curriculum subject ${deleted.code} (${deleted.nameEn})`,
  });
  return deleted;
}

export async function deleteStudentExaminationMark(input: {
  schoolId: number;
  markId: number;
  actorName: string;
  actorRole: string;
}) {
  const [deleted] = await db
    .delete(studentMarks)
    .where(and(eq(studentMarks.id, input.markId), eq(studentMarks.schoolId, input.schoolId)))
    .returning();
  if (!deleted) {
    throw new Error('Examination mark record not found.');
  }
  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_EXAM_MARK',
    module: 'EXAMINATIONS',
    entityRef: `${deleted.subjectCode}:STU-${deleted.studentId}`,
    details: `Deleted examination mark for ${deleted.subjectNameEn} (${deleted.term})`,
  });
  return deleted;
}

export async function deleteStudentInvoiceRecord(input: {
  schoolId: number;
  invoiceId: number;
  actorName: string;
  actorRole: string;
}) {
  await db
    .delete(payments)
    .where(and(eq(payments.invoiceId, input.invoiceId), eq(payments.schoolId, input.schoolId)));
  const [deleted] = await db
    .delete(invoices)
    .where(and(eq(invoices.id, input.invoiceId), eq(invoices.schoolId, input.schoolId)))
    .returning();
  if (!deleted) {
    throw new Error('Invoice not found.');
  }
  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_INVOICE',
    module: 'FINANCE',
    entityRef: deleted.invoiceNumber,
    details: `Deleted invoice ${deleted.invoiceNumber} (${deleted.feeCategory})`,
  });
  return deleted;
}

export async function deleteLibraryBook(input: {
  schoolId: number;
  bookId: number;
  actorName: string;
  actorRole: string;
}) {
  const [deleted] = await db
    .delete(libraryBooks)
    .where(and(eq(libraryBooks.id, input.bookId), eq(libraryBooks.schoolId, input.schoolId)))
    .returning();
  if (!deleted) {
    throw new Error('Library book not found.');
  }
  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_LIBRARY_BOOK',
    module: 'LIBRARY',
    entityRef: deleted.copyCode,
    details: `Deleted library book copy ${deleted.copyCode} (${deleted.titleEn})`,
  });
  return deleted;
}

export async function deleteTransportRoute(input: {
  schoolId: number;
  routeId: number;
  actorName: string;
  actorRole: string;
}) {
  const [deleted] = await db
    .delete(transportRoutes)
    .where(and(eq(transportRoutes.id, input.routeId), eq(transportRoutes.schoolId, input.schoolId)))
    .returning();
  if (!deleted) {
    throw new Error('Transport route not found.');
  }
  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_TRANSPORT_ROUTE',
    module: 'TRANSPORT',
    entityRef: deleted.routeCode,
    details: `Deleted transport route ${deleted.routeCode} (${deleted.routeName})`,
  });
  return deleted;
}

export async function deleteInventoryAsset(input: {
  schoolId: number;
  assetId: number;
  actorName: string;
  actorRole: string;
}) {
  const [deleted] = await db
    .delete(inventoryAssets)
    .where(and(eq(inventoryAssets.id, input.assetId), eq(inventoryAssets.schoolId, input.schoolId)))
    .returning();
  if (!deleted) {
    throw new Error('Inventory asset not found.');
  }
  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_INVENTORY_ASSET',
    module: 'INVENTORY',
    entityRef: deleted.assetCode,
    details: `Deleted inventory asset ${deleted.assetCode} (${deleted.name})`,
  });
  return deleted;
}

export async function deleteAnnouncementPost(input: {
  schoolId: number;
  announcementId: number;
  actorName: string;
  actorRole: string;
}) {
  const [deleted] = await db
    .delete(announcements)
    .where(
      and(eq(announcements.id, input.announcementId), eq(announcements.schoolId, input.schoolId))
    )
    .returning();
  if (!deleted) {
    throw new Error('Announcement not found.');
  }
  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_ANNOUNCEMENT',
    module: 'NOTIFICATIONS',
    entityRef: `ANN-${deleted.id}`,
    details: `Deleted announcement "${deleted.titleEn}"`,
  });
  return deleted;
}

export async function deletePortalAccount(input: {
  schoolId: number;
  accountId: number;
  actorName: string;
  actorRole: string;
}) {
  const existing = await db
    .select()
    .from(portalAccounts)
    .where(and(eq(portalAccounts.id, input.accountId), eq(portalAccounts.schoolId, input.schoolId)));
  if (existing.length === 0) {
    throw new Error('Portal login account not found.');
  }
  if (existing[0].email.toLowerCase() === 'habteofat@gmail.com') {
    throw new Error(
      'Cannot delete the primary System Administrator account (habteofat@gmail.com).'
    );
  }
  const [deleted] = await db
    .delete(portalAccounts)
    .where(and(eq(portalAccounts.id, input.accountId), eq(portalAccounts.schoolId, input.schoolId)))
    .returning();

  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_PORTAL_ACCOUNT',
    module: 'AUTH',
    entityRef: deleted.accessCode,
    details: `Deleted portal login account ${deleted.email} (${deleted.accessCode})`,
  });
  return deleted;
}

export async function deleteEBook(input: {
  schoolId: number;
  ebookId: number;
  actorName: string;
  actorRole: string;
}) {
  const [deleted] = await db
    .delete(ebooks)
    .where(and(eq(ebooks.id, input.ebookId), eq(ebooks.schoolId, input.schoolId)))
    .returning();
  if (!deleted) {
    throw new Error('EBook not found.');
  }
  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_EBOOK',
    module: 'LIBRARY',
    entityRef: deleted.code,
    details: `Deleted digital EBook "${deleted.titleEn}" (${deleted.code})`,
  });
  return deleted;
}

export async function deleteHomework(input: {
  schoolId: number;
  homeworkId: number;
  actorName: string;
  actorRole: string;
}) {
  const [deleted] = await db
    .delete(homeworks)
    .where(and(eq(homeworks.id, input.homeworkId), eq(homeworks.schoolId, input.schoolId)))
    .returning();
  if (!deleted) {
    throw new Error('Homework assignment not found.');
  }
  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_HOMEWORK',
    module: 'ACADEMICS',
    entityRef: `HW-${deleted.id}`,
    details: `Deleted homework "${deleted.title}" (${deleted.subjectCode})`,
  });
  return deleted;
}

export async function deleteOnlineExam(input: {
  schoolId: number;
  examId: number;
  actorName: string;
  actorRole: string;
}) {
  await db
    .delete(onlineExamSubmissions)
    .where(
      and(
        eq(onlineExamSubmissions.examId, input.examId),
        eq(onlineExamSubmissions.schoolId, input.schoolId)
      )
    );
  const [deleted] = await db
    .delete(onlineExams)
    .where(and(eq(onlineExams.id, input.examId), eq(onlineExams.schoolId, input.schoolId)))
    .returning();
  if (!deleted) {
    throw new Error('Online exam not found.');
  }
  await logAuditEvent({
    schoolId: input.schoolId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'DELETE_ONLINE_EXAM',
    module: 'EXAMINATIONS',
    entityRef: `EXAM-${deleted.id}`,
    details: `Deleted online exam "${deleted.title}" (${deleted.subjectCode})`,
  });
  return deleted;
}

export async function requestPasswordRecoveryViaAdmin(emailInput: string) {
  await ensureInitialDataSeeded();
  const cleanEmail = String(emailInput || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid registered email address.');
  }

  const allAccounts = await db.select().from(portalAccounts);
  const matched = allAccounts.find((a) => a.email.toLowerCase() === cleanEmail);

  await logAuditEvent({
    schoolId: matched?.schoolId ?? 1,
    actorName: matched?.fullName || cleanEmail,
    actorRole: matched?.role || 'UNVERIFIED_USER',
    action: 'PASSWORD_RECOVERY_REQUEST',
    module: 'AUTH',
    entityRef: matched?.accessCode || cleanEmail,
    details: matched
      ? `Password recovery requested for registered account ${cleanEmail} (${matched.accessCode}) via System Admin (habteofat@gmail.com).`
      : `Password recovery requested for email ${cleanEmail} via System Admin (habteofat@gmail.com).`,
  });

  return {
    requested: true,
    email: cleanEmail,
    registered: Boolean(matched),
    role: matched?.role || null,
    adminEmail: 'habteofat@gmail.com',
  };
}

export async function exportFullDatabaseSnapshot(actorName: string, actorRole: string) {
  await ensureInitialDataSeeded();

  const [
    schoolsRows,
    classSectionsRows,
    subjectsRows,
    teachersRows,
    studentsRows,
    attendanceRows,
    marksRows,
    invoicesRows,
    paymentsRows,
    libraryBooksRows,
    transportRoutesRows,
    inventoryAssetsRows,
    announcementsRows,
    syncOperationsRows,
    auditLogsRows,
    portalAccountsRows,
    ebooksRows,
    homeworksRows,
    onlineExamsRows,
    onlineExamSubmissionsRows,
  ] = await Promise.all([
    db.select().from(schools),
    db.select().from(classSections),
    db.select().from(subjects),
    db.select().from(teachers),
    db.select().from(students),
    db.select().from(attendanceRecords),
    db.select().from(studentMarks),
    db.select().from(invoices),
    db.select().from(payments),
    db.select().from(libraryBooks),
    db.select().from(transportRoutes),
    db.select().from(inventoryAssets),
    db.select().from(announcements),
    db.select().from(syncOperations),
    db.select().from(auditLogs),
    db.select().from(portalAccounts),
    db.select().from(ebooks),
    db.select().from(homeworks),
    db.select().from(onlineExams),
    db.select().from(onlineExamSubmissions),
  ]);

  await logAuditEvent({
    schoolId: schoolsRows[0]?.id ?? 1,
    actorName,
    actorRole,
    action: 'EXPORT_DATABASE_SNAPSHOT',
    module: 'GOOGLE_DRIVE_DB',
    entityRef: 'ESMS-DB-SNAPSHOT',
    details: `Exported full ESMS database snapshot (${schoolsRows.length} schools, ${studentsRows.length} students, ${portalAccountsRows.length} portal accounts).`,
  });

  return {
    schemaVersion: '1.0',
    appName: 'Ethiopian School Management System (ESMS)',
    driveFolderName: 'ESMS Database',
    exportedAt: new Date().toISOString(),
    exportedBy: actorName,
    counts: {
      schools: schoolsRows.length,
      students: studentsRows.length,
      teachers: teachersRows.length,
      classSections: classSectionsRows.length,
      subjects: subjectsRows.length,
      attendance: attendanceRows.length,
      marks: marksRows.length,
      invoices: invoicesRows.length,
      payments: paymentsRows.length,
      portalAccounts: portalAccountsRows.length,
      ebooks: ebooksRows.length,
      homeworks: homeworksRows.length,
      onlineExams: onlineExamsRows.length,
    },
    tables: {
      schools: schoolsRows,
      classSections: classSectionsRows,
      subjects: subjectsRows,
      teachers: teachersRows,
      students: studentsRows,
      attendanceRecords: attendanceRows,
      studentMarks: marksRows,
      invoices: invoicesRows,
      payments: paymentsRows,
      libraryBooks: libraryBooksRows,
      transportRoutes: transportRoutesRows,
      inventoryAssets: inventoryAssetsRows,
      announcements: announcementsRows,
      syncOperations: syncOperationsRows,
      auditLogs: auditLogsRows,
      portalAccounts: portalAccountsRows,
      ebooks: ebooksRows,
      homeworks: homeworksRows,
      onlineExams: onlineExamsRows,
      onlineExamSubmissions: onlineExamSubmissionsRows,
    },
  };
}

const TIMESTAMP_COLUMN_KEYS = ['createdAt', 'updatedAt', 'paidAt', 'syncedAt', 'submittedAt'] as const;

function coerceTimestampFieldsToDate(rows: any[]): any[] {
  return rows.map((row) => {
    const copy: Record<string, any> = { ...row };
    for (const key of TIMESTAMP_COLUMN_KEYS) {
      if (key in copy && copy[key] != null && !(copy[key] instanceof Date)) {
        const parsed = new Date(copy[key]);
        copy[key] = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
      }
    }
    return copy;
  });
}

export async function restoreFullDatabaseSnapshot(input: {
  snapshot: any;
  actorName: string;
  actorRole: string;
}) {
  await ensureInitialDataSeeded();
  const tables = input.snapshot?.tables;
  if (!tables || !Array.isArray(tables.schools) || tables.schools.length === 0) {
    throw new Error(
      'Invalid ESMS database snapshot format: missing non-empty tables.schools array.'
    );
  }

  // Delete child tables before parent tables to respect foreign key constraints
  await db.delete(onlineExamSubmissions);
  await db.delete(onlineExams);
  await db.delete(homeworks);
  await db.delete(ebooks);
  await db.delete(portalAccounts);
  await db.delete(auditLogs);
  await db.delete(syncOperations);
  await db.delete(announcements);
  await db.delete(inventoryAssets);
  await db.delete(transportRoutes);
  await db.delete(libraryBooks);
  await db.delete(payments);
  await db.delete(invoices);
  await db.delete(studentMarks);
  await db.delete(attendanceRecords);
  await db.delete(students);
  await db.delete(teachers);
  await db.delete(subjects);
  await db.delete(classSections);
  await db.delete(users);
  await db.delete(schools);

  // Re-insert parent tables first, then child tables (with Date objects restored from ISO strings)
  if (Array.isArray(tables.schools) && tables.schools.length > 0) {
    await db.insert(schools).values(coerceTimestampFieldsToDate(tables.schools));
  }
  if (Array.isArray(tables.classSections) && tables.classSections.length > 0) {
    await db.insert(classSections).values(coerceTimestampFieldsToDate(tables.classSections));
  }
  if (Array.isArray(tables.subjects) && tables.subjects.length > 0) {
    await db.insert(subjects).values(coerceTimestampFieldsToDate(tables.subjects));
  }
  if (Array.isArray(tables.teachers) && tables.teachers.length > 0) {
    await db.insert(teachers).values(coerceTimestampFieldsToDate(tables.teachers));
  }
  if (Array.isArray(tables.students) && tables.students.length > 0) {
    await db.insert(students).values(coerceTimestampFieldsToDate(tables.students));
  }
  if (Array.isArray(tables.attendanceRecords) && tables.attendanceRecords.length > 0) {
    await db.insert(attendanceRecords).values(coerceTimestampFieldsToDate(tables.attendanceRecords));
  }
  if (Array.isArray(tables.studentMarks) && tables.studentMarks.length > 0) {
    await db.insert(studentMarks).values(coerceTimestampFieldsToDate(tables.studentMarks));
  }
  if (Array.isArray(tables.invoices) && tables.invoices.length > 0) {
    await db.insert(invoices).values(coerceTimestampFieldsToDate(tables.invoices));
  }
  if (Array.isArray(tables.payments) && tables.payments.length > 0) {
    await db.insert(payments).values(coerceTimestampFieldsToDate(tables.payments));
  }
  if (Array.isArray(tables.libraryBooks) && tables.libraryBooks.length > 0) {
    await db.insert(libraryBooks).values(coerceTimestampFieldsToDate(tables.libraryBooks));
  }
  if (Array.isArray(tables.transportRoutes) && tables.transportRoutes.length > 0) {
    await db.insert(transportRoutes).values(coerceTimestampFieldsToDate(tables.transportRoutes));
  }
  if (Array.isArray(tables.inventoryAssets) && tables.inventoryAssets.length > 0) {
    await db.insert(inventoryAssets).values(coerceTimestampFieldsToDate(tables.inventoryAssets));
  }
  if (Array.isArray(tables.announcements) && tables.announcements.length > 0) {
    await db.insert(announcements).values(coerceTimestampFieldsToDate(tables.announcements));
  }
  if (Array.isArray(tables.syncOperations) && tables.syncOperations.length > 0) {
    await db.insert(syncOperations).values(coerceTimestampFieldsToDate(tables.syncOperations));
  }
  if (Array.isArray(tables.auditLogs) && tables.auditLogs.length > 0) {
    await db.insert(auditLogs).values(coerceTimestampFieldsToDate(tables.auditLogs));
  }
  if (Array.isArray(tables.portalAccounts) && tables.portalAccounts.length > 0) {
    await db.insert(portalAccounts).values(coerceTimestampFieldsToDate(tables.portalAccounts));
  }
  if (Array.isArray(tables.ebooks) && tables.ebooks.length > 0) {
    await db.insert(ebooks).values(coerceTimestampFieldsToDate(tables.ebooks));
  }
  if (Array.isArray(tables.homeworks) && tables.homeworks.length > 0) {
    await db.insert(homeworks).values(coerceTimestampFieldsToDate(tables.homeworks));
  }
  if (Array.isArray(tables.onlineExams) && tables.onlineExams.length > 0) {
    await db.insert(onlineExams).values(coerceTimestampFieldsToDate(tables.onlineExams));
  }
  if (Array.isArray(tables.onlineExamSubmissions) && tables.onlineExamSubmissions.length > 0) {
    await db
      .insert(onlineExamSubmissions)
      .values(coerceTimestampFieldsToDate(tables.onlineExamSubmissions));
  }

  // Ensure every registered student in the restored snapshot has an active Portal Login Account
  await authorizeAllRegisteredStudentsLogin({
    schoolId: tables.schools[0]?.id ?? 1,
    actorName: input.actorName,
    actorRole: input.actorRole,
  });

  await logAuditEvent({
    schoolId: tables.schools[0]?.id ?? 1,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'RESTORE_DATABASE_SNAPSHOT',
    module: 'GOOGLE_DRIVE_DB',
    entityRef: 'ESMS-DB-RESTORE',
    details: `Restored ESMS database snapshot from Google Drive (${tables.schools.length} schools, ${tables.students?.length || 0} students).`,
  });

  return {
    restored: true,
    schoolsCount: tables.schools.length,
    studentsCount: tables.students?.length || 0,
    restoredAt: new Date().toISOString(),
  };
}




