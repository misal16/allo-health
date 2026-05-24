import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ProductDTO } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Lazily release any expired PENDING reservations so available counts are accurate
    await prisma.$executeRaw`
      UPDATE "Stock" s
      SET    reserved  = GREATEST(0, s.reserved - sub.qty),
             "updatedAt" = NOW()
      FROM (
        SELECT "warehouseId", "productId", SUM(quantity) AS qty
        FROM   "Reservation"
        WHERE  status = 'PENDING'::"ReservationStatus"
          AND  "expiresAt" < NOW()
        GROUP BY "warehouseId", "productId"
      ) sub
      WHERE s."productId"   = sub."productId"
        AND s."warehouseId" = sub."warehouseId"
    `;

    await prisma.$executeRaw`
      UPDATE "Reservation"
      SET    status    = 'EXPIRED'::"ReservationStatus",
             "updatedAt" = NOW()
      WHERE  status    = 'PENDING'::"ReservationStatus"
        AND  "expiresAt" < NOW()
    `;

    const products = await prisma.product.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        stocks: {
          include: {
            warehouse: { select: { id: true, name: true, city: true } },
          },
        },
      },
    });

    const data: ProductDTO[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price.toString(),
      category: p.category,
      imageUrl: p.imageUrl,
      stocks: p.stocks.map((s) => ({
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        warehouseCity: s.warehouse.city,
        total: s.total,
        reserved: s.reserved,
        available: Math.max(0, s.total - s.reserved),
      })),
    }));

    return NextResponse.json({ products: data });
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
