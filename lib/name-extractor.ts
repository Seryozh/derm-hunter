// LLM-based real name extraction from YouTube channel data
// Solves the "Dr. Pimple Popper" problem — channel names ≠ legal names

import { callLLM, extractJSON, estimateCost } from "./llm";
import { RawChannel, RecentVideo, ExtractedIdentity } from "./types";

const SYSTEM_PROMPT = `You are a medical professional identifier. Given YouTube channel data, extract the doctor's real identity.

CRITICAL RULES:
1. Extract the REAL LEGAL NAME, not the channel/brand name
2. "Dr. Pimple Popper" → Sandra Lee, MD. "Doctorly" → not identifiable.
3. Look for credentials: MD, DO, MBBS, FAAD, FAACS
4. Determine if they are (a) a medical doctor AND (b) specifically a dermatologist
5. Board certification = FAAD, FAACS, or explicit mention
6. If you cannot determine the real name, set firstName/lastName to null
7. For country: extract from description, channel country, or location mentions

You MUST respond with ONLY a JSON object. No text before or after the JSON.`;

function buildPrompt(channel: RawChannel, recentVideos: RecentVideo[]): string {
  const videoTitles = recentVideos
    .slice(0, 5)
    .map((v) => `- ${v.title}`)
    .join("\n");

  return `Extract the doctor's identity from this YouTube channel:

Channel Name: ${channel.title}
Custom URL: ${channel.customUrl || "none"}
Description (first 800 chars): ${channel.description.slice(0, 800)}
Subscriber Count: ${channel.subscriberCount}
Channel Country: ${channel.country || "unknown"}

Recent Video Titles:
${videoTitles || "none available"}

Return this exact JSON structure:
{"firstName":"string or null","lastName":"string or null","fullDisplay":"string or null","credentials":"string or null","isMedicalDoctor":true,"isDermatologist":true,"boardCertified":true,"hospitalAffiliation":"string or null","stateOrLocation":"string or null","countryCode":"US or GB or IN etc or null","confidence":"high","reasoning":"brief explanation"}`;
}

interface ExtractionResult {
  identity: ExtractedIdentity | null;
  cost: number;
}

export async function extractIdentity(
  channel: RawChannel,
  recentVideos: RecentVideo[]
): Promise<ExtractionResult> {
  try {
    const prompt = buildPrompt(channel, recentVideos);
    const response = await callLLM(
      prompt,
      "anthropic/claude-haiku-4.5",
      SYSTEM_PROMPT,
      0.1,
      { jsonMode: true }
    );
    const cost = estimateCost("anthropic/claude-haiku-4.5", response.inputTokens, response.outputTokens);

    // Robust JSON extraction — handles markdown, preamble text, etc.
    const jsonStr = extractJSON(response.content);
    const parsed = JSON.parse(jsonStr);

    // Normalize confidence (case-insensitive)
    const rawConfidence = String(parsed.confidence || "").toLowerCase();
    const confidence: "high" | "medium" | "low" =
      rawConfidence === "high" ? "high" :
      rawConfidence === "medium" ? "medium" : "low";

    const identity: ExtractedIdentity = {
      firstName: parsed.firstName || null,
      lastName: parsed.lastName || null,
      fullDisplay: parsed.fullDisplay || null,
      credentials: parsed.credentials || null,
      isMedicalDoctor: parsed.isMedicalDoctor === true || parsed.isMedicalDoctor === "true",
      isDermatologist: parsed.isDermatologist === true || parsed.isDermatologist === "true",
      boardCertified: typeof parsed.boardCertified === "boolean" ? parsed.boardCertified :
        parsed.boardCertified === "true" ? true :
        parsed.boardCertified === "false" ? false : null,
      hospitalAffiliation: parsed.hospitalAffiliation || null,
      stateOrLocation: parsed.stateOrLocation || null,
      confidence,
      reasoning: parsed.reasoning || "No reasoning provided",
    };

    // Attach countryCode to identity for downstream filtering
    // We store it in the reasoning field prefix if detected
    const countryCode = parsed.countryCode || null;
    if (countryCode && countryCode !== "US") {
      identity.reasoning = `[Country: ${countryCode}] ${identity.reasoning}`;
    }

    // Store countryCode on the identity object (we'll use channel.country + this)
    (identity as ExtractedIdentity & { _countryCode?: string })._countryCode = countryCode;

    return { identity, cost };
  } catch (err) {
    console.error(`Name extraction failed for ${channel.title}:`, err);
    return { identity: null, cost: 0 };
  }
}
