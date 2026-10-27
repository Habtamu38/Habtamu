import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAssessmentResult,
  calculateInvoiceBalance,
  calculateStudentAttendanceSummary,
  ethiopianToGregorian,
  formatEtb,
  generateRoleAccessCode,
  gregorianToEthiopian,
  hasRolePermission,
  isEthiopianLeapYear,
  validateEthiopianStudentName,
  validateRoleAccessCode,
  verifyTenantAccess,
} from './ethiopianRules';

test('Ethiopian calendar conversion handles New Year (Meskerem 1) and leap years accurately', () => {
  // 2026-09-11 is Meskerem 1, 2019 E.C.
  const ethNewYear = gregorianToEthiopian('2026-09-11');
  assert.equal(ethNewYear.year, 2019);
  assert.equal(ethNewYear.month, 1);
  assert.equal(ethNewYear.day, 1);
  assert.equal(ethNewYear.monthNameEn, 'Meskerem');
  assert.equal(ethNewYear.monthNameAm, 'መስከረም');

  // Round-trip conversion back to Gregorian
  const gregBack = ethiopianToGregorian(2019, 1, 1);
  assert.equal(gregBack, '2026-09-11');

  // 2019 E.C. is an Ethiopian leap year (2019 % 4 === 3 -> 6 days in Pagume)
  assert.equal(isEthiopianLeapYear(2019), true);
  assert.equal(isEthiopianLeapYear(2018), false);

  // Pagume 6, 2019 E.C. is 2027-09-11 (making Meskerem 1, 2020 E.C. fall on 2027-09-12)
  const pagume6 = ethiopianToGregorian(2019, 13, 6);
  assert.equal(pagume6, '2027-09-11');

  // Invalid Pagume 6 on non-leap year throws
  assert.throws(() => ethiopianToGregorian(2018, 13, 6), /Invalid Ethiopian day/);
});

test('Examination grading scale validates limits and computes weighted totals', () => {
  const result = calculateAssessmentResult({
    continuousMark: 28,
    midtermMark: 18,
    finalMark: 46,
  });
  assert.equal(result.totalMark, '92.00');
  assert.equal(result.percentage, 92);
  assert.equal(result.gradeLetter, 'A+');
  assert.equal(result.passed, true);

  // Out-of-bounds continuous mark throws validation error
  assert.throws(
    () =>
      calculateAssessmentResult({
        continuousMark: 35,
        midtermMark: 15,
        finalMark: 40,
      }),
    /Continuous assessment mark must be between 0 and 30/
  );
});

test('ETB monetary math avoids floating point errors and enforces invoice balance rules', () => {
  const calc = calculateInvoiceBalance('12500.00', '1500.00', '5500.25');
  assert.equal(calc.netPayableEtb, '11000.00');
  assert.equal(calc.paidAmountEtb, '5500.25');
  assert.equal(calc.balanceEtb, '5499.75');
  assert.equal(calc.status, 'PARTIAL');

  const fullPaid = calculateInvoiceBalance('8000.00', '0.00', '8000.00');
  assert.equal(fullPaid.balanceEtb, '0.00');
  assert.equal(fullPaid.status, 'PAID');

  assert.equal(formatEtb('12500.5', 'en'), 'ETB 12,500.50');
  assert.equal(formatEtb('12500.5', 'am'), 'ብር 12,500.50');

  assert.throws(
    () => calculateInvoiceBalance('5000.00', '0.00', '6000.00'),
    /Paid amount cannot exceed net payable balance/
  );
});

test('Multi-school tenant isolation blocks cross-school access and verifies RBAC', () => {
  // School 1 user accessing School 1 is allowed
  const sameSchool = verifyTenantAccess({
    userRole: 'SCHOOL_ADMIN',
    userSchoolId: 1,
    targetSchoolId: 1,
  });
  assert.equal(sameSchool.allowed, true);

  // School 1 user attempting to access School 2 is strictly blocked
  const crossSchool = verifyTenantAccess({
    userRole: 'SCHOOL_ADMIN',
    userSchoolId: 1,
    targetSchoolId: 2,
  });
  assert.equal(crossSchool.allowed, false);
  assert.match(crossSchool.reason ?? '', /Cross-tenant access denied/);

  // Super Admin can manage platform schools
  const superAdmin = verifyTenantAccess({
    userRole: 'SUPER_ADMIN',
    userSchoolId: null,
    targetSchoolId: 2,
  });
  assert.equal(superAdmin.allowed, true);

  // Role permissions check
  assert.equal(hasRolePermission('FINANCE_OFFICER', 'RECORD_PAYMENT'), true);
  assert.equal(hasRolePermission('TEACHER', 'RECORD_PAYMENT'), false);
  assert.equal(hasRolePermission('TEACHER', 'ENTER_EXAM_MARKS'), true);
});

test('Ethiopian 3-part student naming validation enforces First, Father, and Grandfather names', () => {
  const valid = validateEthiopianStudentName({
    firstName: 'Abebe',
    fatherName: 'Kebede',
    grandfatherName: 'Tadesse',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.fullNameEn, 'Abebe Kebede Tadesse');

  const invalid = validateEthiopianStudentName({
    firstName: 'Abebe',
    fatherName: '',
    grandfatherName: 'Tadesse',
  });
  assert.equal(invalid.valid, false);
});

test('Admin 6-digit role access codes (STU-, TEA-, FIN-, LIN-) generate and validate accurately', () => {
  const stuCode = generateRoleAccessCode('STU', 482910);
  assert.equal(stuCode, 'STU-482910');

  const teaCheck = validateRoleAccessCode('tea-739201');
  assert.equal(teaCheck.valid, true);
  assert.equal(teaCheck.prefix, 'TEA');
  assert.equal(teaCheck.role, 'TEACHER');
  assert.equal(teaCheck.normalizedCode, 'TEA-739201');

  const finCheck = validateRoleAccessCode('FIN-518392');
  assert.equal(finCheck.valid, true);
  assert.equal(finCheck.role, 'FINANCE_OFFICER');

  const linCheck = validateRoleAccessCode('LIN-629405');
  assert.equal(linCheck.valid, true);
  assert.equal(linCheck.role, 'LIBRARIAN');

  // Invalid prefix or non-6-digit code fails
  assert.equal(validateRoleAccessCode('STU-12345').valid, false);
  assert.equal(validateRoleAccessCode('STU-1234567').valid, false);
  assert.equal(validateRoleAccessCode('ADM-123456').valid, false);

  // Student attendance Present / Absent counter
  const summary = calculateStudentAttendanceSummary([
    { status: 'PRESENT' },
    { status: 'PRESENT' },
    { status: 'ABSENT' },
    { status: 'LATE' },
  ]);
  assert.equal(summary.presentDays, 2);
  assert.equal(summary.absentDays, 1);
  assert.equal(summary.lateDays, 1);
  assert.equal(summary.totalRecordedDays, 4);
  assert.equal(summary.attendanceRatePercent, 75);
});

test('messages/en.json and messages/am.json maintain identical translation keys', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const enRaw = JSON.parse(fs.readFileSync(path.resolve('messages/en.json'), 'utf8'));
  const amRaw = JSON.parse(fs.readFileSync(path.resolve('messages/am.json'), 'utf8'));

  const flattenKeys = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.keys(obj)
      .sort()
      .flatMap((k) => {
        const val = obj[k];
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          return flattenKeys(val as Record<string, unknown>, fullKey);
        }
        return [fullKey];
      });

  assert.deepEqual(flattenKeys(enRaw), flattenKeys(amRaw));
});

test('Focus-trap index calculation wraps strictly forward and backward within the login card', async () => {
  const { computeNextFocusIndex } = await import('./focusTrap');

  // 5 focusable controls in the frosted login card:
  // 0: identifier, 1: password, 2: show/hide, 3: remember me, 4: login button
  assert.equal(computeNextFocusIndex(0, 5, false), 1);
  assert.equal(computeNextFocusIndex(1, 5, false), 2);
  assert.equal(computeNextFocusIndex(2, 5, false), 3);
  assert.equal(computeNextFocusIndex(3, 5, false), 4);
  // Tab on last item (4) wraps strictly back to first item (0)
  assert.equal(computeNextFocusIndex(4, 5, false), 0);

  // Shift+Tab on first item (0) wraps strictly to last item (4)
  assert.equal(computeNextFocusIndex(0, 5, true), 4);
  assert.equal(computeNextFocusIndex(4, 5, true), 3);

  // Outside focus (-1) pulls focus to first (Tab) or last (Shift+Tab)
  assert.equal(computeNextFocusIndex(-1, 5, false), 0);
  assert.equal(computeNextFocusIndex(-1, 5, true), 4);
  assert.equal(computeNextFocusIndex(0, 0, false), -1);
});

test('Teacher-posted online exam remains visible during allotted minutes and disappears once time expires', async () => {
  const {
    calculateOnlineExamRemainingSeconds,
    isOnlineExamActiveForStudent,
    formatExamCountdown,
  } = await import('./ethiopianRules');

  const postedAtMs = Date.parse('2026-10-23T10:00:00.000Z');
  const durationMinutes = 20;

  // 5 minutes after teacher posted: 15 minutes (900s) left -> active and visible to student
  const fiveMinsLater = postedAtMs + 5 * 60 * 1000;
  const remaining = calculateOnlineExamRemainingSeconds(postedAtMs, durationMinutes, fiveMinsLater);
  assert.equal(remaining, 900);
  assert.equal(formatExamCountdown(remaining), '15:00');
  assert.equal(
    isOnlineExamActiveForStudent({ createdAt: postedAtMs, durationMinutes, isActive: true }, fiveMinsLater),
    true
  );

  // Exactly 20 minutes after teacher posted: 0 seconds left -> disappears from student view
  const twentyMinsLater = postedAtMs + 20 * 60 * 1000;
  assert.equal(calculateOnlineExamRemainingSeconds(postedAtMs, durationMinutes, twentyMinsLater), 0);
  assert.equal(
    isOnlineExamActiveForStudent({ createdAt: postedAtMs, durationMinutes, isActive: true }, twentyMinsLater),
    false
  );

  // 35 minutes after teacher posted: still 0 seconds and hidden from student view
  const thirtyFiveMinsLater = postedAtMs + 35 * 60 * 1000;
  assert.equal(
    isOnlineExamActiveForStudent({ createdAt: postedAtMs, durationMinutes, isActive: true }, thirtyFiveMinsLater),
    false
  );
});

test('Student homework submission summary counts reviewed, pending, and teacher feedback records accurately', async () => {
  const { buildStudentHomeworkSubmissionSummary, formatFileSize } = await import('./ethiopianRules');

  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(2048), '2.0 KB');
  assert.equal(formatFileSize(1048576), '1.00 MB');

  const summary = buildStudentHomeworkSubmissionSummary(
    [
      {
        studentId: 1,
        status: 'REVIEWED',
        teacherFeedback: 'Well structured logarithmic proof on Q1-Q12.',
      },
      {
        studentId: 1,
        status: 'SUBMITTED',
        teacherFeedback: '',
      },
      {
        studentId: 2,
        status: 'REVIEWED',
        teacherFeedback: 'Other student feedback',
      },
    ],
    1
  );

  assert.equal(summary.totalSubmitted, 2);
  assert.equal(summary.reviewedCount, 1);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.withFeedbackCount, 1);
});

test('Deleting a student homework submission requires confirmation before removing from workspace.homeworks', async () => {
  const { removeHomeworkSubmissionFromWorkspace } = await import('./ethiopianRules');

  const initialHomeworks = [
    {
      id: 1,
      title: 'Grade 10 Mathematics Homework',
      submissions: [
        { id: 'SUB-101', fileName: 'Yohannes_Math_Unit1.pdf' },
        { id: 'SUB-102', fileName: 'Yohannes_Math_Unit2.pdf' },
      ],
    },
  ];

  // Unconfirmed delete attempt must keep all files intact
  const cancelledResult = removeHomeworkSubmissionFromWorkspace(
    initialHomeworks,
    'SUB-101',
    false
  );
  assert.equal(cancelledResult.removed, false);
  assert.equal(cancelledResult.updatedHomeworks[0].submissions?.length, 2);

  // Confirmed delete removes the target file from workspace.homeworks
  const confirmedResult = removeHomeworkSubmissionFromWorkspace(
    initialHomeworks,
    'SUB-101',
    true
  );
  assert.equal(confirmedResult.removed, true);
  assert.equal(confirmedResult.updatedHomeworks[0].submissions?.length, 1);
  assert.equal(
    confirmedResult.updatedHomeworks[0].submissions?.[0].id,
    'SUB-102'
  );
});

test('Student profile summary builder structures Name, Grade, Class, and ID accurately', async () => {
  const { buildStudentProfileSummary } = await import('./ethiopianRules');

  const profile = buildStudentProfileSummary({
    student: {
      firstName: 'Yohannes',
      fatherName: 'Kebede',
      grandfatherName: 'Worku',
      gradeLevel: 'Grade 10',
      sectionName: 'Section A',
      studentCode: 'ET-BOLE-2019-001',
      enrollmentStatus: 'ACTIVE',
    },
    studentAccount: {
      accessCode: 'STU-482910',
      email: 'yohannes.kebede@student.edu.et',
    },
    school: {
      nameEn: 'Addis Ababa Bole Preparatory & Secondary School',
      academicYearLabel: '2019 E.C. (2026/27 G.C.)',
      currentTerm: 'Term 1',
    },
  });

  assert.equal(profile.fullName, 'Yohannes Kebede Worku');
  assert.equal(profile.initials, 'YK');
  assert.equal(profile.grade, 'Grade 10');
  assert.equal(profile.gradeBadgeLabel, 'GRADE 10');
  assert.equal(
    profile.secondaryGradeLevels.find((g) => g.label === 'Grade 10')?.isCurrent,
    true
  );
  assert.equal(profile.classSection, 'Section A');
  assert.equal(profile.studentId, 'STU-482910');
  assert.equal(profile.email, 'yohannes.kebede@student.edu.et');
});

test('Student attendance progress model computes progress bar percentages and standing accurately', async () => {
  const { buildStudentAttendanceProgressModel } = await import('./ethiopianRules');

  const progress = buildStudentAttendanceProgressModel([
    { status: 'PRESENT' },
    { status: 'PRESENT' },
    { status: 'PRESENT' },
    { status: 'LATE' },
    { status: 'ABSENT' },
  ]);

  assert.equal(progress.totalRecordedDays, 5);
  assert.equal(progress.presentDays, 3);
  assert.equal(progress.lateDays, 1);
  assert.equal(progress.absentDays, 1);
  assert.equal(progress.clampedPercent, 80);
  assert.equal(progress.presentWidthPercent, 60);
  assert.equal(progress.lateWidthPercent, 20);
  assert.equal(progress.absentWidthPercent, 20);
  assert.equal(progress.standingLabel, 'GOOD');
});

test('Student Home navigation enforces the exact 8 ordered modules (1. Student Profile through 8. Homework)', async () => {
  const { STUDENT_HOME_MODULES } = await import('./ethiopianRules');

  assert.equal(STUDENT_HOME_MODULES.length, 8);
  assert.deepEqual(
    STUDENT_HOME_MODULES.map((m) => m.labelEn),
    [
      '1. Student Profile',
      '2. EBook Library',
      '3. Grades & Report',
      '4. Exam',
      '5. School Announcements',
      '6. Teachers & Timetable',
      '7. Attendance',
      '8. Homework',
    ]
  );
});

test('End-of-year overall teacher-recorded score out of 100% passes at >= 50% and fails below 50%', async () => {
  const { calculateAnnualStudentStanding } = await import('./ethiopianRules');

  // Case 1: Overall >= 50% -> Passed (አልፏል)
  const passingStanding = calculateAnnualStudentStanding([
    { continuousMark: 27, midtermMark: 18, finalMark: 44, totalMark: 89 },
    { continuousMark: 28, midtermMark: 19, finalMark: 44, totalMark: 91 },
  ]);
  assert.equal(passingStanding.subjectCount, 2);
  assert.equal(passingStanding.totalPointsEarned, 180);
  assert.equal(passingStanding.maxPossiblePoints, 200);
  assert.equal(passingStanding.overallPercentage, 90);
  assert.equal(passingStanding.passed, true);
  assert.equal(passingStanding.statusCode, 'PASSED');
  assert.equal(passingStanding.statusLabelAm, 'አልፏል');

  // Case 2: Exact boundary 50.0% -> Passed (አልፏል)
  const boundaryPass = calculateAnnualStudentStanding([
    { totalMark: 50 },
    { totalMark: 50 },
  ]);
  assert.equal(boundaryPass.overallPercentage, 50);
  assert.equal(boundaryPass.passed, true);
  assert.equal(boundaryPass.statusCode, 'PASSED');
  assert.equal(boundaryPass.statusLabelAm, 'አልፏል');

  // Case 3: Overall < 50% (e.g. 46.5%) -> Failed (አላለፈም)
  const failingStanding = calculateAnnualStudentStanding([
    { continuousMark: 14, midtermMark: 10, finalMark: 20, totalMark: 44 },
    { continuousMark: 15, midtermMark: 10, finalMark: 24, totalMark: 49 },
  ]);
  assert.equal(failingStanding.overallPercentage, 46.5);
  assert.equal(failingStanding.passed, false);
  assert.equal(failingStanding.statusCode, 'FAILED');
  assert.equal(failingStanding.statusLabelAm, 'አላለፈም');
});

test('Visual status badge (Pass/Fail) next to calculated final grade follows 50% threshold and official payment accounts match Telebirr 0938680030 and CBE 1000302646787', async () => {
  const { getGradePassFailBadge, SCHOOL_PAYMENT_ACCOUNTS } = await import('./ethiopianRules');

  assert.equal( getGradePassFailBadge(89).badgeLabel, 'Pass');
  assert.equal(getGradePassFailBadge(50).badgeLabel, 'Pass');
  assert.equal(getGradePassFailBadge(49.9).badgeLabel, 'Fail');
  assert.equal(getGradePassFailBadge(32).badgeLabel, 'Fail');

  assert.equal(SCHOOL_PAYMENT_ACCOUNTS.telebirr.accountNumber, '0938680030');
  assert.equal(SCHOOL_PAYMENT_ACCOUNTS.cbe.accountNumber, '1000302646787');
});

test('LoginForm real-time email, student username, and access code validator accepts valid formats and rejects invalid inputs', async () => {
  const { isValidEmailOrAccessCode } = await import('../components/forms/LoginForm');

  // Valid emails
  assert.equal(isValidEmailOrAccessCode('habteofat@gmail.com'), true);
  assert.equal(isValidEmailOrAccessCode('admin@esms.edu.et'), true);
  assert.equal(isValidEmailOrAccessCode('  yohannes.kebede@student.edu.et  '), true);

  // Valid Ethiopian student usernames
  assert.equal(isValidEmailOrAccessCode('abebe.kebede'), true);
  assert.equal(isValidEmailOrAccessCode('abebe.kebede.1'), true);

  // Valid 6-digit role access codes
  assert.equal(isValidEmailOrAccessCode('STU-482910'), true);
  assert.equal(isValidEmailOrAccessCode('tea-739201'), true);
  assert.equal(isValidEmailOrAccessCode('FIN-518392'), true);

  // Invalid email formats or incomplete inputs
  assert.equal(isValidEmailOrAccessCode(''), false);
  assert.equal(isValidEmailOrAccessCode('invalid-email'), false);
  assert.equal(isValidEmailOrAccessCode('user@'), false);
  assert.equal(isValidEmailOrAccessCode('user@domain'), false);
  assert.equal(isValidEmailOrAccessCode('user@domain.c'), false);
  assert.equal(isValidEmailOrAccessCode('STU-123'), false);
});

test('All registered students are automatically authorized to log in via email, username, or STU access code', async () => {
  const {
    ensureInitialDataSeeded,
    registerStudentRecord,
    authenticatePortalLogin,
    authorizeAllRegisteredStudentsLogin,
    deleteStudentRecord,
  } = await import('../db/repository');

  await ensureInitialDataSeeded();

  const created = await registerStudentRecord({
    schoolId: 1,
    firstName: 'Biniyam',
    fatherName: 'Solomon',
    grandfatherName: 'Bekele',
    fullNameAm: 'ቢኒያም ሰለሞን በቀለ',
    gender: 'Male',
    dateOfBirth: '2010-05-12',
    gradeLevel: 'Grade 10',
    sectionName: 'Section A',
    guardianName: 'Solomon Bekele',
    guardianRelationship: 'Father',
    guardianPhone: '+251-911-223344',
    emergencyContactPhone: '+251-911-223344',
    subCity: 'Bole',
    woreda: 'Woreda 03',
    previousSchool: 'Bole Primary',
    actorName: 'Admin',
    actorRole: 'SCHOOL_ADMIN',
  });

  try {
    const authRes = await authorizeAllRegisteredStudentsLogin({
      schoolId: 1,
      actorName: 'Admin',
      actorRole: 'SCHOOL_ADMIN',
    });
    assert.ok(authRes.authorizedStudentsCount >= 1);

    // 1. Login with full student email + STU password code
    const loginByEmail = await authenticatePortalLogin(
      created.loginUser,
      created.loginPassword
    );
    assert.equal(loginByEmail.role, 'STUDENT');
    assert.equal(loginByEmail.linkedStudentId, created.id);

    // 2. Login with dot-separated username (firstName.fatherName) + STU password code
    const loginByUsername = await authenticatePortalLogin(
      'biniyam.solomon',
      created.loginPassword
    );
    assert.equal(loginByUsername.role, 'STUDENT');
    assert.equal(loginByUsername.linkedStudentId, created.id);

    // 3. Login with STU-XXXXXX code as identifier + 6-digit numeric password
    const sixDigits = created.loginPassword.replace(/^STU-/i, '');
    const loginByCode = await authenticatePortalLogin(
      created.studentCode,
      sixDigits
    );
    assert.equal(loginByCode.role, 'STUDENT');
    assert.equal(loginByCode.linkedStudentId, created.id);
  } finally {
    await deleteStudentRecord({
      schoolId: 1,
      studentId: created.id,
      actorName: 'Admin',
      actorRole: 'SCHOOL_ADMIN',
    });
  }
});

test('Student Portal dashboard theme palette, pastel Quick Access cards, bilingual search filter, and bottom navigation match specifications', async () => {
  const {
    STUDENT_PORTAL_THEME,
    STUDENT_PORTAL_QUICK_ACCESS_CARDS,
    STUDENT_PORTAL_BOTTOM_NAV,
    filterStudentPortalQuickAccessCards,
  } = await import('./ethiopianRules');

  assert.equal(STUDENT_PORTAL_THEME.mainBackground, '#F8F9FE');
  assert.equal(STUDENT_PORTAL_THEME.headerGradientFrom, '#304FC7');
  assert.equal(STUDENT_PORTAL_THEME.headerGradientTo, '#673AB7');
  assert.equal(STUDENT_PORTAL_THEME.mainText, '#20243A');
  assert.equal(STUDENT_PORTAL_THEME.secondaryText, '#73788A');
  assert.equal(STUDENT_PORTAL_THEME.navBackground, '#FFFFFF');
  assert.equal(STUDENT_PORTAL_THEME.navActiveIcon, '#673AB7');

  assert.deepEqual(STUDENT_PORTAL_THEME.pastelCards, {
    lavender: '#F0EBFF',
    lightBlue: '#EAF3FF',
    mintGreen: '#E7F8F0',
    lightPink: '#FCEAF2',
    paleYellow: '#FFF6D9',
    lightPeach: '#FFF0E5',
  });

  // Verify all 13 Quick Access dashboard features exist
  assert.equal(STUDENT_PORTAL_QUICK_ACCESS_CARDS.length, 13);
  assert.deepEqual(
    STUDENT_PORTAL_BOTTOM_NAV.map((n) => n.labelEn),
    ['Home', 'Calendar', 'Messages', 'More']
  );

  // Verify bilingual search filtering (English + Amharic)
  assert.equal(filterStudentPortalQuickAccessCards('').length, 13);
  assert.equal(filterStudentPortalQuickAccessCards('Gallery')[0]?.id, 'gallery');
  assert.equal(filterStudentPortalQuickAccessCards('ክፍያ')[0]?.id, 'fees');
  assert.equal(filterStudentPortalQuickAccessCards('ውይይት')[0]?.id, 'chat_support');
  assert.equal(filterStudentPortalQuickAccessCards('nonexistent-xyz').length, 0);
});

test('Workspace state JSON export and import for Google Drive "ESMS Database" folder preserves tables, workspaceContext, and student portal login accounts', async () => {
  const {
    DRIVE_FOLDER_NAME,
    PRIMARY_MASTER_SNAPSHOT_FILENAME,
    buildEsmsDriveFolderQuery,
    buildEsmsDriveSnapshotFilesQuery,
    findPreferredDriveSnapshotFile,
    buildWorkspaceStateSnapshot,
    parseAndValidateWorkspaceSnapshot,
  } = await import('./googleDriveDb');
  const {
    exportFullDatabaseSnapshot,
    restoreFullDatabaseSnapshot,
  } = await import('../db/repository');

  assert.equal(DRIVE_FOLDER_NAME, 'ESMS Database');
  assert.equal(PRIMARY_MASTER_SNAPSHOT_FILENAME, 'esms-master-database.json');
  assert.equal(
    buildEsmsDriveFolderQuery(),
    "name = 'ESMS Database' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
  );
  assert.equal(
    buildEsmsDriveSnapshotFilesQuery('folder-123'),
    "'folder-123' in parents and mimeType = 'application/json' and trashed = false"
  );

  const sampleFiles = [
    { id: 'f1', name: 'esms-workspace-snapshot-2026.json', modifiedTime: '2026-10-27T07:00:00Z' },
    { id: 'f2', name: 'esms-master-database.json', modifiedTime: '2026-10-26T07:00:00Z' },
  ];
  assert.equal(findPreferredDriveSnapshotFile(sampleFiles)?.id, 'f2');
  assert.equal(findPreferredDriveSnapshotFile([sampleFiles[0]])?.id, 'f1');
  assert.equal(findPreferredDriveSnapshotFile([]), null);

  // Export live database snapshot and wrap with workspaceContext
  const dbSnapshot = await exportFullDatabaseSnapshot('Admin', 'SCHOOL_ADMIN');
  const fullWorkspaceState = buildWorkspaceStateSnapshot(dbSnapshot, {
    activeSchoolId: 1,
    activeTab: 'overview',
    lang: 'am',
    calendarMode: 'BOTH',
    offlineQueue: [],
  });

  const serializedJson = JSON.stringify(fullWorkspaceState, null, 2);
  const parsedAndValidated = parseAndValidateWorkspaceSnapshot(serializedJson);

  assert.equal(parsedAndValidated.driveFolderName, 'ESMS Database');
  assert.equal(parsedAndValidated.workspaceContext?.lang, 'am');
  assert.equal(parsedAndValidated.workspaceContext?.activeSchoolId, 1);
  assert.ok(parsedAndValidated.counts.schools >= 1);

  // Restore from validated JSON snapshot and verify round-trip persistence
  const restoreResult = await restoreFullDatabaseSnapshot({
    snapshot: parsedAndValidated,
    actorName: 'Admin',
    actorRole: 'SCHOOL_ADMIN',
  });
  assert.equal(restoreResult.restored, true);
  assert.equal(restoreResult.schoolsCount, parsedAndValidated.counts.schools);

  // Reject malformed JSON payloads
  assert.throws(
    () => parseAndValidateWorkspaceSnapshot(JSON.stringify({ tables: { schools: [] } })),
    /not a valid ESMS workspace snapshot/
  );
});

test('Header sync status indicator reflects Online (green dot) when offlineQueue is empty and Offline Queue (amber pulsing dot) when items are queued', async () => {
  const { getHeaderSyncStatusModel } = await import('./ethiopianRules');

  const onlineState = getHeaderSyncStatusModel(0);
  assert.equal(onlineState.isOnlineSynced, true);
  assert.equal(onlineState.statusCode, 'ONLINE');
  assert.equal(onlineState.queueSize, 0);
  assert.equal(onlineState.dotColorClass, 'bg-emerald-500');
  assert.equal(onlineState.labelEn, 'Online · Synced');
  assert.equal(onlineState.labelAm, 'ኦንላይን · ተመሳስሏል');

  const queuedState = getHeaderSyncStatusModel(3);
  assert.equal(queuedState.isOnlineSynced, false);
  assert.equal(queuedState.statusCode, 'OFFLINE_PENDING');
  assert.equal(queuedState.queueSize, 3);
  assert.equal(queuedState.dotColorClass, 'bg-amber-500 animate-pulse');
  assert.equal(queuedState.labelEn, 'Offline Queue (3)');
  assert.equal(queuedState.labelAm, 'ኦፍላይን ወረፋ (3)');
});

test('Print Report toolbar helper enables Print Report button on Examinations and Finance views and triggers window.print()', async () => {
  const { isPrintableReportView, triggerBrowserPrintReport } = await import('./ethiopianRules');

  assert.equal(isPrintableReportView('exams'), true);
  assert.equal(isPrintableReportView('finance'), true);
  assert.equal(isPrintableReportView('overview'), false);
  assert.equal(isPrintableReportView('students'), false);

  let printedCount = 0;
  const result = triggerBrowserPrintReport({
    print: () => {
      printedCount += 1;
    },
  });
  assert.equal(result, true);
  assert.equal(printedCount, 1);
  assert.equal(triggerBrowserPrintReport({}), false);
});




