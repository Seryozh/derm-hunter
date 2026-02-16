# Production Run Analysis - February 16, 2026

## Run Summary

| Metric | Count |
|--------|-------|
| YouTube channels discovered | 245 |
| Gated out | 176 |
| Verified doctors | 68 |
| Gold tier | 57 |
| Silver tier | 7 |
| Bronze tier | 4 |

**Run time:** 14 minutes (09:22 - 09:36 UTC)
**Total API cost:** ~$2.15

## Gate Breakdown

| Reason | Count | % of Gated |
|--------|-------|-----------|
| Low subscribers (<5K) | 90 | 51% |
| Not a medical doctor | 51 | 29% |
| Non-US doctor | 19 | 11% |
| Inactive (>90 days) | 16 | 9% |

The LLM correctly rejected media channels (WIRED, Healthline, Good Morning America), institutional channels (Rush University, NHS, UAMS), lifestyle creators (Jillian Gottlieb, Care with Kate), and medical tourism agencies (Docfinderkorea).

## Contact Enrichment Results

| Source | Searched | Found | Hit Rate |
|--------|----------|-------|----------|
| YouTube Description | 69 | 9 emails + 0 LinkedIn | 13% |
| Exa LinkedIn | 69 | 48 | 70% |
| Exa Doximity | 69 | 63 | 91% |
| Exa Practice (email) | 69 | 12 | 17% |
| Hunter.io | 47 | 13 | 28% |
| Snov.io | 34 | 1 | 3% |
| NPI Phone | - | 11 | fallback |

**Email sources:** Hunter (13), Exa practice (12), YouTube description (9), Snov (1)
**Total with email:** 33/68 (49%)
**Total with LinkedIn:** 44/68 (65%)
**Total with Doximity:** 60/68 (88%)
**Total with phone:** 65/68 (96%)

## Known Limitations

### Non-dermatologists in results
The pipeline finds doctors who create derm-adjacent content. Some verified entries are not dermatologists:
- **Plastic surgeons**: Daniel Barrett, Gary Linkov, Amir Karam, Anthony Youn, Ramtin Kassir (5)
- **Family medicine**: Doctor Mike, Ken Berry (2)
- **Internal medicine**: Robert Hopkins (1)

These are still valid acquisition targets for a telehealth platform but should be categorized separately.

### Exa LinkedIn scoring gaps
LinkedIn hit rate is 70% (48/69). The 30% misses are primarily:
- Common surnames where Exa returns wrong people (Ellis, Liu, Lee)
- Doctors who don't have LinkedIn profiles
- Doctors whose LinkedIn titles don't mention dermatology

### Snov.io underperformance
1/34 hit rate (3%). Recommendation: replace with Apollo.io for better email coverage.

### Doximity edge cases
Family members in the same specialty can cause false positives (e.g. parent/child dermatologists sharing a surname). The multi-signal scoring system catches most of these, but edge cases exist.

## Highlight Doctors (Best Matches)

These doctors had the highest data completeness (email + LinkedIn + Doximity + phone):

| Doctor | Subs | Tier | Contact |
|--------|------|------|---------|
| Dr. Shereene Idriss | 1.67M | Gold | email, LinkedIn, phone |
| Angelo Landriscina (DermAngelo) | 819K | Gold | email, LinkedIn, Doximity, phone |
| Dr. Whitney Bowe | 73K | Gold | email, LinkedIn, Doximity, phone |
| Dr. Abigail Waldman (Dr. Abby) | 100K | Gold | email, LinkedIn, Doximity, phone |
| Dr. Joyce Park (Tea with MD) | 104K | Gold | email, LinkedIn, Doximity, phone |
| Dr. Heather Rogers | 6K | Gold | email, LinkedIn, Doximity, phone |
| Dr. Aleksandra Brown | 86K | Gold | email, LinkedIn, Doximity, phone |
| Dr. Madalyn Nguyen | 159K | Gold | email, LinkedIn, Doximity, phone |

## Notable: Dr. Usama Syed (FutureClinic CEO)

The pipeline independently discovered Dr. Usama Syed:
- **Channel:** Dr. Usama Syed (226K subscribers)
- **Verification:** Gold tier, NPI #1942731989
- **Contact:** Phone, LinkedIn, Doximity
- **LinkedIn:** linkedin.com/in/usama-syed-md-419b0078

This validates the pipeline's targeting: it finds exactly the kind of doctor who would build a telehealth platform.
