# Project Context — Allo Health Reservation System



---

## What Was Built

A Next.js 16 (App Router) + TypeScript full-stack application implementing a race-condition-safe inventory reservation system styled with the Allo Health brand design system.

**Problem solved:** When two customers simultaneously try to book the last available slot, exactly one succeeds (200) and the other gets a 409. This is enforced via `SELECT FOR UPDATE` inside a Prisma `$transaction`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6, App Router, TypeScript |
| Database | PostgreSQL via Supabase (hosted) |
| ORM | Prisma 7.8.0 + `@prisma/adapter-pg` (required in Prisma 7) |
| Redis | Upstash Redis (`@upstash/redis`) |
| Validation | Zod 4 |
| Styling | Tailwind CSS v4 (CSS `@theme` tokens, no tailwind.config.js) |
| Fonts | DM Sans + DM Serif Display (next/font/google) |
| Runtime TS | tsx (replaces ts-node for seed script) |

---

## Project Structure

```
allo-health/
├── app/
│   ├── globals.css              # Tailwind v4 @theme brand tokens
│   ├── layout.tsx               # DM Sans/DM Serif fonts, root layout
│   ├── page.tsx                 # Redirects to /products
│   ├── generated/prisma/        # Auto-generated Prisma client (gitignored)
│   ├── api/
│   │   ├── products/route.ts    # GET — list products with available stock
│   │   ├── warehouses/route.ts  # GET — list warehouses
│   │   ├── reservations/
│   │   │   ├── route.ts         # POST — create reservation (SELECT FOR UPDATE)
│   │   │   └── [id]/
│   │   │       ├── confirm/route.ts   # POST — confirm (410 if expired)
│   │   │       └── release/route.ts  # POST — early cancel
│   │   └── cron/
│   │       └── expire-reservations/route.ts  # GET — Vercel Cron batch expiry
│   ├── products/
│   │   └── page.tsx             # Server Component — hero strip + product grid
│   └── reservation/
│       └── [id]/
│           └── page.tsx         # Server Component — booking details + countdown
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx           # Sticky navy navbar, scroll shadow
│   │   └── Footer.tsx           # Dark footer
│   ├── products/
│   │   ├── ProductCard.tsx      # Card with stock badges + Reserve button
│   │   └── ProductsClient.tsx   # Client — warehouse filter tabs + grid
│   └── reservation/
│       ├── CountdownTimer.tsx   # Client — live countdown, red < 60s
│       ├── ReservationActions.tsx # Client — Confirm/Cancel, inline errors
│       └── ReservationClient.tsx  # Client wrapper (timer + actions)
├── lib/
│   ├── db.ts                    # Prisma singleton with PrismaPg adapter + SSL
│   ├── redis.ts                 # Upstash Redis singleton
│   ├── schemas.ts               # Zod schemas + shared DTO types
│   └── reservation.ts           # createReservation() — SELECT FOR UPDATE logic
├── prisma/
│   ├── schema.prisma            # Data model (5 models, 1 enum)
│   └── seed.ts                  # Seeds 5 products × 3 warehouse cities
├── prisma.config.ts             # Prisma 7 datasource config (reads DATABASE_URL)
├── vercel.json                  # Cron: /api/cron/expire-reservations every 1 min
├── .env                         # Prisma CLI reads this (dotenv/config in prisma.config.ts)
├── .env.local                   # Next.js app reads this at runtime
├── .env.example                 # Template for new contributors
└── CONTEXT.md                   # This file
```

---

## Data Model (prisma/schema.prisma)

```
Product     — id, name, description, price (Decimal), imageUrl, category
Warehouse   — id, name, city, address
Stock       — productId, warehouseId, total, reserved  [@@unique productId+warehouseId]
Reservation — id, productId, warehouseId, quantity, status, expiresAt, idempotencyKey
IdempotencyRecord — key (PK), response (Json), expiresAt
ReservationStatus enum: PENDING | CONFIRMED | RELEASED | EXPIRED
```

---

## Key Design Decisions

### Concurrency (core of the exercise)
`lib/reservation.ts` — `createReservation()` uses `SELECT FOR UPDATE` inside `prisma.$transaction()`:
1. Lock stock row for the product+warehouse
2. Check `total - reserved >= quantity`, else throw `InsufficientStockError` → 409
3. `UPDATE Stock SET reserved = reserved + quantity`
4. `INSERT INTO Reservation`
Two concurrent requests: second blocks on the lock, sees 0 available, returns 409.

### Reservation expiry
- **Vercel Cron** (vercel.json): calls `/api/cron/expire-reservations` every minute
- **Lazy expiry**: `GET /api/products` and `/products` page run a cleanup SQL before fetching stock, so counts are accurate between cron runs
- Protected by `CRON_SECRET` bearer token

### Idempotency (bonus)
- `POST /api/reservations` and `POST /api/reservations/:id/confirm` check `Idempotency-Key` header
- Check `IdempotencyRecord` table first; return cached response if found and not expired
- Store response with 24h TTL on success

### Prisma 7 specifics
- Client generated to `app/generated/prisma/client` (not `@prisma/client`)
- Requires `@prisma/adapter-pg` with a `pg.Pool` — cannot do `new PrismaClient()` without adapter
- Datasource URL in `prisma.config.ts`, not in `schema.prisma`

### Tailwind v4 specifics
- No `tailwind.config.ts` — all config in `app/globals.css` using `@theme {}` block
- Custom colors: `bg-navy`, `bg-cta`, `text-trust-green`, `bg-blue-tint`, etc.

---

## Environment Variables

```
# .env (Prisma CLI) and .env.local (Next.js app) both need:
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@POOLER_HOST:PORT/postgres"
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
CRON_SECRET="random-secret"
```

---

## Current Status (as of May 23, 2026)

###  Done
- Full project scaffolded, zero TypeScript errors
- All API routes implemented
- All UI components implemented (Navbar, Footer, ProductCard, ProductsClient, CountdownTimer, ReservationActions)
- Prisma schema written and client generated
- SSL added to `pg.Pool` in `lib/db.ts` and `prisma/seed.ts`
- Supabase project created (`bwggpqjqcwxfjeeoactt`, region: ap-south-1)
- Database tables created via Supabase SQL Editor (schema applied manually)
- Upstash Redis set up (URL and token in .env.local)

###  In Progress / Remaining
- **DATABASE_URL not yet working locally** — network blocks port 6543 (transaction pooler) and the direct connection (IPv6 only). Session pooler (port 5432) TCP is reachable but gives "tenant/user not found" error. Need to get the **exact session pooler URL** from Supabase dashboard (Settings → Database → Connection string → Session pooler).
- **Seed data not yet inserted** — use the INSERT SQL block in Supabase SQL Editor (provided separately), OR fix the local connection and run `npm run db:seed`.
- **App not yet running locally** — blocked by connection issue above.
- **Not yet deployed to Vercel**

### Next Steps (in order)
1. Fix DATABASE_URL: Supabase → Settings → Database → "Session pooler" → copy exact URI → replace password with `Misalomar%401216` → paste in `.env` and `.env.local`
2. Run `npm run db:seed` OR paste the seed INSERT SQL in Supabase SQL Editor
3. Run `npm run dev` → test at http://localhost:3000
4. Push to GitHub (`git add . && git commit -m "feat: initial implementation" && git push`)
5. Deploy to Vercel → set all 4 env vars in Vercel dashboard
6. Verify Cron Job appears in Vercel dashboard → Cron Jobs tab

---

## Seed Data

5 products × 3 warehouse cities:

| Product | Price | Category |
|---|---|---|
| Sexual Health Consultation | ₹199 | Consultation |
| Erectile Dysfunction Program | ₹499 | Treatment |
| STI Screening Package | ₹999 | Diagnostics |
| Relationship & Intimacy Therapy | ₹799 | Therapy |
| Women's Sexual Wellness | ₹299 | Consultation |

Warehouses: Mumbai (wh_mumbai), Delhi (wh_delhi), Bengaluru (wh_bengaluru)

---

## Brand Tokens (Tailwind v4 — app/globals.css)

```css
--color-navy: #1A3A5C          /* navbar, headings */
--color-deep-navy: #0F2540     /* hero bg, footer */
--color-cta: #F4622A           /* primary buttons ONLY */
--color-cta-hover: #D9521F
--color-trust-green: #2A9D5C   /* success states */
--color-trust-green-bg: #E8F5EC
--color-off-white: #F9F5F0     /* page bg */
--color-blue-tint: #EAF1FA     /* cards, info panels */
--color-body-text: #4A4A4A
--color-muted-text: #8C8C8C
--color-border-light: #E5E9EF
```

---
## Known Issues / Trade-offs

- No auth/login (out of scope)
- Mock payment — Confirm button simulates success; real impl would use Razorpay webhook
- Idempotency stored in Postgres (Redis-first would be faster but adds complexity)
- `prisma migrate dev` doesn't work via the pooler (advisory lock issue) — use `prisma db push` or apply SQL via Supabase SQL Editor
- `db.PROJECT_REF.supabase.co` (direct connection) doesn't resolve on this machine — project is IPv6-only without the Supabase IPv4 add-on
