import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp, futureDate } from "./setup.js";
import type { FastifyInstance } from "fastify";

describe("Appointments API", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
  });

  describe("POST /appointments", () => {
    it("creates an appointment successfully", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: {
          clinicianId: "c1",
          patientId: "p1",
          start: futureDate(1),
          end: futureDate(2),
          clinicianName: "Dr. Test",
          patientName: "Test Patient",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.clinicianId).toBe("c1");
      expect(body.patientId).toBe("p1");
      expect(body.id).toBeDefined();
    });

    it("rejects overlapping appointments (409)", async () => {
      const start = futureDate(5);
      const end = futureDate(6);

      await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: { clinicianId: "c1", patientId: "p1", start, end },
      });

      const res = await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: { clinicianId: "c1", patientId: "p2", start, end },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toBe("Conflict");
    });

    it("rejects start >= end (400)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: {
          clinicianId: "c1",
          patientId: "p1",
          start: futureDate(2),
          end: futureDate(1),
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects past appointments (400)", async () => {
      const past = new Date(Date.now() - 3600000).toISOString();
      const res = await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: {
          clinicianId: "c1",
          patientId: "p1",
          start: past,
          end: futureDate(1),
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects clinician role (403)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "clinician" },
        payload: {
          clinicianId: "c1",
          patientId: "p1",
          start: futureDate(1),
          end: futureDate(2),
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it("allows touching endpoints (end == other.start)", async () => {
      const t1 = futureDate(30);
      const t2 = futureDate(31);
      const t3 = futureDate(32);

      const res1 = await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: { clinicianId: "c1", patientId: "p1", start: t1, end: t2 },
      });
      expect(res1.statusCode).toBe(201);

      // Second appointment starts exactly when first ends — should be allowed
      const res2 = await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: { clinicianId: "c1", patientId: "p2", start: t2, end: t3 },
      });
      expect(res2.statusCode).toBe(201);
    });

    it("rejects missing required fields (400)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: { clinicianId: "c1" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("allows different clinicians at same time", async () => {
      const start = futureDate(10);
      const end = futureDate(11);

      const res1 = await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: { clinicianId: "c1", patientId: "p1", start, end },
      });
      expect(res1.statusCode).toBe(201);

      const res2 = await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: { clinicianId: "c2", patientId: "p2", start, end },
      });
      expect(res2.statusCode).toBe(201);
    });
  });

  describe("GET /clinicians/:id/appointments", () => {
    it("returns appointments for a clinician", async () => {
      // Create appointment first
      await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: {
          clinicianId: "c1",
          patientId: "p1",
          start: futureDate(1),
          end: futureDate(2),
          clinicianName: "Dr. Test",
          patientName: "Test Patient",
        },
      });

      const res = await app.inject({
        method: "GET",
        url: "/clinicians/c1/appointments",
        headers: { "x-role": "clinician" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
      expect(body[0].clinicianId).toBe("c1");
    });

    it("returns 404 for unknown clinician", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/clinicians/nonexistent/appointments",
        headers: { "x-role": "admin" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("rejects patient role (403)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/clinicians/c1/appointments",
        headers: { "x-role": "patient" },
      });

      expect(res.statusCode).toBe(403);
    });

    it("rejects clinician viewing another clinician's schedule (403)", async () => {
      // Create clinicians c1 and c2 via appointments
      await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: {
          clinicianId: "c1",
          patientId: "p1",
          start: futureDate(1),
          end: futureDate(2),
        },
      });
      await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: {
          clinicianId: "c2",
          patientId: "p2",
          start: futureDate(3),
          end: futureDate(4),
        },
      });

      // Clinician c1 tries to view c2's schedule
      const res = await app.inject({
        method: "GET",
        url: "/clinicians/c2/appointments",
        headers: { "x-role": "clinician", "x-clinician-id": "c1" },
      });

      expect(res.statusCode).toBe(403);
    });

    it("supports date range filtering", async () => {
      const start1 = futureDate(1);
      const end1 = futureDate(2);
      const start2 = futureDate(48);
      const end2 = futureDate(49);

      await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: { clinicianId: "c1", patientId: "p1", start: start1, end: end1 },
      });
      await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: { clinicianId: "c1", patientId: "p2", start: start2, end: end2 },
      });

      const res = await app.inject({
        method: "GET",
        url: `/clinicians/c1/appointments?to=${futureDate(24)}`,
        headers: { "x-role": "clinician" },
      });

      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
    });
  });

  describe("GET /appointments", () => {
    it("returns all appointments for admin", async () => {
      await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: {
          clinicianId: "c1",
          patientId: "p1",
          start: futureDate(1),
          end: futureDate(2),
        },
      });

      const res = await app.inject({
        method: "GET",
        url: "/appointments",
        headers: { "x-role": "admin" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
    });

    it("rejects non-admin roles (403)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/appointments",
        headers: { "x-role": "patient" },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("DELETE /appointments/:id", () => {
    it("deletes an appointment successfully", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/appointments",
        headers: { "x-role": "patient" },
        payload: {
          clinicianId: "c1",
          patientId: "p1",
          start: futureDate(1),
          end: futureDate(2),
        },
      });
      const { id } = JSON.parse(createRes.body);

      const deleteRes = await app.inject({
        method: "DELETE",
        url: `/appointments/${id}`,
        headers: { "x-role": "admin" },
      });

      expect(deleteRes.statusCode).toBe(200);
      const body = JSON.parse(deleteRes.body);
      expect(body.id).toBe(id);
      expect(body.clinicianId).toBe("c1");

      // Verify it's actually gone
      const listRes = await app.inject({
        method: "GET",
        url: "/appointments",
        headers: { "x-role": "admin" },
      });
      const appointments = JSON.parse(listRes.body);
      expect(appointments.find((a: any) => a.id === id)).toBeUndefined();
    });

    it("returns 404 for unknown appointment", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/appointments/nonexistent",
        headers: { "x-role": "admin" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("rejects non-admin roles (403)", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/appointments/some-id",
        headers: { "x-role": "patient" },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("Concurrency safety", () => {
    it("rejects concurrent overlapping bookings", async () => {
      const start = futureDate(20);
      const end = futureDate(21);

      const results = await Promise.all([
        app.inject({
          method: "POST",
          url: "/appointments",
          headers: { "x-role": "patient" },
          payload: { clinicianId: "c1", patientId: "p1", start, end },
        }),
        app.inject({
          method: "POST",
          url: "/appointments",
          headers: { "x-role": "patient" },
          payload: { clinicianId: "c1", patientId: "p2", start, end },
        }),
      ]);

      const statuses = results.map((r) => r.statusCode).sort();
      expect(statuses).toEqual([201, 409]);
    });
  });
});
