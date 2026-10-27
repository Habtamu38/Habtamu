import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema.ts';

declare global {
  var _pgliteClient: PGlite | undefined;
  var _pgliteSchemaReady: Promise<void> | undefined;
}

export const getPgliteClient = (): PGlite => {
  if (!global._pgliteClient) {
    global._pgliteClient = new PGlite();
  }
  return global._pgliteClient;
};

const client = getPgliteClient();

export const db = drizzle(client, { schema });

export async function ensureSchemaInitialized(): Promise<void> {
  if (!global._pgliteSchemaReady) {
    global._pgliteSchemaReady = (async () => {
      await client.exec(`
        CREATE TABLE IF NOT EXISTS schools (
          id SERIAL PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          name_en TEXT NOT NULL,
          name_am TEXT NOT NULL,
          school_type TEXT NOT NULL,
          school_level TEXT NOT NULL,
          region TEXT NOT NULL,
          city TEXT NOT NULL,
          sub_city TEXT NOT NULL,
          woreda TEXT NOT NULL,
          phone TEXT NOT NULL,
          email TEXT NOT NULL,
          calendar_system TEXT NOT NULL DEFAULT 'BOTH',
          currency TEXT NOT NULL DEFAULT 'ETB',
          timezone TEXT NOT NULL DEFAULT 'Africa/Addis_Ababa',
          subscription_status TEXT NOT NULL DEFAULT 'ACTIVE',
          academic_year_label TEXT NOT NULL DEFAULT '2019 E.C. (2026/27)',
          current_term TEXT NOT NULL DEFAULT 'Term 1 (Meskerem - Tahsas)',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          uid TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          full_name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'SCHOOL_ADMIN',
          school_id INTEGER REFERENCES schools(id),
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS class_sections (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          grade_level TEXT NOT NULL,
          section_name TEXT NOT NULL,
          stream TEXT NOT NULL DEFAULT 'General',
          room_number TEXT NOT NULL,
          capacity INTEGER NOT NULL DEFAULT 45,
          homeroom_teacher_name TEXT NOT NULL,
          academic_year TEXT NOT NULL DEFAULT '2019 E.C.',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS students (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          student_code TEXT NOT NULL UNIQUE,
          first_name TEXT NOT NULL,
          father_name TEXT NOT NULL,
          grandfather_name TEXT NOT NULL,
          full_name_am TEXT NOT NULL,
          gender TEXT NOT NULL,
          date_of_birth TEXT NOT NULL,
          grade_level TEXT NOT NULL,
          section_name TEXT NOT NULL,
          guardian_name TEXT NOT NULL,
          guardian_relationship TEXT NOT NULL,
          guardian_phone TEXT NOT NULL,
          emergency_contact_phone TEXT NOT NULL,
          sub_city TEXT NOT NULL,
          woreda TEXT NOT NULL,
          previous_school TEXT NOT NULL DEFAULT 'None',
          enrollment_status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS teachers (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          staff_code TEXT NOT NULL UNIQUE,
          full_name TEXT NOT NULL,
          full_name_am TEXT NOT NULL,
          role_title TEXT NOT NULL,
          department TEXT NOT NULL,
          qualification TEXT NOT NULL,
          assigned_subjects TEXT NOT NULL,
          assigned_grades TEXT NOT NULL,
          phone TEXT NOT NULL,
          email TEXT NOT NULL,
          employment_status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS subjects (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          code TEXT NOT NULL,
          name_en TEXT NOT NULL,
          name_am TEXT NOT NULL,
          grade_level TEXT NOT NULL,
          periods_per_week INTEGER NOT NULL DEFAULT 5,
          continuous_weight INTEGER NOT NULL DEFAULT 30,
          midterm_weight INTEGER NOT NULL DEFAULT 20,
          final_weight INTEGER NOT NULL DEFAULT 50,
          passing_mark INTEGER NOT NULL DEFAULT 50,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS attendance_records (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          student_id INTEGER NOT NULL REFERENCES students(id),
          attendance_date TEXT NOT NULL,
          status TEXT NOT NULL,
          grade_level TEXT NOT NULL,
          section_name TEXT NOT NULL,
          remarks TEXT NOT NULL DEFAULT '',
          recorded_by TEXT NOT NULL,
          sync_operation_id TEXT NOT NULL UNIQUE,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_date_idx
          ON attendance_records (school_id, student_id, attendance_date);

        CREATE TABLE IF NOT EXISTS student_marks (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          student_id INTEGER NOT NULL REFERENCES students(id),
          subject_code TEXT NOT NULL,
          subject_name_en TEXT NOT NULL,
          subject_name_am TEXT NOT NULL,
          academic_year TEXT NOT NULL,
          term TEXT NOT NULL,
          continuous_mark NUMERIC(5, 2) NOT NULL,
          midterm_mark NUMERIC(5, 2) NOT NULL,
          final_mark NUMERIC(5, 2) NOT NULL,
          total_mark NUMERIC(5, 2) NOT NULL,
          grade_letter TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'DRAFT',
          approved_by TEXT NOT NULL DEFAULT 'Pending Approval',
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS marks_student_subject_term_idx
          ON student_marks (school_id, student_id, subject_code, academic_year, term);

        CREATE TABLE IF NOT EXISTS invoices (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          invoice_number TEXT NOT NULL UNIQUE,
          student_id INTEGER NOT NULL REFERENCES students(id),
          fee_category TEXT NOT NULL,
          academic_year TEXT NOT NULL,
          term TEXT NOT NULL,
          total_amount_etb NUMERIC(12, 2) NOT NULL,
          discount_etb NUMERIC(12, 2) NOT NULL DEFAULT '0.00',
          paid_amount_etb NUMERIC(12, 2) NOT NULL DEFAULT '0.00',
          balance_etb NUMERIC(12, 2) NOT NULL,
          due_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'UNPAID',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          invoice_id INTEGER NOT NULL REFERENCES invoices(id),
          student_id INTEGER NOT NULL REFERENCES students(id),
          receipt_number TEXT NOT NULL UNIQUE,
          idempotency_key TEXT NOT NULL UNIQUE,
          amount_etb NUMERIC(12, 2) NOT NULL,
          payment_method TEXT NOT NULL,
          transaction_reference TEXT NOT NULL,
          recorded_by TEXT NOT NULL,
          entry_type TEXT NOT NULL DEFAULT 'PAYMENT',
          reversal_reason TEXT NOT NULL DEFAULT '',
          reversed_payment_id INTEGER,
          paid_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS library_books (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          isbn TEXT NOT NULL,
          copy_code TEXT NOT NULL UNIQUE,
          title_en TEXT NOT NULL,
          title_am TEXT NOT NULL,
          author TEXT NOT NULL,
          category TEXT NOT NULL,
          grade_level TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'AVAILABLE',
          borrower_student_id INTEGER REFERENCES students(id),
          borrower_name TEXT NOT NULL DEFAULT '',
          due_date TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS transport_routes (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          route_code TEXT NOT NULL,
          route_name TEXT NOT NULL,
          stops_list TEXT NOT NULL,
          vehicle_plate TEXT NOT NULL,
          driver_name TEXT NOT NULL,
          driver_phone TEXT NOT NULL,
          capacity INTEGER NOT NULL,
          assigned_count INTEGER NOT NULL DEFAULT 0,
          term_fee_etb NUMERIC(10, 2) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS inventory_assets (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          asset_code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          department TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          minimum_threshold INTEGER NOT NULL DEFAULT 5,
          condition_status TEXT NOT NULL DEFAULT 'GOOD',
          unit_value_etb NUMERIC(12, 2) NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS announcements (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          title_en TEXT NOT NULL,
          title_am TEXT NOT NULL,
          body_en TEXT NOT NULL,
          body_am TEXT NOT NULL,
          audience TEXT NOT NULL,
          channel TEXT NOT NULL DEFAULT 'IN_APP_AND_SMS',
          priority TEXT NOT NULL DEFAULT 'NORMAL',
          published_by TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS sync_operations (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          operation_id TEXT NOT NULL UNIQUE,
          device_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          action TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          version_number INTEGER NOT NULL DEFAULT 1,
          sync_status TEXT NOT NULL DEFAULT 'SYNCED',
          conflict_reason TEXT NOT NULL DEFAULT '',
          client_timestamp TEXT NOT NULL,
          synced_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          school_id INTEGER REFERENCES schools(id),
          actor_name TEXT NOT NULL,
          actor_role TEXT NOT NULL,
          action TEXT NOT NULL,
          module TEXT NOT NULL,
          entity_ref TEXT NOT NULL,
          details TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS portal_accounts (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          email TEXT NOT NULL,
          access_code TEXT NOT NULL UNIQUE,
          full_name TEXT NOT NULL,
          full_name_am TEXT NOT NULL,
          role TEXT NOT NULL,
          linked_student_id INTEGER REFERENCES students(id),
          linked_teacher_id INTEGER REFERENCES teachers(id),
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS ebooks (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          code TEXT NOT NULL,
          title_en TEXT NOT NULL,
          title_am TEXT NOT NULL,
          subject_code TEXT NOT NULL,
          grade_level TEXT NOT NULL,
          author TEXT NOT NULL,
          summary TEXT NOT NULL,
          content_body TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS homeworks (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          title TEXT NOT NULL,
          subject_code TEXT NOT NULL,
          grade_level TEXT NOT NULL,
          section_name TEXT NOT NULL,
          due_date TEXT NOT NULL,
          instructions TEXT NOT NULL,
          posted_by TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS online_exams (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          title TEXT NOT NULL,
          subject_code TEXT NOT NULL,
          grade_level TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL DEFAULT 30,
          questions_json TEXT NOT NULL,
          posted_by TEXT NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS online_exam_submissions (
          id SERIAL PRIMARY KEY,
          school_id INTEGER NOT NULL REFERENCES schools(id),
          exam_id INTEGER NOT NULL REFERENCES online_exams(id),
          student_id INTEGER NOT NULL REFERENCES students(id),
          score INTEGER NOT NULL,
          total_questions INTEGER NOT NULL,
          submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
    })();
  }
  return global._pgliteSchemaReady;
}
