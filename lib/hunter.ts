// Hunter.io email finder — needs a domain, 50 free/month

function getApiKey(): string {
  const key = process.env.HUNTER_API_KEY;
  if (!key) throw new Error("HUNTER_API_KEY not set");
  return key;
}

interface HunterResult {
  email: string | null;
  score: number;
  position: string | null;
}

export async function findEmailWithHunter(
  domain: string,
  firstName: string,
  lastName: string
): Promise<HunterResult> {
  const url = new URL("https://api.hunter.io/v2/email-finder");
  url.searchParams.set("domain", domain);
  url.searchParams.set("first_name", firstName);
  url.searchParams.set("last_name", lastName);
  url.searchParams.set("api_key", getApiKey());

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.warn(`Hunter failed for ${domain}: ${response.status}`);
      return { email: null, score: 0, position: null };
    }

    const data = await response.json();
    const result = data?.data;

    if (!result?.email) {
      return { email: null, score: 0, position: null };
    }

    return {
      email: result.email,
      score: result.score || 0,
      position: result.position || null,
    };
  } catch (err) {
    console.error("Hunter error:", err);
    return { email: null, score: 0, position: null };
  }
}
