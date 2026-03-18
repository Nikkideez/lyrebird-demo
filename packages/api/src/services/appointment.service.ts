import { and, eq, gte, lte, lt, or, sql } from "drizzle-orm";
import { appointments, clinicians, patients } from "../db/schema.js";
import type { DB } from "../db/index.js";

export interface CreateAppointmentInput {
  clinicianId: string;
  patientId: string;
  start: string;
  end: string;
  clinicianName?: string;
  patientName?: string;
  patientEmail?: string;
}

export interface ListFilters {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export class AppointmentService {
  constructor(private db: DB) {}

  create(input: CreateAppointmentInput) {
    return this.db.transaction((tx) => {
      // Auto-create clinician if missing
      const existingClinician = tx
        .select()
        .from(clinicians)
        .where(eq(clinicians.id, input.clinicianId))
        .get();

      if (!existingClinician) {
        tx.insert(clinicians)
          .values({
            id: input.clinicianId,
            name: input.clinicianName || `Clinician ${input.clinicianId}`,
          })
          .run();
      }

      // Auto-create patient if missing
      const existingPatient = tx
        .select()
        .from(patients)
        .where(eq(patients.id, input.patientId))
        .get();

      if (!existingPatient) {
        tx.insert(patients)
          .values({
            id: input.patientId,
            name: input.patientName || `Patient ${input.patientId}`,
            email: input.patientEmail,
          })
          .run();
      }

      // Check for overlapping appointments for this clinician
      const overlap = tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.clinicianId, input.clinicianId),
            lt(appointments.start, input.end),
            sql`${appointments.end} > ${input.start}`
          )
        )
        .get();

      if (overlap) {
        return { conflict: true, existing: overlap } as const;
      }

      const id = crypto.randomUUID();
      const appointment = {
        id,
        clinicianId: input.clinicianId,
        patientId: input.patientId,
        start: input.start,
        end: input.end,
      };

      tx.insert(appointments).values(appointment).run();

      return { conflict: false, appointment } as const;
    });
  }

  listByClinicianId(clinicianId: string, filters: ListFilters = {}) {
    const conditions = [eq(appointments.clinicianId, clinicianId)];

    const from = filters.from || new Date().toISOString();
    conditions.push(gte(appointments.start, from));

    if (filters.to) {
      conditions.push(lte(appointments.start, filters.to));
    }

    return this.db
      .select({
        id: appointments.id,
        clinicianId: appointments.clinicianId,
        patientId: appointments.patientId,
        start: appointments.start,
        end: appointments.end,
        createdAt: appointments.createdAt,
        patientName: patients.name,
        patientEmail: patients.email,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .where(and(...conditions))
      .orderBy(appointments.start)
      .all();
  }

  listAll(filters: ListFilters = {}) {
    const conditions = [];

    const from = filters.from || new Date().toISOString();
    conditions.push(gte(appointments.start, from));

    if (filters.to) {
      conditions.push(lte(appointments.start, filters.to));
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    return this.db
      .select({
        id: appointments.id,
        clinicianId: appointments.clinicianId,
        patientId: appointments.patientId,
        start: appointments.start,
        end: appointments.end,
        createdAt: appointments.createdAt,
        clinicianName: clinicians.name,
        clinicianSpecialty: clinicians.specialty,
        patientName: patients.name,
        patientEmail: patients.email,
      })
      .from(appointments)
      .leftJoin(clinicians, eq(appointments.clinicianId, clinicians.id))
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .where(and(...conditions))
      .orderBy(appointments.start)
      .limit(limit)
      .offset(offset)
      .all();
  }

  getClinicianById(id: string) {
    return this.db
      .select()
      .from(clinicians)
      .where(eq(clinicians.id, id))
      .get();
  }

  listClinicians() {
    return this.db.select().from(clinicians).all();
  }

  listPatients() {
    return this.db.select().from(patients).all();
  }
}
