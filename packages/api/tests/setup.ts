import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../src/db/schema.js";
import { buildApp } from "../src/app.js";

export async function createTestApp() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE clinicians (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT
    );
    CREATE TABLE patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT
    );
    CREATE TABLE appointments (
      id TEXT PRIMARY KEY,
      clinician_id TEXT NOT NULL REFERENCES clinicians(id),
      patient_id TEXT NOT NULL REFERENCES patients(id),
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      CHECK (start < end)
    );
  `);

  const db = drizzle(sqlite, { schema });
  const app = await buildApp(db);
  await app.ready();

  return { app, db, sqlite };
}

/** Returns an ISO datetime string N hours from now */
export function futureDate(hoursFromNow: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d.toISOString();
}
