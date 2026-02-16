// Phase 3B: Contact Enrichment
// Waterfall: YouTube description → Exa (LinkedIn/Doximity/Practice) → Hunter → Snov

import { NextResponse } from "next/server";
import { extractContactFromDescription, extractDomainFromUrl } from "../../../../lib/contact-extractor";
import { enrichWithExa, ProfileMatchContext } from "../../../../lib/exa-enrichment";
import { findEmailWithHunter } from "../../../../lib/hunter";
import { findEmailWithSnov } from "../../../../lib/snov";
import { IntelligenceResult, VerificationResult, ContactInfo, ContactSource } from "../../../../lib/types";

interface EnrichInput {
  result: IntelligenceResult;
  verification: VerificationResult;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const inputs: EnrichInput[] = body.verifications || [];

    const enriched: { input: EnrichInput; contact: ContactInfo }[] = [];
    let exaCost = 0;

    for (const input of inputs) {
      const { result, verification } = input;
      const identity = result.identity;
      if (!identity) continue;

      const sourcesChecked: ContactSource[] = [];
      const contact: ContactInfo = {
        email: null,
        emailSource: null,
        phone: null,
        phoneSource: null,
        linkedinUrl: null,
        linkedinSource: null,
        doximityUrl: null,
        doximitySource: null,
        website: null,
        websiteSource: null,
        instagramHandle: null,
        practiceDomain: null,
        allSourcesChecked: sourcesChecked,
      };

      // Step 1: Extract from YouTube description (free)
      sourcesChecked.push("youtube_description");
      const ytContact = extractContactFromDescription(result.channel.description);
      if (ytContact.email) { contact.email = ytContact.email; contact.emailSource = "youtube_description"; }
      if (ytContact.phone) { contact.phone = ytContact.phone; contact.phoneSource = "youtube_description"; }
      if (ytContact.linkedinUrl) { contact.linkedinUrl = ytContact.linkedinUrl; contact.linkedinSource = "youtube_description"; }
      if (ytContact.instagramHandle) contact.instagramHandle = ytContact.instagramHandle;
      if (ytContact.website) { contact.website = ytContact.website; contact.websiteSource = "youtube_description"; }
      if (ytContact.practiceDomain) contact.practiceDomain = ytContact.practiceDomain;

      // Step 2: Exa enrichment (3 searches, ~$0.015)
      const doctorName = identity.fullDisplay
        || [identity.firstName, identity.lastName].filter(Boolean).join(" ")
        || result.channel.title;

      const matchCtx: ProfileMatchContext = {
        firstName: identity.firstName,
        lastName: identity.lastName,
        credentials: identity.credentials,
        city: verification.npiMatch?.practiceAddress?.city || null,
        state: verification.npiMatch?.practiceAddress?.state || identity.stateOrLocation,
      };

      const exaResult = await enrichWithExa(
        doctorName,
        identity.credentials,
        identity.stateOrLocation,
        matchCtx
      );
      exaCost += exaResult.exaCost;

      if (exaResult.linkedinUrl && !contact.linkedinUrl) {
        contact.linkedinUrl = exaResult.linkedinUrl;
        contact.linkedinSource = "exa_linkedin";
        sourcesChecked.push("exa_linkedin");
      }
      if (exaResult.doximityUrl) {
        contact.doximityUrl = exaResult.doximityUrl;
        contact.doximitySource = "exa_doximity";
        sourcesChecked.push("exa_doximity");
      }
      if (exaResult.practiceUrl && !contact.website) {
        contact.website = exaResult.practiceUrl;
        contact.websiteSource = "exa_practice";
        sourcesChecked.push("exa_practice");
      }
      if (exaResult.practiceEmail && !contact.email) {
        contact.email = exaResult.practiceEmail;
        contact.emailSource = "exa_practice";
      }
      if (exaResult.practicePhone && !contact.phone) {
        contact.phone = exaResult.practicePhone;
        contact.phoneSource = "exa_practice";
      }

      // Extract domain from practice URL if we don't have one yet
      if (!contact.practiceDomain && exaResult.practiceUrl) {
        contact.practiceDomain = extractDomainFromUrl(exaResult.practiceUrl);
      }

      // Step 3: Hunter.io (if we have domain but no email)
      if (contact.practiceDomain && !contact.email && identity.firstName && identity.lastName) {
        sourcesChecked.push("hunter");
        const hunterResult = await findEmailWithHunter(
          contact.practiceDomain,
          identity.firstName,
          identity.lastName
        );
        if (hunterResult.email) {
          contact.email = hunterResult.email;
          contact.emailSource = "hunter";
        }
      }

      // Step 4: Snov.io (if still no email and we have domain)
      if (contact.practiceDomain && !contact.email && identity.firstName && identity.lastName) {
        sourcesChecked.push("snov");
        const snovResult = await findEmailWithSnov(
          contact.practiceDomain,
          identity.firstName,
          identity.lastName
        );
        if (snovResult.email) {
          contact.email = snovResult.email;
          contact.emailSource = "snov";
        }
      }

      // Step 5: NPI phone fallback
      if (!contact.phone && verification.npiMatch?.practiceAddress?.phone) {
        contact.phone = verification.npiMatch.practiceAddress.phone;
        contact.phoneSource = "npi";
        sourcesChecked.push("npi");
      }

      enriched.push({ input, contact });
    }

    const withEmail = enriched.filter((e) => e.contact.email).length;
    const withLinkedin = enriched.filter((e) => e.contact.linkedinUrl).length;
    const withDoximity = enriched.filter((e) => e.contact.doximityUrl).length;
    const withPhone = enriched.filter((e) => e.contact.phone).length;

    return NextResponse.json({
      enriched,
      stats: {
        total: enriched.length,
        withEmail,
        withLinkedin,
        withDoximity,
        withPhone,
      },
      costs: { exa: exaCost, hunter: 0, snov: 0 },
    });
  } catch (error) {
    console.error("Enrichment failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enrichment failed" },
      { status: 500 }
    );
  }
}
