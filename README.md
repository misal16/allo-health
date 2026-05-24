# Allo Health � Inventory & Reservation System

Live demo: **[your-app.vercel.app](https://your-app.vercel.app)** 

---

## What It Does

A Next.js 16 App Router application that handles inventory reservation for health consultation slots across multiple clinic locations (warehouses). The core challenge � preventing two customers from booking the same last available slot � is solved at the database level with `SELECT FOR UPDATE`.

---

## Local Setup

### 1. Prerequisites

- Node.js 18+
- A **Supabase** or **Neon** Postgres instance (free tier works)
- An **Upstash Redis** instance (free tier works)

### 2. Provision Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings ? Database ? Connection string**
3. Copy the **Transaction mode** URL (port 6543) ? DATABASE_URL
4. Copy the **Session mode** URL (port 5432) ? DIRECT_URL

### 3. Provision Upstash Redis

1. Create a database at [upstash.com](https://upstash.com)
2. Copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from the console

### 4. Environment variables

```bash
cp .env.example .env.local
# Fill in DATABASE_URL, DIRECT_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, CRON_SECRET
```

### 5. Install, migrate, seed

```bash
npm install
npx prisma generate          # generates Prisma client to app/generated/prisma/
npx prisma migrate dev       # runs migrations
npm run db:seed              # seeds 5 products x 3 warehouse cities
```

### 6. Run

```bash
npm run dev   # -> http://localhost:3000 (redirects to /products)
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/products | List products with available stock per warehouse |
| GET | /api/warehouses | List all warehouse/city locations |
| POST | /api/reservations | Reserve a slot - returns 409 if no stock |
| POST | /api/reservations/:id/confirm | Confirm (payment success) - returns 410 if expired |
| POST | /api/reservations/:id/release | Release early (cancel / payment failed) |
| GET | /api/cron/expire-reservations | Batch-release expired holds (Vercel Cron) |

---

## How Concurrency Is Guaranteed

The reservation endpoint uses SELECT FOR UPDATE inside a Prisma interactive transaction:

BEGIN
  SELECT id, total, reserved FROM "Stock"
  WHERE "productId" = $1 AND "warehouseId" = $2
  FOR UPDATE   <- acquires row-level lock

  IF (total - reserved) < qty -> ROLLBACK -> 409
  UPDATE "Stock" SET reserved = reserved + qty
  INSERT INTO "Reservation" (...)
COMMIT

When two concurrent requests target the same last unit:
1. Both hit FOR UPDATE - PostgreSQL serialises them at the row level.
2. The first transaction proceeds, increments reserved, commits.
3. The second transaction unblocks, sees available = 0, throws InsufficientStockError -> 409.

---

## Reservation Expiry

Vercel Cron (vercel.json) calls GET /api/cron/expire-reservations every minute.
Additionally, GET /api/products and the products page run lazy expiry SQL before fetching
stock, so availability is accurate even between cron runs.

---

## Idempotency (Bonus)

POST /api/reservations and POST /api/reservations/:id/confirm support Idempotency-Key header.
Server checks IdempotencyRecord table before processing. Matching non-expired record returns
the cached response without repeating the side effect. Records expire after 24 hours.

---

## Trade-offs

- No authentication (out of scope per brief)
- Mock payment (Confirm button simulates payment success; real impl uses Razorpay webhook)
- Idempotency in Postgres (Redis-first would be faster)
- Cron min granularity is 1 minute (sub-minute needs Postgres LISTEN/NOTIFY + worker)
