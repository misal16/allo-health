import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({ where: { id } });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (reservation.status !== "PENDING") {
      return NextResponse.json(
        { error: `Cannot release a reservation with status: ${reservation.status}` },
        { status: 409 }
      );
    }

    // Release: decrement reserved count, set status RELEASED
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
        data: { status: "RELEASED" },
      }),
    ]);

    return NextResponse.json({ success: true, status: "RELEASED" });
  } catch (err) {
    console.error("[POST /api/reservations/:id/release]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
