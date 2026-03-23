import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const DB_PATH = process.env.DB_PATH || "clinic.db";

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Auto-create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS clinicians (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    specialty TEXT
  );
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT
  );
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    clinician_id TEXT NOT NULL REFERENCES clinicians(id),
    patient_id TEXT NOT NULL REFERENCES patients(id),
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    CHECK (start < end)
  );
`);

// Seed sample data if tables are empty
const count = sqlite.prepare("SELECT COUNT(*) as n FROM clinicians").get() as { n: number };
if (count.n === 0) {
  sqlite.exec(`
    INSERT INTO clinicians (id, name, specialty) VALUES
      ('c1', 'Dr. Sarah Chen', 'General Practice'),
      ('c2', 'Dr. James Wilson', 'Cardiology'),
      ('c3', 'Dr. Emily Park', 'Dermatology');
    INSERT INTO patients (id, name, email) VALUES
      ('p1', 'Alice Johnson', 'alice@example.com'),
      ('p2', 'Bob Smith', 'bob@example.com'),
      ('p3', 'Carol Davis', 'carol@example.com');
  `);
}

export const db: BetterSQLite3Database<typeof schema> = drizzle(sqlite, { schema });
export type DB = typeof db;
