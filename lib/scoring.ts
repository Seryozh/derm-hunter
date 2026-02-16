// Gold / Silver / Bronze verification tiering

import { ExtractedIdentity, NPIMatch, VerificationResult, VerificationTier } from "./types";

export function computeVerification(
  identity: ExtractedIdentity,
  npiMatches: NPIMatch[],
  npiTotalCount: number
): VerificationResult {
  let confidence = 0;
  let tier: VerificationTier = "bronze";
  const reasons: string[] = [];

  // --- Identity-based scoring ---
  if (identity.isMedicalDoctor) {
    confidence += 15;
    reasons.push("LLM identified as medical doctor");
  }
  if (identity.isDermatologist) {
    confidence += 15;
    reasons.push("LLM identified as dermatologist");
  }
  if (identity.boardCertified) {
    confidence += 10;
    reasons.push("Board certification indicated");
  }
  if (identity.credentials) {
    confidence += 5;
    reasons.push(`Credentials: ${identity.credentials}`);
  }
  if (identity.confidence === "high") {
    confidence += 10;
  } else if (identity.confidence === "medium") {
    confidence += 5;
  }

  // --- NPI-based scoring ---
  const bestMatch = findBestNPIMatch(identity, npiMatches);

  if (bestMatch) {
    confidence += 25;
    reasons.push(`NPI match: ${bestMatch.npiNumber}`);

    // Check if NPI taxonomy is dermatology
    const isDermTaxonomy = bestMatch.taxonomyDescription.toLowerCase().includes("dermatology");
    if (isDermTaxonomy) {
      confidence += 10;
      reasons.push("NPI taxonomy confirms dermatology");
    }

    // Active status
    if (bestMatch.status === "A") {
      confidence += 5;
      reasons.push("NPI status: Active");
    }
  } else if (npiTotalCount > 0) {
    confidence += 5;
    reasons.push(`${npiTotalCount} NPI results but no strong match`);
  }

  // --- Tier assignment ---
  if (confidence >= 70 && bestMatch) {
    tier = "gold";
  } else if (confidence >= 40) {
    tier = "silver";
  } else {
    tier = "bronze";
  }

  // Cap at 100
  confidence = Math.min(confidence, 100);

  return {
    tier,
    npiMatch: bestMatch,
    matchCount: npiTotalCount,
    confidence,
    reasoning: reasons.join("; "),
  };
}

function findBestNPIMatch(
  identity: ExtractedIdentity,
  matches: NPIMatch[]
): NPIMatch | null {
  if (matches.length === 0) return null;

  // Score each match
  let bestMatch: NPIMatch | null = null;
  let bestScore = 0;

  for (const match of matches) {
    let score = 0;

    // Name matching (case-insensitive)
    const firstMatch =
      identity.firstName &&
      match.firstName.toLowerCase().includes(identity.firstName.toLowerCase());
    const lastMatch =
      identity.lastName &&
      match.lastName.toLowerCase() === identity.lastName.toLowerCase();

    if (lastMatch) score += 3;
    if (firstMatch) score += 2;

    // Dermatology taxonomy match
    if (match.taxonomyDescription.toLowerCase().includes("dermatology")) {
      score += 3;
    }

    // Active status
    if (match.status === "A") score += 1;

    // State match
    if (
      identity.stateOrLocation &&
      match.practiceAddress?.state &&
      identity.stateOrLocation.toUpperCase().includes(match.practiceAddress.state.toUpperCase())
    ) {
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = match;
    }
  }

  // Require at minimum a last name match
  if (bestScore < 3) return null;

  return bestMatch;
}
