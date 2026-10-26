# PhysioCore

Multi-tenant physiotherapy hospital management system with PostgreSQL, Fastify, Next.js, shadcn/ui, and BullMQ.

## Architecture

```
physiocore/
├── apps/
│   ├── api/          # Fastify REST API (:4000)
│   ├── worker/       # BullMQ background job processor
│   └── web/          # Next.js frontend (:3000)
├── packages/
│   ├── db/           # Prisma schema + client
│   └── schema/       # Zod schemas (shared)
├── docker/
│   └── docker-compose.yml
└── pnpm-workspace.yaml
```

### Tenancy

Every tenant-scoped table has a `tenantId` column and every service query requires an explicit tenant predicate. The old transaction-local PostgreSQL RLS hook has been disabled because Prisma's pooled connections are not pinned to Fastify requests; cross-tenant integration tests are required before re-enabling RLS with a transaction-bound data-access layer.

### Auth

JWT access token (15 min) plus a 7-day refresh token hashed in DB and delivered to browsers through an httpOnly cookie. Roles: `SUPER_ADMIN`, `ADMIN`, `FRONT_DESK`, `THERAPIST`, `BILLING`, `PATIENT`. RBAC with resource-level guards via `requirePermission()` preHandler hook.

## Quick Start

```bash
# Prerequisites: Node.js 20+, pnpm, Docker

# 1. Install dependencies
pnpm install

# 2. Start infrastructure
docker compose -f docker/docker-compose.yml up -d postgres redis

# 3. Run migrations
pnpm db:migrate

# 4. Seed demo data
pnpm db:seed

# 5. Start development
pnpm dev          # starts API (:4000), worker, and web (:3000)
pnpm dev:api      # API only
pnpm dev:web      # frontend only
```

## API Documentation

Swagger UI at `http://localhost:4000/docs` once the API is running.

## Environment Variables

See `.env.example` for all required vars. Key ones:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/physiocore` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `JWT_ACCESS_SECRET` | — | JWT signing key (access token) |
| `JWT_REFRESH_SECRET` | — | JWT signing key (refresh token) |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin |

## Demo Credentials

After seeding:

| Role | Email | Password |
|---|---|---|
| SUPER_ADMIN | admin@physiocare.com | password123 |
| ADMIN | manager@physiocare.com | password123 |
| FRONT_DESK | frontdesk@physiocare.com | password123 |
| BILLING | billing@physiocare.com | password123 |

## API Routes

All routes under `/api/v1`. Global response format:

```json
{ "success": true, "data": {}, "meta": { "page": 1, "total": 100 } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

### Auth
| Method | Path | Description |
|---|---|---|
| POST | /auth/register-tenant | Create tenant + SUPER_ADMIN |
| POST | /auth/login | Login, returns token pair |
| POST | /auth/refresh | Rotate refresh token |
| POST | /auth/logout | Revoke refresh token |
| POST | /auth/forgot-password | Send reset email |
| POST | /auth/reset-password | Set new password |
| GET | /auth/me | Current user + tenant |

### Users
| Method | Path | Permissions |
|---|---|---|
| GET | /users | settings:read |
| POST | /users | settings:update |
| GET | /users/:id | settings:read |
| PATCH | /users/:id | settings:update |
| DELETE | /users/:id | settings:update |
| PATCH | /users/:id/reset-password | settings:update |

### Patients
| Method | Path | Permissions |
|---|---|---|
| GET | /patients | patient:read |
| POST | /patients | patient:create |
| GET | /patients/:id | patient:read |
| PATCH | /patients/:id | patient:update |
| DELETE | /patients/:id | patient:delete |
| GET | /patients/:id/appointments | appointment:read |
| GET | /patients/:id/soap-notes | soap_note:read |
| GET | /patients/:id/invoices | finance:read |
| GET | /patients/:id/exercise-plans | patient:read |
| GET | /patients/:id/outcome-measures | patient:read |
| GET | /patients/:id/timeline | patient:read |
| GET | /patients/:id/history | patient:read |

### Appointments
| Method | Path | Permissions |
|---|---|---|
| GET | /appointments | appointment:read |
| POST | /appointments | appointment:create |
| GET | /appointments/:id | appointment:read |
| PATCH | /appointments/:id | appointment:update |
| DELETE | /appointments/:id | appointment:delete |
| POST | /appointments/:id/confirm | appointment:update |
| POST | /appointments/:id/check-in | appointment:update |
| POST | /appointments/:id/start-session | appointment:update |
| POST | /appointments/:id/no-show | appointment:update |
| GET | /appointments/available-slots | appointment:read |
| GET | /appointments/queue | appointment:read |

### SOAP Notes
| Method | Path | Permissions |
|---|---|---|
| GET | /soap-notes | soap_note:read |
| POST | /soap-notes | soap_note:create |
| GET | /soap-notes/:id | soap_note:read |
| PATCH | /soap-notes/:id | soap_note:create |
| POST | /soap-notes/:id/sign | soap_note:sign |
| GET | /soap-notes/:id/suggest | soap_note:read |

### Therapists & Schedules
| Method | Path | Permissions |
|---|---|---|
| GET | /therapists | patient:read |
| POST | /therapists | settings:update |
| GET | /therapists/:id | patient:read |
| PATCH | /therapists/:id | settings:update |
| GET | /therapists/:id/schedule | appointment:read |
| POST | /therapists/:id/schedule | appointment:create |
| DELETE | /therapists/:id/schedule/:blockId | appointment:delete |
| GET | /therapists/:id/patients | patient:read |
| GET | /therapists/:id/utilisation | finance:read |

### Finance
| Method | Path | Permissions |
|---|---|---|
| GET | /finance/summary | finance:read |
| GET | /finance/monthly-trend | finance:read |
| GET | /invoices | finance:read |
| POST | /invoices | finance:create |
| GET | /invoices/:id | finance:read |
| PATCH | /invoices/:id | finance:update |
| POST | /invoices/:id/send | finance:update |
| POST | /invoices/:id/mark-paid | finance:update |
| POST | /invoices/:id/submit-medical-aid | finance:update |
| GET | /invoices/:id/pdf | finance:read |
| GET | /medical-schemes/claims | scheme:read |
| POST | /medical-schemes/claims | scheme:write |
| POST | /medical-schemes/claims/:id/submit | scheme:write |
| PATCH | /medical-schemes/claims/:id/status | scheme:write |
| GET | /medical-schemes/claims/report | scheme:read |

Medical-aid claims are submitted and tracked in the Medical Schemes area. The worker intentionally does not invent approval or rejection outcomes: a real funder/MediSwitch adapter and credentials are still required before automated claim submission/status reconciliation can be enabled. `MEDISWITCH_API_KEY` and `MEDISWITCH_API_URL` are reserved for that provider integration.

### Payments
| Method | Path | Permissions |
|---|---|---|
| GET | /payments | payment:read |
| POST | /payments | payment:create |
| GET | /payments/summary | payment:read |
| GET | /payments/requests | payment:read |
| POST | /payments/requests | payment:create |
| GET | /payments/requests/:id | payment:read |
| POST | /payments/requests/:id/poll | payment:read |
| POST | /payments/onekhusa/webhook | Public signed callback |
| GET | /payments/methods | payment:read |
| POST | /payments/methods | payment:create |
| PATCH | /payments/methods/:id | payment:create |
| DELETE | /payments/methods/:id | payment:create |

OneKhusa request-to-pay uses the `@chiahq/sdk` package. Configure the `ONEKHUSA_*`
values in `.env`, run the payment-request migration, and register
`POST /api/v1/payments/onekhusa/webhook` with OneKhusa. Staff can create a request
from an outstanding invoice; the member sees the timed account number and reference
in the portal, and configured email/SMS channels receive the same payment details.
Webhook confirmation is authoritative, while the worker polls pending requests every
30 seconds as a reconciliation fallback. Confirmed payments are linked to the
invoice and automatically update its balance/status.

### Inventory & Assets
| Method | Path | Permissions |
|---|---|---|
| GET | /inventory/summary | inventory:read |
| GET | /inventory/assets | inventory:read |
| POST | /inventory/assets | inventory:write |
| PATCH | /inventory/assets/:assetId | inventory:write |
| DELETE | /inventory/assets/:assetId | inventory:write |
| GET | /inventory/drugs | inventory:read |
| POST | /inventory/drugs | inventory:write |
| PATCH | /inventory/drugs/:drugId | inventory:write |
| POST | /inventory/drugs/:drugId/receive | inventory:write |
| POST | /inventory/drugs/:drugId/issue | inventory:issue |
| POST | /inventory/drugs/:drugId/adjust | inventory:write |
| GET | /inventory/drugs/:drugId/movements | inventory:read |

Drug issues are recorded against either a patient or an active employee. Stock is decremented transactionally and cannot fall below zero; expired stock cannot be issued; every receipt, issue, and adjustment remains in the movement ledger.

### Clinical Safety & Observations
| Method | Path | Permissions |
|---|---|---|
| GET | /patients/:id/clinical-observations | clinical_observation:read |
| POST | /patients/:id/clinical-observations | clinical_observation:write |

Patient records include structured allergies, chronic conditions, current medications, blood type, preferred language, and clinical precautions. Vitals and pain observations are tenant-scoped, optionally linked to an appointment, recorded with the staff member who entered them, and included in the patient history timeline.

### Exercise Plans
| Method | Path | Permissions |
|---|---|---|
| GET | /exercise-plans | patient:read |
| POST | /exercise-plans | patient:create |
| GET | /exercise-plans/:id | patient:read |
| PATCH | /exercise-plans/:id | patient:update |
| POST | /exercise-plans/:id/send | patient:update |
| POST | /exercise-plans/:id/items | patient:create |
| PATCH | /exercise-plans/:id/items/:itemId | patient:update |
| DELETE | /exercise-plans/:id/items/:itemId | patient:delete |

### Outcome Measures
| Method | Path | Permissions |
|---|---|---|
| GET | /patients/:id/outcome-measures | patient:read |
| POST | /patients/:id/outcome-measures | patient:update |
| PATCH | /outcome-measures/:id | patient:update |
| DELETE | /outcome-measures/:id | patient:update |

### Reminders
| Method | Path | Permissions |
|---|---|---|
| GET | /reminders/rules | settings:read |
| POST | /reminders/rules | settings:update |
| PATCH | /reminders/rules/:id | settings:update |
| DELETE | /reminders/rules/:id | settings:update |
| POST | /reminders/send | settings:update |
| GET | /reminders/logs | settings:read |
| GET | /reminders/stats | settings:read |

### Marketing
| Method | Path | Permissions |
|---|---|---|
| GET | /marketing/campaigns | settings:read |
| POST | /marketing/campaigns | settings:update |
| GET | /marketing/campaigns/:id | settings:read |
| PATCH | /marketing/campaigns/:id | settings:update |
| POST | /marketing/campaigns/:id/send | settings:update |
| GET | /marketing/sources | settings:read |
| GET | /marketing/reviews | settings:read |

### Reports
| Method | Path | Permissions |
|---|---|---|
| GET | /reports | finance:read |
| GET | /reports/dashboard | finance:read |
| GET | /reports/patients | finance:read |
| GET | /reports/members | finance:read |
| GET | /reports/payments | finance:read |
| GET | /reports/medical-scheme-payments | finance:read |
| GET | /reports/clinical | finance:read |
| GET | /reports/financial | finance:read |
| GET | /reports/operational | finance:read |
| GET | /reports/therapist/:id | finance:read |
| POST | /reports/export | finance:export |
| GET | /reports/exports/:exportId | finance:read |
| GET | /reports/exports/:exportId/download | finance:export |

Report detail endpoints accept ISO `startDate` and `endDate` query parameters. `/reports/patients` also accepts `memberStatus` and preferred `paymentMethod`; `/reports/payments` accepts recorded `paymentMethod` and payment `status`; `/reports/medical-scheme-payments` groups completed scheme collections by linked scheme and accepts an optional `schemeId`.

### Settings
| Method | Path | Permissions |
|---|---|---|
| GET | /settings | settings:read |
| PATCH | /settings | settings:update |
| GET | /settings/integrations | settings:read |
| PATCH | /settings/integrations/:key | settings:update |

### Patient Portal (PATIENT role)
| Method | Path | Description |
|---|---|---|
| GET | /portal/me | Own profile |
| GET | /portal/appointments | Upcoming appointments |
| POST | /portal/appointments/:id/cancel | Cancel own appointment |
| GET | /portal/invoices | Own invoices |
| POST | /portal/invoices/:id/pay | Create OneKhusa request-to-pay |
| GET | /portal/exercise-plans | Own exercise plans |
| GET | /portal/soap-notes | Own SOAP notes (read-only) |
| POST | /portal/feedback | Submit session rating |

## Background Jobs

| Queue | Job | Trigger |
|---|---|---|
| reminders | send-appointment-reminder | Every 15 min (cron) |
| reminders | send-no-show-notification | On NO_SHOW status change |
| reminders | reengagement | Daily cron |
| invoices | send-invoice-email | On create or manual send |
| invoices | flag-overdue-invoices | Daily cron |
| reports | export-report | POST /reports/export |
| medical-aid | poll-claim-status | Daily cron |
| payment-requests | poll-payment-requests | Every 30 seconds (webhook reconciliation fallback) |

## Testing

```bash
pnpm test          # run all tests
pnpm test:api      # API tests only
pnpm --filter @physiocore/worker test
pnpm --filter @physiocore/web lint
```

## Production Readiness Gap Register

The application now covers the core outpatient physiotherapy workflows: patient registration, structured clinical intake, SOAP notes, treatment and exercise plans, outcome measures, appointments, therapist and employee management, inventory and drug issue tracking, invoices, payment methods, OneKhusa request-to-pay reconciliation, medical-scheme reporting, patient history, reminders, portal access, audit logging, and deployment checks.

The following items remain before claiming full hospital-information-system scope:

| Area | Status | Next action |
|---|---|---|
| Medical-scheme EDI / MediSwitch | External dependency | Obtain the funder contract, credentials, tariff rules, and test endpoints, then implement signed submissions and response reconciliation. |
| Documents, consent forms, and attachments | Not yet implemented | Add encrypted object storage, document metadata, consent versioning, retention rules, and access audit events. |
| Patient onboarding and portal identity | Partial | Add invitation/self-registration, identity verification, MFA, and secure document upload. |
| Check-in and waiting queue | Implemented | Appointment check-in records arrival time, room, priority, and the transition into treatment; the live queue is available from Appointments. |
| Room and resource capacity scheduling | Partial | Room labels are recorded on appointments. Add managed rooms, equipment calendars, and conflict prevention for full facility-capacity scheduling. |
| Pharmacy prescriptions, laboratory, imaging, referrals, admissions, and beds | Out of current outpatient scope | Add only if the deployment will operate beyond physiotherapy outpatient care; each needs its own clinical workflow and integrations. |
| Branches and broader workforce operations | Partial | Add locations, room calendars, attendance, leave, credential expiry, and staff compliance tracking. |
| Production operations | Deployment-owned | Configure TLS, secret management, managed PostgreSQL/Redis, backups, restore drills, monitoring/alerting, log retention, and incident response. |

These are deliberately recorded as explicit gaps rather than represented by placeholder screens. The current product should be positioned as an outpatient physiotherapy management system until the external integrations and broader hospital modules are delivered.

## Deployment

```bash
docker compose -f docker/docker-compose.yml up -d
```

The production release workflow publishes API, worker, and web images to GHCR and runs `prisma migrate deploy`. Configure the protected `production` environment with `PRODUCTION_DATABASE_URL`; runtime orchestration, TLS, secrets, backups, and restore drills must be configured on the selected hosting platform.

## Key Design Decisions

- **Explicit tenant scoping**: tenant IDs are enforced at authentication, route, and service boundaries; the current pooled Prisma setup does not claim transaction-safe RLS.
- **Zod schemas in shared package**: Frontend and backend validate against the same schemas.
- **Therapist ownership enforcement**: At the service layer, not just route level — therapists can only access their own patients.
- **Hash-stored refresh tokens**: Refresh tokens are SHA-256 hashed before DB storage. The raw UUID is the bearer credential.
- **HIPAA-aware logging**: Audit logs store resource IDs, not PHI (names, diagnoses).
