"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, DollarSign } from "lucide-react";
import { CostBreakdown } from "../lib/types";

export default function CostDisplay({ costs }: { costs: CostBreakdown }) {
  const [expanded, setExpanded] = useState(false);

  const items = [
    { label: "YouTube API", value: costs.youtube, note: "free (quota-based)" },
    { label: "OpenRouter (Haiku)", value: costs.openrouterHaiku },
    { label: "OpenRouter (Sonnet)", value: costs.openrouterSonnet },
    { label: "Exa AI", value: costs.exa },
    { label: "Hunter.io", value: costs.hunter, note: "50 free/month" },
    { label: "Snov.io", value: costs.snov, note: "50 free/month" },
    { label: "NPI Registry", value: costs.npi, note: "always free" },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-gray-900">
            Total Cost: ${costs.total.toFixed(4)}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-1">
          {items.map((item) => (
            <div key={item.label} className="flex justify-between text-xs text-gray-600">
              <span>
                {item.label}
                {item.note && <span className="ml-1 text-gray-400">({item.note})</span>}
              </span>
              <span className="font-mono">${item.value.toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
