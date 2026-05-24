"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  expiresAt: string; // ISO string
  onExpired?: () => void;
};

export default function CountdownTimer({ expiresAt, onExpired }: Props) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpiredRef.current?.();
      return;
    }
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpiredRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft <= 60 && secondsLeft > 0;
  const isExpired = secondsLeft === 0;

  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl p-5 ${
        isExpired
          ? "bg-red-50 border border-red-200"
          : isUrgent
          ? "bg-allo-accent-bg border border-amber-200"
          : "bg-allo-bg-alt border border-allo-border"
      }`}
    >
      <p
        className={`text-[12px] font-medium uppercase tracking-wide ${
          isExpired ? "text-red-600" : isUrgent ? "text-amber-800" : "text-allo-text-muted"
        }`}
      >
        {isExpired ? "Hold expired" : "Hold expires in"}
      </p>

      {isExpired ? (
        <p className="text-[28px] font-semibold text-red-600 font-mono">—</p>
      ) : (
        <p
          className={`text-[42px] font-semibold tabular-nums leading-none font-mono ${
            isUrgent ? "text-amber-800" : "text-allo-text"
          }`}
          aria-live="polite"
          aria-label={`${minutes} minutes and ${seconds} seconds remaining`}
        >
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </p>
      )}

      {!isExpired && (
        <p
          className={`text-[11px] text-center ${
            isUrgent ? "text-amber-800/70" : "text-allo-text-muted"
          }`}
        >
          {isUrgent
            ? "Less than a minute — confirm now!"
            : "Your slot is reserved. Complete payment before time runs out."}
        </p>
      )}
    </div>
  );
}
