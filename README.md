# Inventory Reservation System

Production-grade inventory reservation system for e-commerce checkout, built with Next.js 15 App Router, TypeScript, Prisma ORM, and Supabase PostgreSQL.

The system prevents overselling under concurrency by combining PostgreSQL row locks (`SELECT ... FOR UPDATE`) with Prisma interactive transactions.

## 1. Project Overview

### Core workflow
1. User reserves stock during checkout.
2. Reservation is created as `PENDING` with a 10-minute expiry.
3. If payment succeeds: reservation is confirmed and stock is finalized.
4. If payment fails or expires: reservation is released and stock becomes available.

### Critical guarantee
If two users reserve the last unit at the same time, exactly one reservation succeeds and the other receives HTTP `409`.

## 2. Architecture Decisions

- Framework: Next.js 15 App Router + Route Handlers.
- Database: Supabase PostgreSQL (no SQLite).
- ORM: Prisma.
- Validation: Zod on API input and client-side reservation input.
- UI: Tailwind CSS + shadcn/ui-style component architecture.
- Data fetching: React Query for polling and mutation lifecycle.

### Structure
- `src/app` routes, pages, API handlers
- `src/components` UI and feature components
- `src/lib/prisma.ts` Prisma singleton
- `src/lib/reservations/service.ts` transactional reservation logic
- `src/lib/validations` shared Zod schemas
- `src/hooks` client hooks (countdown)
- `src/types` API view models
- `prisma/schema.prisma` data model
- `prisma/seed.ts` demo data

## 3. Concurrency Strategy

Reservation creation (`POST /api/reservations`) uses this algorithm inside a single transaction:

1. Start interactive transaction.
2. Lock target `Inventory` row with `SELECT ... FOR UPDATE`.
3. Compute `available = totalUnits - reservedUnits`.
4. If unavailable, throw conflict (`409`).
5. If available, increment `reservedUnits` and create reservation.
6. Commit.

Because the row is locked, concurrent requests serialize on that inventory row, preventing double reservation.

## 4. Why `SELECT FOR UPDATE` Was Used

Prisma does not provide a high-level API for per-row pessimistic locking in this pattern. We use `tx.$queryRaw` with `FOR UPDATE` to explicitly lock rows during critical inventory transitions.

This ensures correctness for:
- Reserve (`PENDING`)
- Confirm (`CONFIRMED`)
- Release (`RELEASED`)
- Cron expiry cleanup

## 5. Expiry Cleanup Strategy

Reservations expire after 10 minutes.

### Lazy cleanup
- During confirm flow, if reservation is expired, it is released in the same transaction and `410` is returned.

### Scheduled cleanup
- `POST /api/cron/release-expired` finds expired pending reservations.
- Each reservation is released transactionally:
  - decrement `reservedUnits`
  - set status `RELEASED`
- Vercel cron calls this endpoint every minute (`vercel.json`).

## 6. Tradeoffs

- `Serializable` isolation gives stronger consistency but may reduce throughput under heavy contention.
- Polling-based UI refresh is simple and robust, but less efficient than WebSockets.
- Idempotency is supported on reserve endpoint using optional `Idempotency-Key`; confirm/release are idempotent by reservation state transitions.

## 7. Local Setup

### Prerequisites
- Node.js 20+
- Supabase project and PostgreSQL connection string

### Install
```bash
npm install
```

### Environment
Create `.env` from `.env.example`:

```env
DATABASE_URL="postgresql://..."
CRON_SECRET="your-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Prisma
```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

### Run app
```bash
npm run dev
```

## 8. Environment Variables

- `DATABASE_URL`: Supabase Postgres connection string.
- `CRON_SECRET`: Bearer token used by `/api/cron/release-expired`.
- `NEXT_PUBLIC_APP_URL`: app base URL (useful for deployment docs and references).

## 9. Prisma Migration Steps

1. Update `prisma/schema.prisma`.
2. Run migration:
```bash
npm run prisma:migrate -- --name <change-name>
```
3. Regenerate client:
```bash
npm run prisma:generate
```
4. Deploy migrations in production:
```bash
npx prisma migrate deploy
```

## 10. Deployment Steps (Vercel + Supabase)

1. Push repository to GitHub.
2. Import project in Vercel.
3. Set environment variables in Vercel:
- `DATABASE_URL`
- `CRON_SECRET`
- `NEXT_PUBLIC_APP_URL`
4. Ensure Prisma migrations are applied to production DB:
- either in CI/CD (`prisma migrate deploy`) or one-time release step.
5. Deploy.
6. Verify cron route auth:
- cron must call `POST /api/cron/release-expired` with `Authorization: Bearer <CRON_SECRET>`.

## 11. API Summary

- `GET /api/products`
  - returns products + inventory by warehouse + computed available units
- `GET /api/warehouses`
  - returns all warehouses
- `POST /api/reservations`
  - body: `{ productId, warehouseId, quantity }`
  - creates `PENDING` reservation expiring in 10 minutes
  - returns `409` for insufficient inventory
- `GET /api/reservations/:id`
  - returns reservation details for checkout polling
- `POST /api/reservations/:id/confirm`
  - confirms reservation, decrements `totalUnits` and `reservedUnits`
  - returns `410` if expired
- `POST /api/reservations/:id/release`
  - idempotently releases pending reservation
- `POST /api/cron/release-expired`
  - releases all expired pending reservations (requires bearer auth)

## 12. Future Improvements

- Dedicated idempotency records table for cross-endpoint replay guarantees.
- Retry policy for serialization failures (`P2034`) under extreme contention.
- Observability: structured logs + traces + reservation metrics.
- Optional optimistic UI with rollback.
- WebSocket updates for near-real-time reservation status.
