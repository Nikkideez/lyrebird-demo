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
  "x-clinician-id": z
    .string()
    .optional()
    .describe("Clinician ID for own-schedule enforcement"),
});

const ClinicianAppointmentsQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const ClinicianParams = z.object({
  id: z.string().min(1),
});

export function clinicianRoutes(app: FastifyInstance, db: DB) {
  const service = new AppointmentService(db);

  // GET /clinicians/:id/appointments
  app.get(
    "/clinicians/:id/appointments",
    {
      preHandler: requireRole("clinician", "admin"),
      schema: {
        description: "Get appointments for a specific clinician",
        tags: ["Clinicians"],
        headers: RoleHeader,
        params: ClinicianParams,
        querystring: ClinicianAppointmentsQuery,
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof ClinicianParams>;
      const query = request.query as z.infer<
        typeof ClinicianAppointmentsQuery
      >;

      // Clinicians can only view their own schedule
      if (request.role === "clinician") {
        const clinicianId = request.headers["x-clinician-id"] as
          | string
          | undefined;
        if (clinicianId && clinicianId !== id) {
          return reply.code(403).send({
            error: "Forbidden",
            message: "Clinicians can only view their own schedule",
          });
        }
      }

      // 404 if clinician doesn't exist
      const clinician = service.getClinicianById(id);
      if (!clinician) {
        return reply.code(404).send({
          error: "Not Found",
          message: `Clinician '${id}' not found`,
        });
      }

      return service.listByClinicianId(id, query);
    }
  );
}
