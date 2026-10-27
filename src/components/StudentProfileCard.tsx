import React from 'react';
import {
  CalendarDisplayMode,
  LanguageCode,
  PortalAccountRecord,
  SchoolRecord,
  StudentRecord,
} from '../types/esms';
import {
  buildStudentProfileSummary,
  formatCalendarDate,
} from '../utils/ethiopianRules';
import {
  UserCheck,
  GraduationCap,
  Layers,
  BadgeCheck,
  Calendar,
  MapPin,
  Phone,
  Building2,
  ShieldCheck,
} from 'lucide-react';

export interface StudentProfileCardProps {
  student: StudentRecord;
  studentAccount?: PortalAccountRecord;
  school: SchoolRecord | null;
  lang: LanguageCode;
  calendarMode: CalendarDisplayMode;
}

export const StudentProfileCard: React.FC<StudentProfileCardProps> = ({
  student,
  studentAccount,
  school,
  calendarMode,
}) => {
  const summary = buildStudentProfileSummary({
    student,
    studentAccount,
    school,
  });

  return (
    <section
      aria-label="Student Profile"
      className="space-y-6"
    >
      {/* Clean, Readable Summary Tile Grouping Name, Grade, Class, and ID */}
      <div
        data-testid="student-summary-tile"
        className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden"
      >
        {/* Institutional Identity Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div
              aria-hidden="true"
              className="w-13 h-13 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center font-bold text-base tracking-wider text-white shrink-0"
            >
              {summary.initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span
                  data-testid="student-grade-badge"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-400 text-slate-950 font-mono font-extrabold text-xs uppercase tracking-wider shadow-xs"
                >
                  <GraduationCap className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                  {summary.grade}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold uppercase tracking-wider text-slate-300">
                  Student Academic Profile
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-emerald-300">
                  {summary.enrollmentStatus}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1.5">
                {summary.fullName}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {summary.schoolName} · {summary.academicYear} · {summary.currentTerm}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:items-end justify-center border-t lg:border-t-0 border-white/15 pt-3 lg:pt-0">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Official Student ID
            </span>
            <span className="text-lg font-mono font-bold text-emerald-300 tabular-nums tracking-tight mt-0.5">
              {summary.studentId}
            </span>
            <span className="text-xs font-mono text-slate-300 truncate max-w-[260px]">
              {summary.email}
            </span>
          </div>
        </div>

        {/* 4-Card Summary Grid: Name · Grade · Class · ID */}
        <div className="p-6 bg-slate-50/70">
          <div
            data-testid="student-core-details-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {/* 1. Name */}
            <article
              data-testid="profile-card-name"
              className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>Student Name</span>
                <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
              <div className="mt-3">
                <div className="text-base font-bold text-slate-900 leading-snug">
                  {summary.fullName}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  First: <span className="font-medium text-slate-700">{summary.firstName}</span>
                  {' · '}Father: <span className="font-medium text-slate-700">{summary.fatherName}</span>
                  {' · '}Grandfather: <span className="font-medium text-slate-700">{summary.grandfatherName}</span>
                </div>
              </div>
            </article>

            {/* 2. Grade (High-Contrast Badge Display) */}
            <article
              data-testid="profile-card-grade"
              className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>Grade Level</span>
                <span className="px-2.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[11px] font-bold tracking-wider">
                  {summary.grade}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-4 gap-1" aria-label="Secondary grade level indicator">
                  {summary.secondaryGradeLevels.map((item) => (
                    <span
                      key={item.label}
                      className={`text-center py-1 rounded text-[10px] font-mono font-bold border ${
                        item.isCurrent
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      {item.label.replace('Grade ', 'G')}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-slate-500">
                  Secondary Division · {summary.grade}
                </div>
              </div>
            </article>

            {/* 3. Class */}
            <article
              data-testid="profile-card-class"
              className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>Class</span>
                <Layers className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
              <div className="mt-3">
                <div className="text-xl font-bold text-slate-900 tracking-tight">
                  {summary.classSection}
                </div>
                <div className="text-xs text-slate-500 mt-1 truncate">
                  Assigned Homeroom · {summary.currentTerm}
                </div>
              </div>
            </article>

            {/* 4. Student ID */}
            <article
              data-testid="profile-card-id"
              className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-4 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                <span>Student ID</span>
                <BadgeCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              </div>
              <div className="mt-3">
                <div className="text-xl font-mono font-bold text-emerald-950 tracking-tight tabular-nums">
                  {summary.studentId}
                </div>
                <div className="text-xs font-mono text-emerald-800 mt-1 truncate">
                  Registry Code: {student.studentCode}
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>

      {/* Supporting Academic & Guardian Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <article className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Personal & Demographic Details
              </h3>
              <p className="text-xs text-slate-500">
                Birth record, gender, residential sub-city, and prior school
              </p>
            </div>
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <dt className="text-slate-500 font-medium">Date of Birth</dt>
              <dd className="font-mono font-semibold text-slate-900 mt-1 tabular-nums">
                {formatCalendarDate(student.dateOfBirth, calendarMode, 'en')}
              </dd>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <dt className="text-slate-500 font-medium">Gender</dt>
              <dd className="font-semibold text-slate-900 mt-1">{student.gender}</dd>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <dt className="text-slate-500 font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Residence (Sub-City & Woreda)
              </dt>
              <dd className="font-semibold text-slate-900 mt-1">
                {student.subCity} Sub-City · {student.woreda}
              </dd>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <dt className="text-slate-500 font-medium">Previous School</dt>
              <dd className="font-semibold text-slate-900 mt-1 truncate">
                {student.previousSchool || 'Direct Admission'}
              </dd>
            </div>
          </dl>
        </article>

        <article className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Guardian & Campus Enrollment
              </h3>
              <p className="text-xs text-slate-500">
                Verified parent/guardian contact and enrolled school campus
              </p>
            </div>
            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <dt className="text-slate-500 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                Primary Guardian
              </dt>
              <dd className="font-semibold text-slate-900 mt-1">
                {student.guardianName} · {student.guardianRelationship}
              </dd>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <dt className="text-slate-500 font-medium">Guardian Phone</dt>
              <dd className="font-mono font-semibold text-slate-900 mt-1 tabular-nums">
                {student.guardianPhone}
              </dd>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 sm:col-span-2">
              <dt className="text-slate-500 font-medium flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                Enrolled School Campus
              </dt>
              <dd className="font-semibold text-slate-900 mt-1">
                {summary.schoolName} · {school?.city || 'Addis Ababa'} ({school?.subCity || 'Bole'})
              </dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
};
