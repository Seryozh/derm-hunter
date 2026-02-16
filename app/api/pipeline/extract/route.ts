// Phase 2: Gate + Intelligence
// Applies subscriber/recency gate, then extracts real names via LLM

import { NextResponse } from "next/server";
import { extractIdentity } from "../../../../lib/name-extractor";
import { DiscoveredDoctor, IntelligenceResult, GateResult } from "../../../../lib/types";

const MIN_SUBSCRIBERS = 5000;
const MAX_DAYS_SINCE_UPLOAD = 90;

function applyGate(doctor: DiscoveredDoctor): GateResult {
  const { channel, lastUploadDate } = doctor;

  // Subscriber gate
  if (channel.subscriberCount === -1) {
    // Hidden subs — let through with note
  } else if (channel.subscriberCount < MIN_SUBSCRIBERS) {
    return {
      passed: false,
      reason: `Only ${channel.subscriberCount.toLocaleString()} subscribers (min: ${MIN_SUBSCRIBERS.toLocaleString()})`,
    };
  }

  // Recency gate
  if (lastUploadDate) {
    const daysSince = Math.floor(
      (Date.now() - new Date(lastUploadDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince > MAX_DAYS_SINCE_UPLOAD) {
      return {
        passed: false,
        reason: `Last upload ${daysSince} days ago (max: ${MAX_DAYS_SINCE_UPLOAD})`,
      };
    }
  } else {
    return { passed: false, reason: "No recent uploads found" };
  }

  return { passed: true };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const doctors: DiscoveredDoctor[] = body.doctors || [];

    if (doctors.length === 0) {
      return NextResponse.json({ results: [], costs: { haiku: 0 } });
    }

    const results: IntelligenceResult[] = [];
    let totalCost = 0;

    for (const doctor of doctors) {
      const gate = applyGate(doctor);

      if (!gate.passed) {
        results.push({
          channel: doctor.channel,
          recentVideos: doctor.recentVideos,
          gate,
          identity: null,
        });
        continue;
      }

      // Extract identity via LLM
      const { identity, cost } = await extractIdentity(doctor.channel, doctor.recentVideos);
      totalCost += cost;

      // Secondary gate: must be identified as a medical doctor
      if (identity && !identity.isMedicalDoctor) {
        results.push({
          channel: doctor.channel,
          recentVideos: doctor.recentVideos,
          gate: { passed: false, reason: "LLM determined not a medical doctor" },
          identity,
        });
        continue;
      }

      results.push({
        channel: doctor.channel,
        recentVideos: doctor.recentVideos,
        gate,
        identity,
      });
    }

    const passed = results.filter((r) => r.gate.passed && r.identity);
    const filtered = results.filter((r) => !r.gate.passed);

    return NextResponse.json({
      results,
      stats: {
        total: doctors.length,
        passed: passed.length,
        filtered: filtered.length,
      },
      costs: { haiku: totalCost },
    });
  } catch (error) {
    console.error("Extraction failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
