"use client";

import { useState } from "react";
import CountdownTimer from "@/components/reservation/CountdownTimer";
import ReservationActions from "@/components/reservation/ReservationActions";
import type { ReservationDTO } from "@/lib/schemas";

export default function ReservationClient({
  reservation,
}: {
  reservation: ReservationDTO;
}) {
  const [isExpired, setIsExpired] = useState(
    new Date(reservation.expiresAt) < new Date()
  );

  const isPending = reservation.status === "PENDING";

  return (
    <div className="space-y-5">
      {isPending && (
        <CountdownTimer
          expiresAt={reservation.expiresAt}
          onExpired={() => setIsExpired(true)}
        />
      )}
      <ReservationActions
        reservationId={reservation.id}
        status={reservation.status}
        isExpired={isExpired}
      />
    </div>
  );
}
