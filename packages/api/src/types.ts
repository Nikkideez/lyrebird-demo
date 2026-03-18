import type { FastifyRequest } from "fastify";

export type Role = "patient" | "clinician" | "admin";

declare module "fastify" {
  interface FastifyRequest {
    role: Role;
  }
}
