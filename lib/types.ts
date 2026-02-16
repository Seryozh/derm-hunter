// ============================================================================
// PIPELINE TYPES — The backbone of the Derm Hunter engine
// ============================================================================

// --- Phase 1: Discovery (YouTube) ---

export interface RawChannel {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: number; // Parsed from string
  videoCount: number;
  viewCount: number;
  country: string | null;
  customUrl: string | null; // @handle
  uploadsPlaylistId: string | null;
  discoveryQuery: string; // Which search query found this
}

export interface RecentVideo {
  videoId: string;
  title: string;
  publishedAt: string; // ISO date
}

export interface DiscoveredDoctor {
  channel: RawChannel;
  recentVideos: RecentVideo[];
  lastUploadDate: string | null; // ISO date of most recent video
}

// --- Phase 2: Gate + Intelligence ---

export interface GateResult {
  passed: boolean;
  reason?: string; // Why it was filtered out
}

export interface ExtractedIdentity {
  firstName: string | null;
  lastName: string | null;
  fullDisplay: string | null; // "Dr. Sandra Lee, MD, FAAD"
  credentials: string | null; // "MD", "DO", "MBBS", etc.
  isMedicalDoctor: boolean;
  isDermatologist: boolean;
  boardCertified: boolean | null;
  hospitalAffiliation: string | null;
  stateOrLocation: string | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

export interface IntelligenceResult {
  channel: RawChannel;
  recentVideos: RecentVideo[];
  gate: GateResult;
  identity: ExtractedIdentity | null; // null if gate failed
}

// --- Phase 3A: NPI Verification ---

export type VerificationTier = "gold" | "silver" | "bronze";

export interface NPIMatch {
  npiNumber: number;
  firstName: string;
  lastName: string;
  credential: string;
  status: string; // "A" = active
  taxonomyDescription: string;
  taxonomyCode: string;
  isPrimary: boolean;
  practiceAddress: {
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    phone: string | null;
  } | null;
}

export interface VerificationResult {
  tier: VerificationTier;
  npiMatch: NPIMatch | null;
  matchCount: number; // How many NPI results came back
  confidence: number; // 0-100
  reasoning: string;
}

// --- Phase 3B: Contact Enrichment ---

export type ContactSource =
  | "youtube_description"
  | "exa_linkedin"
  | "exa_doximity"
  | "exa_practice"
  | "npi"
  | "hunter"
  | "snov"
  | "manual";

export interface ContactInfo {
  email: string | null;
  emailSource: ContactSource | null;
  phone: string | null;
  phoneSource: ContactSource | null;
  linkedinUrl: string | null;
  linkedinSource: ContactSource | null;
  doximityUrl: string | null;
  doximitySource: ContactSource | null;
  website: string | null;
  websiteSource: ContactSource | null;
  instagramHandle: string | null;
  practiceDomain: string | null; // Extracted for Hunter/Snov
  allSourcesChecked: ContactSource[];
}

// --- Combined: Verified Doctor (output of Phases 1-3) ---

export interface VerifiedDoctor {
  // Identity
  channel: RawChannel;
  recentVideos: RecentVideo[];
  identity: ExtractedIdentity;

  // Verification
  verification: VerificationResult;

  // Contact
  contact: ContactInfo;

  // Metadata
  discoveredAt: string; // ISO timestamp
}

// --- Phase 4: Outreach (On-Demand) ---

export interface EmailVariant {
  subject: string;
  body: string;
  angle: "monetization" | "peer_credibility" | "patient_demand";
}

export interface OutreachAssets {
  // Email (if email found)
  emailVariants: EmailVariant[] | null;
  emailFollowUp: { subject: string; body: string } | null;

  // LinkedIn (if LinkedIn found)
  linkedinConnectionRequest: string | null; // 300 char max
  linkedinInMail: string | null; // 1900 char max

  // Doximity (if Doximity found)
  doximityMessage: string | null;

  // Phone (if phone only)
  coldCallScript: string | null;
  smsMessage: string | null; // 160 char max

  generatedAt: string; // ISO timestamp
}

// --- Phase 4B: Mock Landing Page ---

export interface MockLandingPage {
  doctorName: string;
  specialty: string;
  heroTagline: string;
  subscriberProof: string;
  services: string[];
  monthlyPrice: string;
  avatarUrl: string;
  youtubeUrl: string;
  ctaText: string;
  generatedAt: string;
}

// --- Phase 5: Campaign Projections ---

export interface CampaignProjections {
  // Inputs
  totalDiscovered: number;
  totalVerified: number;
  withEmail: number;
  withLinkedIn: number;
  withDoximity: number;
  withPhone: number;

  // Email channel
  emailSent: number;
  emailOpened: number;
  emailReplied: number;
  emailDemos: number;

  // LinkedIn channel
  linkedinSent: number;
  linkedinAccepted: number;
  linkedinReplied: number;
  linkedinDemos: number;

  // Doximity channel
  doximitySent: number;
  doximityReplied: number;
  doximityDemos: number;

  // Phone channel
  phoneCalls: number;
  phoneConnected: number;
  phoneInterested: number;
  phoneDemos: number;

  // Combined
  totalDemos: number;
  signUps: number;
  revenuePerDoctor: number;
  projectedAnnualRevenue: number;
  campaignCost: number;
  roi: number;
}

// --- Pipeline Run ---

export interface PipelineProgress {
  phase: 1 | 2 | 3 | 4 | 5;
  phaseLabel: string;
  totalInPhase: number;
  processedInPhase: number;
  errors: string[];
}

export interface CostBreakdown {
  youtube: number;
  openrouterHaiku: number;
  openrouterSonnet: number;
  exa: number;
  hunter: number;
  snov: number;
  npi: number; // Always 0
  total: number;
}

export interface ApiEffectiveness {
  provider: string;
  searched: number;
  found: number;
  hitRate: number; // 0-100
  costPerSuccess: number;
}

export interface SourceStats {
  emailSources: Record<string, number>;
  phoneSources: Record<string, number>;
  linkedinSources: Record<string, number>;
  doximitySources: Record<string, number>;
  websiteSources: Record<string, number>;
  apiEffectiveness: ApiEffectiveness[];
}

export interface DoctorDebugLog {
  channelTitle: string;
  phase1: string; // discovery query
  phase2Gate: string; // PASS/FAIL + reason
  phase2Identity: string; // SUCCESS/FAIL + details
  phase3Verification: string; // tier + NPI details
  phase3Enrichment: string[]; // per-source results
  finalStatus: string; // summary
}

export interface PipelineRunResult {
  doctors: VerifiedDoctor[];
  costs: CostBreakdown;
  stats: {
    discovered: number;
    gated: number;
    gatedReasons: Record<string, number>;
    identified: number;
    verified: number;
    withEmail: number;
    withLinkedIn: number;
    withDoximity: number;
    withPhone: number;
  };
  sourceStats: SourceStats;
  debugLogs: DoctorDebugLog[];
  startedAt: string;
  completedAt: string;
}
