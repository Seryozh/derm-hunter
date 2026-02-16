// Exa AI enrichment — 3 targeted searches per doctor
// LinkedIn profile (category: people), Doximity profile, Practice/contact page
// Multi-signal scoring for LinkedIn + Doximity validation

interface ExaResult {
  url: string;
  title: string;
  text?: string;
  highlights?: string[];
  summary?: string;
}

interface ExaSearchResponse {
  results: ExaResult[];
}

function getApiKey(): string {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error("EXA_API_KEY not set");
  return key;
}

interface ExaSearchOptions {
  includeDomains?: string[];
  excludeDomains?: string[];
  numResults?: number;
  useAutoprompt?: boolean;
  type?: "neural" | "keyword" | "auto";
  category?: "people" | "company" | "news";
  contents?: {
    text?: { maxCharacters: number };
    highlights?: { query?: string; maxCharacters?: number };
    summary?: { query?: string };
  };
}

async function exaSearch(
  query: string,
  options: ExaSearchOptions = {}
): Promise<ExaResult[]> {
  const body: Record<string, unknown> = {
    query,
    numResults: options.numResults || 5,
    useAutoprompt: options.useAutoprompt ?? true,
    type: options.type || "auto",
  };

  if (options.includeDomains) body.includeDomains = options.includeDomains;
  if (options.excludeDomains) body.excludeDomains = options.excludeDomains;
  if (options.category) body.category = options.category;
  if (options.contents) body.contents = options.contents;

  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "x-api-key": getApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`Exa search failed: ${response.status} — ${errorBody}`);
      return [];
    }

    const data: ExaSearchResponse = await response.json();
    return data.results || [];
  } catch (err) {
    console.error("Exa search error:", err);
    return [];
  }
}

// ========== Multi-Signal Profile Scoring ==========

export interface ProfileMatchContext {
  firstName: string | null;
  lastName: string | null;
  credentials: string | null;
  city: string | null;    // From NPI practiceAddress
  state: string | null;   // From identity.stateOrLocation or NPI
}

interface ScoredResult {
  result: ExaResult;
  score: number;
  breakdown: string;
}

// Top 200 most common US surnames — used to add location hints for disambiguation
const COMMON_SURNAMES = new Set([
  "smith", "johnson", "williams", "brown", "jones", "garcia", "miller", "davis",
  "rodriguez", "martinez", "hernandez", "lopez", "gonzalez", "wilson", "anderson",
  "thomas", "taylor", "moore", "jackson", "martin", "lee", "thompson", "white",
  "harris", "clark", "lewis", "robinson", "walker", "hall", "allen", "young",
  "king", "wright", "hill", "scott", "green", "adams", "baker", "nelson",
  "mitchell", "roberts", "carter", "phillips", "evans", "turner", "torres",
  "parker", "collins", "edwards", "stewart", "morris", "rogers", "reed", "cook",
  "morgan", "bell", "murphy", "bailey", "rivera", "cooper", "richardson", "cox",
  "howard", "ward", "peterson", "gray", "james", "watson", "brooks", "kelly",
  "sanders", "price", "bennett", "wood", "barnes", "ross", "henderson", "coleman",
  "jenkins", "perry", "powell", "long", "patterson", "hughes", "flores",
  "washington", "butler", "simmons", "foster", "gonzales", "bryant", "alexander",
  "russell", "griffin", "diaz", "hayes", "myers", "ford", "hamilton", "graham",
  "sullivan", "wallace", "woods", "cole", "west", "jordan", "owens", "reynolds",
  "fisher", "ellis", "harrison", "gibson", "mcdonald", "cruz", "marshall", "ortiz",
  "gomez", "murray", "freeman", "wells", "webb", "simpson", "stevens", "tucker",
  "porter", "hunter", "hicks", "crawford", "henry", "boyd", "mason", "morales",
  "kennedy", "warren", "dixon", "ramos", "reyes", "burns", "gordon", "shaw",
  "holmes", "rice", "robertson", "hunt", "black", "daniels", "palmer", "mills",
  "nichols", "grant", "knight", "ferguson", "rose", "stone", "hawkins", "dunn",
  "perkins", "hudson", "spencer", "gardner", "stephens", "payne", "pierce",
  "berry", "matthews", "arnold", "wagner", "willis", "ray", "watkins", "olson",
  "carroll", "duncan", "snyder", "hart", "cunningham", "bradley", "lane",
  "andrews", "ruiz", "harper", "fox", "riley", "armstrong", "carpenter", "weaver",
  "greene", "lawrence", "elliott", "chavez", "sims", "austin", "peters", "kelley",
  "franklin", "lawson",
]);

function scoreProfileMatch(
  result: ExaResult,
  ctx: ProfileMatchContext,
  urlMustInclude: string  // "linkedin.com/in/" or "doximity.com"
): ScoredResult {
  const url = result.url.toLowerCase();
  const title = (result.title || "").toLowerCase();
  const text = `${url} ${title}`;

  let score = 0;
  const parts: string[] = [];

  // URL type check — must be correct profile type
  if (!url.includes(urlMustInclude)) {
    return { result, score: 0, breakdown: "wrong URL type" };
  }

  // 1. Last name match (REQUIRED — 30 points)
  if (ctx.lastName) {
    const lastLower = ctx.lastName.toLowerCase();
    if (text.includes(lastLower)) {
      score += 30;
      parts.push(`lastName:30`);
    } else {
      return { result, score: 0, breakdown: "no lastName match" };
    }
  } else {
    return { result, score: 0, breakdown: "no lastName provided" };
  }

  // 2. First name or initial match (30 full, 15 initial)
  if (ctx.firstName) {
    const firstLower = ctx.firstName.toLowerCase();
    if (text.includes(firstLower)) {
      score += 30;
      parts.push(`firstName:30`);
    } else if (firstLower.length > 0 && text.includes(firstLower[0])) {
      // Check for initial in URL slug (e.g., "j-smith" for "John Smith")
      const slugPart = url.split("/").pop() || "";
      if (slugPart.startsWith(firstLower[0]) || slugPart.includes(`-${firstLower[0]}`)) {
        score += 15;
        parts.push(`firstInitial:15`);
      }
    }
  }

  // 3. Specialty keyword (20 points)
  const specialtyKeywords = ["dermatolog", "derm ", "skin", "mohs"];
  for (const kw of specialtyKeywords) {
    if (title.includes(kw)) {
      score += 20;
      parts.push(`specialty:20`);
      break;
    }
  }

  // 4. Location match — city (15) or state (10)
  if (ctx.city) {
    const cityLower = ctx.city.toLowerCase();
    if (cityLower.length >= 3 && title.includes(cityLower)) {
      score += 15;
      parts.push(`city:15`);
    }
  }
  if (ctx.state) {
    const stateLower = ctx.state.toLowerCase();
    // Match 2-letter state code or full state name in title
    if (stateLower.length === 2) {
      // Be careful with 2-letter matches — require word boundary
      const stateRegex = new RegExp(`\\b${stateLower}\\b`, "i");
      if (stateRegex.test(title)) {
        score += 10;
        parts.push(`state:10`);
      }
    } else if (stateLower.length >= 3 && title.includes(stateLower)) {
      score += 10;
      parts.push(`state:10`);
    }
  }

  // 5. Credential mention (5 points)
  const credentialKeywords = [" md", "m.d.", " do", "d.o.", "doctor", " dr ", "dr."];
  for (const cred of credentialKeywords) {
    if (title.includes(cred)) {
      score += 5;
      parts.push(`credential:5`);
      break;
    }
  }

  // 6. Common surname guard — if lastName is common and firstName was provided
  //    but didn't match at all, this is likely a wrong person. Reject.
  if (ctx.firstName && ctx.lastName && COMMON_SURNAMES.has(ctx.lastName.toLowerCase())) {
    const hasFirstNameSignal = parts.some(p => p.startsWith("firstName:") || p.startsWith("firstInitial:"));
    if (!hasFirstNameSignal) {
      return { result, score: 0, breakdown: "common surname + no firstName match → rejected" };
    }
  }

  return { result, score, breakdown: parts.join(" + ") || "lastName only" };
}

function findBestProfileMatch(
  results: ExaResult[],
  ctx: ProfileMatchContext,
  urlMustInclude: string,
  minScore: number = 50
): { url: string; score: number; breakdown: string } | null {
  const scored = results
    .map((r) => scoreProfileMatch(r, ctx, urlMustInclude))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  const best = scored[0];
  const cleanUrl = best.result.url.split("?")[0].split("#")[0];
  return { url: cleanUrl, score: best.score, breakdown: best.breakdown };
}

// ========== Aggregator domain blocklist ==========

const AGGREGATOR_DOMAINS = [
  "healthgrades.com", "zocdoc.com", "vitals.com", "webmd.com",
  "yelp.com", "realself.com", "ratemds.com", "castleconnolly.com",
  "npidb.org", "npino.com", "opencorporates.com", "bbb.org",
  "healthcarepricetool.com", "aamc.org", "sharecare.com",
  "google.com", "bing.com", "facebook.com", "twitter.com",
  "instagram.com", "tiktok.com", "linkedin.com", "doximity.com",
  "youtube.com", "youtu.be", "reddit.com", "wikipedia.org",
];

// ========== Main Enrichment Function ==========

export interface EnrichmentResult {
  linkedinUrl: string | null;
  linkedinScore: number;
  linkedinBreakdown: string | null;
  doximityUrl: string | null;
  doximityScore: number;
  doximityBreakdown: string | null;
  practiceUrl: string | null;
  practicePhone: string | null;
  practiceEmail: string | null;
  exaCost: number;
  searchDetails: {
    linkedinResults: number;
    doximityResults: number;
    practiceResults: number;
  };
}

export async function enrichWithExa(
  doctorName: string,
  credentials: string | null,
  state: string | null,
  matchContext?: ProfileMatchContext
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    linkedinUrl: null,
    linkedinScore: 0,
    linkedinBreakdown: null,
    doximityUrl: null,
    doximityScore: 0,
    doximityBreakdown: null,
    practiceUrl: null,
    practicePhone: null,
    practiceEmail: null,
    exaCost: 0,
    searchDetails: { linkedinResults: 0, doximityResults: 0, practiceResults: 0 },
  };

  const nameQuery = credentials
    ? `${doctorName} ${credentials}`
    : doctorName;

  const locationHint = state ? ` ${state}` : "";

  // Build LinkedIn query — add location for common surnames
  const isCommonSurname = matchContext?.lastName
    ? COMMON_SURNAMES.has(matchContext.lastName.toLowerCase())
    : false;

  let linkedinQuery = `${doctorName} dermatologist`;
  if (isCommonSurname && (matchContext?.city || matchContext?.state)) {
    // Add location for disambiguation of common names
    linkedinQuery += ` ${matchContext?.city || ""} ${matchContext?.state || ""}`.trim();
  } else {
    linkedinQuery += locationHint;
  }

  // Run 3 searches in parallel
  const [linkedinResults, doximityResults, practiceResults] = await Promise.all([
    // 1. LinkedIn — category: "people" + domain-level filter (NOT path-level)
    //    Path-level "linkedin.com/in" causes 400 with people category
    exaSearch(linkedinQuery, {
      category: "people",
      includeDomains: ["linkedin.com"],
      type: "neural",
      numResults: 5,
    }),
    // 2. Doximity profile
    exaSearch(`${nameQuery} dermatologist`, {
      includeDomains: ["doximity.com"],
      numResults: 5,
      type: "auto",
    }),
    // 3. Practice / contact page — use highlights to extract contact info
    exaSearch(`${nameQuery} dermatology practice contact${locationHint}`, {
      numResults: 5,
      type: "auto",
      excludeDomains: AGGREGATOR_DOMAINS,
      contents: {
        text: { maxCharacters: 1000 },
        highlights: {
          query: "email address phone number contact office",
          maxCharacters: 300,
        },
      },
    }),
  ]);

  // Cost: 3 searches × $0.005 + content on practice results
  result.exaCost = 0.005 * 3 + 0.001 * practiceResults.length;
  result.searchDetails = {
    linkedinResults: linkedinResults.length,
    doximityResults: doximityResults.length,
    practiceResults: practiceResults.length,
  };

  // Build match context — use provided context or fallback to basic parsing
  const ctx: ProfileMatchContext = matchContext || {
    firstName: null,
    lastName: null,
    credentials,
    city: null,
    state,
  };

  // Parse LinkedIn — multi-signal scoring
  if (ctx.lastName) {
    const linkedinMatch = findBestProfileMatch(
      linkedinResults, ctx, "linkedin.com/in/", 50
    );
    if (linkedinMatch) {
      result.linkedinUrl = linkedinMatch.url;
      result.linkedinScore = linkedinMatch.score;
      result.linkedinBreakdown = linkedinMatch.breakdown;
    }
  } else {
    // Fallback: no identity context, take first /in/ result
    const fallback = linkedinResults.find((r) => r.url.includes("linkedin.com/in/"));
    if (fallback) {
      result.linkedinUrl = fallback.url.split("?")[0].split("#")[0];
      result.linkedinScore = 0;
      result.linkedinBreakdown = "no-context-fallback";
    }
  }

  // Parse Doximity — multi-signal scoring (same system)
  if (ctx.lastName) {
    const doximityMatch = findBestProfileMatch(
      doximityResults, ctx, "doximity.com", 50
    );
    if (doximityMatch) {
      result.doximityUrl = doximityMatch.url;
      result.doximityScore = doximityMatch.score;
      result.doximityBreakdown = doximityMatch.breakdown;
    }
  } else {
    const fallback = doximityResults.find((r) => r.url.includes("doximity.com"));
    if (fallback) {
      result.doximityUrl = fallback.url.split("?")[0].split("#")[0];
      result.doximityScore = 0;
      result.doximityBreakdown = "no-context-fallback";
    }
  }

  // Parse practice pages — extract email/phone from text AND highlights
  for (const pr of practiceResults) {
    const searchText = [pr.text, ...(pr.highlights || [])].filter(Boolean).join(" ");
    if (!searchText) continue;

    // Look for email
    if (!result.practiceEmail) {
      const emailMatch = searchText.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      if (emailMatch) {
        const email = emailMatch[0].toLowerCase();
        if (!email.endsWith(".png") && !email.endsWith(".jpg") &&
            !email.endsWith(".gif") && !email.includes("example") &&
            !email.includes("noreply") && !email.includes("no-reply")) {
          result.practiceEmail = email;
        }
      }
    }

    // Look for phone — require at least one separator to avoid matching NPI numbers
    if (!result.practicePhone) {
      const phoneMatch = searchText.match(
        /(?:\+?1[-.\s])?\(\d{3}\)[-.\s]?\d{3}[-.\s]?\d{4}|\d{3}[-.\s]\d{3}[-.\s]\d{4}/
      );
      if (phoneMatch) {
        result.practicePhone = phoneMatch[0];
      }
    }

    // Store practice URL (skip aggregator sites)
    if (!result.practiceUrl) {
      const urlLower = pr.url.toLowerCase();
      const isAggregator = AGGREGATOR_DOMAINS.some((d) => urlLower.includes(d));
      if (!isAggregator) {
        result.practiceUrl = pr.url;
      }
    }
  }

  return result;
}
