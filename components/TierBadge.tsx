"use client";

import { VerificationTier } from "../lib/types";

const TIER_STYLES: Record<VerificationTier, { bg: string; text: string; label: string }> = {
  gold: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Gold" },
  silver: { bg: "bg-gray-100", text: "text-gray-700", label: "Silver" },
  bronze: { bg: "bg-orange-100", text: "text-orange-700", label: "Bronze" },
};

export default function TierBadge({ tier }: { tier: VerificationTier }) {
  const style = TIER_STYLES[tier];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}
