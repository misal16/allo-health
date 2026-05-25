import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";
import {
  createReservation,
  InsufficientStockError,
  StockNotFoundError,
} from "@/lib/reservation";
import { CreateReservationSchema } from "@/lib/schemas";

const IDENTITY_CACHE_TTL_SECONDS = 24 * 60 * 60;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request body
    const parsed = CreateReservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // ── Idempotency ────────────────────────────────────────────────────────
    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (idempotencyKey) {
      try {
        const cachedResponse = await redis.get<string>(`idempotency:${idempotencyKey}`);
        if (cachedResponse) {
          const parsed = JSON.parse(cachedResponse) as {
            status: number;
            body: unknown;
          };
          return NextResponse.json(parsed.body, { status: parsed.status });
        }
      } catch (redisError) {
        console.warn("Redis idempotency read failed:", redisError);
      }

      const existing = await prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      });
      if (existing && existing.expiresAt > new Date()) {
        const cached = existing.response as { status: number; body: unknown };
        return NextResponse.json(cached.body, { status: cached.status });
      }
    }

    // ── Core reservation (race-condition-safe via SELECT FOR UPDATE) ───────
    const reservation = await createReservation(productId, warehouseId, quantity);

    const responseBody = { reservation };
    const status = 201;

    // Persist idempotency record
    if (idempotencyKey) {
      const expiresAt = new Date(Date.now() + IDENTITY_CACHE_TTL_SECONDS * 1000);
      await prisma.idempotencyRecord.upsert({
        where: { key: idempotencyKey },
        create: {
          key: idempotencyKey,
          response: { status, body: responseBody },
          expiresAt,
        },
        update: {},
      });

      try {
        await redis.set(
          `idempotency:${idempotencyKey}`,
          JSON.stringify({ status, body: responseBody }),
          {
            ex: IDENTITY_CACHE_TTL_SECONDS,
          }
        );
      } catch (redisError) {
        console.warn("Redis idempotency write failed:", redisError);
      }
    }

    return NextResponse.json(responseBody, { status });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: err.message, code: "INSUFFICIENT_STOCK" },
        { status: 409 }
      );
    }
    if (err instanceof StockNotFoundError) {
      return NextResponse.json(
        { error: err.message, code: "STOCK_NOT_FOUND" },
        { status: 404 }
      );
    }
    console.error("[POST /api/reservations]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
