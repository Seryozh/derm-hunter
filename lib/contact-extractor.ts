// Extract contact info from YouTube channel description using regex
// This is the first (free) step in the contact enrichment waterfall

import { ContactInfo } from "./types";

const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const LINKEDIN_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/gi;
const INSTAGRAM_REGEX = /@([\w.]+)|instagram\.com\/([\w.]+)/gi;
const WEBSITE_REGEX = /(?:https?:\/\/)?(?:www\.)?[\w-]+\.(?:com|org|net|io|co|health|clinic|med|doctor)(?:\/[\w-]*)*/gi;

// Domains to exclude from "website" extraction
const EXCLUDED_DOMAINS = [
  "youtube.com", "youtu.be", "facebook.com", "twitter.com",
  "instagram.com", "tiktok.com", "linkedin.com", "doximity.com",
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
  "patreon.com", "linktr.ee",
];

export function extractContactFromDescription(description: string): Partial<ContactInfo> {
  const result: Partial<ContactInfo> = {};

  // Extract email
  const emails = description.match(EMAIL_REGEX) || [];
  const validEmails = emails.filter(
    (e) => !e.endsWith(".png") && !e.endsWith(".jpg") && !e.includes("example")
  );
  if (validEmails.length > 0) {
    result.email = validEmails[0];
    result.emailSource = "youtube_description";
  }

  // Extract phone
  const phones = description.match(PHONE_REGEX);
  if (phones && phones.length > 0) {
    result.phone = phones[0]!.replace(/[^\d+]/g, "");
    result.phoneSource = "youtube_description";
  }

  // Extract LinkedIn
  const linkedins = description.match(LINKEDIN_REGEX);
  if (linkedins && linkedins[0]) {
    let url = linkedins[0];
    if (!url.startsWith("http")) url = "https://" + url;
    result.linkedinUrl = url;
    result.linkedinSource = "youtube_description";
  }

  // Extract Instagram
  const igMatches = [...description.matchAll(INSTAGRAM_REGEX)];
  if (igMatches.length > 0) {
    result.instagramHandle = igMatches[0][1] || igMatches[0][2] || null;
  }

  // Extract website (practice domain)
  const websites = description.match(WEBSITE_REGEX) || [];
  const practiceWebsites = websites.filter((w) => {
    const lower = w.toLowerCase();
    return !EXCLUDED_DOMAINS.some((d) => lower.includes(d));
  });
  if (practiceWebsites.length > 0) {
    let site = practiceWebsites[0];
    if (!site.startsWith("http")) site = "https://" + site;
    result.website = site;
    // Extract domain for Hunter/Snov
    try {
      const parsed = new URL(site);
      result.practiceDomain = parsed.hostname.replace("www.", "");
    } catch {
      // ignore parse errors
    }
  }

  return result;
}

// Extract domain from a URL for use with Hunter/Snov
export function extractDomainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace("www.", "");
  } catch {
    return null;
  }
}
