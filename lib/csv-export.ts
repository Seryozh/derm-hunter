// Export utilities — CSV, plain text, AI-debug formats

import { VerifiedDoctor, PipelineRunResult } from "./types";

// ========== CSV Export (with source columns) ==========

export function doctorsToCSV(doctors: VerifiedDoctor[]): string {
  const headers = [
    "Name", "Channel", "Subscribers", "Credentials",
    "Tier", "Confidence", "NPI Number",
    "Email", "Email Source",
    "Phone", "Phone Source",
    "LinkedIn", "LinkedIn Source",
    "Doximity", "Doximity Source",
    "Website", "Website Source",
    "Location", "Last Upload", "Discovery Query", "YouTube URL",
  ];

  const rows = doctors.map((d) => [
    d.identity.fullDisplay || "",
    d.channel.title,
    d.channel.subscriberCount.toString(),
    d.identity.credentials || "",
    d.verification.tier,
    d.verification.confidence.toString(),
    d.verification.npiMatch?.npiNumber?.toString() || "",
    d.contact.email || "",
    d.contact.emailSource || "",
    d.contact.phone || "",
    d.contact.phoneSource || "",
    d.contact.linkedinUrl || "",
    d.contact.linkedinSource || "",
    d.contact.doximityUrl || "",
    d.contact.doximitySource || "",
    d.contact.website || "",
    d.contact.websiteSource || "",
    d.identity.stateOrLocation || "",
    d.recentVideos[0]?.publishedAt || "",
    d.channel.discoveryQuery,
    d.channel.customUrl
      ? `https://youtube.com/${d.channel.customUrl}`
      : `https://youtube.com/channel/${d.channel.channelId}`,
  ]);

  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

// ========== Plain Text Export ==========

export function doctorsToPlainText(doctors: VerifiedDoctor[]): string {
  return doctors.map((d) => {
    const name = d.identity.fullDisplay || d.channel.title;
    const subs = d.channel.subscriberCount >= 0 ? `${(d.channel.subscriberCount / 1000).toFixed(0)}K` : "Hidden";
    const lines = [
      `${name} (${d.channel.title}, ${subs} subs)`,
      `${d.verification.tier.charAt(0).toUpperCase() + d.verification.tier.slice(1)} tier${d.verification.npiMatch ? ", NPI verified" : ""} ${d.identity.isDermatologist ? "dermatologist" : "physician"}`,
    ];

    if (d.contact.email) lines.push(`Email: ${d.contact.email} (from ${d.contact.emailSource})`);
    if (d.contact.phone) lines.push(`Phone: ${d.contact.phone} (from ${d.contact.phoneSource})`);
    if (d.contact.linkedinUrl) lines.push(`LinkedIn: ${d.contact.linkedinUrl} (from ${d.contact.linkedinSource})`);
    if (d.contact.doximityUrl) lines.push(`Doximity: ${d.contact.doximityUrl} (from ${d.contact.doximitySource})`);
    if (d.contact.website) lines.push(`Website: ${d.contact.website} (from ${d.contact.websiteSource})`);
    if (d.identity.stateOrLocation) lines.push(d.identity.stateOrLocation);

    return lines.join("\n");
  }).join("\n---\n");
}

// ========== AI-Debug Export ==========

export function pipelineToDebugText(result: PipelineRunResult): string {
  const lines: string[] = [];

  lines.push("DERM HUNTER PIPELINE DEBUG LOG");
  lines.push(`Run: ${result.startedAt} → ${result.completedAt}`);
  lines.push(`Discovered: ${result.stats.discovered} | Gated: ${result.stats.gated} | Verified: ${result.stats.verified}`);
  lines.push("");

  // Gate reasons
  if (result.stats.gatedReasons) {
    lines.push("GATE REASONS:");
    for (const [reason, count] of Object.entries(result.stats.gatedReasons)) {
      lines.push(`  ${reason}: ${count}`);
    }
    lines.push("");
  }

  // API effectiveness
  if (result.sourceStats?.apiEffectiveness) {
    lines.push("API EFFECTIVENESS:");
    for (const api of result.sourceStats.apiEffectiveness) {
      lines.push(`  ${api.provider}: ${api.found}/${api.searched} (${api.hitRate}% hit rate)${api.costPerSuccess > 0 ? ` — $${api.costPerSuccess.toFixed(4)}/success` : ""}`);
    }
    lines.push("");
  }

  // Source breakdown
  if (result.sourceStats) {
    const { emailSources, linkedinSources, doximitySources, phoneSources } = result.sourceStats;
    if (Object.keys(emailSources).length > 0) {
      lines.push("EMAIL SOURCES: " + Object.entries(emailSources).map(([k, v]) => `${k}: ${v}`).join(", "));
    }
    if (Object.keys(linkedinSources).length > 0) {
      lines.push("LINKEDIN SOURCES: " + Object.entries(linkedinSources).map(([k, v]) => `${k}: ${v}`).join(", "));
    }
    if (Object.keys(doximitySources).length > 0) {
      lines.push("DOXIMITY SOURCES: " + Object.entries(doximitySources).map(([k, v]) => `${k}: ${v}`).join(", "));
    }
    if (Object.keys(phoneSources).length > 0) {
      lines.push("PHONE SOURCES: " + Object.entries(phoneSources).map(([k, v]) => `${k}: ${v}`).join(", "));
    }
    lines.push("");
  }

  // Per-doctor debug
  lines.push("=".repeat(70));
  lines.push("PER-DOCTOR DEBUG LOGS");
  lines.push("=".repeat(70));

  for (const log of result.debugLogs || []) {
    lines.push("");
    lines.push(`DOCTOR: ${log.channelTitle}`);
    lines.push(`  PHASE 1 - Discovery: ${log.phase1}`);
    lines.push(`  PHASE 2 - Gate: ${log.phase2Gate}`);
    if (log.phase2Identity) lines.push(`  PHASE 2 - Identity: ${log.phase2Identity}`);
    if (log.phase3Verification) lines.push(`  PHASE 3A - Verification: ${log.phase3Verification}`);
    if (log.phase3Enrichment.length > 0) {
      lines.push("  PHASE 3B - Enrichment:");
      for (const entry of log.phase3Enrichment) {
        lines.push(`    - ${entry}`);
      }
    }
    lines.push(`  FINAL: ${log.finalStatus}`);
    lines.push("  ---");
  }

  // Costs
  lines.push("");
  lines.push("COSTS:");
  lines.push(`  OpenRouter (Haiku): $${result.costs.openrouterHaiku.toFixed(4)}`);
  lines.push(`  OpenRouter (Sonnet): $${result.costs.openrouterSonnet.toFixed(4)}`);
  lines.push(`  Exa AI: $${result.costs.exa.toFixed(4)}`);
  lines.push(`  Total: $${result.costs.total.toFixed(4)}`);

  return lines.join("\n");
}

// ========== Download Helper ==========

export function downloadFile(content: string, filename: string, mimeType = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.click();
  URL.revokeObjectURL(url);
}
