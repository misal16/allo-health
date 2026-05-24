"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "PENDING" | "CONFIRMED" | "RELEASED" | "EXPIRED";

type Props = {
  reservationId: string;
  status: Status;
  isExpired: boolean; // passed from parent countdown
};

export default function ReservationActions({
  reservationId,
  status: initialStatus,
  isExpired,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [loading, setLoading] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveExpired = isExpired || status === "EXPIRED";

  const handleConfirm = async () => {
    setLoading("confirm");
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/confirm`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.status === 410) {
        setStatus("EXPIRED");
        setError(data.error ?? "Reservation has expired.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setStatus("CONFIRMED");
      router.refresh();
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    setLoading("cancel");
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/release`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not cancel the reservation.");
        return;
      }

      setStatus("RELEASED");
      router.refresh();
    } finally {
      setLoading(null);
    }
  };

  // ── Terminal states ────────────────────────────────────────────────────────
  if (status === "CONFIRMED") {
    return (
      <div className="rounded-xl bg-allo-trust-bg border border-allo-trust/30 p-5 text-center">
        <p className="text-2xl mb-1">✓</p>
        <p className="text-[16px] font-medium text-allo-trust">Booking confirmed!</p>
        <p className="text-[13px] text-allo-text-muted mt-1">
          A confirmation has been recorded. Our team will reach out shortly.
        </p>
        <a
          href="/products"
          className="inline-block mt-4 text-[13px] text-allo-text font-medium hover:underline"
        >
          ← Back to services
        </a>
      </div>
    );
  }

  if (status === "RELEASED") {
    return (
      <div className="rounded-xl bg-allo-bg-alt border border-allo-border p-5 text-center">
        <p className="text-[15px] font-medium text-allo-text">Booking cancelled</p>
        <p className="text-[13px] text-allo-text-muted mt-1">
          Your hold has been released. The slot is now available to others.
        </p>
        <a
          href="/products"
          className="inline-block mt-4 text-[13px] text-allo-text font-medium hover:underline"
        >
          ← Browse other services
        </a>
      </div>
    );
  }

  if (effectiveExpired) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-5 text-center">
        <p className="text-[15px] font-medium text-red-700">Reservation expired</p>
        <p className="text-[13px] text-red-600/80 mt-1">
          The 10-minute hold has passed. The slot has been returned to inventory.
        </p>
        <a
          href="/products"
          className="inline-block mt-4 text-[13px] text-allo-text font-medium hover:underline"
        >
          ← Find another slot
        </a>
      </div>
    );
  }

  // ── Active PENDING state ──────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-700"
        >
          {error}
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={loading !== null}
        className="w-full py-3 px-5 bg-allo-text hover:bg-allo-dark-2 disabled:bg-allo-border disabled:text-allo-text-muted text-white font-medium text-[15px] rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed min-h-[44px]"
      >
        {loading === "confirm" ? "Processing…" : "Confirm Purchase"}
      </button>

      <button
        onClick={handleCancel}
        disabled={loading !== null}
        className="w-full py-2.5 px-5 border-[1.5px] border-allo-border-md text-allo-text font-medium text-[14px] rounded-lg hover:bg-allo-bg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
      >
        {loading === "cancel" ? "Cancelling…" : "Cancel"}
      </button>
    </div>
  );
}
