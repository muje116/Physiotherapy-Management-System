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

Row-level security on PostgreSQL. Every tenant-scoped table has a `tenantId` column. Prisma middleware sets `app.current_tenant_id` session variable per request. RLS policies enforce isolation at the database level.

### Auth

JWT access token (15 min) + refresh token (7 days, hashed in DB). Roles: `SUPER_ADMIN`, `ADMIN`, `FRONT_DESK`, `THERAPIST`, `BILLING`, `PATIENT`. RBAC with resource-level guards via `requirePermission()` preHandler hook.

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

### Appointments
| Method | Path | Permissions |
|---|---|---|
| GET | /appointments | appointment:read |
| POST | /appointments | appointment:create |
| GET | /appointments/:id | appointment:read |
| PATCH | /appointments/:id | appointment:update |
| DELETE | /appointments/:id | appointment:delete |
| POST | /appointments/:id/confirm | appointment:update |
| POST | /appointments/:id/no-show | appointment:update |
| GET | /appointments/available-slots | appointment:read |

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
| GET | /medical-aid/claims | finance:read |
| PATCH | /medical-aid/claims/:id | finance:update |
| POST | /medical-aid/claims/:id/resubmit | finance:update |

Medical-aid claims are submitted and tracked in the Medical Schemes area. The worker intentionally does not invent approval or rejection outcomes: until a real funder/MediSwitch adapter is configured, staff must record the response through the claim status action. `MEDISWITCH_API_KEY` and `MEDISWITCH_API_URL` are reserved for that provider integration.

### Payments
| Method | Path | Permissions |
|---|---|---|
| GET | /payments | payment:read |
| POST | /payments | payment:create |
| GET | /payments/summary | payment:read |
| GET | /payments/methods | payment:read |
| POST | /payments/methods | payment:create |
| PATCH | /payments/methods/:id | payment:create |
| DELETE | /payments/methods/:id | payment:create |

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
| GET | /reports/clinical | finance:read |
| GET | /reports/financial | finance:read |
| GET | /reports/operational | finance:read |
| GET | /reports/therapist/:id | finance:read |
| POST | /reports/export | finance:export |
| GET | /reports/exports/:exportId | finance:read |
| GET | /reports/exports/:exportId/download | finance:export |

Report detail endpoints accept ISO `startDate` and `endDate` query parameters. `/reports/patients` also accepts `memberStatus` and preferred `paymentMethod`; `/reports/payments` accepts recorded `paymentMethod` and payment `status`.

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
| POST | /portal/invoices/:id/pay | Redirect to payment |
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

## Testing

```bash
pnpm test          # run all tests
pnpm test:api      # API tests only
```

## Deployment

```bash
docker compose -f docker/docker-compose.yml up -d
```

## Key Design Decisions

- **RLS over application-level filtering**: Row-level security ensures data isolation even if a query omits tenantId.
- **Zod schemas in shared package**: Frontend and backend validate against the same schemas.
- **Therapist ownership enforcement**: At the service layer, not just route level — therapists can only access their own patients.
- **Hash-stored refresh tokens**: Refresh tokens are SHA-256 hashed before DB storage. The raw UUID is the bearer credential.
- **HIPAA-aware logging**: Audit logs store resource IDs, not PHI (names, diagnoses).

# Physiotherapy-Management-System
