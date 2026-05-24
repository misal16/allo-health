import { prisma } from "@/lib/db";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductsClient from "@/components/products/ProductsClient";
import type { ProductDTO, WarehouseDTO } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Available Consultations – Allo Health",
  description:
    "Book a sexual health consultation with a certified MD. 100% discreet, ₹199 onwards.",
};

async function getData(): Promise<{ products: ProductDTO[]; warehouses: WarehouseDTO[] }> {
  // Lazy expiry: mark PENDING reservations past their expiresAt as EXPIRED
  // and release their reserved stock. This runs before fetching to ensure
  // accurate availability counts even between cron runs.
  try {
    await prisma.$executeRaw`
      UPDATE "Stock" s
      SET    reserved    = GREATEST(0, s.reserved - sub.qty),
             "updatedAt" = NOW()
      FROM (
        SELECT "warehouseId", "productId", SUM(quantity)::int AS qty
        FROM   "Reservation"
        WHERE  status    = 'PENDING'::"ReservationStatus"
          AND  "expiresAt" < NOW()
        GROUP BY "warehouseId", "productId"
      ) sub
      WHERE s."productId"   = sub."productId"
        AND s."warehouseId" = sub."warehouseId"
    `;

    await prisma.$executeRaw`
      UPDATE "Reservation"
      SET    status      = 'EXPIRED'::"ReservationStatus",
             "updatedAt" = NOW()
      WHERE  status    = 'PENDING'::"ReservationStatus"
        AND  "expiresAt" < NOW()
    `;
  } catch (e) {
    // Non-fatal: cron will catch up
    console.warn("[products page] lazy expiry failed:", e);
  }

  const [rawProducts, rawWarehouses] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        stocks: {
          include: { warehouse: { select: { id: true, name: true, city: true } } },
        },
      },
    }),
    prisma.warehouse.findMany({ orderBy: { city: "asc" } }),
  ]);

  const products: ProductDTO[] = rawProducts.map((p) => ({
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

  const warehouses: WarehouseDTO[] = rawWarehouses.map((w) => ({
    id: w.id,
    name: w.name,
    city: w.city,
    address: w.address,
  }));

  return { products, warehouses };
}

export default async function ProductsPage() {
  const { products, warehouses } = await getData();

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Hero — dark with amber radial glow */}
      <div
        className="bg-allo-dark py-16 sm:py-20"
        style={{
          background:
            "radial-gradient(circle at 75% 20%, rgba(250,204,21,0.22) 0%, transparent 55%), #0F172A",
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6">
          {/* Eyebrow chip */}
          <div className="inline-flex items-center gap-1.5 bg-allo-accent/[0.12] text-allo-accent text-[12px] font-medium px-3 py-1 rounded-full tracking-[0.05em] mb-5">
            India&apos;s #1 Sexual Health Provider
          </div>

          <h1 className="text-[36px] sm:text-[48px] font-semibold text-white leading-[1.2] mb-4 max-w-[580px]">
            Available Consultations
          </h1>
          <p className="text-[16px] text-white/55 max-w-[460px] mb-8 leading-[1.65]">
            Speak with certified MDs, 100% discreet. Book a slot in seconds —
            starting at ₹199.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 mb-10">
            <a
              href="#services"
              className="bg-white text-allo-text text-[14px] font-medium px-6 py-2.5 rounded-lg hover:bg-white/90 active:scale-[0.97] transition-all duration-150"
            >
              Browse Services
            </a>
            <a
              href="#how-it-works"
              className="bg-white/[0.08] text-white text-[14px] font-medium px-6 py-2.5 rounded-lg border border-white/20 hover:bg-white/[0.12] transition-all duration-150"
            >
              How It Works
            </a>
          </div>

          {/* Trust pills */}
          <div className="flex flex-wrap gap-2">
            {[
              "✓ 100% Discreet",
              "✓ Licensed MDs",
              "✓ 50,000+ Patients",
              "✓ No Judgement",
            ].map((pill) => (
              <span
                key={pill}
                className="text-[11px] text-white/65 bg-white/[0.06] border border-white/[0.12] px-3 py-1 rounded-full"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="bg-white border-b border-allo-border">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex flex-wrap gap-x-8 gap-y-2 items-center justify-center sm:justify-start">
          {[
            { stat: "4,00,000+", label: "Patients treated" },
            { stat: "4.8★", label: "Average rating" },
            { stat: "50+", label: "Cities covered" },
            { stat: "₹199", label: "Starts at" },
          ].map(({ stat, label }) => (
            <div key={stat} className="flex items-baseline gap-1.5">
              <span className="text-[18px] font-bold text-allo-text font-mono">
                {stat}
              </span>
              <span className="text-[12px] text-allo-text-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Products + city filter (client) */}
      <ProductsClient products={products} warehouses={warehouses} />

      <Footer />
    </div>
  );
}
