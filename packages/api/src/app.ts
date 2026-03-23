import path from "node:path";
import { existsSync } from "node:fs";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { authPlugin } from "./middleware/auth.js";
import { appointmentRoutes } from "./routes/appointments.js";
import { clinicianRoutes } from "./routes/clinicians.js";
import type { DB } from "./db/index.js";

export async function buildApp(db: DB) {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, { origin: true });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Lyrebird Clinic API",
        description: "Appointment management system for Lyrebird Health",
        version: "1.0.0",
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifySwaggerUi, { routePrefix: "/docs" });

  authPlugin(app);

  // Register API routes under /api prefix for Docker (frontend uses /api/*)
  // Also register at root for direct API access and backwards compatibility
  const registerRoutes = (instance: typeof app) => {
    appointmentRoutes(instance, db);
    clinicianRoutes(instance, db);
    instance.get("/health", async () => ({ status: "ok" }));
  };

  await app.register(
    async (api) => {
      registerRoutes(api);
    },
    { prefix: "/api" }
  );
  registerRoutes(app);

  // Serve frontend static assets in production
  const webDist = path.resolve(process.cwd(), "public");
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, wildcard: false });
    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile("index.html");
    });
  }

  return app;
}
