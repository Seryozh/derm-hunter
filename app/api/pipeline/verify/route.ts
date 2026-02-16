// Phase 3A: NPI Verification
// Verifies extracted names against NPI Registry, assigns Gold/Silver/Bronze tier

import { NextResponse } from "next/server";
import { verifyWithNPI } from "../../../../lib/npi";
import { computeVerification } from "../../../../lib/scoring";
import { IntelligenceResult, VerificationResult } from "../../../../lib/types";

interface VerifyInput {
  result: IntelligenceResult;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const inputs: VerifyInput[] = body.results || [];

    const verifications: { result: IntelligenceResult; verification: VerificationResult }[] = [];

    for (const input of inputs) {
      const { result } = input;
      const identity = result.identity;

      if (!identity || !result.gate.passed) {
        continue; // Skip unidentified or gated-out doctors
      }

      // Need at minimum a last name for NPI lookup
      if (!identity.lastName) {
        const verification = computeVerification(identity, [], 0);
        verifications.push({ result, verification });
        continue;
      }

      // Extract state abbreviation from location
      const state = extractStateAbbr(identity.stateOrLocation);

      // Search NPI with cascading fallback
      const npiResult = await verifyWithNPI(
        identity.firstName || "",
        identity.lastName,
        state
      );

      const verification = computeVerification(
        identity,
        npiResult.matches,
        npiResult.totalCount
      );

      verifications.push({ result, verification });
    }

    const gold = verifications.filter((v) => v.verification.tier === "gold").length;
    const silver = verifications.filter((v) => v.verification.tier === "silver").length;
    const bronze = verifications.filter((v) => v.verification.tier === "bronze").length;

    return NextResponse.json({
      verifications,
      stats: { total: verifications.length, gold, silver, bronze },
      costs: { npi: 0 }, // NPI is free
    });
  } catch (error) {
    console.error("Verification failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed" },
      { status: 500 }
    );
  }
}

// Try to extract 2-letter state code from location string
function extractStateAbbr(location: string | null): string | null {
  if (!location) return null;

  const STATE_ABBRS = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY","DC",
  ];

  // Check if the location IS a state abbreviation
  const upper = location.trim().toUpperCase();
  if (STATE_ABBRS.includes(upper)) return upper;

  // Check if it contains a state abbreviation (e.g. "Los Angeles, CA")
  for (const abbr of STATE_ABBRS) {
    if (upper.includes(`, ${abbr}`) || upper.endsWith(` ${abbr}`)) {
      return abbr;
    }
  }

  // State name mapping (common ones)
  const STATE_NAMES: Record<string, string> = {
    "california": "CA", "new york": "NY", "texas": "TX", "florida": "FL",
    "illinois": "IL", "pennsylvania": "PA", "ohio": "OH", "georgia": "GA",
    "michigan": "MI", "new jersey": "NJ", "virginia": "VA", "washington": "WA",
    "arizona": "AZ", "massachusetts": "MA", "tennessee": "TN", "indiana": "IN",
    "maryland": "MD", "colorado": "CO", "minnesota": "MN", "wisconsin": "WI",
    "connecticut": "CT", "oregon": "OR", "north carolina": "NC", "south carolina": "SC",
  };

  const lower = location.toLowerCase();
  for (const [name, abbr] of Object.entries(STATE_NAMES)) {
    if (lower.includes(name)) return abbr;
  }

  return null;
}
