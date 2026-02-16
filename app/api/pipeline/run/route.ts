// Pipeline Orchestrator — chains Phases 1-3 via direct function imports
// Phase 4 (outreach) is on-demand, not part of the pipeline run
// Streams progress via SSE for real-time UI updates

import { searchDermVideos, getChannelDetails, getRecentVideos } from "../../../../lib/youtube";
import { DERM_QUERIES } from "../../../../lib/derm-queries";
import { extractIdentity } from "../../../../lib/name-extractor";
import { verifyWithNPI } from "../../../../lib/npi";
import { computeVerification } from "../../../../lib/scoring";
import { extractContactFromDescription, extractDomainFromUrl } from "../../../../lib/contact-extractor";
import { enrichWithExa, ProfileMatchContext } from "../../../../lib/exa-enrichment";
import { findEmailWithHunter } from "../../../../lib/hunter";
import { findEmailWithSnov } from "../../../../lib/snov";
import {
  DiscoveredDoctor,
  VerifiedDoctor,
  ContactInfo,
  ContactSource,
  CostBreakdown,
  PipelineRunResult,
  ExtractedIdentity,
  SourceStats,
  ApiEffectiveness,
  DoctorDebugLog,
} from "../../../../lib/types";

export const maxDuration = 300; // 5 minutes

// US country codes from YouTube API
const US_COUNTRY_CODES = new Set(["US", "us", ""]);

function isLikelyUS(channel: { country: string | null }, identity: ExtractedIdentity | null): boolean {
  // If YouTube says US, trust it
  if (channel.country && US_COUNTRY_CODES.has(channel.country)) return true;
  // If YouTube doesn't provide country (common), check LLM identity
  if (!channel.country && identity) {
    const loc = (identity.stateOrLocation || "").toLowerCase();
    const reasoning = (identity.reasoning || "").toLowerCase();
    // Check for non-US country indicators
    const nonUSIndicators = ["india", "uk", "united kingdom", "canada", "australia",
      "philippines", "pakistan", "nigeria", "south africa", "germany", "brazil",
      "country: in", "country: gb", "country: ca", "country: au", "country: ph"];
    for (const indicator of nonUSIndicators) {
      if (loc.includes(indicator) || reasoning.includes(indicator)) return false;
    }
    // If no country info at all, assume US (YouTube search already filtered regionCode=US)
    return true;
  }
  // Non-US country explicitly set
  if (channel.country && !US_COUNTRY_CODES.has(channel.country)) return false;
  return true;
}

export async function POST(request: Request) {
  const startedAt = new Date().toISOString();
  const encoder = new TextEncoder();

  const body = await request.json().catch(() => ({}));
  const maxQueries = Math.min(body.maxQueries || 3, DERM_QUERIES.length);
  const queries = DERM_QUERIES.slice(0, maxQueries);
  const stream = body.stream !== false; // default to streaming

  // Demo mode: return cached data without making any API calls
  if (process.env.DEMO_MODE === "true") {
    return serveDemoData(stream, encoder);
  }

  // If not streaming, run full pipeline and return JSON
  if (!stream) {
    return runFullPipeline(queries, startedAt);
  }

  // SSE streaming response
  const readable = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const result = await runPipelineWithProgress(queries, startedAt, send);
        send({ type: "complete", result });
        controller.close();
      } catch (error) {
        send({ type: "error", error: error instanceof Error ? error.message : "Pipeline failed" });
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function serveDemoData(stream: boolean, encoder: TextEncoder) {
  let demoSnapshot;
  try {
    const fs = await import("fs");
    const path = await import("path");
    const snapshotPath = path.join(process.cwd(), "lib", "demo-snapshot.json");
    const raw = fs.readFileSync(snapshotPath, "utf-8");
    demoSnapshot = JSON.parse(raw);
  } catch {
    return Response.json(
      { error: "Demo mode is enabled but no demo-snapshot.json found in lib/. Run the pipeline once in development mode and use the Snapshot button to capture data." },
      { status: 500 }
    );
  }

  const result = demoSnapshot.result;

  if (!stream) {
    return Response.json(result);
  }

  // Simulate realistic streaming with delays
  const readable = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

      // Phase 1: Discovery (~3 seconds)
      send({ type: "phase", phase: 1, label: "Discovering channels on YouTube..." });
      await delay(1500);
      send({ type: "phase", phase: 1, label: `Searching dermatologist content across ${10} queries...` });
      await delay(1500);
      send({ type: "phase", phase: 1, label: `Discovered ${result.stats.discovered} channels`, count: result.stats.discovered });
      await delay(500);

      // Phase 2: Gate + Intelligence (~5 seconds with per-doctor ticks)
      send({ type: "phase", phase: 2, label: "Filtering and identifying doctors..." });
      const discovered = result.stats.discovered;
      for (let i = 0; i < discovered; i += Math.ceil(discovered / 12)) {
        const batch = Math.min(i + Math.ceil(discovered / 12), discovered);
        send({ type: "progress", phase: 2, processed: batch, total: discovered });
        await delay(350 + Math.random() * 150);
      }
      send({ type: "phase", phase: 2, label: `${result.stats.identified} doctors identified, ${result.stats.gated} filtered`, count: result.stats.identified });
      await delay(500);

      // Phase 3: Verification + Enrichment (~8 seconds, per-doctor)
      send({ type: "phase", phase: 3, label: "Verifying credentials and finding contact info..." });
      const total = result.doctors.length;
      for (let i = 0; i < total; i++) {
        send({
          type: "progress", phase: 3, processed: i + 1, total,
          doctor: result.doctors[i]?.identity?.fullDisplay || result.doctors[i]?.channel?.title || "Doctor",
          tier: result.doctors[i]?.verification?.tier || "bronze",
        });
        await delay(80 + Math.random() * 120);
      }

      send({ type: "complete", result });
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function runFullPipeline(queries: string[], startedAt: string) {
  const result = await runPipelineWithProgress(queries, startedAt, () => {});
  return Response.json(result);
}

async function runPipelineWithProgress(
  queries: string[],
  startedAt: string,
  onProgress: (data: Record<string, unknown>) => void
): Promise<PipelineRunResult> {
  const costs: CostBreakdown = {
    youtube: 0, openrouterHaiku: 0, openrouterSonnet: 0,
    exa: 0, hunter: 0, snov: 0, npi: 0, total: 0,
  };

  const debugLogs: DoctorDebugLog[] = [];
  const gatedReasons: Record<string, number> = {};
  const sourceCounters = {
    emailSources: {} as Record<string, number>,
    phoneSources: {} as Record<string, number>,
    linkedinSources: {} as Record<string, number>,
    doximitySources: {} as Record<string, number>,
    websiteSources: {} as Record<string, number>,
    // Track searches vs successes per API
    exaLinkedinSearched: 0, exaLinkedinFound: 0,
    exaDoximitySearched: 0, exaDoximityFound: 0,
    exaPracticeSearched: 0, exaPracticeEmailFound: 0,
    hunterSearched: 0, hunterFound: 0,
    snovSearched: 0, snovFound: 0,
    ytDescSearched: 0, ytDescEmailFound: 0, ytDescLinkedinFound: 0,
  };

  const sourceMaps: Record<string, Record<string, number>> = {
    email: sourceCounters.emailSources,
    phone: sourceCounters.phoneSources,
    linkedin: sourceCounters.linkedinSources,
    doximity: sourceCounters.doximitySources,
    website: sourceCounters.websiteSources,
  };

  function incrementSource(type: string, source: string) {
    const map = sourceMaps[type];
    if (map) map[source] = (map[source] || 0) + 1;
  }

  function addGateReason(reason: string) {
    gatedReasons[reason] = (gatedReasons[reason] || 0) + 1;
  }

  // ========== PHASE 1: Discovery ==========
  onProgress({ type: "phase", phase: 1, label: "Discovering channels on YouTube..." });

  const allChannelIds = new Set<string>();
  const channelToQuery = new Map<string, string>();

  for (const query of queries) {
    const { channelIds } = await searchDermVideos(query, 50);
    for (const id of channelIds) {
      if (!allChannelIds.has(id)) {
        allChannelIds.add(id);
        channelToQuery.set(id, query);
      }
    }
  }

  const channelIdArray = Array.from(allChannelIds);
  const { channels } = await getChannelDetails(channelIdArray, "multi-query");

  const discovered: DiscoveredDoctor[] = [];
  for (const channel of channels) {
    const { videos } = await getRecentVideos(channel.channelId, channel.uploadsPlaylistId, 5);
    const lastUploadDate = videos.length > 0
      ? videos.reduce((latest, v) => (v.publishedAt > latest ? v.publishedAt : latest), videos[0].publishedAt)
      : null;
    channel.discoveryQuery = channelToQuery.get(channel.channelId) || "unknown";
    discovered.push({ channel, recentVideos: videos, lastUploadDate });
  }

  onProgress({ type: "phase", phase: 1, label: `Discovered ${discovered.length} channels`, count: discovered.length });

  // ========== PHASE 2: Gate + Intelligence ==========
  onProgress({ type: "phase", phase: 2, label: "Filtering and identifying doctors..." });

  const MIN_SUBSCRIBERS = 5000;
  const MAX_DAYS_SINCE_UPLOAD = 90;

  interface PassedDoctor {
    doctor: DiscoveredDoctor;
    identity: ExtractedIdentity;
  }
  const passed: PassedDoctor[] = [];
  let gatedOut = 0;

  for (let i = 0; i < discovered.length; i++) {
    const doc = discovered[i];
    const debugLog: DoctorDebugLog = {
      channelTitle: doc.channel.title,
      phase1: `Found via query "${doc.channel.discoveryQuery}"`,
      phase2Gate: "",
      phase2Identity: "",
      phase3Verification: "",
      phase3Enrichment: [],
      finalStatus: "",
    };

    // Subscriber gate
    if (doc.channel.subscriberCount !== -1 && doc.channel.subscriberCount < MIN_SUBSCRIBERS) {
      gatedOut++;
      addGateReason("low_subscribers");
      debugLog.phase2Gate = `FAIL: ${doc.channel.subscriberCount.toLocaleString()} subs < ${MIN_SUBSCRIBERS.toLocaleString()} min`;
      debugLog.finalStatus = "Gated: low subscribers";
      debugLogs.push(debugLog);
      continue;
    }

    // Recency gate
    if (doc.lastUploadDate) {
      const daysSince = Math.floor(
        (Date.now() - new Date(doc.lastUploadDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince > MAX_DAYS_SINCE_UPLOAD) {
        gatedOut++;
        addGateReason("inactive");
        debugLog.phase2Gate = `FAIL: Last upload ${daysSince} days ago > ${MAX_DAYS_SINCE_UPLOAD} max`;
        debugLog.finalStatus = "Gated: inactive";
        debugLogs.push(debugLog);
        continue;
      }
      debugLog.phase2Gate = `PASS (${doc.channel.subscriberCount.toLocaleString()} subs, last upload ${daysSince}d ago)`;
    } else {
      gatedOut++;
      addGateReason("no_uploads");
      debugLog.phase2Gate = "FAIL: No recent uploads found";
      debugLog.finalStatus = "Gated: no uploads";
      debugLogs.push(debugLog);
      continue;
    }

    // Extract identity via LLM
    const { identity, cost } = await extractIdentity(doc.channel, doc.recentVideos);
    costs.openrouterHaiku += cost;

    if (!identity) {
      gatedOut++;
      addGateReason("identity_extraction_failed");
      debugLog.phase2Identity = "FAIL: LLM extraction returned null";
      debugLog.finalStatus = "Gated: identity extraction failed";
      debugLogs.push(debugLog);
      continue;
    }

    if (!identity.isMedicalDoctor) {
      gatedOut++;
      addGateReason("not_medical_doctor");
      debugLog.phase2Identity = `FAIL: Not a medical doctor (${identity.reasoning})`;
      debugLog.finalStatus = "Gated: not a medical doctor";
      debugLogs.push(debugLog);
      continue;
    }

    // Country filter — skip non-US doctors before expensive enrichment
    if (!isLikelyUS(doc.channel, identity)) {
      gatedOut++;
      addGateReason("non_us");
      debugLog.phase2Identity = `FAIL: Non-US doctor (country: ${doc.channel.country}, location: ${identity.stateOrLocation})`;
      debugLog.finalStatus = "Gated: non-US doctor";
      debugLogs.push(debugLog);
      continue;
    }

    debugLog.phase2Identity = `SUCCESS: ${identity.fullDisplay || "Unknown"} (${identity.credentials || "no creds"}, confidence: ${identity.confidence})`;
    passed.push({ doctor: doc, identity });
    debugLogs.push(debugLog);

    if ((i + 1) % 5 === 0) {
      onProgress({ type: "progress", phase: 2, processed: i + 1, total: discovered.length, passed: passed.length });
    }
  }

  onProgress({ type: "phase", phase: 2, label: `${passed.length} doctors identified, ${gatedOut} filtered`, count: passed.length });

  // ========== PHASE 3: Verification + Enrichment ==========
  onProgress({ type: "phase", phase: 3, label: "Verifying credentials and finding contact info..." });

  const verified: VerifiedDoctor[] = [];

  for (let i = 0; i < passed.length; i++) {
    const { doctor, identity } = passed[i];
    // Find the debug log for this doctor
    const debugLog = debugLogs.find((d) => d.channelTitle === doctor.channel.title);
    const enrichmentLog: string[] = [];

    // NPI lookup
    let npiResult = { matches: [] as unknown[], totalCount: 0 };
    if (identity.lastName) {
      npiResult = await verifyWithNPI(identity.firstName || "", identity.lastName, identity.stateOrLocation);
    }

    const verification = computeVerification(identity, npiResult.matches as never[], npiResult.totalCount);

    if (debugLog) {
      debugLog.phase3Verification = `${verification.tier.toUpperCase()} (confidence: ${verification.confidence}%, NPI: ${verification.npiMatch?.npiNumber || "none"})`;
    }

    // ========== Contact Enrichment ==========
    const sourcesChecked: ContactSource[] = [];
    const contact: ContactInfo = {
      email: null, emailSource: null,
      phone: null, phoneSource: null,
      linkedinUrl: null, linkedinSource: null,
      doximityUrl: null, doximitySource: null,
      website: null, websiteSource: null,
      instagramHandle: null, practiceDomain: null,
      allSourcesChecked: sourcesChecked,
    };

    // Step 1: YouTube description extraction (free)
    sourcesChecked.push("youtube_description");
    sourceCounters.ytDescSearched++;
    const ytContact = extractContactFromDescription(doctor.channel.description);

    if (ytContact.email) {
      contact.email = ytContact.email; contact.emailSource = "youtube_description";
      incrementSource("email", "youtube_description");
      sourceCounters.ytDescEmailFound++;
      enrichmentLog.push(`YouTube description: EMAIL found (${ytContact.email})`);
    }
    if (ytContact.phone) {
      contact.phone = ytContact.phone; contact.phoneSource = "youtube_description";
      incrementSource("phone", "youtube_description");
      enrichmentLog.push(`YouTube description: PHONE found`);
    }
    if (ytContact.linkedinUrl) {
      contact.linkedinUrl = ytContact.linkedinUrl; contact.linkedinSource = "youtube_description";
      incrementSource("linkedin", "youtube_description");
      sourceCounters.ytDescLinkedinFound++;
      enrichmentLog.push(`YouTube description: LINKEDIN found`);
    }
    if (ytContact.instagramHandle) contact.instagramHandle = ytContact.instagramHandle;
    if (ytContact.website) {
      contact.website = ytContact.website; contact.websiteSource = "youtube_description";
      incrementSource("website", "youtube_description");
    }
    if (ytContact.practiceDomain) contact.practiceDomain = ytContact.practiceDomain;

    if (!ytContact.email && !ytContact.linkedinUrl) {
      enrichmentLog.push("YouTube description: No email or LinkedIn found");
    }

    // Step 2: Exa enrichment (3 parallel searches)
    const doctorName = identity.fullDisplay
      || [identity.firstName, identity.lastName].filter(Boolean).join(" ")
      || doctor.channel.title;

    sourceCounters.exaLinkedinSearched++;
    sourceCounters.exaDoximitySearched++;
    sourceCounters.exaPracticeSearched++;

    // Build match context for multi-signal profile scoring
    const matchContext: ProfileMatchContext = {
      firstName: identity.firstName,
      lastName: identity.lastName,
      credentials: identity.credentials,
      city: verification.npiMatch?.practiceAddress?.city || null,
      state: verification.npiMatch?.practiceAddress?.state || identity.stateOrLocation,
    };

    const exaResult = await enrichWithExa(doctorName, identity.credentials, identity.stateOrLocation, matchContext);
    costs.exa += exaResult.exaCost;

    if (exaResult.linkedinUrl && !contact.linkedinUrl) {
      contact.linkedinUrl = exaResult.linkedinUrl;
      contact.linkedinSource = "exa_linkedin";
      sourcesChecked.push("exa_linkedin");
      incrementSource("linkedin", "exa_linkedin");
      sourceCounters.exaLinkedinFound++;
      enrichmentLog.push(`Exa LinkedIn: SUCCESS score=${exaResult.linkedinScore} [${exaResult.linkedinBreakdown}] (${exaResult.linkedinUrl})`);
    } else if (exaResult.linkedinUrl) {
      enrichmentLog.push(`Exa LinkedIn: Found but already had from YouTube`);
    } else {
      enrichmentLog.push(`Exa LinkedIn: FAILED (${exaResult.searchDetails.linkedinResults} results, none scored ≥50)`);
    }

    if (exaResult.doximityUrl) {
      contact.doximityUrl = exaResult.doximityUrl;
      contact.doximitySource = "exa_doximity";
      sourcesChecked.push("exa_doximity");
      incrementSource("doximity", "exa_doximity");
      sourceCounters.exaDoximityFound++;
      enrichmentLog.push(`Exa Doximity: SUCCESS score=${exaResult.doximityScore} [${exaResult.doximityBreakdown}] (${exaResult.doximityUrl})`);
    } else {
      enrichmentLog.push(`Exa Doximity: FAILED (${exaResult.searchDetails.doximityResults} results, none scored ≥50)`);
    }

    if (exaResult.practiceUrl && !contact.website) {
      contact.website = exaResult.practiceUrl;
      contact.websiteSource = "exa_practice";
      sourcesChecked.push("exa_practice");
      incrementSource("website", "exa_practice");
    }
    if (exaResult.practiceEmail && !contact.email) {
      contact.email = exaResult.practiceEmail;
      contact.emailSource = "exa_practice";
      incrementSource("email", "exa_practice");
      sourceCounters.exaPracticeEmailFound++;
      enrichmentLog.push(`Exa Practice: EMAIL found (${exaResult.practiceEmail})`);
    }
    if (exaResult.practicePhone && !contact.phone) {
      contact.phone = exaResult.practicePhone;
      contact.phoneSource = "exa_practice";
      incrementSource("phone", "exa_practice");
      enrichmentLog.push(`Exa Practice: PHONE found`);
    }

    if (!contact.practiceDomain && exaResult.practiceUrl) {
      contact.practiceDomain = extractDomainFromUrl(exaResult.practiceUrl);
    }

    // Step 3: Hunter.io (if domain but no email)
    if (contact.practiceDomain && !contact.email && identity.firstName && identity.lastName) {
      sourcesChecked.push("hunter");
      sourceCounters.hunterSearched++;
      const hunterResult = await findEmailWithHunter(contact.practiceDomain, identity.firstName, identity.lastName);
      if (hunterResult.email) {
        contact.email = hunterResult.email;
        contact.emailSource = "hunter";
        incrementSource("email", "hunter");
        sourceCounters.hunterFound++;
        enrichmentLog.push(`Hunter.io: EMAIL found (${hunterResult.email}, score: ${hunterResult.score})`);
      } else {
        enrichmentLog.push(`Hunter.io: FAILED for domain ${contact.practiceDomain}`);
      }
    } else if (!contact.practiceDomain) {
      enrichmentLog.push("Hunter.io: SKIPPED (no practice domain)");
    } else if (contact.email) {
      enrichmentLog.push("Hunter.io: SKIPPED (already have email)");
    }

    // Step 4: Snov.io (last resort for email)
    if (contact.practiceDomain && !contact.email && identity.firstName && identity.lastName) {
      sourcesChecked.push("snov");
      sourceCounters.snovSearched++;
      const snovResult = await findEmailWithSnov(contact.practiceDomain, identity.firstName, identity.lastName);
      if (snovResult.email) {
        contact.email = snovResult.email;
        contact.emailSource = "snov";
        incrementSource("email", "snov");
        sourceCounters.snovFound++;
        enrichmentLog.push(`Snov.io: EMAIL found (${snovResult.email})`);
      } else {
        enrichmentLog.push(`Snov.io: FAILED for domain ${contact.practiceDomain}`);
      }
    } else if (contact.email) {
      enrichmentLog.push("Snov.io: SKIPPED (already have email)");
    }

    // Step 5: NPI phone fallback
    if (!contact.phone && verification.npiMatch?.practiceAddress?.phone) {
      contact.phone = verification.npiMatch.practiceAddress.phone;
      contact.phoneSource = "npi";
      sourcesChecked.push("npi");
      incrementSource("phone", "npi");
      enrichmentLog.push(`NPI phone: SUCCESS (${contact.phone})`);
    }

    // Build final status
    const contactMethods = [
      contact.email ? "email" : null,
      contact.linkedinUrl ? "linkedin" : null,
      contact.doximityUrl ? "doximity" : null,
      contact.phone ? "phone" : null,
    ].filter(Boolean);

    if (debugLog) {
      debugLog.phase3Enrichment = enrichmentLog;
      debugLog.finalStatus = contactMethods.length > 0
        ? `${verification.tier.toUpperCase()} — Contact: ${contactMethods.join(", ")}`
        : `${verification.tier.toUpperCase()} — NO CONTACT (investigate)`;
    }

    verified.push({
      channel: doctor.channel,
      recentVideos: doctor.recentVideos,
      identity,
      verification,
      contact,
      discoveredAt: new Date().toISOString(),
    });

    onProgress({
      type: "progress", phase: 3, processed: i + 1, total: passed.length,
      doctor: identity.fullDisplay || doctor.channel.title,
      tier: verification.tier,
    });
  }

  // ========== Calculate Results ==========
  costs.total = costs.openrouterHaiku + costs.openrouterSonnet + costs.exa + costs.hunter + costs.snov;

  // Build API effectiveness metrics
  const apiEffectiveness: ApiEffectiveness[] = [
    {
      provider: "YouTube Description",
      searched: sourceCounters.ytDescSearched,
      found: sourceCounters.ytDescEmailFound + sourceCounters.ytDescLinkedinFound,
      hitRate: sourceCounters.ytDescSearched > 0
        ? Math.round(((sourceCounters.ytDescEmailFound + sourceCounters.ytDescLinkedinFound) / sourceCounters.ytDescSearched) * 100)
        : 0,
      costPerSuccess: 0,
    },
    {
      provider: "Exa LinkedIn",
      searched: sourceCounters.exaLinkedinSearched,
      found: sourceCounters.exaLinkedinFound,
      hitRate: sourceCounters.exaLinkedinSearched > 0
        ? Math.round((sourceCounters.exaLinkedinFound / sourceCounters.exaLinkedinSearched) * 100)
        : 0,
      costPerSuccess: sourceCounters.exaLinkedinFound > 0
        ? (sourceCounters.exaLinkedinSearched * 0.005) / sourceCounters.exaLinkedinFound
        : 0,
    },
    {
      provider: "Exa Doximity",
      searched: sourceCounters.exaDoximitySearched,
      found: sourceCounters.exaDoximityFound,
      hitRate: sourceCounters.exaDoximitySearched > 0
        ? Math.round((sourceCounters.exaDoximityFound / sourceCounters.exaDoximitySearched) * 100)
        : 0,
      costPerSuccess: sourceCounters.exaDoximityFound > 0
        ? (sourceCounters.exaDoximitySearched * 0.005) / sourceCounters.exaDoximityFound
        : 0,
    },
    {
      provider: "Exa Practice (Email)",
      searched: sourceCounters.exaPracticeSearched,
      found: sourceCounters.exaPracticeEmailFound,
      hitRate: sourceCounters.exaPracticeSearched > 0
        ? Math.round((sourceCounters.exaPracticeEmailFound / sourceCounters.exaPracticeSearched) * 100)
        : 0,
      costPerSuccess: sourceCounters.exaPracticeEmailFound > 0
        ? (sourceCounters.exaPracticeSearched * 0.006) / sourceCounters.exaPracticeEmailFound
        : 0,
    },
    {
      provider: "Hunter.io",
      searched: sourceCounters.hunterSearched,
      found: sourceCounters.hunterFound,
      hitRate: sourceCounters.hunterSearched > 0
        ? Math.round((sourceCounters.hunterFound / sourceCounters.hunterSearched) * 100)
        : 0,
      costPerSuccess: 0,
    },
    {
      provider: "Snov.io",
      searched: sourceCounters.snovSearched,
      found: sourceCounters.snovFound,
      hitRate: sourceCounters.snovSearched > 0
        ? Math.round((sourceCounters.snovFound / sourceCounters.snovSearched) * 100)
        : 0,
      costPerSuccess: 0,
    },
  ];

  const sourceStats: SourceStats = {
    emailSources: sourceCounters.emailSources,
    phoneSources: sourceCounters.phoneSources,
    linkedinSources: sourceCounters.linkedinSources,
    doximitySources: sourceCounters.doximitySources,
    websiteSources: sourceCounters.websiteSources,
    apiEffectiveness,
  };

  return {
    doctors: verified,
    costs,
    stats: {
      discovered: discovered.length,
      gated: gatedOut,
      gatedReasons,
      identified: passed.length,
      verified: verified.length,
      withEmail: verified.filter((d) => d.contact.email).length,
      withLinkedIn: verified.filter((d) => d.contact.linkedinUrl).length,
      withDoximity: verified.filter((d) => d.contact.doximityUrl).length,
      withPhone: verified.filter((d) => d.contact.phone).length,
    },
    sourceStats,
    debugLogs,
    startedAt,
    completedAt: new Date().toISOString(),
  };
}
