"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductDTO, StockDTO } from "@/lib/schemas";

const CATEGORY_ICONS: Record<string, string> = {
  Consultation: "🩺",
  Treatment: "💊",
  Diagnostics: "🔬",
  Therapy: "🧠",
};

type Props = {
  product: ProductDTO;
  selectedWarehouseId: string | null;
};

export default function ProductCard({ product, selectedWarehouseId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleStocks: StockDTO[] = selectedWarehouseId
    ? product.stocks.filter((s) => s.warehouseId === selectedWarehouseId)
    : product.stocks;

  const totalAvailable = visibleStocks.reduce((sum, s) => sum + s.available, 0);

  const getReserveTarget = (): StockDTO | null => {
    if (selectedWarehouseId) {
      return visibleStocks.find((s) => s.available > 0) ?? null;
    }
    return product.stocks.find((s) => s.available > 0) ?? null;
  };

  const handleReserve = async () => {
    const target = getReserveTarget();
    if (!target) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: target.warehouseId,
          quantity: 1,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError(data.error ?? "No stock available at this location.");
        return;
      }
      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        return;
      }

      router.push(`/reservation/${data.reservation.id}`);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const icon = CATEGORY_ICONS[product.category ?? ""] ?? "🏥";
  const reserveTarget = getReserveTarget();
  const isSoldOut = totalAvailable === 0;

  return (
    <article className="bg-white border border-allo-border rounded-xl overflow-hidden flex flex-col hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all duration-200">
      {/* Icon / header band */}
      <div className="bg-allo-bg-alt px-5 pt-5 pb-4 flex items-center gap-3">
        <div className="w-8 h-8 shrink-0 bg-white rounded-lg flex items-center justify-center text-lg shadow-sm">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-medium text-allo-text leading-snug truncate">
            {product.name}
          </h2>
          {product.category && (
            <span className="text-[11px] text-allo-text-muted">{product.category}</span>
          )}
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Description */}
        {product.description && (
          <p className="text-[14px] text-allo-text-muted leading-[1.55] line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Price row */}
        <div className="flex items-center gap-2">
          <span className="text-[20px] font-semibold text-allo-text">
            ₹{product.price}
          </span>
          <span className="text-[11px] font-medium bg-allo-accent-bg text-amber-800 px-2.5 py-0.5 rounded-full">
            per session
          </span>
        </div>

        {/* Stock per city */}
        <div className="space-y-1.5">
          {visibleStocks.map((s) => (
            <div key={s.warehouseId} className="flex items-center justify-between">
              <span className="text-[12px] text-allo-text-muted">{s.warehouseCity}</span>
              <StockBadge available={s.available} />
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <p
            role="alert"
            className="text-[12px] text-allo-error bg-red-50 border border-red-100 rounded-lg px-3 py-2"
          >
            {error}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* CTAs */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleReserve}
            disabled={!reserveTarget || loading || isSoldOut}
            aria-label={`Reserve ${product.name}`}
            className={`w-full py-2.5 px-4 rounded-lg text-[14px] font-medium transition-all duration-150 min-h-[44px] ${
              isSoldOut
                ? "bg-allo-border text-allo-text-muted cursor-not-allowed"
                : "bg-allo-text text-white hover:bg-allo-dark-2 active:scale-[0.97] cursor-pointer"
            }`}
          >
            {loading ? "Reserving…" : isSoldOut ? "Sold Out" : "Reserve Slot"}
          </button>

          <button
            aria-label={`View details for ${product.name}`}
            className="w-full py-2.5 px-4 rounded-lg text-[14px] font-medium border-[1.5px] border-allo-border-md text-allo-text hover:bg-allo-bg transition-all duration-150 cursor-pointer min-h-[44px]"
          >
            View Details
          </button>
        </div>

        {/* Learn more link */}
        <a
          href="#"
          className="text-[13px] font-medium text-allo-accent-dk hover:text-amber-600 transition-colors text-center"
        >
          Learn More →
        </a>
      </div>
    </article>
  );
}

function StockBadge({ available }: { available: number }) {
  if (available === 0) {
    return (
      <span className="text-[11px] font-medium text-allo-text-muted bg-allo-border px-2.5 py-0.5 rounded-full">
        Unavailable
      </span>
    );
  }
  if (available <= 3) {
    return (
      <span className="text-[11px] font-medium text-amber-800 bg-allo-accent-bg px-2.5 py-0.5 rounded-full">
        Only {available} left
      </span>
    );
  }
  return (
    <span className="text-[11px] font-medium text-allo-trust-text bg-allo-trust-bg px-2.5 py-0.5 rounded-full">
      {available} available
    </span>
  );
}
