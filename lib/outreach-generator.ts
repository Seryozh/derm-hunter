// On-demand outreach generation — generates per-doctor, per-channel
// Only called when user clicks "Generate Outreach" button

import { callLLM, extractJSON, estimateCost } from "./llm";
import { VerifiedDoctor, OutreachAssets, EmailVariant } from "./types";

const SYSTEM_PROMPT = `You are an expert B2B sales copywriter specializing in healthcare SaaS.
You write outreach messages for Future Clinic, a platform that helps doctors monetize their online following
through virtual consultations, digital products, and membership programs.

Key selling points:
- Doctors keep 100% of their existing practice
- Future Clinic adds a new revenue stream from their online audience
- Platform handles scheduling, payments, content delivery
- HIPAA compliant
- Other doctors with similar followings are already earning $X/month

Tone: Professional but warm. Doctor-to-doctor feel (CEO Usama Syed is a dermatologist).
Never be pushy. Focus on value and peer credibility.`;

function buildOutreachPrompt(doctor: VerifiedDoctor): string {
  const name = doctor.identity.fullDisplay || doctor.channel.title;
  const subs = doctor.channel.subscriberCount.toLocaleString();
  const hasEmail = !!doctor.contact.email;
  const hasLinkedin = !!doctor.contact.linkedinUrl;
  const hasDoximity = !!doctor.contact.doximityUrl;
  const hasPhone = !!doctor.contact.phone;

  return `Generate outreach content for this doctor:

Name: ${name}
YouTube Channel: ${doctor.channel.title} (${subs} subscribers)
Credentials: ${doctor.identity.credentials || "Unknown"}
Location: ${doctor.identity.stateOrLocation || "Unknown"}
Verification: ${doctor.verification.tier} tier (${doctor.verification.confidence}% confidence)
Recent Videos: ${doctor.recentVideos.slice(0, 3).map((v) => v.title).join(", ")}

Generate ONLY the channels that apply:
${hasEmail ? "- EMAIL: 3 variants (monetization angle, peer credibility angle, patient demand angle) + 1 follow-up" : ""}
${hasLinkedin ? "- LINKEDIN: connection request (300 char max) + InMail (1900 char max)" : ""}
${hasDoximity ? "- DOXIMITY: doctor-to-doctor message" : ""}
${hasPhone ? "- PHONE: cold call script + SMS (160 char max)" : ""}

Respond in valid JSON:
{
  ${hasEmail ? `"emailVariants": [
    {"subject": "...", "body": "...", "angle": "monetization"},
    {"subject": "...", "body": "...", "angle": "peer_credibility"},
    {"subject": "...", "body": "...", "angle": "patient_demand"}
  ],
  "emailFollowUp": {"subject": "...", "body": "..."},` : `"emailVariants": null, "emailFollowUp": null,`}
  ${hasLinkedin ? `"linkedinConnectionRequest": "...",
  "linkedinInMail": "...",` : `"linkedinConnectionRequest": null, "linkedinInMail": null,`}
  ${hasDoximity ? `"doximityMessage": "...",` : `"doximityMessage": null,`}
  ${hasPhone ? `"coldCallScript": "...",
  "smsMessage": "..."` : `"coldCallScript": null, "smsMessage": null`}
}`;
}

interface OutreachResult {
  assets: OutreachAssets | null;
  cost: number;
}

export async function generateOutreach(doctor: VerifiedDoctor): Promise<OutreachResult> {
  try {
    const prompt = buildOutreachPrompt(doctor);
    const response = await callLLM(prompt, "anthropic/claude-sonnet-4.5", SYSTEM_PROMPT, 0.7, { jsonMode: true });
    const cost = estimateCost("anthropic/claude-sonnet-4.5", response.inputTokens, response.outputTokens);

    const jsonStr = extractJSON(response.content);
    const parsed = JSON.parse(jsonStr);

    const assets: OutreachAssets = {
      emailVariants: parsed.emailVariants
        ? parsed.emailVariants.map((v: EmailVariant) => ({
            subject: v.subject,
            body: v.body,
            angle: v.angle,
          }))
        : null,
      emailFollowUp: parsed.emailFollowUp || null,
      linkedinConnectionRequest: parsed.linkedinConnectionRequest || null,
      linkedinInMail: parsed.linkedinInMail || null,
      doximityMessage: parsed.doximityMessage || null,
      coldCallScript: parsed.coldCallScript || null,
      smsMessage: parsed.smsMessage || null,
      generatedAt: new Date().toISOString(),
    };

    return { assets, cost };
  } catch (err) {
    console.error(`Outreach generation failed for ${doctor.channel.title}:`, err);
    return { assets: null, cost: 0 };
  }
}
