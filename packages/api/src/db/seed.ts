import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const DB_PATH = process.env.DB_PATH || "clinic.db";
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

// Create tables
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

// Seed data
const clinicianData = [
  { id: "c1", name: "Dr. Sarah Chen", specialty: "General Practice" },
  { id: "c2", name: "Dr. James Wilson", specialty: "Cardiology" },
  { id: "c3", name: "Dr. Emily Park", specialty: "Dermatology" },
];

const patientData = [
  { id: "p1", name: "Alice Johnson", email: "alice@example.com" },
  { id: "p2", name: "Bob Smith", email: "bob@example.com" },
  { id: "p3", name: "Carol Davis", email: "carol@example.com" },
];

// Use tomorrow as base for seed appointments so they're always "upcoming"
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(9, 0, 0, 0);

const appointmentData = [
  {
    id: "a1",
    clinicianId: "c1",
    patientId: "p1",
    start: new Date(tomorrow).toISOString(),
    end: new Date(new Date(tomorrow).setMinutes(30)).toISOString(),
  },
  {
    id: "a2",
    clinicianId: "c1",
    patientId: "p2",
    start: new Date(new Date(tomorrow).setHours(10, 0)).toISOString(),
    end: new Date(new Date(tomorrow).setHours(10, 30)).toISOString(),
  },
  {
    id: "a3",
    clinicianId: "c2",
    patientId: "p3",
    start: new Date(new Date(tomorrow).setHours(14, 0)).toISOString(),
    end: new Date(new Date(tomorrow).setHours(14, 45)).toISOString(),
  },
];

db.insert(schema.clinicians).values(clinicianData).onConflictDoNothing().run();
db.insert(schema.patients).values(patientData).onConflictDoNothing().run();
db.insert(schema.appointments)
  .values(appointmentData)
  .onConflictDoNothing()
  .run();

console.log("Seeded database successfully.");
sqlite.close();
