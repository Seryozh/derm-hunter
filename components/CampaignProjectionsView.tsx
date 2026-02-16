"use client";

import { CampaignProjections } from "../lib/types";

export default function CampaignProjectionsView({ projections }: { projections: CampaignProjections }) {
  const p = projections;

  // At-scale projections: weekly runs for a year
  const weeklyRuns = 52;
  const atScaleSignups = p.signUps * weeklyRuns;
  const atScaleRevenue = atScaleSignups * p.revenuePerDoctor;
  const atScaleApiCost = p.campaignCost * weeklyRuns;
  const breakEvenRuns = p.revenuePerDoctor > 0
    ? Math.ceil(p.campaignCost / p.revenuePerDoctor * (1 / (p.signUps > 0 ? p.signUps / p.totalDiscovered : 0.01)))
    : 0;

  return (
    <div className="space-y-4">
      {/* Strategy Context */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="text-sm font-semibold text-blue-900">
          Influencer-Doctor Acquisition Strategy
        </h3>
        <p className="mt-1 text-xs text-blue-700">
          Future Clinic targets dermatologists with active YouTube audiences. These doctors already
          create content, making them ideal early adopters for a telehealth platform. This pipeline
          finds them, verifies credentials via NPI, and surfaces contact info for outreach.
        </p>
      </div>

      {/* This Run */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <h3 className="text-sm font-semibold text-green-900">This Run</h3>
        <div className="mt-2 grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-700">{p.totalDiscovered}</div>
            <div className="text-xs text-green-600">Verified Doctors</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-700">{p.totalDemos}</div>
            <div className="text-xs text-green-600">Est. Demo Bookings</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-700">
              {p.signUps > 0 ? p.signUps : "0-1"}
            </div>
            <div className="text-xs text-green-600">Est. Sign-Ups</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-700">
              ${p.campaignCost.toFixed(2)}
            </div>
            <div className="text-xs text-green-600">API Cost</div>
          </div>
        </div>
        {p.signUps > 0 && (
          <div className="mt-2 text-center text-xs text-green-700">
            Projected revenue from {p.signUps} sign-up{p.signUps !== 1 ? "s" : ""}:{" "}
            <strong>${p.projectedAnnualRevenue.toLocaleString()}/year</strong>{" "}
            ($500/mo per doctor)
          </div>
        )}
      </div>

      {/* Range of Outcomes */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">Range of Outcomes (per run)</h3>
        <div className="mt-3 space-y-2">
          <OutcomeRow
            label="Conservative (0 sign-ups)"
            revenue="$0"
            cost={`$${p.campaignCost.toFixed(2)}`}
            note="Still generates verified contact list for manual outreach"
          />
          <OutcomeRow
            label="Expected (1 sign-up)"
            revenue={`$${p.revenuePerDoctor.toLocaleString()}/yr`}
            cost={`$${p.campaignCost.toFixed(2)}`}
            note={`ROI: ${Math.round(p.revenuePerDoctor / p.campaignCost).toLocaleString()}x`}
            highlight
          />
          <OutcomeRow
            label="Optimistic (2+ sign-ups)"
            revenue={`$${(p.revenuePerDoctor * 2).toLocaleString()}+/yr`}
            cost={`$${p.campaignCost.toFixed(2)}`}
            note={`ROI: ${Math.round((p.revenuePerDoctor * 2) / p.campaignCost).toLocaleString()}x`}
          />
        </div>
      </div>

      {/* Break-even and Scale */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h4 className="text-xs font-semibold text-amber-900">Break-Even Context</h4>
          <div className="mt-2 text-2xl font-bold text-amber-700">1 sign-up</div>
          <p className="mt-1 text-xs text-amber-700">
            A single converted doctor ($6K/yr) pays for{" "}
            <strong>{Math.round(6000 / p.campaignCost).toLocaleString()}</strong> pipeline runs
          </p>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <h4 className="text-xs font-semibold text-indigo-900">At Scale (weekly runs, 1 yr)</h4>
          <div className="mt-2 text-2xl font-bold text-indigo-700">
            ${atScaleRevenue > 1000 ? `${Math.round(atScaleRevenue / 1000)}K` : atScaleRevenue}/yr
          </div>
          <p className="mt-1 text-xs text-indigo-700">
            {weeklyRuns} runs x ~{p.totalDiscovered} doctors = {p.totalDiscovered * weeklyRuns} leads/yr
          </p>
          <p className="text-xs text-indigo-600">
            Total API cost: ${atScaleApiCost.toFixed(0)}/yr
          </p>
        </div>
      </div>

      {/* Channel Funnels */}
      <div className="grid grid-cols-2 gap-3">
        {p.emailSent > 0 && (
          <FunnelCard
            title="Email"
            color="blue"
            steps={[
              { label: "Sent", value: p.emailSent },
              { label: "Opened", value: p.emailOpened },
              { label: "Replied", value: p.emailReplied },
              { label: "Demos", value: p.emailDemos },
            ]}
          />
        )}
        {p.linkedinSent > 0 && (
          <FunnelCard
            title="LinkedIn"
            color="indigo"
            steps={[
              { label: "Sent", value: p.linkedinSent },
              { label: "Accepted", value: p.linkedinAccepted },
              { label: "Replied", value: p.linkedinReplied },
              { label: "Demos", value: p.linkedinDemos },
            ]}
          />
        )}
        {p.doximitySent > 0 && (
          <FunnelCard
            title="Doximity"
            color="purple"
            steps={[
              { label: "Sent", value: p.doximitySent },
              { label: "Replied", value: p.doximityReplied },
              { label: "Demos", value: p.doximityDemos },
            ]}
          />
        )}
        {p.phoneCalls > 0 && (
          <FunnelCard
            title="Phone"
            color="green"
            steps={[
              { label: "Calls", value: p.phoneCalls },
              { label: "Connected", value: p.phoneConnected },
              { label: "Interested", value: p.phoneInterested },
              { label: "Demos", value: p.phoneDemos },
            ]}
          />
        )}
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
        <strong>Sources:</strong> Email open rates from Mailchimp Healthcare avg (22%), LinkedIn
        connection acceptance from LinkedIn Sales Solutions (30%), Doximity response rates from
        Doximity 2024 Physician Report (12%). Revenue assumes $500/mo per doctor (Future Clinic pricing).
        API cost is measured from actual pipeline runs. These are industry averages and actual
        results will vary based on outreach quality and targeting.
      </div>
    </div>
  );
}

function OutcomeRow({
  label,
  revenue,
  cost,
  note,
  highlight,
}: {
  label: string;
  revenue: string;
  cost: string;
  note: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${highlight ? "bg-green-50" : "bg-gray-50"}`}>
      <div>
        <div className={`text-xs font-medium ${highlight ? "text-green-900" : "text-gray-700"}`}>{label}</div>
        <div className="text-[10px] text-gray-500">{note}</div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-bold ${highlight ? "text-green-700" : "text-gray-900"}`}>{revenue}</div>
        <div className="text-[10px] text-gray-500">Cost: {cost}</div>
      </div>
    </div>
  );
}

function FunnelCard({
  title,
  color,
  steps,
}: {
  title: string;
  color: string;
  steps: { label: string; value: number }[];
}) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50",
    indigo: "border-indigo-200 bg-indigo-50",
    purple: "border-purple-200 bg-purple-50",
    green: "border-green-200 bg-green-50",
  };

  return (
    <div className={`rounded-lg border p-3 ${colorMap[color] || "border-gray-200 bg-gray-50"}`}>
      <h4 className="mb-2 text-xs font-semibold text-gray-700">{title}</h4>
      <div className="space-y-1">
        {steps.map((step, i) => (
          <div key={step.label} className="flex justify-between text-xs">
            <span className="text-gray-600">
              {i > 0 ? "→ " : ""}{step.label}
            </span>
            <span className="font-medium text-gray-900">{step.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
