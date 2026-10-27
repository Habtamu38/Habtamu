export type UserRole =
  | 'SUPER_ADMIN'
  | 'SCHOOL_ADMIN'
  | 'PRINCIPAL'
  | 'REGISTRAR'
  | 'TEACHER'
  | 'FINANCE_OFFICER'
  | 'LIBRARIAN'
  | 'PARENT'
  | 'STUDENT';

export type LanguageCode = 'en' | 'am';

export interface EthiopianDate {
  year: number;
  month: number; // 1..13
  day: number; // 1..30 (1..5 or 6 for Pagume)
  monthNameEn: string;
  monthNameAm: string;
}

export const ETHIOPIAN_MONTHS: ReadonlyArray<{ en: string; am: string }> = [
  { en: 'Meskerem', am: 'መስከረም' },
  { en: 'Tikimt', am: 'ጥቅምት' },
  { en: 'Hidar', am: 'ኅዳር' },
  { en: 'Tahsas', am: 'ታኅሣሥ' },
  { en: 'Tir', am: 'ጥር' },
  { en: 'Yekatit', am: 'የካቲት' },
  { en: 'Megabit', am: 'መጋቢት' },
  { en: 'Miyazia', am: 'ሚያዝያ' },
  { en: 'Ginbot', am: 'ግንቦት' },
  { en: 'Sene', am: 'ሰኔ' },
  { en: 'Hamle', am: 'ሐምሌ' },
  { en: 'Nehase', am: 'ነሐሴ' },
  { en: 'Pagume', am: 'ጳጉሜን' },
];

const JD_EPOCH_OFFSET_AMETE_MIHRET = 1723856;

/**
 * Checks whether an Ethiopian year is a leap year (6 days in Pagume).
 * In the Ethiopian calendar, year Y has 6 Pagume days when (Y + 1) % 4 === 0 (i.e. Y % 4 === 3).
 */
export function isEthiopianLeapYear(ethYear: number): boolean {
  return ((ethYear % 4) + 4) % 4 === 3;
}

export function isGregorianLeapYear(gregYear: number): boolean {
  return (gregYear % 4 === 0 && gregYear % 100 !== 0) || gregYear % 400 === 0;
}

/**
 * Converts a Gregorian calendar date (YYYY, MM 1-12, DD 1-31) to Julian Day Number.
 */
export function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/**
 * Converts Julian Day Number to Gregorian calendar date (YYYY-MM-DD).
 */
export function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

/**
 * Converts an ISO Gregorian date string (YYYY-MM-DD) to an Ethiopian calendar date.
 */
export function gregorianToEthiopian(isoDate: string): EthiopianDate {
  const clean = isoDate.trim().slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid ISO date format: ${isoDate}`);
  }
  const [gYear, gMonth, gDay] = parts;
  const jdn = gregorianToJdn(gYear, gMonth, gDay);
  const r = (jdn - JD_EPOCH_OFFSET_AMETE_MIHRET) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year =
    4 * Math.floor((jdn - JD_EPOCH_OFFSET_AMETE_MIHRET) / 1461) +
    Math.floor(r / 365) -
    Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  const monthMeta = ETHIOPIAN_MONTHS[month - 1] ?? ETHIOPIAN_MONTHS[0];
  return {
    year,
    month,
    day,
    monthNameEn: monthMeta.en,
    monthNameAm: monthMeta.am,
  };
}

/**
 * Converts an Ethiopian calendar date (year, month 1..13, day 1..30) to canonical Gregorian YYYY-MM-DD.
 */
export function ethiopianToGregorian(ethYear: number, ethMonth: number, ethDay: number): string {
  if (ethMonth < 1 || ethMonth > 13) {
    throw new Error(`Ethiopian month must be between 1 and 13, got ${ethMonth}`);
  }
  const maxDay = ethMonth === 13 ? (isEthiopianLeapYear(ethYear) ? 6 : 5) : 30;
  if (ethDay < 1 || ethDay > maxDay) {
    throw new Error(
      `Invalid Ethiopian day ${ethDay} for month ${ethMonth} in year ${ethYear} (max ${maxDay})`
    );
  }
  const jdn =
    JD_EPOCH_OFFSET_AMETE_MIHRET +
    365 +
    365 * (ethYear - 1) +
    Math.floor(ethYear / 4) +
    30 * ethMonth +
    ethDay -
    31;
  const { year, month, day } = jdnToGregorian(jdn);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Formats a canonical YYYY-MM-DD date in Ethiopian, Gregorian, or Dual display.
 */
export function formatCalendarDate(
  isoDate: string,
  mode: 'ETHIOPIAN' | 'GREGORIAN' | 'BOTH' = 'BOTH',
  lang: LanguageCode = 'en'
): string {
  try {
    const eth = gregorianToEthiopian(isoDate);
    const ethFormatted =
      lang === 'am'
        ? `${eth.monthNameAm} ${eth.day}፣ ${eth.year} ዓ.ም`
        : `${eth.monthNameEn} ${eth.day}, ${eth.year} E.C.`;
    if (mode === 'ETHIOPIAN') return ethFormatted;
    if (mode === 'GREGORIAN') return `${isoDate} G.C.`;
    return `${ethFormatted} · ${isoDate}`;
  } catch {
    return isoDate;
  }
}

/**
 * Decimal-safe ETB monetary conversion to integer santim (cents).
 */
export function toSantim(amount: number | string): number {
  const num = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid monetary amount: ${amount}`);
  }
  return Math.round(num * 100);
}

export function fromSantim(santim: number): string {
  return (santim / 100).toFixed(2);
}

/**
 * Formats an amount in Ethiopian Birr (ETB / ብር) using tabular-safe formatting.
 */
export function formatEtb(amount: number | string, lang: LanguageCode = 'en'): string {
  const santim = toSantim(amount);
  const birr = santim / 100;
  const formatted = birr.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return lang === 'am' ? `ብር ${formatted}` : `ETB ${formatted}`;
}

export interface InvoiceComputationResult {
  netPayableEtb: string;
  paidAmountEtb: string;
  balanceEtb: string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
}

/**
 * Computes invoice balance and status using exact santim integer math.
 */
export function calculateInvoiceBalance(
  totalAmountEtb: number | string,
  discountEtb: number | string,
  paidAmountEtb: number | string
): InvoiceComputationResult {
  const totalS = toSantim(totalAmountEtb);
  const discountS = toSantim(discountEtb);
  const paidS = toSantim(paidAmountEtb);

  if (totalS < 0 || discountS < 0 || paidS < 0) {
    throw new Error('Monetary amounts cannot be negative.');
  }
  if (discountS > totalS) {
    throw new Error('Discount cannot exceed total invoice amount.');
  }

  const netPayableS = totalS - discountS;
  if (paidS > netPayableS) {
    throw new Error('Paid amount cannot exceed net payable balance.');
  }

  const balanceS = netPayableS - paidS;
  let status: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID';
  if (balanceS === 0 && netPayableS > 0) {
    status = 'PAID';
  } else if (paidS > 0 && balanceS > 0) {
    status = 'PARTIAL';
  } else if (netPayableS === 0) {
    status = 'PAID';
  }

  return {
    netPayableEtb: fromSantim(netPayableS),
    paidAmountEtb: fromSantim(paidS),
    balanceEtb: fromSantim(balanceS),
    status,
  };
}

export interface GradingBoundary {
  minPercentage: number;
  letter: string;
  labelEn: string;
  labelAm: string;
  passed: boolean;
}

export const DEFAULT_ETHIOPIAN_GRADING_SCALE: ReadonlyArray<GradingBoundary> = [
  { minPercentage: 90, letter: 'A+', labelEn: 'Distinction (Excellent)', labelAm: 'እጅግ በጣም ጥሩ', passed: true },
  { minPercentage: 85, letter: 'A', labelEn: 'Excellent', labelAm: 'በጣም ጥሩ', passed: true },
  { minPercentage: 75, letter: 'B+', labelEn: 'Very Good', labelAm: 'ጥሩ ከፍተኛ', passed: true },
  { minPercentage: 65, letter: 'B', labelEn: 'Good', labelAm: 'ጥሩ', passed: true },
  { minPercentage: 50, letter: 'C', labelEn: 'Satisfactory (Pass)', labelAm: 'አጥጋቢ (አልፏል)', passed: true },
  { minPercentage: 40, letter: 'D', labelEn: 'Conditional / Needs Support', labelAm: 'ድጋፍ የሚሻ', passed: false },
  { minPercentage: 0, letter: 'F', labelEn: 'Unsatisfactory (Fail)', labelAm: 'ወድቋል', passed: false },
];

export interface AssessmentCalculationInput {
  continuousMark: number;
  midtermMark: number;
  finalMark: number;
  maxContinuous?: number;
  maxMidterm?: number;
  maxFinal?: number;
}

export interface AssessmentCalculationOutput {
  totalMark: string;
  percentage: number;
  gradeLetter: string;
  labelEn: string;
  labelAm: string;
  passed: boolean;
}

/**
 * Validates and computes Ethiopian continuous + midterm + final examination results.
 */
export function calculateAssessmentResult(
  input: AssessmentCalculationInput,
  scale: ReadonlyArray<GradingBoundary> = DEFAULT_ETHIOPIAN_GRADING_SCALE
): AssessmentCalculationOutput {
  const maxC = input.maxContinuous ?? 30;
  const maxM = input.maxMidterm ?? 20;
  const maxF = input.maxFinal ?? 50;

  if (input.continuousMark < 0 || input.continuousMark > maxC) {
    throw new Error(`Continuous assessment mark must be between 0 and ${maxC}.`);
  }
  if (input.midtermMark < 0 || input.midtermMark > maxM) {
    throw new Error(`Midterm mark must be between 0 and ${maxM}.`);
  }
  if (input.finalMark < 0 || input.finalMark > maxF) {
    throw new Error(`Final exam mark must be between 0 and ${maxF}.`);
  }

  const maxTotal = maxC + maxM + maxF;
  const rawTotal = input.continuousMark + input.midtermMark + input.finalMark;
  const percentage = maxTotal > 0 ? Number(((rawTotal / maxTotal) * 100).toFixed(2)) : 0;

  const matched =
    scale.find((b) => percentage >= b.minPercentage) ?? scale[scale.length - 1];

  return {
    totalMark: rawTotal.toFixed(2),
    percentage,
    gradeLetter: matched.letter,
    labelEn: matched.labelEn,
    labelAm: matched.labelAm,
    passed: matched.passed,
  };
}

/**
 * Validates Ethiopian 3-part naming convention (First Name, Father's Name, Grandfather's Name).
 */
export function validateEthiopianStudentName(input: {
  firstName: string;
  fatherName: string;
  grandfatherName: string;
}): { valid: boolean; fullNameEn: string; error?: string } {
  const first = input.firstName.trim();
  const father = input.fatherName.trim();
  const grandfather = input.grandfatherName.trim();

  if (first.length < 2) {
    return { valid: false, fullNameEn: '', error: 'Student first name is required (min 2 chars).' };
  }
  if (father.length < 2) {
    return { valid: false, fullNameEn: '', error: "Father's name is required (min 2 chars)." };
  }
  if (grandfather.length < 2) {
    return { valid: false, fullNameEn: '', error: "Grandfather's name is required (min 2 chars)." };
  }

  return {
    valid: true,
    fullNameEn: `${first} ${father} ${grandfather}`,
  };
}

/**
 * Enforces multi-school tenant isolation and RBAC permission boundaries.
 */
export function verifyTenantAccess(params: {
  userRole: UserRole;
  userSchoolId: number | null;
  targetSchoolId: number;
}): { allowed: boolean; reason?: string } {
  if (params.userRole === 'SUPER_ADMIN') {
    return { allowed: true };
  }
  if (!params.userSchoolId) {
    return { allowed: false, reason: 'User has no assigned school tenant.' };
  }
  if (params.userSchoolId !== params.targetSchoolId) {
    return {
      allowed: false,
      reason: `Cross-tenant access denied: User belongs to school #${params.userSchoolId}, cannot access school #${params.targetSchoolId}.`,
    };
  }
  return { allowed: true };
}

export type PermissionAction =
  | 'MANAGE_SCHOOLS'
  | 'REGISTER_STUDENT'
  | 'RECORD_ATTENDANCE'
  | 'ENTER_EXAM_MARKS'
  | 'PUBLISH_RESULTS'
  | 'CREATE_INVOICE'
  | 'RECORD_PAYMENT'
  | 'REVERSE_PAYMENT'
  | 'MANAGE_LIBRARY'
  | 'VIEW_AUDIT_LOGS';

const ROLE_PERMISSION_MAP: Record<UserRole, ReadonlyArray<PermissionAction>> = {
  SUPER_ADMIN: [
    'MANAGE_SCHOOLS',
    'REGISTER_STUDENT',
    'RECORD_ATTENDANCE',
    'ENTER_EXAM_MARKS',
    'PUBLISH_RESULTS',
    'CREATE_INVOICE',
    'RECORD_PAYMENT',
    'REVERSE_PAYMENT',
    'MANAGE_LIBRARY',
    'VIEW_AUDIT_LOGS',
  ],
  SCHOOL_ADMIN: [
    'REGISTER_STUDENT',
    'RECORD_ATTENDANCE',
    'ENTER_EXAM_MARKS',
    'PUBLISH_RESULTS',
    'CREATE_INVOICE',
    'RECORD_PAYMENT',
    'REVERSE_PAYMENT',
    'MANAGE_LIBRARY',
    'VIEW_AUDIT_LOGS',
  ],
  PRINCIPAL: ['PUBLISH_RESULTS', 'RECORD_ATTENDANCE', 'VIEW_AUDIT_LOGS'],
  REGISTRAR: ['REGISTER_STUDENT'],
  TEACHER: ['RECORD_ATTENDANCE', 'ENTER_EXAM_MARKS'],
  FINANCE_OFFICER: ['CREATE_INVOICE', 'RECORD_PAYMENT', 'REVERSE_PAYMENT'],
  LIBRARIAN: ['MANAGE_LIBRARY'],
  PARENT: [],
  STUDENT: [],
};

export function hasRolePermission(role: UserRole, action: PermissionAction): boolean {
  return ROLE_PERMISSION_MAP[role]?.includes(action) ?? false;
}

export type AccessCodePrefix = 'STU' | 'TEA' | 'FIN' | 'LIN';

export const ACCESS_CODE_ROLE_MAP: Record<AccessCodePrefix, UserRole> = {
  STU: 'STUDENT',
  TEA: 'TEACHER',
  FIN: 'FINANCE_OFFICER',
  LIN: 'LIBRARIAN',
};

/**
 * Generates an Admin System 6-digit login access code with the required role prefix:
 * - Student: STU-XXXXXX
 * - Teacher: TEA-XXXXXX
 * - Finance: FIN-XXXXXX
 * - Library: LIN-XXXXXX
 */
export function generateRoleAccessCode(prefix: AccessCodePrefix, seedSixDigits?: number): string {
  const num =
    seedSixDigits !== undefined
      ? Math.abs(Math.floor(seedSixDigits)) % 1000000
      : Math.floor(100000 + Math.random() * 900000);
  const sixDigits = String(num).padStart(6, '0');
  return `${prefix}-${sixDigits}`;
}

/**
 * Validates whether a login access code matches STU-XXXXXX, TEA-XXXXXX, FIN-XXXXXX, or LIN-XXXXXX
 * (prefix + hyphen + exact 6 digits) and returns the mapped role.
 */
export function validateRoleAccessCode(code: string): {
  valid: boolean;
  prefix?: AccessCodePrefix;
  role?: UserRole;
  normalizedCode: string;
  error?: string;
} {
  const normalized = code.trim().toUpperCase();
  const match = /^(STU|TEA|FIN|LIN)-(\d{6})$/.exec(normalized);
  if (!match) {
    return {
      valid: false,
      normalizedCode: normalized,
      error:
        'Access code must start with STU-, TEA-, FIN-, or LIN- followed by exactly 6 digits (e.g. STU-482910).',
    };
  }
  const prefix = match[1] as AccessCodePrefix;
  return {
    valid: true,
    prefix,
    role: ACCESS_CODE_ROLE_MAP[prefix],
    normalizedCode: normalized,
  };
}

export interface StudentAttendanceSummary {
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  totalRecordedDays: number;
  attendanceRatePercent: number;
}

/**
 * Calculates how many days a student was Present (መጡ), Absent (ቀሩ), Late (አረፈዱ), and Excused.
 */
export function calculateStudentAttendanceSummary(
  records: ReadonlyArray<{ status: string }>
): StudentAttendanceSummary {
  let presentDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  let excusedDays = 0;

  for (const r of records) {
    const st = r.status.toUpperCase();
    if (st === 'PRESENT') presentDays += 1;
    else if (st === 'ABSENT') absentDays += 1;
    else if (st === 'LATE') lateDays += 1;
    else if (st === 'EXCUSED') excusedDays += 1;
  }

  const totalRecordedDays = presentDays + absentDays + lateDays + excusedDays;
  const attendedCount = presentDays + lateDays;
  const attendanceRatePercent =
    totalRecordedDays > 0 ? Math.round((attendedCount / totalRecordedDays) * 100) : 100;

  return {
    presentDays,
    absentDays,
    lateDays,
    excusedDays,
    totalRecordedDays,
    attendanceRatePercent,
  };
}

/**
 * Computes how many seconds remain before a teacher-posted online exam expires.
 * Once the teacher's allotted durationMinutes have elapsed since createdAt, returns 0.
 */
export function calculateOnlineExamRemainingSeconds(
  createdAt: string | number | Date | null | undefined,
  durationMinutes: number,
  nowMs: number = Date.now()
): number {
  if (!createdAt || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return 0;
  }
  let createdMs: number;
  if (createdAt instanceof Date) {
    createdMs = createdAt.getTime();
  } else if (typeof createdAt === 'number') {
    createdMs = createdAt < 1e12 ? createdAt * 1000 : createdAt;
  } else {
    createdMs = new Date(createdAt).getTime();
  }
  if (Number.isNaN(createdMs)) {
    return 0;
  }
  const expiresAtMs = createdMs + durationMinutes * 60 * 1000;
  return Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
}

/**
 * Determines whether a teacher-posted online exam should be visible to students.
 * When the teacher-allotted durationMinutes have elapsed, returns false so the exam disappears from student view.
 */
export function isOnlineExamActiveForStudent(
  exam: {
    createdAt: string | number | Date | null | undefined;
    durationMinutes: number;
    isActive?: boolean;
  },
  nowMs: number = Date.now()
): boolean {
  if (exam.isActive === false) {
    return false;
  }
  return calculateOnlineExamRemainingSeconds(exam.createdAt, exam.durationMinutes, nowMs) > 0;
}

/**
 * Formats remaining exam seconds into MM:SS or HH:MM:SS for live student countdown display.
 */
export function formatExamCountdown(remainingSeconds: number): string {
  const safe = Math.max(0, Math.floor(remainingSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Formats a file size in bytes into human-readable B, KB, or MB.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface HomeworkSubmissionSummary {
  totalSubmitted: number;
  reviewedCount: number;
  pendingCount: number;
  withFeedbackCount: number;
}

/**
 * Summarizes a student's homework file submissions by status and teacher feedback availability.
 */
export function buildStudentHomeworkSubmissionSummary(
  submissions: ReadonlyArray<{
    studentId: number;
    status: string;
    teacherFeedback?: string;
  }>,
  studentId: number
): HomeworkSubmissionSummary {
  const mine = submissions.filter((s) => s.studentId === studentId);
  let reviewedCount = 0;
  let pendingCount = 0;
  let withFeedbackCount = 0;

  for (const sub of mine) {
    const st = sub.status.toUpperCase();
    if (st === 'REVIEWED' || st === 'GRADED') {
      reviewedCount += 1;
    } else {
      pendingCount += 1;
    }
    if (sub.teacherFeedback && sub.teacherFeedback.trim().length > 0) {
      withFeedbackCount += 1;
    }
  }

  return {
    totalSubmitted: mine.length,
    reviewedCount,
    pendingCount,
    withFeedbackCount,
  };
}

/**
 * Removes a student homework submission file from the workspace.homeworks collection
 * ONLY when confirmation is explicitly granted (`confirmed === true`).
 */
export function removeHomeworkSubmissionFromWorkspace<
  TSub extends { id: string },
  THw extends { id: number; submissions?: ReadonlyArray<TSub> },
>(
  homeworks: ReadonlyArray<THw>,
  submissionId: string,
  confirmed: boolean
): { updatedHomeworks: THw[]; removed: boolean } {
  if (!confirmed || !submissionId.trim()) {
    return {
      updatedHomeworks: [...homeworks],
      removed: false,
    };
  }

  let removed = false;
  const updatedHomeworks = homeworks.map((hw) => {
    const subs = hw.submissions ?? [];
    const nextSubs = subs.filter((s) => {
      if (s.id === submissionId) {
        removed = true;
        return false;
      }
      return true;
    });
    if (nextSubs.length === subs.length) {
      return hw;
    }
    return {
      ...hw,
      submissions: nextSubs,
    };
  });

  return {
    updatedHomeworks,
    removed,
  };
}

export interface StudentProfileSummaryViewModel {
  fullName: string;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  initials: string;
  grade: string;
  gradeBadgeLabel: string;
  secondaryGradeLevels: ReadonlyArray<{ label: string; isCurrent: boolean }>;
  classSection: string;
  studentId: string;
  email: string;
  enrollmentStatus: string;
  schoolName: string;
  academicYear: string;
  currentTerm: string;
}

export interface StudentAttendanceProgressModel {
  attendanceRatePercent: number;
  clampedPercent: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  totalRecordedDays: number;
  presentWidthPercent: number;
  lateWidthPercent: number;
  absentWidthPercent: number;
  standingLabel: 'EXCELLENT' | 'GOOD' | 'AT_RISK';
}

/**
 * Computes a complete progress-bar view model for a student's daily attendance rate.
 */
export function buildStudentAttendanceProgressModel(
  records: ReadonlyArray<{ status: string }>
): StudentAttendanceProgressModel {
  const base = calculateStudentAttendanceSummary(records);
  const clampedPercent = Math.max(0, Math.min(100, base.attendanceRatePercent));
  const total = Math.max(1, base.totalRecordedDays);

  const presentWidthPercent =
    base.totalRecordedDays > 0 ? Math.round((base.presentDays / total) * 100) : 100;
  const lateWidthPercent =
    base.totalRecordedDays > 0 ? Math.round((base.lateDays / total) * 100) : 0;
  const absentWidthPercent =
    base.totalRecordedDays > 0
      ? Math.max(0, 100 - presentWidthPercent - lateWidthPercent)
      : 0;

  let standingLabel: 'EXCELLENT' | 'GOOD' | 'AT_RISK' = 'EXCELLENT';
  if (clampedPercent < 75) {
    standingLabel = 'AT_RISK';
  } else if (clampedPercent < 90) {
    standingLabel = 'GOOD';
  }

  return {
    ...base,
    clampedPercent,
    presentWidthPercent,
    lateWidthPercent,
    absentWidthPercent,
    standingLabel,
  };
}

/**
 * Builds a normalized, structured summary view-model for the Student Profile card layout,
 * grouping Name, Grade, Class, and ID with clear visual hierarchy fields and high-contrast grade badge metadata.
 */
export function buildStudentProfileSummary(params: {
  student: {
    firstName: string;
    fatherName: string;
    grandfatherName: string;
    gradeLevel: string;
    sectionName: string;
    studentCode: string;
    enrollmentStatus?: string;
  };
  studentAccount?: {
    accessCode?: string;
    email?: string;
  } | null;
  school?: {
    nameEn?: string;
    academicYearLabel?: string;
    currentTerm?: string;
  } | null;
}): StudentProfileSummaryViewModel {
  const firstName = params.student.firstName.trim();
  const fatherName = params.student.fatherName.trim();
  const grandfatherName = params.student.grandfatherName.trim();
  const fullName = [firstName, fatherName, grandfatherName].filter(Boolean).join(' ');
  const initials = `${firstName[0] || 'S'}${fatherName[0] || 'T'}`.toUpperCase();
  const rawGrade = params.student.gradeLevel.trim() || 'Grade 10';
  const gradeMatch = rawGrade.match(/9|10|11|12/);
  const normalizedGrade = gradeMatch ? `Grade ${gradeMatch[0]}` : rawGrade;

  const secondaryGradeLevels = (['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'] as const).map(
    (label) => ({
      label,
      isCurrent: label.toLowerCase() === normalizedGrade.toLowerCase(),
    })
  );

  return {
    fullName,
    firstName,
    fatherName,
    grandfatherName,
    initials,
    grade: normalizedGrade,
    gradeBadgeLabel: normalizedGrade.toUpperCase(),
    secondaryGradeLevels,
    classSection: params.student.sectionName.trim() || 'Section A',
    studentId: (
      params.studentAccount?.accessCode ||
      params.student.studentCode ||
      'STU-482910'
    ).trim(),
    email: (params.studentAccount?.email || 'yohannes.kebede@student.edu.et').trim(),
    enrollmentStatus: (params.student.enrollmentStatus || 'ACTIVE').trim(),
    schoolName:
      params.school?.nameEn?.trim() ||
      'Addis Ababa Bole Preparatory & Secondary School',
    academicYear: params.school?.academicYearLabel?.trim() || '2019 E.C. (2026/27 G.C.)',
    currentTerm: params.school?.currentTerm?.trim() || 'Term 1 (Meskerem - Tahsas)',
  };
}

export type StudentHomeModuleId =
  | 'profile'
  | 'ebook'
  | 'grade'
  | 'exam_space'
  | 'announcements'
  | 'teachers_timetable'
  | 'attendance'
  | 'homework';

export const STUDENT_HOME_MODULES: ReadonlyArray<{
  order: number;
  id: StudentHomeModuleId;
  labelEn: string;
}> = [
  { order: 1, id: 'profile', labelEn: '1. Student Profile' },
  { order: 2, id: 'ebook', labelEn: '2. EBook Library' },
  { order: 3, id: 'grade', labelEn: '3. Grades & Report' },
  { order: 4, id: 'exam_space', labelEn: '4. Exam' },
  { order: 5, id: 'announcements', labelEn: '5. School Announcements' },
  { order: 6, id: 'teachers_timetable', labelEn: '6. Teachers & Timetable' },
  { order: 7, id: 'attendance', labelEn: '7. Attendance' },
  { order: 8, id: 'homework', labelEn: '8. Homework' },
];

export interface StudentAnnualStandingSummary {
  subjectCount: number;
  totalPointsEarned: number;
  maxPossiblePoints: number;
  overallPercentage: number;
  passThresholdPercent: number;
  passed: boolean;
  statusCode: 'PASSED' | 'FAILED' | 'PENDING';
  statusLabelEn: string;
  statusLabelAm: string;
  passedSubjectsCount: number;
  failedSubjectsCount: number;
}

/**
 * Calculates a student's overall teacher-recorded score out of 100% across recorded subjects
 * and applies the end-of-year promotion rule:
 * - Below 50% (< 50%): Failed / Not Promoted (አላለፈም)
 * - 50% or above (>= 50%): Passed / Promoted (አልፏል)
 */
export function calculateAnnualStudentStanding(
  marks: ReadonlyArray<{
    continuousMark?: number | string;
    midtermMark?: number | string;
    finalMark?: number | string;
    totalMark?: number | string;
  }>
): StudentAnnualStandingSummary {
  const passThresholdPercent = 50;

  if (!marks || marks.length === 0) {
    return {
      subjectCount: 0,
      totalPointsEarned: 0,
      maxPossiblePoints: 0,
      overallPercentage: 0,
      passThresholdPercent,
      passed: false,
      statusCode: 'PENDING',
      statusLabelEn: 'Pending Teacher Marks (< 50% Not Promoted · ≥ 50% Promoted)',
      statusLabelAm: 'ውጤት አልተመዘገበም',
      passedSubjectsCount: 0,
      failedSubjectsCount: 0,
    };
  }

  let totalPointsEarned = 0;
  let passedSubjectsCount = 0;
  let failedSubjectsCount = 0;

  for (const m of marks) {
    const rawTotal =
      m.totalMark !== undefined && m.totalMark !== null && String(m.totalMark).trim() !== ''
        ? Number(m.totalMark)
        : Number(m.continuousMark || 0) +
          Number(m.midtermMark || 0) +
          Number(m.finalMark || 0);
    const clampedSubjectMark = Math.max(0, Math.min(100, Number.isFinite(rawTotal) ? rawTotal : 0));
    totalPointsEarned += clampedSubjectMark;
    if (clampedSubjectMark >= passThresholdPercent) {
      passedSubjectsCount += 1;
    } else {
      failedSubjectsCount += 1;
    }
  }

  const subjectCount = marks.length;
  const maxPossiblePoints = subjectCount * 100;
  const overallPercentage = Number((totalPointsEarned / subjectCount).toFixed(1));
  const passed = overallPercentage >= passThresholdPercent;

  return {
    subjectCount,
    totalPointsEarned: Number(totalPointsEarned.toFixed(1)),
    maxPossiblePoints,
    overallPercentage,
    passThresholdPercent,
    passed,
    statusCode: passed ? 'PASSED' : 'FAILED',
    statusLabelEn: passed ? 'PASSED (Promoted — ≥ 50%)' : 'FAILED (Not Promoted — < 50%)',
    statusLabelAm: passed ? 'አልፏል' : 'አላለፈም',
    passedSubjectsCount,
    failedSubjectsCount,
  };
}

export interface GradePassFailBadgeModel {
  scorePercent: number;
  thresholdPercent: 50;
  passed: boolean;
  badgeLabel: 'Pass' | 'Fail';
  statusCode: 'PASS' | 'FAIL';
}

/**
 * Evaluates a student's calculated final grade against the 50% threshold
 * and returns a visual status badge model ('Pass' for >= 50%, 'Fail' for < 50%).
 */
export function getGradePassFailBadge(scorePercent: number | string): GradePassFailBadgeModel {
  const num = typeof scorePercent === 'string' ? Number.parseFloat(scorePercent) : scorePercent;
  const safeScore = Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
  const passed = safeScore >= 50;
  return {
    scorePercent: safeScore,
    thresholdPercent: 50,
    passed,
    badgeLabel: passed ? 'Pass' : 'Fail',
    statusCode: passed ? 'PASS' : 'FAIL',
  };
}

export const SCHOOL_PAYMENT_ACCOUNTS = {
  telebirr: {
    provider: 'Telebirr',
    accountNumber: '0938680030',
    displayLabel: 'Telebirr 0938680030',
  },
  cbe: {
    provider: 'CBE',
    accountNumber: '1000302646787',
    displayLabel: 'CBE 1000302646787',
  },
} as const;

export const STUDENT_PORTAL_THEME = {
  mainBackground: '#F8F9FE',
  headerGradientFrom: '#304FC7',
  headerGradientTo: '#673AB7',
  mainText: '#20243A',
  secondaryText: '#73788A',
  navBackground: '#FFFFFF',
  navActiveIcon: '#673AB7',
  pastelCards: {
    lavender: '#F0EBFF',
    lightBlue: '#EAF3FF',
    mintGreen: '#E7F8F0',
    lightPink: '#FCEAF2',
    paleYellow: '#FFF6D9',
    lightPeach: '#FFF0E5',
  },
} as const;

export type StudentPortalFeatureId =
  | 'profile'
  | 'events'
  | 'teachers_timetable'
  | 'attendance'
  | 'chat_support'
  | 'grade'
  | 'gallery'
  | 'fees'
  | 'announcements'
  | 'homework'
  | 'exam_space'
  | 'ebook'
  | 'calendar';

export type StudentPortalBottomNavId = 'home' | 'calendar' | 'messages' | 'more';

export interface StudentPortalQuickAccessCardMeta {
  id: StudentPortalFeatureId;
  titleEn: string;
  titleAm: string;
  subtitleEn: string;
  subtitleAm: string;
  pastelBg: string;
  accentColor: string;
  keywords: ReadonlyArray<string>;
}

export const STUDENT_PORTAL_QUICK_ACCESS_CARDS: ReadonlyArray<StudentPortalQuickAccessCardMeta> = [
  {
    id: 'profile',
    titleEn: 'Student Profile',
    titleAm: 'የተማሪ መገለጫ',
    subtitleEn: 'ID, Grade & Guardian Info',
    subtitleAm: 'መታወቂያ፣ ክፍል እና ወላጅ',
    pastelBg: '#F0EBFF',
    accentColor: '#673AB7',
    keywords: ['profile', 'id', 'student', 'guardian', 'grade', 'section', 'መገለጫ', 'ተማሪ'],
  },
  {
    id: 'events',
    titleEn: 'School Events',
    titleAm: 'የትምህርት ቤት ዝግጅቶች',
    subtitleEn: 'Academic & Cultural Festivals',
    subtitleAm: 'አካዳሚያዊ እና ባህላዊ በዓላት',
    pastelBg: '#EAF3FF',
    accentColor: '#304FC7',
    keywords: ['events', 'festival', 'sports', 'stem', 'ceremony', 'ዝግጅቶች', 'በዓላት'],
  },
  {
    id: 'teachers_timetable',
    titleEn: 'Teachers & Staff Directory',
    titleAm: 'መምህራን እና የክፍል ፕሮግራም',
    subtitleEn: 'Faculty & Weekly Timetable',
    subtitleAm: 'መምህራን እና ሳምንታዊ ፕሮግራም',
    pastelBg: '#E7F8F0',
    accentColor: '#15803D',
    keywords: ['teachers', 'staff', 'directory', 'timetable', 'schedule', 'መምህራን', 'ፕሮግራም'],
  },
  {
    id: 'attendance',
    titleEn: 'Attendance Tracking',
    titleAm: 'የክፍል ክትትል (Attendance)',
    subtitleEn: 'Present, Absent & Late Log',
    subtitleAm: 'የቀን ክትትል እና መገኘት',
    pastelBg: '#FCEAF2',
    accentColor: '#BE185D',
    keywords: ['attendance', 'present', 'absent', 'late', 'tracking', 'ክትትል', 'መገኘት'],
  },
  {
    id: 'chat_support',
    titleEn: 'Chat & Support',
    titleAm: 'ውይይት እና ድጋፍ',
    subtitleEn: 'Academic Advisor & Helpdesk',
    subtitleAm: 'የትምህርት አማካሪ እና እርዳታ',
    pastelBg: '#FFF6D9',
    accentColor: '#B45309',
    keywords: ['chat', 'support', 'messages', 'help', 'advisor', 'ውይይት', 'ድጋፍ', 'መልእክት'],
  },
  {
    id: 'grade',
    titleEn: 'Grade Sheet & Results',
    titleAm: 'የውጤት መግለጫ (Grade Sheet)',
    subtitleEn: '100% Marks & Pass/Fail Standing',
    subtitleAm: 'የፈተና ውጤት እና ደረጃ',
    pastelBg: '#FFF0E5',
    accentColor: '#C2410C',
    keywords: ['grade', 'results', 'marks', 'report', 'pass', 'fail', 'ውጤት', 'ደረጃ'],
  },
  {
    id: 'gallery',
    titleEn: 'Student Gallery',
    titleAm: 'የተማሪዎች ፎቶ ማዕከል',
    subtitleEn: 'Campus Life, Labs & Athletics',
    subtitleAm: 'የትምህርት ቤት እንቅስቃሴዎች',
    pastelBg: '#F0EBFF',
    accentColor: '#673AB7',
    keywords: ['gallery', 'photos', 'campus', 'lab', 'sports', 'ፎቶ', 'ማዕከል'],
  },
  {
    id: 'fees',
    titleEn: 'School Fees & Payment History',
    titleAm: 'የትምህርት ክፍያ እና ታሪክ',
    subtitleEn: 'ETB Invoices, Telebirr & CBE',
    subtitleAm: 'ክፍያ፣ ቴሌብር እና ንግድ ባንክ',
    pastelBg: '#EAF3FF',
    accentColor: '#304FC7',
    keywords: ['fees', 'payment', 'invoice', 'telebirr', 'cbe', 'etb', 'ክፍያ', 'ደረሰኝ'],
  },
  {
    id: 'announcements',
    titleEn: 'School Notices',
    titleAm: 'የትምህርት ቤት ማስታወቂያዎች',
    subtitleEn: 'Official Bulletins & Alerts',
    subtitleAm: 'ኦፊሴላዊ ማስታወቂያዎች',
    pastelBg: '#E7F8F0',
    accentColor: '#15803D',
    keywords: ['notices', 'announcements', 'bulletin', 'news', 'ማስታወቂያ'],
  },
  {
    id: 'homework',
    titleEn: 'Assignments & Homework',
    titleAm: 'የቤት ስራ እና አሳይመንት',
    subtitleEn: 'Tasks & File Submissions',
    subtitleAm: 'የቤት ስራ ማስረከቢያ',
    pastelBg: '#FCEAF2',
    accentColor: '#BE185D',
    keywords: ['assignments', 'homework', 'tasks', 'submission', 'የቤት ስራ', 'አሳይመንት'],
  },
  {
    id: 'exam_space',
    titleEn: 'Examination Schedule & Results',
    titleAm: 'የፈተና ፕሮግራም እና ውጤት',
    subtitleEn: 'Timed Exams & Assessments',
    subtitleAm: 'የኦንላይን ፈተና እና ጊዜ',
    pastelBg: '#FFF6D9',
    accentColor: '#B45309',
    keywords: ['exam', 'examination', 'schedule', 'test', 'quiz', 'ፈተና'],
  },
  {
    id: 'ebook',
    titleEn: 'Digital Library',
    titleAm: 'ዲጂታል ላይብረሪ (E-Books)',
    subtitleEn: 'MoE Textbooks & Study Guides',
    subtitleAm: 'የመማሪያ መጽሐፍት',
    pastelBg: '#FFF0E5',
    accentColor: '#C2410C',
    keywords: ['library', 'ebook', 'books', 'textbook', 'digital', 'ላይብረሪ', 'መጽሐፍት'],
  },
  {
    id: 'calendar',
    titleEn: 'Upcoming Events & Calendar',
    titleAm: 'የኢትዮጵያ የትምህርት ዘመን ቀን መቁጠሪያ',
    subtitleEn: 'Ethiopian (E.C.) & Gregorian Dates',
    subtitleAm: 'የትምህርት ዘመን የቀን መቁጠሪያ',
    pastelBg: '#F0EBFF',
    accentColor: '#673AB7',
    keywords: ['calendar', 'upcoming', 'dates', 'ethiopian', 'meskerem', 'ቀን መቁጠሪያ'],
  },
];

export const STUDENT_PORTAL_BOTTOM_NAV: ReadonlyArray<{
  id: StudentPortalBottomNavId;
  labelEn: string;
  labelAm: string;
}> = [
  { id: 'home', labelEn: 'Home', labelAm: 'መነሻ' },
  { id: 'calendar', labelEn: 'Calendar', labelAm: 'ቀን መቁጠሪያ' },
  { id: 'messages', labelEn: 'Messages', labelAm: 'መልእክቶች' },
  { id: 'more', labelEn: 'More', labelAm: 'ተጨማሪ' },
];

export function filterStudentPortalQuickAccessCards(
  query: string,
  cards: ReadonlyArray<StudentPortalQuickAccessCardMeta> = STUDENT_PORTAL_QUICK_ACCESS_CARDS
): StudentPortalQuickAccessCardMeta[] {
  const clean = query.trim().toLowerCase();
  if (!clean) {
    return [...cards];
  }
  return cards.filter(
    (card) =>
      card.titleEn.toLowerCase().includes(clean) ||
      card.titleAm.toLowerCase().includes(clean) ||
      card.subtitleEn.toLowerCase().includes(clean) ||
      card.subtitleAm.toLowerCase().includes(clean) ||
      card.keywords.some((kw) => kw.toLowerCase().includes(clean))
  );
}

export interface HeaderSyncStatusModel {
  queueSize: number;
  isOnlineSynced: boolean;
  statusCode: 'ONLINE' | 'OFFLINE_PENDING';
  dotColorClass: string;
  badgeColorClass: string;
  labelEn: string;
  labelAm: string;
  tooltipEn: string;
  tooltipAm: string;
}

export function getHeaderSyncStatusModel(offlineQueueSize: number): HeaderSyncStatusModel {
  const safeSize = Math.max(0, Math.floor(Number(offlineQueueSize) || 0));
  const isOnlineSynced = safeSize === 0;
  return {
    queueSize: safeSize,
    isOnlineSynced,
    statusCode: isOnlineSynced ? 'ONLINE' : 'OFFLINE_PENDING',
    dotColorClass: isOnlineSynced ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse',
    badgeColorClass: isOnlineSynced
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : 'bg-amber-50 text-amber-900 border-amber-300',
    labelEn: isOnlineSynced ? 'Online · Synced' : `Offline Queue (${safeSize})`,
    labelAm: isOnlineSynced ? 'ኦንላይን · ተመሳስሏል' : `ኦፍላይን ወረፋ (${safeSize})`,
    tooltipEn: isOnlineSynced
      ? 'All workspace records are synchronized with the server.'
      : `${safeSize} operation(s) queued offline awaiting synchronization.`,
    tooltipAm: isOnlineSynced
      ? 'ሁሉም መረጃዎች ከሰርቨር ጋር ተመሳስለዋል።'
      : `${safeSize} መረጃዎች በኦፍላይን ወረፋ ላይ ናቸው።`,
  };
}

/**
 * Returns true if the given active tab ID supports the toolbar 'Print Report' action
 * (Examinations & Report Cards view or Finance & Fees view).
 */
export function isPrintableReportView(activeTab: string): boolean {
  return activeTab === 'exams' || activeTab === 'finance';
}

/**
 * Triggers the browser's native window.print() dialog safely.
 */
export function triggerBrowserPrintReport(
  win: { print?: () => void } | undefined = typeof window !== 'undefined' ? window : undefined
): boolean {
  if (win && typeof win.print === 'function') {
    win.print();
    return true;
  }
  return false;
}


