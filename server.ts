import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import * as dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  authenticatePortalLogin,
  authorizeAllRegisteredStudentsLogin,
  createAnnouncementPost,
  createOrUpdateClassSection,
  createOrUpdateEBook,
  createOrUpdateHomework,
  createOrUpdateInventoryAsset,
  createOrUpdateLibraryBook,
  createOrUpdateOnlineExam,
  createOrUpdatePortalAccount,
  createOrUpdateSubject,
  createOrUpdateTeacher,
  createOrUpdateTransportRoute,
  createSchoolTenant,
  createStudentInvoiceRecord,
  deleteAnnouncementPost,
  deleteClassSection,
  deleteEBook,
  deleteHomework,
  deleteHomeworkSubmissionFile,
  deleteInventoryAsset,
  deleteLibraryBook,
  deleteOnlineExam,
  deletePortalAccount,
  deleteSchoolTenant,
  deleteStudentExaminationMark,
  deleteStudentInvoiceRecord,
  deleteStudentRecord,
  deleteSubjectRecord,
  deleteTeacherRecord,
  deleteTransportRoute,
  exportFullDatabaseSnapshot,
  getAllSchools,
  getOrCreateUser,
  getSchoolWorkspaceData,
  logAuditEvent,
  processOfflineSyncBatch,
  recordIdempotentPayment,
  registerStudentRecord,
  requestPasswordRecoveryViaAdmin,
  restoreFullDatabaseSnapshot,
  reversePaymentTransaction,
  submitOnlineExamAttempt,
  submitStudentHomeworkFile,
  toggleLibraryBookLoan,
  updateAnnouncementPost,
  updateHomeworkSubmissionFeedback,
  updateSchoolTenant,
  updateStudentInvoiceRecord,
  updateStudentRecord,
  upsertAttendanceRecord,
  upsertStudentExaminationMark,
} from './src/db/repository.ts';
import { hasRolePermission, verifyTenantAccess } from './src/utils/ethiopianRules.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health Check
  app.get('/api/v1/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'esms-ethiopia-api',
      apiVersion: 'v1',
      timestamp: new Date().toISOString(),
    });
  });

  // 1. Schools & Multi-Tenant Onboarding + Edit School Configuration
  app.get('/api/v1/schools', requireAuth, async (req: AuthRequest, res) => {
    try {
      const list = await getAllSchools();
      if (req.esmsUser) {
        await getOrCreateUser(
          req.esmsUser.uid,
          req.esmsUser.email,
          req.esmsUser.fullName,
          req.esmsUser.role,
          req.esmsUser.schoolId ?? list[0]?.id ?? null
        );
      }
      res.json({ schools: list });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load schools' });
    }
  });

  app.post('/api/v1/schools', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'SCHOOL_ADMIN') {
        return res.status(403).json({
          error: 'Forbidden: Only Platform Super Admin or School Admin can onboard a school.',
        });
      }
      const {
        code,
        nameEn,
        nameAm,
        schoolType,
        schoolLevel,
        region,
        city,
        subCity,
        woreda,
        phone,
        email,
      } = req.body;

      if (!code || !nameEn || !nameAm) {
        return res.status(400).json({
          error: 'School code, English name, and Amharic name are required.',
        });
      }

      const created = await createSchoolTenant({
        code,
        nameEn,
        nameAm,
        schoolType: schoolType || 'GOVERNMENT',
        schoolLevel: schoolLevel || 'SECONDARY (Grades 9-12)',
        region: region || 'Addis Ababa City Administration',
        city: city || 'Addis Ababa',
        subCity: subCity || 'Bole',
        woreda: woreda || 'Woreda 01',
        phone: phone || '+251-111-000-000',
        email: email || 'info@school.edu.et',
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.status(201).json({ school: created });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to onboard school' });
    }
  });

  app.put('/api/v1/schools/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number.parseInt(String(req.params.id), 10);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }

      const updated = await updateSchoolTenant({
        schoolId: targetSchoolId,
        code: String(req.body.code || ''),
        nameEn: String(req.body.nameEn || ''),
        nameAm: String(req.body.nameAm || ''),
        schoolType: String(req.body.schoolType || 'GOVERNMENT'),
        schoolLevel: String(req.body.schoolLevel || 'SECONDARY (Grades 9-12)'),
        region: String(req.body.region || 'Addis Ababa City Administration'),
        city: String(req.body.city || 'Addis Ababa'),
        subCity: String(req.body.subCity || 'Bole'),
        woreda: String(req.body.woreda || 'Woreda 01'),
        phone: String(req.body.phone || '+251-111-000-000'),
        email: String(req.body.email || 'info@school.edu.et'),
        academicYearLabel: String(req.body.academicYearLabel || '2019 E.C. / 2026-27 G.C.'),
        currentTerm: String(req.body.currentTerm || 'Term 1 (Meskerem - Tahsas)'),
        subscriptionStatus: String(req.body.subscriptionStatus || 'ACTIVE'),
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ school: updated });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to update school' });
    }
  });

  // 2. Tenant-Isolated School Workspace Data
  app.get('/api/v1/workspace/:schoolId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const targetSchoolId = Number.parseInt(String(req.params.schoolId), 10);
      if (Number.isNaN(targetSchoolId)) {
        return res.status(400).json({ error: 'Invalid school ID.' });
      }

      const actor = req.esmsUser!;
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });

      if (!tenantCheck.allowed) {
        await logAuditEvent({
          schoolId: targetSchoolId,
          actorName: actor.fullName,
          actorRole: actor.role,
          action: 'BLOCKED_CROSS_TENANT_ACCESS',
          module: 'TENANT_ISOLATION',
          entityRef: `SCHOOL-${targetSchoolId}`,
          details: tenantCheck.reason || 'Cross-tenant request blocked by server guard.',
        });
        return res.status(403).json({ error: tenantCheck.reason });
      }

      const data = await getSchoolWorkspaceData(targetSchoolId);
      return res.json(data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to load workspace data' });
    }
  });

  // 3. Student Registration & Edit (3-Part Ethiopian Name Validation + Tenant Check)
  app.post('/api/v1/students', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }
      if (!hasRolePermission(actor.role, 'REGISTER_STUDENT')) {
        return res.status(403).json({
          error: `Role ${actor.role} is not permitted to register students.`,
        });
      }

      const student = await registerStudentRecord({
        schoolId: targetSchoolId,
        firstName: String(req.body.firstName || ''),
        fatherName: String(req.body.fatherName || ''),
        grandfatherName: String(req.body.grandfatherName || ''),
        fullNameAm: String(req.body.fullNameAm || ''),
        gender: String(req.body.gender || 'Female'),
        dateOfBirth: String(req.body.dateOfBirth || '2010-09-11'),
        gradeLevel: String(req.body.gradeLevel || 'Grade 10'),
        sectionName: String(req.body.sectionName || 'Section A'),
        guardianName: String(req.body.guardianName || ''),
        guardianRelationship: String(req.body.guardianRelationship || 'Father'),
        guardianPhone: String(req.body.guardianPhone || ''),
        emergencyContactPhone: String(req.body.emergencyContactPhone || ''),
        subCity: String(req.body.subCity || 'Bole'),
        woreda: String(req.body.woreda || 'Woreda 03'),
        previousSchool: String(req.body.previousSchool || 'Direct Admission'),
        email: req.body.email ? String(req.body.email) : undefined,
        accessCode: req.body.accessCode ? String(req.body.accessCode) : undefined,
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.status(201).json({
        student,
        loginCredentials: {
          loginUser: student.loginUser,
          loginPassword: student.loginPassword,
          studentCode: student.studentCode,
        },
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to register student' });
    }
  });

  app.put('/api/v1/students/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const studentId = Number.parseInt(String(req.params.id), 10);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }
      if (!hasRolePermission(actor.role, 'REGISTER_STUDENT')) {
        return res.status(403).json({
          error: `Role ${actor.role} is not permitted to edit student records.`,
        });
      }

      const student = await updateStudentRecord({
        schoolId: targetSchoolId,
        studentId,
        studentCode: req.body.studentCode ? String(req.body.studentCode) : undefined,
        email: req.body.email ? String(req.body.email) : undefined,
        firstName: String(req.body.firstName || ''),
        fatherName: String(req.body.fatherName || ''),
        grandfatherName: String(req.body.grandfatherName || ''),
        fullNameAm: String(req.body.fullNameAm || ''),
        gender: String(req.body.gender || 'Female'),
        dateOfBirth: String(req.body.dateOfBirth || '2010-09-11'),
        gradeLevel: String(req.body.gradeLevel || 'Grade 10'),
        sectionName: String(req.body.sectionName || 'Section A'),
        guardianName: String(req.body.guardianName || ''),
        guardianRelationship: String(req.body.guardianRelationship || 'Father'),
        guardianPhone: String(req.body.guardianPhone || ''),
        subCity: String(req.body.subCity || 'Bole'),
        woreda: String(req.body.woreda || 'Woreda 03'),
        previousSchool: String(req.body.previousSchool || 'Direct Admission'),
        enrollmentStatus: String(req.body.enrollmentStatus || 'ACTIVE'),
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ student });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to update student' });
    }
  });

  // 3B. Teachers, Class Sections & Subjects Create / Update
  app.post('/api/v1/teachers', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }

      const teacher = await createOrUpdateTeacher({
        schoolId: targetSchoolId,
        teacherId: req.body.teacherId ? Number(req.body.teacherId) : undefined,
        staffCode: req.body.staffCode ? String(req.body.staffCode) : undefined,
        fullName: String(req.body.fullName || ''),
        fullNameAm: String(req.body.fullNameAm || ''),
        roleTitle: String(req.body.roleTitle || 'Subject Teacher'),
        department: String(req.body.department || 'Natural Sciences'),
        qualification: String(req.body.qualification || 'B.Ed.'),
        assignedSubjects: String(req.body.assignedSubjects || ''),
        assignedGrades: String(req.body.assignedGrades || ''),
        phone: String(req.body.phone || ''),
        email: String(req.body.email || ''),
        employmentStatus: String(req.body.employmentStatus || 'ACTIVE'),
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ teacher });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to save teacher' });
    }
  });

  app.post('/api/v1/sections', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }

      const section = await createOrUpdateClassSection({
        schoolId: targetSchoolId,
        sectionId: req.body.sectionId ? Number(req.body.sectionId) : undefined,
        gradeLevel: String(req.body.gradeLevel || 'Grade 10'),
        sectionName: String(req.body.sectionName || 'Section A'),
        stream: String(req.body.stream || 'General Secondary'),
        roomNumber: String(req.body.roomNumber || 'Block A - Rm 101'),
        capacity: Number(req.body.capacity) || 45,
        homeroomTeacherName: String(req.body.homeroomTeacherName || ''),
        academicYear: String(req.body.academicYear || '2019 E.C.'),
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ section });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to save class section' });
    }
  });

  app.post('/api/v1/subjects', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }

      const subject = await createOrUpdateSubject({
        schoolId: targetSchoolId,
        subjectId: req.body.subjectId ? Number(req.body.subjectId) : undefined,
        code: String(req.body.code || ''),
        nameEn: String(req.body.nameEn || ''),
        nameAm: String(req.body.nameAm || ''),
        gradeLevel: String(req.body.gradeLevel || 'Grade 10'),
        periodsPerWeek: Number(req.body.periodsPerWeek) || 5,
        continuousWeight: Number(req.body.continuousWeight) || 30,
        midtermWeight: Number(req.body.midtermWeight) || 20,
        finalWeight: Number(req.body.finalWeight) || 50,
        passingMark: Number(req.body.passingMark) || 50,
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ subject });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to save subject' });
    }
  });

  // 4. Daily Attendance Recording (Idempotent / Unique per Student + Date)
  app.post('/api/v1/attendance', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }
      if (!hasRolePermission(actor.role, 'RECORD_ATTENDANCE')) {
        return res.status(403).json({
          error: `Role ${actor.role} is not permitted to record attendance.`,
        });
      }

      const record = await upsertAttendanceRecord({
        schoolId: targetSchoolId,
        studentId: Number(req.body.studentId),
        attendanceDate: String(req.body.attendanceDate || '2026-10-23'),
        status: String(req.body.status || 'PRESENT'),
        remarks: String(req.body.remarks || ''),
        recordedBy: actor.fullName,
        actorRole: actor.role,
        syncOperationId: req.body.syncOperationId ? String(req.body.syncOperationId) : undefined,
      });

      return res.json({ attendance: record });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to save attendance' });
    }
  });

  // 5. Examination Marks Entry & Validation
  app.post('/api/v1/examinations/marks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }
      if (!hasRolePermission(actor.role, 'ENTER_EXAM_MARKS')) {
        return res.status(403).json({
          error: `Role ${actor.role} is not permitted to enter examination marks.`,
        });
      }

      const saved = await upsertStudentExaminationMark({
        schoolId: targetSchoolId,
        studentId: Number(req.body.studentId),
        subjectCode: String(req.body.subjectCode || 'MATH-10'),
        subjectNameEn: String(req.body.subjectNameEn || 'Mathematics'),
        subjectNameAm: String(req.body.subjectNameAm || 'ሒሳብ'),
        academicYear: String(req.body.academicYear || '2019 E.C.'),
        term: String(req.body.term || 'Term 1'),
        continuousMark: Number(req.body.continuousMark),
        midtermMark: Number(req.body.midtermMark),
        finalMark: Number(req.body.finalMark),
        status: String(req.body.status || 'PUBLISHED'),
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ mark: saved });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to save examination mark' });
    }
  });

  // 6. Finance: Create & Update Invoice (ETB)
  app.post('/api/v1/invoices', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }
      if (!hasRolePermission(actor.role, 'CREATE_INVOICE')) {
        return res.status(403).json({
          error: `Role ${actor.role} is not permitted to create invoices.`,
        });
      }

      const invoice = await createStudentInvoiceRecord({
        schoolId: targetSchoolId,
        studentId: Number(req.body.studentId),
        feeCategory: String(req.body.feeCategory || 'Term Tuition Fee'),
        academicYear: String(req.body.academicYear || '2019 E.C.'),
        term: String(req.body.term || 'Term 1'),
        totalAmountEtb: req.body.totalAmountEtb,
        discountEtb: req.body.discountEtb || 0,
        dueDate: String(req.body.dueDate || '2026-11-30'),
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.status(201).json({ invoice });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to create invoice' });
    }
  });

  app.put('/api/v1/invoices/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const invoiceId = Number.parseInt(String(req.params.id), 10);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }
      if (!hasRolePermission(actor.role, 'CREATE_INVOICE')) {
        return res.status(403).json({
          error: `Role ${actor.role} is not permitted to edit invoices.`,
        });
      }

      const invoice = await updateStudentInvoiceRecord({
        schoolId: targetSchoolId,
        invoiceId,
        feeCategory: String(req.body.feeCategory || 'Term Tuition Fee'),
        totalAmountEtb: req.body.totalAmountEtb,
        discountEtb: req.body.discountEtb || 0,
        dueDate: String(req.body.dueDate || '2026-11-30'),
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ invoice });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to update invoice' });
    }
  });

  // 7. Finance: Record Idempotent Payment (ETB)
  app.post('/api/v1/payments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }
      if (!hasRolePermission(actor.role, 'RECORD_PAYMENT')) {
        return res.status(403).json({
          error: `Role ${actor.role} is not permitted to record payments.`,
        });
      }

      const result = await recordIdempotentPayment({
        schoolId: targetSchoolId,
        invoiceId: Number(req.body.invoiceId),
        amountEtb: req.body.amountEtb,
        paymentMethod: String(req.body.paymentMethod || 'Telebirr'),
        transactionReference: String(req.body.transactionReference || `REF-${Date.now()}`),
        idempotencyKey: String(req.body.idempotencyKey || `IDEMP-${Date.now()}`),
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to record payment' });
    }
  });

  // 8. Finance: Authorized Payment Reversal (Audit-Safe, Never Hard Deleted)
  app.post('/api/v1/payments/reverse', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }
      if (!hasRolePermission(actor.role, 'REVERSE_PAYMENT')) {
        return res.status(403).json({
          error: `Role ${actor.role} is not permitted to reverse financial transactions.`,
        });
      }

      const reversal = await reversePaymentTransaction({
        schoolId: targetSchoolId,
        paymentId: Number(req.body.paymentId),
        reversalReason: String(req.body.reversalReason || ''),
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ reversal });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to reverse payment' });
    }
  });

  // 9. Library, Transport & Inventory Operations (Catalog + Edit + Circulation)
  app.post('/api/v1/library/toggle-loan', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }

      const updated = await toggleLibraryBookLoan({
        schoolId: targetSchoolId,
        bookId: Number(req.body.bookId),
        studentId: req.body.studentId ? Number(req.body.studentId) : null,
        dueDate: String(req.body.dueDate || '2026-11-15'),
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ book: updated });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Library operation failed' });
    }
  });

  app.post('/api/v1/library/books', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }

      const book = await createOrUpdateLibraryBook({
        schoolId: targetSchoolId,
        bookId: req.body.bookId ? Number(req.body.bookId) : undefined,
        isbn: String(req.body.isbn || '978-99944-0-000-0'),
        copyCode: String(req.body.copyCode || ''),
        titleEn: String(req.body.titleEn || ''),
        titleAm: String(req.body.titleAm || ''),
        author: String(req.body.author || 'Ministry of Education'),
        category: String(req.body.category || 'Reference'),
        gradeLevel: String(req.body.gradeLevel || 'Grade 10'),
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ book });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to save library book' });
    }
  });

  app.post('/api/v1/transport/routes', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }

      const route = await createOrUpdateTransportRoute({
        schoolId: targetSchoolId,
        routeId: req.body.routeId ? Number(req.body.routeId) : undefined,
        routeCode: String(req.body.routeCode || ''),
        routeName: String(req.body.routeName || ''),
        stopsList: String(req.body.stopsList || ''),
        vehiclePlate: String(req.body.vehiclePlate || ''),
        driverName: String(req.body.driverName || ''),
        driverPhone: String(req.body.driverPhone || ''),
        capacity: Number(req.body.capacity) || 30,
        assignedCount: Number(req.body.assignedCount) || 0,
        termFeeEtb: req.body.termFeeEtb || '3000.00',
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ route });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to save transport route' });
    }
  });

  app.post('/api/v1/inventory/assets', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }

      const asset = await createOrUpdateInventoryAsset({
        schoolId: targetSchoolId,
        assetId: req.body.assetId ? Number(req.body.assetId) : undefined,
        assetCode: String(req.body.assetCode || ''),
        name: String(req.body.name || ''),
        category: String(req.body.category || 'Laboratory Equipment'),
        department: String(req.body.department || 'Science Lab'),
        quantity: Number(req.body.quantity) || 1,
        minimumThreshold: Number(req.body.minimumThreshold) || 5,
        unitValueEtb: req.body.unitValueEtb || '5000.00',
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ asset });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to save inventory asset' });
    }
  });

  // 10. Announcements & Notifications (Create + Edit)
  app.post('/api/v1/announcements', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }

      const created = await createAnnouncementPost({
        schoolId: targetSchoolId,
        titleEn: String(req.body.titleEn || ''),
        titleAm: String(req.body.titleAm || ''),
        bodyEn: String(req.body.bodyEn || ''),
        bodyAm: String(req.body.bodyAm || ''),
        audience: String(req.body.audience || 'ALL'),
        channel: String(req.body.channel || 'IN_APP_AND_SMS'),
        priority: String(req.body.priority || 'NORMAL'),
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.status(201).json({ announcement: created });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to publish announcement' });
    }
  });

  app.put('/api/v1/announcements/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const announcementId = Number.parseInt(String(req.params.id), 10);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }

      const updated = await updateAnnouncementPost({
        schoolId: targetSchoolId,
        announcementId,
        titleEn: String(req.body.titleEn || ''),
        titleAm: String(req.body.titleAm || ''),
        bodyEn: String(req.body.bodyEn || ''),
        bodyAm: String(req.body.bodyAm || ''),
        audience: String(req.body.audience || 'ALL'),
        channel: String(req.body.channel || 'IN_APP_AND_SMS'),
        priority: String(req.body.priority || 'NORMAL'),
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ announcement: updated });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to update announcement' });
    }
  });

  // 11. Offline Synchronization Protocol Endpoint
  app.post('/api/v1/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }

      const operations = Array.isArray(req.body.operations) ? req.body.operations : [];
      const synced = await processOfflineSyncBatch({
        schoolId: targetSchoolId,
        operations,
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ synced });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Offline sync batch failed' });
    }
  });

  // 12. Strict Admin-Controlled Login Gate (Email + Password Only)
  app.post('/api/v1/auth/login', async (req, res) => {
    try {
      const identifier = String(req.body.identifier || '');
      const password = String(req.body.password || '');
      const account = await authenticatePortalLogin(identifier, password);
      return res.json({ account });
    } catch (error: any) {
      return res.status(403).json({ error: error.message || 'Login rejected.' });
    }
  });

  // 13. Admin Access Control: Create / Edit Registered Emails & 6-Digit Access Codes
  app.post('/api/v1/portal-accounts', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const tenantCheck = verifyTenantAccess({
        userRole: actor.role,
        userSchoolId: actor.schoolId,
        targetSchoolId,
      });
      if (!tenantCheck.allowed) {
        return res.status(403).json({ error: tenantCheck.reason });
      }

      const account = await createOrUpdatePortalAccount({
        schoolId: targetSchoolId,
        accountId: req.body.accountId ? Number(req.body.accountId) : undefined,
        email: String(req.body.email || ''),
        accessCode: req.body.accessCode ? String(req.body.accessCode) : undefined,
        fullName: String(req.body.fullName || ''),
        fullNameAm: String(req.body.fullNameAm || ''),
        role: String(req.body.role || 'STUDENT'),
        linkedStudentId: req.body.linkedStudentId ? Number(req.body.linkedStudentId) : null,
        linkedTeacherId: req.body.linkedTeacherId ? Number(req.body.linkedTeacherId) : null,
        isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
        actorName: actor.fullName,
        actorRole: actor.role,
      });

      return res.json({ account });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to save access account' });
    }
  });

  // 13b. Authorize / Activate Login Access for All Registered Students
  app.post('/api/v1/students/authorize-all-login', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId || actor.schoolId || 1);
      const result = await authorizeAllRegisteredStudentsLogin({
        schoolId: targetSchoolId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json(result);
    } catch (error: any) {
      return res
        .status(400)
        .json({ error: error.message || 'Failed to authorize student logins' });
    }
  });

  // 14. Digital EBooks (Admin, Librarian, Teacher)
  app.post('/api/v1/ebooks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const ebook = await createOrUpdateEBook({
        schoolId: targetSchoolId,
        ebookId: req.body.ebookId ? Number(req.body.ebookId) : undefined,
        code: String(req.body.code || ''),
        titleEn: String(req.body.titleEn || ''),
        titleAm: String(req.body.titleAm || ''),
        subjectCode: String(req.body.subjectCode || 'MATH-10'),
        gradeLevel: String(req.body.gradeLevel || 'Grade 10'),
        author: String(req.body.author || 'Ministry of Education'),
        summary: String(req.body.summary || ''),
        contentBody: String(req.body.contentBody || ''),
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ ebook });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to save EBook' });
    }
  });

  // 15. Homework Assignments (Teacher / Admin Post & Edit + Student Homework File Upload)
  app.post('/api/v1/homeworks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const homework = await createOrUpdateHomework({
        schoolId: targetSchoolId,
        homeworkId: req.body.homeworkId ? Number(req.body.homeworkId) : undefined,
        title: String(req.body.title || ''),
        subjectCode: String(req.body.subjectCode || 'MATH-10'),
        gradeLevel: String(req.body.gradeLevel || 'Grade 10'),
        sectionName: String(req.body.sectionName || 'Section A'),
        dueDate: String(req.body.dueDate || '2026-10-30'),
        instructions: String(req.body.instructions || ''),
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ homework });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to save homework' });
    }
  });

  app.post('/api/v1/homeworks/:id/submissions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const homeworkId = Number.parseInt(String(req.params.id), 10) || 1;
      const targetSchoolId = Number(req.body.schoolId) || actor.schoolId || 1;
      const submission = await submitStudentHomeworkFile({
        schoolId: targetSchoolId,
        homeworkId,
        homeworkTitle: String(req.body.homeworkTitle || 'Homework Assignment'),
        subjectCode: String(req.body.subjectCode || 'MATH-10'),
        studentId: Number(req.body.studentId) || 1,
        studentCode: String(req.body.studentCode || 'STU-482910'),
        studentName: String(req.body.studentName || actor.fullName),
        fileName: String(req.body.fileName || ''),
        fileSizeBytes: Number(req.body.fileSizeBytes) || 1024,
        fileType: String(req.body.fileType || 'application/pdf'),
        fileContentPreview: String(req.body.fileContentPreview || ''),
        notes: String(req.body.notes || ''),
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.status(201).json({ submission });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to upload homework file' });
    }
  });

  app.put('/api/v1/homeworks/submissions/:submissionId/feedback', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const submissionId = String(req.params.submissionId);
      const targetSchoolId = Number(req.body.schoolId) || actor.schoolId || 1;
      const updated = await updateHomeworkSubmissionFeedback({
        schoolId: targetSchoolId,
        submissionId,
        status: (req.body.status || 'REVIEWED') as 'SUBMITTED' | 'REVIEWED' | 'NEEDS_REVISION',
        teacherFeedback: String(req.body.teacherFeedback || ''),
        gradeScore: req.body.gradeScore ? String(req.body.gradeScore) : undefined,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ submission: updated });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to update homework feedback' });
    }
  });

  app.delete('/api/v1/homeworks/submissions/:submissionId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const submissionId = String(req.params.submissionId);
      const targetSchoolId = Number(req.query.schoolId) || actor.schoolId || 1;
      const deleted = await deleteHomeworkSubmissionFile({
        schoolId: targetSchoolId,
        submissionId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete homework submission' });
    }
  });

  // 16. Interactive Online Exams for Student Exam Space (Teacher / Admin Post & Student Submit)
  app.post('/api/v1/online-exams', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const targetSchoolId = Number(req.body.schoolId);
      const exam = await createOrUpdateOnlineExam({
        schoolId: targetSchoolId,
        examId: req.body.examId ? Number(req.body.examId) : undefined,
        title: String(req.body.title || ''),
        subjectCode: String(req.body.subjectCode || 'MATH-10'),
        gradeLevel: String(req.body.gradeLevel || 'Grade 10'),
        durationMinutes: Number(req.body.durationMinutes) || 25,
        questionsJson: String(req.body.questionsJson || '[]'),
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ exam });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to save online exam' });
    }
  });

  app.post('/api/v1/online-exams/submit', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const submission = await submitOnlineExamAttempt({
        schoolId: Number(req.body.schoolId) || 1,
        examId: Number(req.body.examId),
        studentId: Number(req.body.studentId),
        score: Number(req.body.score),
        totalQuestions: Number(req.body.totalQuestions),
        actorName: actor.fullName,
      });
      return res.json({ submission });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to submit online exam' });
    }
  });

  // 17. Student AI Help Option (Server-Side Gemini Study Assistant via @google/genai)
  app.post('/api/v1/ai-tutor', requireAuth, async (req: AuthRequest, res) => {
    try {
      const question = String(req.body.question || '').trim();
      const subject = String(req.body.subject || 'General Ethiopian Secondary Curriculum');
      const gradeLevel = String(req.body.gradeLevel || 'Grade 10');

      if (!question) {
        return res.status(400).json({ error: 'Please enter a study question.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `You are an encouraging secondary school tutor helping a ${gradeLevel} student studying ${subject}. Provide a clear, step-by-step explanation in English.\n\nStudent Question: ${question}`,
        });
        return res.json({
          answer:
            response.text ||
            'Here is your curriculum study summary. Review the key formulas and examples in your EBook.',
        });
      }

      // Structured English curriculum explanation fallback if GEMINI_API_KEY is not yet configured in environment
      return res.json({
        answer: `[${gradeLevel} · ${subject} Study Guide]\n\n1. Key Concept Breakdown:\nFor "${question}", start by identifying the given variables, definitions, and standard textbook formulas for ${subject}.\n\n2. Step-by-Step Method:\n• Step 1: Write down the governing equation or grammatical rule from your ${gradeLevel} EBook.\n• Step 2: Substitute the known values and simplify step by step.\n• Step 3: Verify the unit or context and compare with your class notes.\n\n(Tip: Check the EBook Library and Exam tabs for practice problems on ${subject}.)`,
      });
    } catch (error: any) {
      return res.json({
        answer: `Study Assistant Note:\nReview the core chapter formulas in your EBook for "${req.body.question || 'this topic'}" and practice the interactive quiz in the Exam tab.`,
      });
    }
  });

  // 18. DELETE Endpoints for All Editable Entities
  app.delete('/api/v1/schools/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deleteSchoolTenant({
        schoolId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete school' });
    }
  });

  app.delete('/api/v1/students/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number(req.query.schoolId || req.body?.schoolId || actor.schoolId || 1);
      const studentId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deleteStudentRecord({
        schoolId,
        studentId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete student' });
    }
  });

  app.delete('/api/v1/teachers/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number(req.query.schoolId || req.body?.schoolId || actor.schoolId || 1);
      const teacherId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deleteTeacherRecord({
        schoolId,
        teacherId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete teacher' });
    }
  });

  app.delete('/api/v1/sections/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number(req.query.schoolId || req.body?.schoolId || actor.schoolId || 1);
      const sectionId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deleteClassSection({
        schoolId,
        sectionId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete class section' });
    }
  });

  app.delete('/api/v1/subjects/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number(req.query.schoolId || req.body?.schoolId || actor.schoolId || 1);
      const subjectId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deleteSubjectRecord({
        schoolId,
        subjectId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete subject' });
    }
  });

  app.delete('/api/v1/examinations/marks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number(req.query.schoolId || req.body?.schoolId || actor.schoolId || 1);
      const markId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deleteStudentExaminationMark({
        schoolId,
        markId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete examination mark' });
    }
  });

  app.delete('/api/v1/invoices/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number(req.query.schoolId || req.body?.schoolId || actor.schoolId || 1);
      const invoiceId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deleteStudentInvoiceRecord({
        schoolId,
        invoiceId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete invoice' });
    }
  });

  app.delete('/api/v1/library/books/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number(req.query.schoolId || req.body?.schoolId || actor.schoolId || 1);
      const bookId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deleteLibraryBook({
        schoolId,
        bookId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete library book' });
    }
  });

  app.delete('/api/v1/transport/routes/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number(req.query.schoolId || req.body?.schoolId || actor.schoolId || 1);
      const routeId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deleteTransportRoute({
        schoolId,
        routeId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete transport route' });
    }
  });

  app.delete('/api/v1/inventory/assets/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number(req.query.schoolId || req.body?.schoolId || actor.schoolId || 1);
      const assetId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deleteInventoryAsset({
        schoolId,
        assetId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete inventory asset' });
    }
  });

  app.delete('/api/v1/announcements/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number(req.query.schoolId || req.body?.schoolId || actor.schoolId || 1);
      const announcementId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deleteAnnouncementPost({
        schoolId,
        announcementId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete announcement' });
    }
  });

  app.delete('/api/v1/portal-accounts/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number(req.query.schoolId || req.body?.schoolId || actor.schoolId || 1);
      const accountId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deletePortalAccount({
        schoolId,
        accountId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete portal account' });
    }
  });

  app.delete('/api/v1/ebooks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number(req.query.schoolId || req.body?.schoolId || actor.schoolId || 1);
      const ebookId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deleteEBook({
        schoolId,
        ebookId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete EBook' });
    }
  });

  app.delete('/api/v1/homeworks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number(req.query.schoolId || req.body?.schoolId || actor.schoolId || 1);
      const homeworkId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deleteHomework({
        schoolId,
        homeworkId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete homework' });
    }
  });

  app.delete('/api/v1/online-exams/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const schoolId = Number(req.query.schoolId || req.body?.schoolId || actor.schoolId || 1);
      const examId = Number.parseInt(String(req.params.id), 10);
      const deleted = await deleteOnlineExam({
        schoolId,
        examId,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to delete online exam' });
    }
  });

  // Public Password Recovery Request via System Admin (habteofat@gmail.com)
  app.post('/api/v1/auth/password-recovery', async (req, res) => {
    try {
      const email = String(req.body?.email || '');
      const result = await requestPasswordRecoveryViaAdmin(email);
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to log recovery request' });
    }
  });

  // Full Database Snapshot Export & Restore (Google Drive Database Integration)
  app.get('/api/v1/database/snapshot', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const snapshot = await exportFullDatabaseSnapshot(actor.fullName, actor.role);
      return res.json({ snapshot });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to export database snapshot' });
    }
  });

  app.post('/api/v1/database/restore', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = req.esmsUser!;
      const snapshot = req.body?.snapshot || req.body;
      const result = await restoreFullDatabaseSnapshot({
        snapshot,
        actorName: actor.fullName,
        actorRole: actor.role,
      });
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to restore database snapshot' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ESMS Ethiopia full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
