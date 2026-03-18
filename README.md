# Lyrebird Clinic Appointment System

A RESTful API and React frontend for managing clinic appointments, built as a take-home coding challenge for Lyrebird Health.

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
| **Containerization** | Docker + docker-compose | Multi-stage builds, SQLite volume persistence |
| **CI** | GitHub Actions | Lint + test on push/PR |

## Quick Start

### Prerequisites
- Node.js >= 20
- pnpm >= 9

### Local Development

```bash
pnpm install
pnpm db:seed       # Seed sample data
pnpm dev           # Starts API (port 3000) + Web (port 5173)
```

Visit http://localhost:5173 for the frontend, http://localhost:3000/docs for Swagger UI.

### Docker

```bash
docker compose up --build
```

Everything at http://localhost:3000 (API + frontend served by Fastify, Swagger at `/docs`).

### Run Tests

```bash
pnpm test
```

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
    "start": "2025-12-01T09:00:00.000Z",
    "end": "2025-12-01T09:30:00.000Z"
  }'
```

**Responses:** `201 Created` | `400 Bad Request` (invalid times) | `409 Conflict` (overlapping slot)

### GET /clinicians/:id/appointments
Clinician's upcoming schedule. Roles: `clinician`, `admin`.

```bash
curl http://localhost:3000/clinicians/c1/appointments \
  -H "X-Role: clinician"

# With date range:
curl "http://localhost:3000/clinicians/c1/appointments?from=2025-12-01T00:00:00Z&to=2025-12-31T23:59:59Z" \
  -H "X-Role: clinician"
```

### GET /appointments
All appointments (admin only). Supports `from`, `to`, `limit`, `offset`.

```bash
curl "http://localhost:3000/appointments?limit=10&offset=0" \
  -H "X-Role: admin"
```

### GET /clinicians
List all clinicians. No auth required.

### GET /patients
List all patients. No auth required.

## Auth Simulation

Role is determined by the `X-Role` header (or `?role=` query param):
- `patient` (default) — can book appointments
- `clinician` — can view own schedule
- `admin` — full access

## Architecture & Design Decisions

### Tech Stack
- **Fastify** — chosen over Express for built-in schema validation, first-class TypeScript, and automatic Swagger generation from Zod schemas
- **Drizzle ORM + SQLite** — type-safe, zero-config database. SQLite's single-writer lock provides inherent concurrency safety for overlap checks
- **Zod** — runtime validation with automatic OpenAPI schema generation via `fastify-type-provider-zod`
- **React + shadcn/ui + Tailwind** — component-based frontend with Lyrebird brand theming

### Concurrency Safety
SQLite uses a single-writer lock. All overlap checks and inserts happen inside a Drizzle transaction. When two concurrent requests attempt to book the same slot, SQLite serializes them — the second request sees the first's insert and returns a `409 Conflict`. This is demonstrated in the test suite (`"rejects concurrent overlapping bookings"`).

### Overlap Detection
Uses the standard interval overlap formula: `new.start < existing.end AND new.end > existing.start`. This catches all overlap cases (partial overlap, containment, exact match).

### Auto-Entity Creation
POST /appointments auto-creates clinician/patient records if they don't exist, reducing friction. Names default to `"Clinician {id}"` / `"Patient {id}"` but can be provided in the request body.

### Tradeoffs
- **SQLite vs Postgres** — SQLite is simpler to set up and sufficient for this use case. For production with multiple application instances, Postgres would be necessary since SQLite's file-level locking doesn't work across processes/containers.
- **Header-based auth** — Simulation only. A real system would use JWT/OAuth with proper session management.
- **Monorepo** — pnpm workspaces keep API and web together with shared tooling, at the cost of slightly more complex Docker builds.

## Bonus Features

All optional bonus items from the spec are implemented:

- **Swagger/OpenAPI** — auto-generated from Zod schemas, UI at `/docs`
- **Role-based auth simulation** — `X-Role` header with route-level guards, clinician own-schedule enforcement via `X-Clinician-Id`
- **Concurrency-safe booking** — SQLite write serialization with transactional overlap check + concurrent test
- **Docker + docker-compose** — single-container multi-stage build, Fastify serves both API and frontend, SQLite volume persistence
- **CI pipeline** — GitHub Actions running lint + test on push/PR
- **React frontend** — booking form, clinician schedule, admin dashboard with Lyrebird branding

## Project Structure

```
packages/
  api/          # Fastify REST API
    src/
      app.ts                    # Fastify app factory
      server.ts                 # Entry point
      db/schema.ts              # Drizzle table definitions
      db/seed.ts                # Dev seed data
      routes/appointments.ts    # POST + GET /appointments
      routes/clinicians.ts      # GET /clinicians/:id/appointments
      services/appointment.service.ts  # Business logic
      middleware/auth.ts        # Role-based access control
    tests/
      appointments.test.ts      # Integration tests
  web/          # React + Vite frontend
    src/
      pages/BookAppointment.tsx
      pages/ClinicianSchedule.tsx
      pages/AdminDashboard.tsx
      components/ui/            # shadcn-style components
      lib/api.ts                # API client
```
