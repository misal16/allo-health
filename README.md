# Allo Health — Inventory Reservation Platform

A Next.js App Router application that implements inventory reservation for retail and healthcare bookings. It prevents double-booking by holding stock in a PENDING reservation state for 10 minutes, then either confirming or releasing the hold.

---

## Live Demo

Replace this with your deployed Vercel URL once the project is live.

---

## What It Does

- Lists products and stock availability per warehouse
- Creates reservations for a product/warehouse with quantity management
- Confirms reservations when payment succeeds
- Releases reservations early when cancelled
- Automatically expires pending reservations after 10 minutes
- Handles concurrent reservation attempts safely using PostgreSQL row locks

---

## Local Setup

### Prerequisites

- Node.js 18+
- Hosted Postgres database (Supabase, Neon, Railway, etc.)
- Vercel account for app deployment

### Environment variables

Copy `.env.example` to `.env.local` and fill in the values.

```bash
cp .env.example .env.local
```

Required variables:

- `DATABASE_URL` — hosted Postgres connection string
- `UPSTASH_REDIS_REST_URL` — Upstash REST URL for Redis
- `UPSTASH_REDIS_REST_TOKEN` — Upstash REST token for Redis
- `CRON_SECRET` — random secret used by the cron endpoint

### Install, migrate, and seed

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

### Run locally

```bash
npm run dev
```

Open `http://localhost:3000/products`.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products with available stock by warehouse |
| GET | `/api/warehouses` | List warehouses |
| POST | `/api/reservations` | Create a reservation, returns `409` if not enough stock |
| POST | `/api/reservations/:id/confirm` | Confirm a reservation, returns `410` if expired |
| POST | `/api/reservations/:id/release` | Cancel and release a reservation |
| GET | `/api/cron/expire-reservations` | Expire pending holds and release stock |

---

## Reservation expiry in production

Expiry is handled in two ways:

1. **Vercel Cron job** calls `/api/cron/expire-reservations` every minute and marks expired reservations as `EXPIRED`, releasing reserved stock.
2. **Lazy cleanup** runs in `GET /api/products` and the products page before reading stock, so availability stays accurate even between cron runs.

This keeps the system consistent without requiring a separate background worker.

---

## Concurrency protection

The reservation creation flow uses a PostgreSQL `SELECT ... FOR UPDATE` lock on the relevant `Stock` row within a Prisma transaction.

That means when two users try to reserve the same last unit at the same time:

1. The first request acquires the row lock and updates `reserved`.
2. The second request blocks until the first commits.
3. After unblocking, the second request re-checks availability and returns `409` if no stock remains.

This prevents double reservation of the same inventory unit.

---

## Idempotency

The app supports `Idempotency-Key` for:

- `POST /api/reservations`
- `POST /api/reservations/:id/confirm`

If the same key is reused, the server returns the cached response from the `IdempotencyRecord` table instead of repeating the side effect.

---

## Deployment notes

- `vercel.json` defines a cron job that runs every minute:
  - `path: /api/cron/expire-reservations`
  - `schedule: "* * * * *"`
- In Vercel, set `CRON_SECRET` as a project environment variable.
- If you want, configure the Cron job manually in the Vercel dashboard and pass the same secret header.

---

## Trade-offs

- No user authentication; this is focused on inventory reservation behavior.
- Payment is mocked by the confirm flow; no real payment gateway is integrated.
- Idempotency is implemented in Postgres rather than Redis to keep the data model simple and self-contained.
- Cron-based expiry is minute-granular, which is sufficient for the 10-minute reservation window.
