"use client";

import { CampaignProjections } from "../lib/types";

export default function CampaignProjectionsView({ projections }: { projections: CampaignProjections }) {
  const p = projections;

  const fcCut = 0.25;
  const avgPatientSub = 30;
  const fcPerPatient = avgPatientSub * fcCut; // $7.50

  // At-scale projections: weekly runs for a year
  const weeklyRuns = 52;
  const atScaleSignups = p.signUps * weeklyRuns;
  const atScaleRevenue = atScaleSignups * p.revenuePerDoctor;
  const atScaleApiCost = p.campaignCost * weeklyRuns;

  return (
    <div className="space-y-4">
      {/* Strategy Context */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="text-sm font-semibold text-blue-900">
          Influencer-Doctor Acquisition — Unit Economics
        </h3>
        <p className="mt-1 text-xs text-blue-700">
          FutureClinic is a marketplace where patients subscribe to doctors at ~${avgPatientSub}/month.
          The platform takes a {fcCut * 100}% fee (${fcPerPatient.toFixed(2)}/patient/month).
          Doctors with existing YouTube audiences are high-LTV targets — their content drives organic
          patient acquisition, making each onboarded doctor worth significantly more than a
          cold-acquired provider.
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
      </div>

      {/* Revenue Model */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">Revenue per Onboarded Doctor</h3>
        <p className="mt-1 text-xs text-gray-500">
          Content-creator doctors convert their YouTube audience into patients. FutureClinic earns
          ${fcPerPatient.toFixed(2)}/patient/month ({fcCut * 100}% of ${avgPatientSub}).
        </p>
        <div className="mt-3 space-y-2">
          <OutcomeRow
            label="Conservative (50 patients)"
            revenue={`$${(fcPerPatient * 50 * 12).toLocaleString()}/yr`}
            detail="Minimal audience conversion"
            note={`${fcPerPatient.toFixed(2)} × 50 × 12 months`}
          />
          <OutcomeRow
            label="Expected (100 patients)"
            revenue={`$${(fcPerPatient * 100 * 12).toLocaleString()}/yr`}
            detail="Moderate engagement, ~0.1% of 100K subs"
            note={`${fcPerPatient.toFixed(2)} × 100 × 12 months`}
            highlight
          />
          <OutcomeRow
            label="High-Influence (500+ patients)"
            revenue={`$${(fcPerPatient * 500 * 12).toLocaleString()}/yr`}
            detail="Top creators like Dr. Idriss (1.67M subs)"
            note={`${fcPerPatient.toFixed(2)} × 500 × 12 months`}
          />
        </div>
      </div>

      {/* Break-even and Scale */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h4 className="text-xs font-semibold text-amber-900">Cost to Acquire Leads</h4>
          <div className="mt-2 text-2xl font-bold text-amber-700">${p.campaignCost.toFixed(2)}</div>
          <p className="mt-1 text-xs text-amber-700">
            API cost for {p.totalDiscovered} verified doctors with contact info
          </p>
          <p className="mt-1 text-xs text-amber-600">
            ${(p.campaignCost / p.totalDiscovered).toFixed(3)}/doctor — 1 sign-up pays
            for <strong>{Math.round(p.revenuePerDoctor / p.campaignCost).toLocaleString()}</strong> pipeline runs
          </p>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <h4 className="text-xs font-semibold text-indigo-900">At Scale (weekly runs, 1 yr)</h4>
          <div className="mt-2 text-2xl font-bold text-indigo-700">
            {(p.totalDiscovered * weeklyRuns).toLocaleString()} leads
          </div>
          <p className="mt-1 text-xs text-indigo-700">
            {weeklyRuns} runs × {p.totalDiscovered} doctors/run
          </p>
          <p className="text-xs text-indigo-600">
            Total API cost: ${atScaleApiCost.toFixed(0)}/yr
          </p>
          {atScaleSignups > 0 && (
            <p className="text-xs text-indigo-600">
              Est. {atScaleSignups} sign-ups → ${atScaleRevenue > 1000 ? `${Math.round(atScaleRevenue / 1000)}K` : atScaleRevenue}/yr
            </p>
          )}
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
        Doximity 2024 Physician Report (12%). Revenue model based on FutureClinic&apos;s 25%
        marketplace fee on ~$30/month patient subscriptions. API cost is measured from actual
        pipeline runs. These are industry averages — actual results will vary based on outreach
        quality and targeting.
      </div>
    </div>
  );
}

function OutcomeRow({
  label,
  revenue,
  detail,
  note,
  highlight,
}: {
  label: string;
  revenue: string;
  detail: string;
  note: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${highlight ? "bg-green-50" : "bg-gray-50"}`}>
      <div>
        <div className={`text-xs font-medium ${highlight ? "text-green-900" : "text-gray-700"}`}>{label}</div>
        <div className="text-[10px] text-gray-500">{detail}</div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-bold ${highlight ? "text-green-700" : "text-gray-900"}`}>{revenue}</div>
        <div className="text-[10px] text-gray-400">{note}</div>
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
              {i > 0 ? "\u2192 " : ""}{step.label}
            </span>
            <span className="font-medium text-gray-900">{step.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
