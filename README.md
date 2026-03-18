# Lyrebird Clinic Appointment System

A RESTful API and React frontend for managing clinic appointments, built as a take-home challenge for Lyrebird Health.

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Runtime** | Node.js 20 + TypeScript | Type-safe, modern JS runtime |
| **API Framework** | Fastify 5 | Built-in schema validation, first-class TS, auto Swagger from Zod |
| **ORM** | Drizzle ORM + better-sqlite3 | Type-safe SQL, zero codegen, SQLite write-lock = free concurrency safety |
| **Validation** | Zod + fastify-type-provider-zod | Runtime validation + automatic OpenAPI generation |
| **Frontend** | React 19 + Vite 6 | Fast dev server, optimized builds |
| **UI Components** | shadcn/ui + Radix | Accessible primitives, full styling control |
| **Styling** | Tailwind CSS 4 | Utility-first, themed to Lyrebird brand (#5D5BF0, Montserrat) |
| **Testing** | Vitest | Fast, Vite-native test runner |
| **Containerization** | Docker + docker-compose | Multi-stage build, SQLite volume persistence |
| **CI** | GitHub Actions | Lint + test on push/PR |

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9

### Local Development

```bash
pnpm install
pnpm db:seed       # Seed sample data (3 clinicians, 3 patients, 3 appointments)
pnpm dev           # Starts API (port 3000) + Web (port 5173)
```

- Frontend: http://localhost:5173 (Vite dev server proxies `/api/*` to port 3000)
- Swagger UI: http://localhost:3000/docs
- Health check: http://localhost:3000/health

### Docker

```bash
docker compose up --build
```

Everything at http://localhost:3000 -- Fastify serves both the API and the frontend static assets. Swagger at `/docs`. SQLite database persisted via Docker volume at `/data/clinic.db`.

### Run Tests

```bash
pnpm test
```

Tests use in-memory SQLite databases, so they run fast and don't touch the dev database.

## API Endpoints

### POST /appointments

Create a new appointment. Roles: `patient`, `admin`.

```bash
curl -X POST http://localhost:3000/appointments \
  -H "Content-Type: application/json" \
  -H "X-Role: patient" \
  -d '{
    "clinicianId": "c1",
    "patientId": "p1",
    "start": "2026-12-01T09:00:00.000Z",
    "end": "2026-12-01T09:30:00.000Z"
  }'
```

**Responses:** `201 Created` | `400 Bad Request` (invalid times, past dates) | `409 Conflict` (overlapping slot) | `403 Forbidden` (wrong role)

Validations:
- `start` must be before `end`
- `start` must be in the future
- Zod validates ISO datetime format, non-empty IDs, optional email format

### GET /clinicians/:id/appointments

Clinician's upcoming schedule. Roles: `clinician`, `admin`.

```bash
curl http://localhost:3000/clinicians/c1/appointments \
  -H "X-Role: clinician"

# With date range:
curl "http://localhost:3000/clinicians/c1/appointments?from=2026-12-01T00:00:00Z&to=2026-12-31T23:59:59Z" \
  -H "X-Role: clinician"
```

Clinicians can only view their own schedule (enforced via `X-Clinician-Id` header). Admins can view any clinician's schedule. Returns `404` if the clinician doesn't exist.

### GET /appointments

All appointments (admin only). Supports `from`, `to`, `limit`, `offset`.

```bash
curl "http://localhost:3000/appointments?limit=10&offset=0" \
  -H "X-Role: admin"
```

Defaults: `from` = now (only future appointments), `limit` = 50. Joins clinician and patient names into the response.

### GET /clinicians

List all clinicians. No auth required.

### GET /patients

List all patients. No auth required.

## Auth Simulation

Role is determined by the `X-Role` header (or `?role=` query param):

| Role | Permissions |
|------|-------------|
| `patient` (default) | Book appointments |
| `clinician` | View own schedule (requires `X-Clinician-Id` header for own-schedule enforcement) |
| `admin` | Full access: book, view any schedule, list all appointments |

Invalid or missing `X-Role` values silently default to `patient`.

### Frontend Role Switcher

The React frontend includes a dropdown in the header to switch between roles. This updates a module-level variable in `lib/api.ts` that's attached to every outgoing request as the `X-Role` header. The role state lives outside React (module scope) because it needs to be accessible from the API client module, and it's simpler than threading Context through to a utility module. Every API call from the frontend automatically includes the current role.

## Architecture & Design Decisions

### Why Fastify over Express

Fastify provides built-in schema validation with the Zod type provider (`fastify-type-provider-zod`). Route schemas defined with Zod are automatically validated on request, serialized on response, and transformed into OpenAPI specs via `@fastify/swagger`. This means a single Zod schema definition gives you: runtime validation, TypeScript types, and Swagger documentation. Express would require wiring these up separately.

### Why Drizzle + SQLite

Drizzle provides type-safe SQL without codegen -- schema definitions in TypeScript double as the source of truth. `better-sqlite3` is a synchronous, native SQLite driver, which means no connection pooling, no async complexity, and zero infrastructure. SQLite's file-level locking provides inherent write serialization, which turns out to be exactly what you want for preventing double-booked appointment slots.

### Why Single-Container Docker

The initial approach was two containers (React served by nginx, API by Node) with nginx reverse-proxying API requests. This was replaced with a single container where Fastify serves the pre-built React assets via `@fastify/static`.

The `setNotFoundHandler` in `app.ts` is the key: any request that doesn't match an API route or static file gets `index.html`, which is standard SPA fallback routing. This eliminated:
- nginx configuration and its own Dockerfile
- DNS resolution issues between containers in docker-compose
- Port mapping complexity
- A separate web container entirely

The multi-stage Dockerfile builds the web app, builds the API, then copies the web dist into `/public` where Fastify serves it.

### Synchronous Drizzle Transactions

`better-sqlite3` is synchronous. Drizzle's `db.transaction()` with the better-sqlite3 driver expects a **synchronous callback**. If you pass an `async` callback, the returned Promise is silently ignored -- the transaction commits immediately and the async operations execute outside the transaction boundary. All transaction code in `appointment.service.ts` uses synchronous `.get()` and `.run()` calls, not `.then()` or `await`.

This is a non-obvious gotcha: the TypeScript types don't prevent you from passing an async callback, and there's no runtime error. The transaction just silently doesn't work as expected.

### Overlap Detection

Uses the standard interval overlap formula:

```
new.start < existing.end AND new.end > existing.start
```

This catches all overlap cases: partial overlap, full containment, and exact match. Strict inequality (`<` / `>`) means touching endpoints are allowed -- an appointment ending at 10:00 doesn't conflict with one starting at 10:00.

### Auto-Entity Creation

`POST /appointments` auto-creates clinician and patient records if they don't exist. The overlap check and the insert happen in the same synchronous transaction, so there's no race condition between checking and inserting. Names default to `"Clinician {id}"` / `"Patient {id}"` but can be provided via optional `clinicianName`, `patientName`, and `patientEmail` fields.

### Frontend Architecture

- **React Router** with three routes: `/` (book), `/schedule` (clinician view), `/admin` (dashboard)
- **Vite dev proxy** rewrites `/api/*` to `http://localhost:3000/*` during development, so the frontend uses `/api` prefixed paths in `lib/api.ts`
- **Module-level role state** in `lib/api.ts` -- a `_currentRole` variable outside any component, with `setRole`/`getRole` exports. The `App` component syncs this with local React state for the dropdown UI. This avoids Context boilerplate for what is fundamentally a simulation feature.

## Concurrency Safety

SQLite uses a single-writer lock. All overlap checks and inserts happen inside a Drizzle transaction. When two concurrent requests attempt to book the same slot, SQLite serializes them -- the second request sees the first's insert and returns a `409 Conflict`.

This is verified in the test suite:

```typescript
const results = await Promise.all([
  app.inject({ method: "POST", url: "/appointments", ... }),
  app.inject({ method: "POST", url: "/appointments", ... }),
]);
const statuses = results.map((r) => r.statusCode).sort();
expect(statuses).toEqual([201, 409]);
```

One request succeeds, one gets rejected. The order is non-deterministic, but the outcome is always correct.

## Tradeoffs

### SQLite vs Postgres

SQLite is simpler to set up and sufficient for this use case. It requires no separate database process, no connection strings, no migrations infrastructure. For production with multiple application instances, PostgreSQL would be necessary since SQLite's file-level locking doesn't work across processes or containers.

### Header-Based Auth

Simulation only. The `X-Role` header is trivially spoofable. A real system would use JWT or OAuth with proper session management, token refresh, and server-side validation. But the spec calls for role simulation, and this approach makes it trivially easy to test different roles with curl.

### Monorepo

pnpm workspaces keep API and web together with shared tooling (`pnpm dev` runs both, `pnpm test` tests both). The cost is a slightly more complex Docker build since the build context needs to be the monorepo root, not the individual package.

### Single Container vs Separate Containers

The single-container approach couples frontend and API deployments -- you can't scale or deploy them independently. For this scope, simplicity wins: one image, one container, one port, no inter-container networking. In production you'd want separate services behind a reverse proxy or CDN, with the frontend on a CDN/static host and the API behind a load balancer.

### SQLite File-Level Locking

SQLite's single-writer lock is a feature here -- it provides free concurrency safety for overlap checks without any application-level locking. But it would be a hard bottleneck at scale. Every write blocks every other write, and you can't run multiple API instances against the same SQLite file (or at least, you shouldn't). WAL mode helps with read concurrency, but writes are still serialized.

### Auto-Entity Creation

Convenient for dev and demo -- you can book an appointment without first creating the clinician and patient. In production you'd want explicit entity management with proper validation, unique constraints on business identifiers (not just arbitrary string IDs), and probably a separate registration flow.

### Module-Level Role State

The `_currentRole` variable in `lib/api.ts` lives outside React's component tree. This is not React-idiomatic -- the "right" way would be Context + a provider. But for a simulation feature that just needs to attach a header to fetch calls, a module-level variable is simpler and avoids prop drilling or Context boilerplate. The tradeoff is that React doesn't re-render when the role changes from outside the component tree, but in practice the `App` component owns the setter and keeps local state in sync.

### No Real Authentication

There is no user identity -- the system trusts whatever the `X-Role` header says. There's no concept of "which patient am I" or "which clinician am I" beyond the optional `X-Clinician-Id` header for own-schedule enforcement. This is intentional per the spec requirements.

## Bonus Features

All optional bonus items from the spec are implemented:

- **Swagger/OpenAPI** -- auto-generated from Zod schemas, UI at `/docs`
- **Role-based auth simulation** -- `X-Role` header with route-level guards, clinician own-schedule enforcement via `X-Clinician-Id`
- **Concurrency-safe booking** -- SQLite write serialization with transactional overlap check + concurrent test
- **Docker + docker-compose** -- single-container multi-stage build, Fastify serves both API and frontend, SQLite volume persistence
- **CI pipeline** -- GitHub Actions running lint + test on push/PR
- **React frontend** -- booking form, clinician schedule, admin dashboard with Lyrebird branding

## Testing

16 integration tests in `packages/api/tests/appointments.test.ts`, using Vitest with in-memory SQLite:

| Category | Tests | What's covered |
|----------|-------|----------------|
| **POST /appointments** | 8 | Successful creation, overlap rejection (409), invalid time range (400), past dates (400), role enforcement (403), missing fields (400), touching endpoints allowed, different clinicians at same time |
| **GET /clinicians/:id/appointments** | 5 | Returns appointments, 404 for unknown clinician, role enforcement (403), cross-clinician access denied, date range filtering |
| **GET /appointments** | 2 | Admin access returns all, non-admin rejected (403) |
| **Concurrency** | 1 | Parallel overlapping bookings: exactly one 201 and one 409 |

Test setup (`tests/setup.ts`) creates a fresh in-memory SQLite database and Fastify app per test via `beforeEach`, ensuring test isolation.

## Project Structure

```
packages/
  api/                                # Fastify REST API
    src/
      app.ts                          # App factory, static serving, Swagger setup
      server.ts                       # Entry point (listen on PORT)
      types.ts                        # Role type + Fastify request augmentation
      db/
        index.ts                      # Database connection, table creation, WAL mode
        schema.ts                     # Drizzle table definitions (clinicians, patients, appointments)
        seed.ts                       # Dev seed data (3 clinicians, 3 patients, 3 appointments)
      routes/
        appointments.ts               # POST /appointments, GET /appointments, GET /clinicians, GET /patients
        clinicians.ts                 # GET /clinicians/:id/appointments
      services/
        appointment.service.ts        # Business logic: create, list, overlap check
      middleware/
        auth.ts                       # X-Role parsing, requireRole() guard
    tests/
      setup.ts                        # In-memory DB + app factory for tests
      appointments.test.ts            # 16 integration tests
    Dockerfile                        # Multi-stage: build web + API, serve from single container
  web/                                # React + Vite frontend
    src/
      App.tsx                         # Router, role switcher, layout
      lib/api.ts                      # API client, role state, type definitions
      pages/
        BookAppointment.tsx           # Appointment booking form
        ClinicianSchedule.tsx         # Clinician's upcoming schedule view
        AdminDashboard.tsx            # Admin view of all appointments
      components/ui/                  # shadcn/ui components
    vite.config.ts                    # Dev proxy: /api/* -> localhost:3000
docker-compose.yml                    # Single service, SQLite volume mount
```
