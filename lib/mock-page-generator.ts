// Generate mock Future Clinic landing page data for a verified doctor

import { VerifiedDoctor, MockLandingPage } from "./types";

export function generateMockPage(doctor: VerifiedDoctor): MockLandingPage {
  const name = doctor.identity.fullDisplay || doctor.channel.title;
  const subs = doctor.channel.subscriberCount;
  const customUrl = doctor.channel.customUrl;
  const youtubeUrl = customUrl
    ? `https://youtube.com/${customUrl}`
    : `https://youtube.com/channel/${doctor.channel.channelId}`;

  // Determine services based on video content
  const videoTitles = doctor.recentVideos.map((v) => v.title.toLowerCase()).join(" ");
  const services: string[] = [];

  if (videoTitles.includes("acne") || videoTitles.includes("skin care") || videoTitles.includes("skincare")) {
    services.push("Acne Treatment Consultation");
  }
  if (videoTitles.includes("botox") || videoTitles.includes("filler") || videoTitles.includes("cosmetic")) {
    services.push("Cosmetic Dermatology Consultation");
  }
  if (videoTitles.includes("cancer") || videoTitles.includes("mole") || videoTitles.includes("melanoma")) {
    services.push("Skin Cancer Screening");
  }
  if (videoTitles.includes("eczema") || videoTitles.includes("psoriasis") || videoTitles.includes("rash")) {
    services.push("Chronic Skin Condition Management");
  }
  if (videoTitles.includes("laser") || videoTitles.includes("resurfacing")) {
    services.push("Laser Treatment Consultation");
  }

  // Default services if none matched
  if (services.length === 0) {
    services.push("Virtual Dermatology Consultation", "Skin Health Assessment", "Treatment Plan Review");
  }

  // Pricing based on subscriber count
  let monthlyPrice: string;
  if (subs >= 500000) {
    monthlyPrice = "$99/month";
  } else if (subs >= 100000) {
    monthlyPrice = "$79/month";
  } else if (subs >= 50000) {
    monthlyPrice = "$59/month";
  } else {
    monthlyPrice = "$49/month";
  }

  return {
    doctorName: name,
    specialty: doctor.identity.isDermatologist ? "Board-Certified Dermatologist" : "Dermatology Specialist",
    heroTagline: `Get personalized skin care advice from ${name.split(",")[0]}`,
    subscriberProof: `Trusted by ${formatNumber(subs)} subscribers`,
    services,
    monthlyPrice,
    avatarUrl: doctor.channel.thumbnailUrl,
    youtubeUrl,
    ctaText: "Book Your Virtual Consultation",
    generatedAt: new Date().toISOString(),
  };
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}
