import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";
import { AppointmentService } from "../services/appointment.service.js";
import type { DB } from "../db/index.js";

const RoleHeader = z.object({
  "x-role": z
    .enum(["patient", "clinician", "admin"])
    .optional()
    .describe("Simulated auth role (default: patient)"),
});

const CreateAppointmentSchema = z.object({
  clinicianId: z.string().min(1),
  patientId: z.string().min(1),
  start: z.string().datetime({ message: "start must be an ISO datetime" }),
  end: z.string().datetime({ message: "end must be an ISO datetime" }),
  clinicianName: z.string().optional(),
  patientName: z.string().optional(),
  patientEmail: z.string().email().optional(),
});

const ListAppointmentsQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function appointmentRoutes(app: FastifyInstance, db: DB) {
  const service = new AppointmentService(db);

  // POST /appointments
  app.post(
    "/appointments",
    {
      preHandler: requireRole("patient", "admin"),
      schema: {
        description: "Create a new appointment",
        tags: ["Appointments"],
        headers: RoleHeader,
        body: CreateAppointmentSchema,
        response: {
          201: z.object({
            id: z.string(),
            clinicianId: z.string(),
            patientId: z.string(),
            start: z.string(),
            end: z.string(),
          }),
          400: z.object({ error: z.string(), message: z.string() }),
          409: z.object({
            error: z.string(),
            message: z.string(),
            conflictingAppointment: z.object({
              id: z.string(),
              start: z.string(),
              end: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof CreateAppointmentSchema>;

      // Validate start < end
      if (body.start >= body.end) {
        return reply.code(400).send({
          error: "Bad Request",
          message: "start must be before end",
        });
      }

      // Validate not in the past
      if (new Date(body.start) < new Date()) {
        return reply.code(400).send({
          error: "Bad Request",
          message: "Cannot book appointments in the past",
        });
      }

      const result = await service.create(body);

      if (result.conflict) {
        return reply.code(409).send({
          error: "Conflict",
          message:
            "This time slot overlaps with an existing appointment for this clinician",
          conflictingAppointment: {
            id: result.existing.id,
            start: result.existing.start,
            end: result.existing.end,
          },
        });
      }

      return reply.code(201).send(result.appointment);
    }
  );

  // GET /appointments (admin only)
  app.get(
    "/appointments",
    {
      preHandler: requireRole("admin"),
      schema: {
        description: "List all appointments (admin only)",
        tags: ["Appointments"],
        headers: RoleHeader,
        querystring: ListAppointmentsQuery,
      },
    },
    async (request) => {
      const query = request.query as z.infer<typeof ListAppointmentsQuery>;
      return service.listAll(query);
    }
  );

  // DELETE /appointments/:id (admin only)
  app.delete(
    "/appointments/:id",
    {
      preHandler: requireRole("admin"),
      schema: {
        description: "Delete an appointment by ID (admin only)",
        tags: ["Appointments"],
        headers: RoleHeader,
        params: z.object({ id: z.string().min(1) }),
        response: {
          200: z.object({
            id: z.string(),
            clinicianId: z.string(),
            patientId: z.string(),
            start: z.string(),
            end: z.string(),
          }),
          404: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = service.deleteById(id);

      if (!result.found) {
        return reply.code(404).send({
          error: "Not Found",
          message: `Appointment '${id}' not found`,
        });
      }

      return reply.code(200).send(result.appointment);
    }
  );

  // GET /clinicians (convenience endpoint)
  app.get(
    "/clinicians",
    {
      schema: {
        description: "List all clinicians",
        tags: ["Clinicians"],
      },
    },
    async () => {
      return service.listClinicians();
    }
  );

  // GET /patients (convenience endpoint)
  app.get(
    "/patients",
    {
      schema: {
        description: "List all patients",
        tags: ["Patients"],
      },
    },
    async () => {
      return service.listPatients();
    }
  );
}
