import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const clinicians = sqliteTable("clinicians", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  specialty: text("specialty"),
});

export const patients = sqliteTable("patients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
});

export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey(),
  clinicianId: text("clinician_id")
    .notNull()
    .references(() => clinicians.id),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  start: text("start").notNull(),
  end: text("end").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});
