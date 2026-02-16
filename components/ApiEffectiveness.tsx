"use client";

import { SourceStats } from "../lib/types";

export default function ApiEffectiveness({ sourceStats }: { sourceStats: SourceStats }) {
  const { apiEffectiveness, emailSources, linkedinSources, doximitySources, phoneSources } = sourceStats;

  return (
    <div className="space-y-4">
      {/* API Hit Rates */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">API Effectiveness</h3>
        <div className="space-y-3">
          {apiEffectiveness
            .filter((api) => api.searched > 0)
            .map((api) => (
              <div key={api.provider}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-gray-700">{api.provider}</span>
                  <span className="text-gray-500">
                    {api.found}/{api.searched} ({api.hitRate}%)
                    {api.costPerSuccess > 0 && ` — $${api.costPerSuccess.toFixed(4)}/hit`}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-100">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      api.hitRate >= 50 ? "bg-green-500" :
                      api.hitRate >= 20 ? "bg-yellow-500" :
                      api.hitRate > 0 ? "bg-orange-500" : "bg-red-300"
                    }`}
                    style={{ width: `${Math.max(api.hitRate, 2)}%` }}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Source Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <SourceCard title="Email Sources" sources={emailSources} color="blue" />
        <SourceCard title="LinkedIn Sources" sources={linkedinSources} color="indigo" />
        <SourceCard title="Doximity Sources" sources={doximitySources} color="purple" />
        <SourceCard title="Phone Sources" sources={phoneSources} color="green" />
      </div>

      {/* Recommendations */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
        <h4 className="text-xs font-semibold text-amber-800 mb-2">API Recommendations</h4>
        <ul className="space-y-1 text-xs text-amber-700">
          {apiEffectiveness.filter(a => a.searched > 0 && a.hitRate === 0).map(a => (
            <li key={a.provider}>
              {a.provider}: 0% hit rate — consider removing or adjusting query
            </li>
          ))}
          {apiEffectiveness.filter(a => a.hitRate >= 50).map(a => (
            <li key={a.provider}>
              {a.provider}: {a.hitRate}% hit rate — high value, keep
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SourceCard({
  title,
  sources,
  color,
}: {
  title: string;
  sources: Record<string, number>;
  color: string;
}) {
  const entries = Object.entries(sources).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  const colorMap: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50",
    indigo: "border-indigo-200 bg-indigo-50",
    purple: "border-purple-200 bg-purple-50",
    green: "border-green-200 bg-green-50",
  };

  const barColorMap: Record<string, string> = {
    blue: "bg-blue-500",
    indigo: "bg-indigo-500",
    purple: "bg-purple-500",
    green: "bg-green-500",
  };

  if (total === 0) return null;

  return (
    <div className={`rounded-lg border p-3 ${colorMap[color] || "border-gray-200 bg-gray-50"}`}>
      <h4 className="mb-2 text-xs font-semibold text-gray-700">{title} ({total})</h4>
      <div className="space-y-1">
        {entries.map(([source, count]) => (
          <div key={source} className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-white/60">
              <div
                className={`h-1.5 rounded-full ${barColorMap[color] || "bg-gray-500"}`}
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 whitespace-nowrap">
              {source.replace(/_/g, " ")}: {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
