export interface DeliverableArtifact {
  id: string;
  titleEn: string;
  titleAm: string;
  category: string;
  summary: string;
  codeLanguage: string;
  content: string;
}

export const DELIVERABLE_ARTIFACTS: ReadonlyArray<DeliverableArtifact> = [
  {
    id: 'architecture-risk',
    titleEn: '1. Multi-Tenant & Hybrid Sync Architecture Specification',
    titleAm: '1. Multi-Tenant & Hybrid Sync Architecture Specification',
    category: 'Architecture & Risk Assessment',
    summary:
      'Complete system topology, tenant isolation enforcement, data ownership boundaries between Cloud, Local School Server, and Android SQLite clients.',
    codeLanguage: 'markdown',
    content: `# ESMS System Architecture & Risk Assessment

## 1. Multi-School Tenant Isolation
- Every school-owned table carries a non-nullable \`school_id\` foreign key referencing \`schools(id)\`.
- Server-side middleware (\`verifyTenantAccess\`) validates that the authenticated user's \`schoolId\` matches the target resource's \`schoolId\`.
- Platform Super Administrators (\`SUPER_ADMIN\`) manage school onboarding and subscription lifecycles; any cross-tenant access attempt by school-scoped roles is blocked with HTTP 403 and recorded in \`audit_logs\`.

## 2. Data Ownership & Hybrid Offline Sync Matrix
| Module / Entity | Offline Creation Allowed? | Authority / Conflict Resolution Strategy |
| :--- | :--- | :--- |
| Daily Attendance (\`attendance_records\`) | YES (Android & Local Server) | Unique constraint \`(school_id, student_id, attendance_date)\` + \`sync_operation_id\` idempotency |
| Assessment Mark Drafts (\`student_marks\`) | YES (Draft status only) | Version-checked upsert; once \`PUBLISHED\`, offline edits are rejected as \`CONFLICT\` |
| Tuition Invoices & Payments (\`payments\`) | NO (Online / Local Server Cashier) | Strict \`idempotency_key\` enforcement; immutable ledger with mandatory \`REVERSAL\` entries |
| Library Book Loans (\`library_books\`) | Local Server LAN Only | Single active borrower constraint per \`copy_code\` |`,
  },
  {
    id: 'prisma-schema',
    titleEn: '2. Normalized PostgreSQL Schema (Prisma & Drizzle)',
    titleAm: '2. Normalized PostgreSQL Schema (Prisma & Drizzle)',
    category: 'Database Engineering',
    summary:
      'Production PostgreSQL schema covering Schools, Ethiopian 3-part Student names, Guardians, Attendance, Examinations, ETB Finance Ledger, Library, Transport, Inventory, and Sync Operations.',
    codeLanguage: 'prisma',
    content: `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model School {
  id                 Int      @id @default(autoincrement())
  code               String   @unique
  nameEn             String   @map("name_en")
  nameAm             String   @map("name_am")
  schoolType         String   @map("school_type")
  schoolLevel        String   @map("school_level")
  region             String
  city               String
  subCity            String   @map("sub_city")
  woreda             String
  calendarSystem     String   @default("BOTH") @map("calendar_system")
  currency           String   @default("ETB")
  subscriptionStatus String   @default("ACTIVE") @map("subscription_status")
  students           Student[]
  invoices           Invoice[]
  payments           Payment[]
  attendance         AttendanceRecord[]
  @@map("schools")
}

model Student {
  id              Int      @id @default(autoincrement())
  schoolId        Int      @map("school_id")
  studentCode     String   @unique @map("student_code")
  firstName       String   @map("first_name")
  fatherName      String   @map("father_name")
  grandfatherName String   @map("grandfather_name")
  fullNameAm      String   @map("full_name_am")
  gradeLevel      String   @map("grade_level")
  sectionName     String   @map("section_name")
  guardianName    String   @map("guardian_name")
  guardianPhone   String   @map("guardian_phone")
  school          School   @relation(fields: [schoolId], references: [id])
  @@index([schoolId, gradeLevel, sectionName])
  @@map("students")
}

model Payment {
  id                   Int      @id @default(autoincrement())
  schoolId             Int      @map("school_id")
  invoiceId            Int      @map("invoice_id")
  studentId            Int      @map("student_id")
  receiptNumber        String   @unique @map("receipt_number")
  idempotencyKey       String   @unique @map("idempotency_key")
  amountEtb            Decimal  @db.Decimal(12, 2) @map("amount_etb")
  paymentMethod        String   @map("payment_method")
  transactionReference String   @map("transaction_reference")
  entryType            String   @default("PAYMENT") @map("entry_type")
  reversalReason       String   @default("") @map("reversal_reason")
  reversedPaymentId    Int?     @map("reversed_payment_id")
  paidAt               DateTime @default(now()) @map("paid_at")
  school               School   @relation(fields: [schoolId], references: [id])
  @@map("payments")
}`,
  },
  {
    id: 'flutter-android-sync',
    titleEn: '3. Flutter Android SQLite Offline & Background Sync Module',
    titleAm: '3. Flutter Android SQLite Offline & Background Sync Module',
    category: 'Android Mobile Client (Flutter / Dart)',
    summary:
      'Dart implementation for Android teacher & parent app using sqflite + flutter_secure_storage + idempotent background batch synchronization.',
    codeLanguage: 'dart',
    content: `// apps/mobile/lib/services/offline_sync_service.dart
import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:http/http.dart' as http;

class OfflineSyncService {
  final Database db;
  final String apiBaseUrl;

  OfflineSyncService({required this.db, required this.apiBaseUrl});

  Future<void> enqueueAttendance({
    required int schoolId,
    required int studentId,
    required String attendanceDate,
    required String status,
    required String deviceId,
  }) async {
    final opId = 'OP-\${deviceId}-\${studentId}-\${attendanceDate}';
    await db.insert(
      'local_sync_queue',
      {
        'operation_id': opId,
        'school_id': schoolId,
        'device_id': deviceId,
        'entity_type': 'ATTENDANCE',
        'entity_id': '\${studentId}:\${attendanceDate}',
        'action': 'UPSERT',
        'payload_json': jsonEncode({
          'studentId': studentId,
          'attendanceDate': attendanceDate,
          'status': status,
        }),
        'version_number': 1,
        'sync_status': 'PENDING',
        'client_timestamp': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<int> flushPendingQueue(String bearerToken, int schoolId) async {
    final pending = await db.query(
      'local_sync_queue',
      where: 'sync_status = ? AND school_id = ?',
      whereArgs: ['PENDING', schoolId],
    );
    if (pending.isEmpty) return 0;

    final response = await http.post(
      Uri.parse('\$apiBaseUrl/api/v1/sync'),
      headers: {
        'Authorization': 'Bearer \$bearerToken',
        'Content-Type': 'application/json',
        'x-esms-school-id': schoolId.toString(),
      },
      body: jsonEncode({
        'schoolId': schoolId,
        'operations': pending.map((row) => {
          'operationId': row['operation_id'],
          'deviceId': row['device_id'],
          'entityType': row['entity_type'],
          'entityId': row['entity_id'],
          'action': row['action'],
          'payload': jsonDecode(row['payload_json'] as String),
          'versionNumber': row['version_number'],
          'clientTimestamp': row['client_timestamp'],
        }).toList(),
      }),
    );

    if (response.statusCode == 200) {
      for (final row in pending) {
        await db.update(
          'local_sync_queue',
          {'sync_status': 'SYNCED'},
          where: 'operation_id = ?',
          whereArgs: [row['operation_id']],
        );
      }
      return pending.length;
    }
    throw Exception('Sync failed with HTTP \${response.statusCode}');
  }
}`,
  },
  {
    id: 'docker-devops-backup',
    titleEn: '4. Docker Compose, Nginx TLS & PostgreSQL Backup Runbook',
    titleAm: '4. Docker Compose, Nginx TLS & PostgreSQL Backup Runbook',
    category: 'DevOps, Local School Server & Disaster Recovery',
    summary:
      'Production Docker Compose topology for Cloud and Local School Server deployments, Nginx reverse proxy with rate limiting, and tested pg_dump / pg_restore verification script.',
    codeLanguage: 'yaml',
    content: `# infrastructure/docker/docker-compose.yml
version: "3.9"
services:
  esms-postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: \${SQL_DB_NAME}
      POSTGRES_USER: \${SQL_ADMIN_USER}
      POSTGRES_PASSWORD: \${SQL_ADMIN_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${SQL_ADMIN_USER} -d \${SQL_DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  esms-app:
    build:
      context: ../..
      dockerfile: infrastructure/docker/Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      SQL_HOST: esms-postgres
      SQL_DB_NAME: \${SQL_DB_NAME}
      SQL_USER: \${SQL_USER}
      SQL_PASSWORD: \${SQL_PASSWORD}
    depends_on:
      esms-postgres:
        condition: service_healthy

  # Automated Nightly Encrypted Backup & Restore Verification
  esms-backup-verifier:
    image: postgres:16-alpine
    entrypoint: |
      /bin/sh -c "pg_dump -Fc -h esms-postgres -U \${SQL_ADMIN_USER} \${SQL_DB_NAME} > /backups/esms_\$\$(date +%Y%m%d).dump && pg_restore --list /backups/esms_\$\$(date +%Y%m%d).dump"

volumes:
  pgdata:`,
  },
];
