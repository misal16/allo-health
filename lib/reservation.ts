/**
 * Core reservation logic with race-condition-safe stock management.
 *
 * Strategy: PostgreSQL SELECT FOR UPDATE inside a Prisma interactive transaction.
 * When two concurrent requests arrive for the last unit of a SKU:
 *  1. Both start a transaction.
 *  2. Both attempt SELECT ... FOR UPDATE on the same stock row.
 *  3. PostgreSQL serialises access — the second request BLOCKS until the first commits.
 *  4. First: sees available ≥ quantity → increments reserved → creates reservation → COMMITS.
 *  5. Second: unblocks, sees available = 0 → throws InsufficientStockError → ROLLBACKS → 409.
 */

import { prisma } from "./db";
import type { Prisma } from "@/app/generated/prisma/client";
import type { ReservationDTO } from "./schemas";

export class InsufficientStockError extends Error {
  constructor() {
    super("Not enough stock available at this location");
    this.name = "InsufficientStockError";
  }
}

export class StockNotFoundError extends Error {
  constructor() {
    super("No stock record found for this product/warehouse combination");
    this.name = "StockNotFoundError";
  }
}

type StockRow = {
  id: string;
  total: number;
  reserved: number;
  productId: string;
  warehouseId: string;
};

export async function createReservation(
  productId: string,
  warehouseId: string,
  quantity: number
): Promise<ReservationDTO> {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const reservation = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // ── 1. Lock the stock row for this product+warehouse ──────────────────
      // SELECT FOR UPDATE acquires a row-level lock. Any concurrent transaction
      // attempting the same will block here until we commit or roll back.
      const stocks = await tx.$queryRaw<StockRow[]>`
        SELECT id, total, reserved, "productId", "warehouseId"
        FROM "Stock"
        WHERE "productId" = ${productId}
          AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      const stock = stocks[0];
      if (!stock) throw new StockNotFoundError();

      // ── 2. Check availability ─────────────────────────────────────────────
      const available = stock.total - stock.reserved;
      if (available < quantity) throw new InsufficientStockError();

      // ── 3. Increment reserved count ───────────────────────────────────────
      await tx.$executeRaw`
        UPDATE "Stock"
        SET    reserved  = reserved + ${quantity},
               "updatedAt" = NOW()
        WHERE  "productId"   = ${productId}
          AND  "warehouseId" = ${warehouseId}
      `;

      // ── 4. Create the reservation (ORM is safe here — we hold the lock) ───
      const res = await tx.reservation.create({
        data: { productId, warehouseId, quantity, status: "PENDING", expiresAt },
        include: {
          product: { select: { id: true, name: true, price: true, category: true, description: true } },
          warehouse: { select: { id: true, name: true, city: true } },
        },
      });

      return res;
    },
    {
      // Serializable isolation is not required here — the FOR UPDATE lock on the
      // stock row is sufficient to prevent double-spending under READ COMMITTED.
      timeout: 8000,
    }
  );

  return {
    id: reservation.id,
    productId: reservation.productId,
    warehouseId: reservation.warehouseId,
    quantity: reservation.quantity,
    status: reservation.status as ReservationDTO["status"],
    expiresAt: reservation.expiresAt.toISOString(),
    createdAt: reservation.createdAt.toISOString(),
    product: {
      ...reservation.product,
      price: reservation.product.price.toString(),
    },
    warehouse: reservation.warehouse,
  };
}
