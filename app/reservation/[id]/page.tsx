import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ReservationClient from "@/components/reservation/ReservationClient";
import type { ReservationDTO } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await prisma.reservation.findUnique({
    where: { id },
    select: { product: { select: { name: true } } },
  });
  return {
    title: res ? `${res.product.name} – Reservation | Allo Health` : "Reservation",
  };
}

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const res = await prisma.reservation.findUnique({
    where: { id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          category: true,
          description: true,
        },
      },
      warehouse: { select: { id: true, name: true, city: true } },
    },
  });

  if (!res) notFound();

  const reservation: ReservationDTO = {
    id: res.id,
    productId: res.productId,
    warehouseId: res.warehouseId,
    quantity: res.quantity,
    status: res.status as ReservationDTO["status"],
    expiresAt: res.expiresAt.toISOString(),
    createdAt: res.createdAt.toISOString(),
    product: {
      ...res.product,
      price: res.product.price.toString(),
    },
    warehouse: res.warehouse,
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-allo-accent-bg text-amber-800 border-amber-200",
    CONFIRMED: "bg-allo-trust-bg text-allo-trust-text border-allo-trust/30",
    RELEASED: "bg-allo-bg-alt text-allo-text-muted border-allo-border",
    EXPIRED: "bg-red-50 text-red-600 border-red-200",
  };

  const CATEGORY_ICONS: Record<string, string> = {
    Consultation: "🩺",
    Treatment: "💊",
    Diagnostics: "🔬",
    Therapy: "🧠",
  };

  const icon = CATEGORY_ICONS[reservation.product.category ?? ""] ?? "🏥";

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Hero strip */}
      <div className="bg-allo-dark py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <a
            href="/products"
            className="text-[13px] text-white/60 hover:text-white/90 transition-colors"
          >
            ← Back to services
          </a>
          <h1 className="mt-2 text-2xl font-semibold text-white">
            Complete your booking
          </h1>
        </div>
      </div>

      <main className="flex-1 bg-allo-bg py-8 sm:py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-5">
          {/* Reservation details card */}
          <div className="bg-white border border-allo-border rounded-xl p-5">
            {/* Status badge */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-allo-bg-alt rounded-lg flex items-center justify-center text-lg shrink-0">
                  {icon}
                </div>
                <div>
                  <h2 className="text-[16px] font-medium text-allo-text leading-snug">
                    {reservation.product.name}
                  </h2>
                  {reservation.product.category && (
                    <p className="text-[12px] text-allo-text-muted mt-0.5">
                      {reservation.product.category}
                    </p>
                  )}
                </div>
              </div>
              <span
                className={`text-[11px] font-medium border px-2.5 py-1 rounded-full shrink-0 ${
                  statusColors[reservation.status] ?? ""
                }`}
              >
                {reservation.status}
              </span>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 bg-allo-bg rounded-lg p-4 text-[13px]">
              <div>
                <p className="text-allo-text-muted text-[11px] mb-0.5">City</p>
                <p className="font-medium text-allo-text">{reservation.warehouse.city}</p>
              </div>
              <div>
                <p className="text-allo-text-muted text-[11px] mb-0.5">Clinic</p>
                <p className="font-medium text-allo-text">{reservation.warehouse.name}</p>
              </div>
              <div>
                <p className="text-allo-text-muted text-[11px] mb-0.5">Quantity</p>
                <p className="font-medium text-allo-text">{reservation.quantity}</p>
              </div>
              <div>
                <p className="text-allo-text-muted text-[11px] mb-0.5">Amount</p>
                <p className="text-[16px] font-semibold text-allo-text">
                  ₹{reservation.product.price}
                </p>
              </div>
            </div>

            {/* Booking ID */}
            <p className="mt-3 text-[11px] text-allo-text-muted font-mono">
              Booking #{reservation.id.slice(-8).toUpperCase()}
            </p>
          </div>

          {/* Countdown + actions (client) */}
          <ReservationClient reservation={reservation} />

          {/* Trust note */}
          <p className="text-center text-[12px] text-allo-text-muted">
            🔒 Secure checkout &nbsp;·&nbsp; 100% confidential &nbsp;·&nbsp; Licensed MDs only
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
