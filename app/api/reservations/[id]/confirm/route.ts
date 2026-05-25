import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";

const IDENTITY_CACHE_TTL_SECONDS = 24 * 60 * 60;

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ── Idempotency ─────────────────────────────────────────────────────────
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

    // ── Fetch and validate reservation ──────────────────────────────────────
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, price: true, category: true, description: true } },
        warehouse: { select: { id: true, name: true, city: true } },
      },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (reservation.status !== "PENDING") {
      const statusMessages: Record<string, string> = {
        CONFIRMED: "Reservation is already confirmed",
        RELEASED: "Reservation has already been released",
        EXPIRED: "Reservation has expired",
      };
      const status = reservation.status === "RELEASED" || reservation.status === "EXPIRED" ? 410 : 409;
      return NextResponse.json(
        { error: statusMessages[reservation.status] ?? "Cannot confirm reservation", code: reservation.status },
        { status }
      );
    }

    // ── Check expiry ──────────────────────────────────────────────────────
    if (reservation.expiresAt < new Date()) {
      // Release the hold and mark expired
      await prisma.$transaction([
        prisma.$executeRaw`
          UPDATE "Stock"
          SET    reserved    = GREATEST(0, reserved - ${reservation.quantity}),
                 "updatedAt" = NOW()
          WHERE  "productId"   = ${reservation.productId}
            AND  "warehouseId" = ${reservation.warehouseId}
        `,
        prisma.reservation.update({
          where: { id },
          data: { status: "EXPIRED" },
        }),
      ]);

      const responseBody = {
        error: "Reservation has expired — the hold has been released",
        code: "RESERVATION_EXPIRED",
      };
      if (idempotencyKey) {
        const expiresAt = new Date(Date.now() + IDENTITY_CACHE_TTL_SECONDS * 1000);
        await prisma.idempotencyRecord.upsert({
          where: { key: idempotencyKey },
          create: {
            key: idempotencyKey,
            response: { status: 410, body: responseBody },
            expiresAt,
          },
          update: {},
        });

        try {
          await redis.set(
            `idempotency:${idempotencyKey}`,
            JSON.stringify({ status: 410, body: responseBody }),
            { ex: IDENTITY_CACHE_TTL_SECONDS }
          );
        } catch (redisError) {
          console.warn("Redis idempotency write failed:", redisError);
        }
      }
      return NextResponse.json(responseBody, { status: 410 });
    }

    // ── Confirm: decrement total stock permanently, clear reserved hold ───
    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE "Stock"
        SET    total      = total - ${reservation.quantity},
               reserved   = GREATEST(0, reserved - ${reservation.quantity}),
               "updatedAt" = NOW()
        WHERE  "productId"   = ${reservation.productId}
          AND  "warehouseId" = ${reservation.warehouseId}
      `,
      prisma.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
      }),
    ]);

    const confirmed = await prisma.reservation.findUniqueOrThrow({
      where: { id },
      include: {
        product: { select: { id: true, name: true, price: true, category: true, description: true } },
        warehouse: { select: { id: true, name: true, city: true } },
      },
    });

    const responseBody = {
      reservation: {
        ...confirmed,
        expiresAt: confirmed.expiresAt.toISOString(),
        createdAt: confirmed.createdAt.toISOString(),
        updatedAt: confirmed.updatedAt.toISOString(),
        product: { ...confirmed.product, price: confirmed.product.price.toString() },
      },
    };

    if (idempotencyKey) {
      const expiresAt = new Date(Date.now() + IDENTITY_CACHE_TTL_SECONDS * 1000);
      await prisma.idempotencyRecord.upsert({
        where: { key: idempotencyKey },
        create: {
          key: idempotencyKey,
          response: { status: 200, body: responseBody },
          expiresAt,
        },
        update: {},
      });

      try {
        await redis.set(
          `idempotency:${idempotencyKey}`,
          JSON.stringify({ status: 200, body: responseBody }),
          { ex: IDENTITY_CACHE_TTL_SECONDS }
        );
      } catch (redisError) {
        console.warn("Redis idempotency write failed:", redisError);
      }
    }

    return NextResponse.json(responseBody);
  } catch (err) {
    console.error("[POST /api/reservations/:id/confirm]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
