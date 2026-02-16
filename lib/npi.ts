// NPI Registry API wrapper — free, no auth, US-only physician verification

import { NPIMatch } from "./types";

const NPI_API_BASE = "https://npiregistry.cms.hhs.gov/api";

interface NPISearchParams {
  firstName: string;
  lastName: string;
  state?: string;
  taxonomyDescription?: string;
}

interface NPISearchResult {
  matches: NPIMatch[];
  totalCount: number;
}

export async function searchNPI(params: NPISearchParams): Promise<NPISearchResult> {
  const url = new URL(NPI_API_BASE);
  url.searchParams.set("version", "2.1");
  url.searchParams.set("first_name", params.firstName);
  url.searchParams.set("last_name", params.lastName);
  url.searchParams.set("enumeration_type", "NPI-1"); // Individual providers only
  url.searchParams.set("limit", "10");

  // Add state filter if available (but don't require it — fuzzy matching)
  if (params.state && params.state.length === 2) {
    url.searchParams.set("state", params.state.toUpperCase());
  }

  // Add taxonomy filter for dermatology
  if (params.taxonomyDescription) {
    url.searchParams.set("taxonomy_description", params.taxonomyDescription);
  }

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(`NPI API failed: ${response.status}`);
      return { matches: [], totalCount: 0 };
    }

    const data = await response.json();
    const resultCount = data.result_count || 0;
    const results = data.results || [];

    const matches: NPIMatch[] = [];
    for (const result of results) {
      try {
        const basic = result.basic || {};
        const taxonomies = result.taxonomies || [];
        const addresses = result.addresses || [];

        // Find primary taxonomy
        const primaryTaxonomy = taxonomies.find((t: { primary: boolean }) => t.primary) || taxonomies[0] || {};

        // Find practice address (type 2 = practice location)
        const practiceAddr = addresses.find((a: { address_purpose: string }) => a.address_purpose === "LOCATION") || addresses[0];

        matches.push({
          npiNumber: parseInt(result.number, 10),
          firstName: basic.first_name || "",
          lastName: basic.last_name || "",
          credential: basic.credential || "",
          status: basic.status || "",
          taxonomyDescription: primaryTaxonomy.desc || "",
          taxonomyCode: primaryTaxonomy.code || "",
          isPrimary: primaryTaxonomy.primary === true,
          practiceAddress: practiceAddr
            ? {
                address1: practiceAddr.address_1 || "",
                city: practiceAddr.city || "",
                state: practiceAddr.state || "",
                postalCode: practiceAddr.postal_code || "",
                phone: practiceAddr.telephone_number || null,
              }
            : null,
        });
      } catch (err) {
        console.error("Error parsing NPI result:", err);
      }
    }

    return { matches, totalCount: resultCount };
  } catch (err) {
    console.error("NPI search failed:", err);
    return { matches: [], totalCount: 0 };
  }
}

// Try with dermatology taxonomy first, then without, then without state
export async function verifyWithNPI(
  firstName: string,
  lastName: string,
  state?: string | null
): Promise<NPISearchResult> {
  // Attempt 1: Dermatology + state
  if (state) {
    const result = await searchNPI({
      firstName,
      lastName,
      state,
      taxonomyDescription: "Dermatology",
    });
    if (result.matches.length > 0) return result;
  }

  // Attempt 2: Dermatology without state (fuzzy)
  const result2 = await searchNPI({
    firstName,
    lastName,
    taxonomyDescription: "Dermatology",
  });
  if (result2.matches.length > 0) return result2;

  // Attempt 3: Any physician, no state filter
  const result3 = await searchNPI({ firstName, lastName });
  return result3;
}
