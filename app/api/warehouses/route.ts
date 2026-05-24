import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { city: "asc" },
      select: { id: true, name: true, city: true, address: true },
    });
    return NextResponse.json({ warehouses });
  } catch (err) {
    console.error("[GET /api/warehouses]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
