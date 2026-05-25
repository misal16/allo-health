import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const isVercelCron = req.headers.has("x-vercel-cron") || req.headers.has("x-vercel-cron-job");

  if (
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    !isVercelCron
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all expired PENDING reservations
    const expired = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      select: { id: true, productId: true, warehouseId: true, quantity: true },
    });

    if (expired.length === 0) {
      return NextResponse.json({ released: 0 });
    }

    // Release each: decrement reserved, mark EXPIRED
    await prisma.$transaction(
      expired.flatMap((r) => [
        prisma.$executeRaw`
          UPDATE "Stock"
          SET    reserved    = GREATEST(0, reserved - ${r.quantity}),
                 "updatedAt" = NOW()
          WHERE  "productId"   = ${r.productId}
            AND  "warehouseId" = ${r.warehouseId}
        `,
        prisma.reservation.update({
          where: { id: r.id },
          data: { status: "EXPIRED" },
        }),
      ])
    );

    console.log(`[cron] Released ${expired.length} expired reservations`);
    return NextResponse.json({ released: expired.length });
  } catch (err) {
    console.error("[GET /api/cron/expire-reservations]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
