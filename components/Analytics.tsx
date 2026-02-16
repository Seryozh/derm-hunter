"use client";

import { PipelineRunResult } from "../lib/types";

export default function Analytics({ result }: { result: PipelineRunResult }) {
  const { stats } = result;

  const funnelSteps = [
    { label: "Discovered", value: stats.discovered, color: "bg-blue-500" },
    { label: "Passed Gate", value: stats.identified, color: "bg-indigo-500" },
    { label: "Verified", value: stats.verified, color: "bg-green-500" },
  ];

  const contactStats = [
    { label: "Email", value: stats.withEmail, icon: "📧" },
    { label: "LinkedIn", value: stats.withLinkedIn, icon: "💼" },
    { label: "Doximity", value: stats.withDoximity, icon: "🩺" },
    { label: "Phone", value: stats.withPhone, icon: "📞" },
  ];

  const totalContacted = new Set([
    ...result.doctors.filter((d) => d.contact.email).map((d) => d.channel.channelId),
    ...result.doctors.filter((d) => d.contact.linkedinUrl).map((d) => d.channel.channelId),
    ...result.doctors.filter((d) => d.contact.doximityUrl).map((d) => d.channel.channelId),
    ...result.doctors.filter((d) => d.contact.phone).map((d) => d.channel.channelId),
  ]).size;

  const contactCoverage = stats.verified > 0 ? Math.round((totalContacted / stats.verified) * 100) : 0;

  // Tier breakdown
  const gold = result.doctors.filter((d) => d.verification.tier === "gold").length;
  const silver = result.doctors.filter((d) => d.verification.tier === "silver").length;
  const bronze = result.doctors.filter((d) => d.verification.tier === "bronze").length;

  return (
    <div className="space-y-4">
      {/* Funnel */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Discovery Funnel</h3>
        <div className="space-y-2">
          {funnelSteps.map((step) => (
            <div key={step.label}>
              <div className="mb-1 flex justify-between text-xs text-gray-600">
                <span>{step.label}</span>
                <span className="font-medium">{step.value}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100">
                <div
                  className={`h-2 rounded-full ${step.color} transition-all`}
                  style={{
                    width: `${stats.discovered > 0 ? (step.value / stats.discovered) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
          <div className="text-xs text-gray-400">
            Gated out: {stats.gated} channels
          </div>
        </div>
      </div>

      {/* Tier Breakdown */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Verification Tiers</h3>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="text-xs text-gray-600">Gold: {gold}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-gray-400" />
            <span className="text-xs text-gray-600">Silver: {silver}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-400" />
            <span className="text-xs text-gray-600">Bronze: {bronze}</span>
          </div>
        </div>
        {stats.verified > 0 && (
          <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full">
            {gold > 0 && <div className="bg-yellow-400" style={{ width: `${(gold / stats.verified) * 100}%` }} />}
            {silver > 0 && <div className="bg-gray-400" style={{ width: `${(silver / stats.verified) * 100}%` }} />}
            {bronze > 0 && <div className="bg-orange-400" style={{ width: `${(bronze / stats.verified) * 100}%` }} />}
          </div>
        )}
      </div>

      {/* Contact Coverage */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Contact Coverage: {contactCoverage}%
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {contactStats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-2 text-xs">
              <span>{stat.icon}</span>
              <span className="text-gray-600">{stat.label}:</span>
              <span className="font-semibold text-gray-900">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
