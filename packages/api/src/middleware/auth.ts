import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Role } from "../types.js";

const VALID_ROLES: Role[] = ["patient", "clinician", "admin"];

export function authPlugin(app: FastifyInstance) {
  app.decorateRequest("role", "patient" as Role);

  app.addHook("onRequest", async (request: FastifyRequest) => {
    const headerRole = request.headers["x-role"] as string | undefined;
    const queryRole = (request.query as Record<string, string>)?.role;
    const raw = headerRole || queryRole || "patient";
    request.role = VALID_ROLES.includes(raw as Role)
      ? (raw as Role)
      : "patient";
  });
}

export function requireRole(...allowed: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!allowed.includes(request.role)) {
      reply.code(403).send({
        error: "Forbidden",
        message: `Role '${request.role}' is not allowed. Required: ${allowed.join(", ")}`,
      });
    }
  };
}
