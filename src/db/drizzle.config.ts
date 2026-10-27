import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

function resolveActiveSqlHost(): string | undefined {
  const configuredHost = process.env.SQL_HOST;
  if (configuredHost && fs.existsSync(path.join(configuredHost, '.s.PGSQL.5432'))) {
    return configuredHost;
  }
  const cloudSqlRoot = '/app/cloudsql';
  if (fs.existsSync(cloudSqlRoot)) {
    for (const entry of fs.readdirSync(cloudSqlRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const candidateDir = path.join(cloudSqlRoot, entry.name);
        if (fs.existsSync(path.join(candidateDir, '.s.PGSQL.5432'))) {
          return candidateDir;
        }
      }
    }
  }
  return configuredHost;
}

const sqlHost = resolveActiveSqlHost();
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER;
const password = process.env.SQL_ADMIN_PASSWORD;

if (!sqlHost) {
  throw new Error('SQL_HOST must be set in environment variables.');
}
if (!sqlDbName) {
  throw new Error('SQL_DB_NAME must be set in environment variables.');
}
if (!user) {
  throw new Error('SQL_ADMIN_USER must be set in environment variables.');
}
if (!password) {
  throw new Error('SQL_ADMIN_PASSWORD must be set in environment variables.');
}
console.log(`Using user: ${user} to connect to database.`);

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: {
    host: sqlHost,
    user: user,
    password: password,
    database: sqlDbName,
    ssl: false,
  },
  verbose: true,
});
