# Derm Hunter Engine

AI-powered pipeline for discovering influencer doctors across any medical specialty (this tool uses dermatology as an example). Finds physicians with active YouTube channels, verifies their credentials via NPI Registry, and surfaces multi-channel contact information in minutes.

This is a prototype made specifically for FutureClinic.

**Built for healthcare platforms targeting creator-doctors.** Demonstrated with dermatology, but works for any specialty. 

---

## Why This Tool Exists

**The opportunity:** Influencer doctors are not just better leads: they're the only doctors who can drive real patient volume at scale for telehealth platforms.

A traditional dermatologist sees patients in-office. An influencer dermatologist has hundreds of thousands of engaged followers asking skincare questions in YouTube comments every day. When they launch on a telehealth platform, they bring their entire audience with them.

**The arbitrage:** Finding these doctors manually takes lots of manual work (especially the smaller creators). API costs to automate it are pennies. The return is massive: a single converted doctor with a large audience can generate thousands of patient visits.

This tool finds them in minutes for under a dollar.

Built in 2 sleepless nights to prove the concept works, as a prototype for FutureClinic and also because I found this more interesting and engagging rather than a boring cover letter.

---

## What It Does

Runs a 5-phase pipeline that turns YouTube search into verified physician leads:

1. **Discovery** - Finds doctors creating patient-facing content (minimum subscriber threshold, recently active)
2. **Intelligence** - LLM extracts real identity from channel metadata ("Dr. Pimple Popper" → "Sandra Lee, MD")
3. **Verification** - Matches against NPI Registry to confirm US medical license and specialty
4. **Enrichment** - Surfaces contact info from multiple sources: YouTube, Exa AI, Hunter.io, Snov.io, NPI. 
5. **Outreach** - Generates personalized outreach strategies using enriched contact data as well as other information for highest conversion chance. 

Results include emails, LinkedIn profiles, Doximity profiles, phone numbers, and practice websites: all with source attribution showing where each piece of data came from.

---

## Specialty Support

Works for any medical specialty. Change specialty in two places:

**Query list** (`lib/derm-queries.ts`):
```typescript
// Dermatology
"dermatologist reacts to skincare routine"
"board certified dermatologist explains acne"

// Psychiatry
"psychiatrist explains anxiety disorders"
"psychiatrist reacts to therapy scenes"

// Nutriology 
"nutriologist explains healthy eating habits"
"certified nutriologist reacts to fast food commercials"

```

**NPI taxonomy** (`lib/npi.ts`):
```typescript
taxonomy_description: "Dermatology"  // or "Nutriology", "Psychiatry", etc.
```

Everything else (name extraction, verification, contact enrichment) works identically across specialties.

---

## Tech Stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS
- **YouTube Data API** - channel discovery
- **Claude via OpenRouter** - identity extraction and classification
- **Exa AI** - LinkedIn/Doximity/practice site search
- **NPI Registry** - US physician credential verification (free, no auth)
- **Hunter.io + Snov.io** - email finding

---

## Demo Data

**The results shown in the live demo are real.** They were captured from an actual pipeline run using the snapshot feature:

1. Pipeline runs with real API keys
2. Results are saved to `demo-snapshot.json`
3. Demo mode loads this information
4. No API calls made, no credentials needed for demo

This lets anyone explore the full interface and see real doctor data without exposing API keys or burning credits.

Set `DEMO_MODE=true` in environment variables to enable.

---

## Multi-Signal Profile Matching

LinkedIn and Doximity profiles are validated using a scoring system to prevent false positives (the "John Smith MD" problem):

**Signals weighted and scored:**
- Last name match (required)
- First name match or initial
- Specialty keywords in profile
- City/state location match
- Medical credentials mentioned

**Minimum threshold required to accept a match.** Common surnames require stronger signals.

**Result:** Significantly reduced chance of false positives. Returns null rather than wrong match. 

---

## Contact Enrichment Strategy

Tries sources in priority order until contact info found:

1. **YouTube description** (free, doctors often list business email)
2. **Exa LinkedIn search** (scored matching, high accuracy)
3. **Exa Doximity search** (doctor-specific professional network)
4. **Exa practice pages** (extracts email/phone from practice sites)
5. **Hunter.io** (email finder when practice domain known)
6. **Snov.io** (fallback email finder)
7. **NPI phone** (government registry, reliable but basic)

Every data point tagged with source attribution: `emailSource: "hunter"`, `phoneSource: "npi"`, `linkedinSource: "exa_linkedin"`, etc.

Shows which APIs deliver value and which don't.

---

## Architecture
```
app/api/pipeline/
  run/          # Main orchestrator with Server-Sent Events
  discover/     # YouTube search and channel details
  extract/      # LLM-powered name extraction
  verify/       # NPI Registry lookup and scoring
  enrich/       # Multi-source contact waterfall

lib/
  youtube.ts              # YouTube API client
  name-extractor.ts       # Identity extraction prompts
  npi.ts                  # NPI Registry integration
  exa-enrichment.ts       # LinkedIn/Doximity scoring
  contact-extractor.ts    # YouTube description parsing
  hunter.ts, snov.ts      # Email finder APIs
  scoring.ts              # Verification tier logic
  campaign-projections.ts # Outreach ROI modeling
  types.ts                # TypeScript interfaces

components/
  Dashboard.tsx                   # Main UI + pipeline controls
  DoctorProfile.tsx              # Doctor detail slide-out
  Analytics.tsx                  # Verification breakdown
  ApiEffectiveness.tsx           # Source attribution stats
  CampaignProjectionsView.tsx    # Campaign funnel modeling
```

---

## API Cost Structure

**Why this works economically:**

YouTube API: Free (generous quota)  
Claude (name extraction): Pennies per doctor  
Exa AI: Also pennies per doctor  
Hunter/Snov: Free tiers cover most use cases (Apollo is a better choice here, I just didn't want to pay $99 a month for it)
NPI Registry: Free government API

**Total cost per verified doctor: A few cents.**

A single influencer doctor with a large engaged audience can drive hundreds or thousands of telehealth visits. The ROI math is absurd.

---

## Customization

**For international markets:**
- Remove US-only filter in extract phase
- Swap NPI for GMC (UK), CPSO (Canada), or regional equivalents. Extra research needed though, haven't looked into it. 
- Rest of pipeline works unchanged

**For different platforms:**
- Replace YouTube discovery with TikTok, Instagram, etc.
- Name extraction and enrichment phases work on any social profile with minor changes.

**For richer data:**
- Add Clearbit or RocketReach for deeper profile enrichment
- Use Apollo instead of Hunter.io
- Integrate CRM APIs (HubSpot, Salesforce) for direct lead sync

---

## Why Influencer Doctors Matter

Traditional physician outreach targets random doctors in a specialty. Most don't have digital audiences. Most don't understand telehealth business models. Conversion rates are low.

**Influencer doctors are different:**

They've already built patient audiences (proof of communication ability and patient trust)  
They create educational content daily (comfortable with digital tools)  
Their followers ask health questions in comments (pre-qualified demand)  
They understand digital health models (early adopter mindset)

When an influencer doctor joins a telehealth platform, they don't bring themselves - they bring thousands of engaged patients ready to book visits.

This pipeline finds those doctors at scale.

---

## Setup

```bash
git clone https://github.com/Seryozh/derm-hunter.git
cd derm-hunter
npm install
cp .env.example .env.local
# Fill in your API keys in .env.local
npm run dev
```

Open http://localhost:3000, pick query count, hit "Run Pipeline".

See `.env.example` for all required and optional API keys.

---

## License

MIT

---

**Built by Sergey Kudelin**
[GitHub](https://github.com/Seryozh) • [LinkedIn](https://www.linkedin.com/in/sergey-kudelin/) • [Email](mailto:sergey@sergeykudelin.com)

*Built in 2 sleepless nights for Future Clinic. API costs are cheap. The return is massive.*