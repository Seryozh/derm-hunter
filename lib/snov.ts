// Snov.io email finder — OAuth2 client credentials, 50 free/month

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.SNOV_CLIENT_ID;
  const clientSecret = process.env.SNOV_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("SNOV credentials not set");

  const response = await fetch("https://api.snov.io/v1/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Snov OAuth failed: ${response.status}`);
  }

  const data = await response.json();
  const token = data.access_token;
  if (!token) throw new Error("Snov returned no access_token");

  // Cache for 50 minutes (tokens expire in 1 hour)
  cachedToken = {
    token,
    expiresAt: Date.now() + 50 * 60 * 1000,
  };

  return token;
}

interface SnovResult {
  email: string | null;
  status: string | null;
}

export async function findEmailWithSnov(
  domain: string,
  firstName: string,
  lastName: string
): Promise<SnovResult> {
  try {
    const token = await getAccessToken();

    const response = await fetch("https://api.snov.io/v1/get-emails-from-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        firstName,
        lastName,
        domain,
      }),
    });

    if (!response.ok) {
      console.warn(`Snov failed for ${domain}: ${response.status}`);
      return { email: null, status: null };
    }

    const data = await response.json();
    const emails = data?.data?.emails;

    if (!Array.isArray(emails) || emails.length === 0) {
      return { email: null, status: null };
    }

    // Return the first (highest confidence) email
    return {
      email: emails[0].email || null,
      status: emails[0].status || null,
    };
  } catch (err) {
    console.error("Snov error:", err);
    return { email: null, status: null };
  }
}
