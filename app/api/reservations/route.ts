import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createReservation,
  InsufficientStockError,
  StockNotFoundError,
} from "@/lib/reservation";
import { CreateReservationSchema } from "@/lib/schemas";

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
      await prisma.idempotencyRecord.upsert({
        where: { key: idempotencyKey },
        create: {
          key: idempotencyKey,
          response: { status, body: responseBody },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        update: {},
      });
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
