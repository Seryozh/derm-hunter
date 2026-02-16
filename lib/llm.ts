// OpenRouter API wrapper — all LLM calls go through here

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");
  return key;
}

export type ModelId = "anthropic/claude-haiku-4.5" | "anthropic/claude-sonnet-4.5";

interface LLMResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

interface CallLLMOptions {
  jsonMode?: boolean;
  maxRetries?: number;
}

export async function callLLM(
  prompt: string,
  model: ModelId = "anthropic/claude-haiku-4.5",
  systemPrompt?: string,
  temperature = 0.1,
  options: CallLLMOptions = {}
): Promise<LLMResponse> {
  const { jsonMode = false, maxRetries = 2 } = options;

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: 1024,
  };

  // Enable JSON mode when requested — guarantees valid JSON output
  if (jsonMode) {
    body.response_format = { type: "json_object" };
    // response-healing plugin auto-repairs malformed JSON (missing brackets, etc.)
    body.plugins = [{ id: "response-healing" }];
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(OPENROUTER_BASE, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://futureclinic.com",
          "X-Title": "Derm Hunter Engine",
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429 || response.status >= 500) {
        // Retryable error — wait with exponential backoff
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.warn(`OpenRouter ${response.status}, retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        lastError = new Error(`OpenRouter ${model}: ${response.status}`);
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`OpenRouter ${model} failed: ${response.status} — ${errorBody}`);
      }

      const data = await response.json();

      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.length === 0) {
        throw new Error(`OpenRouter returned empty response from ${model}`);
      }

      return {
        content,
        model: data.model || model,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error(`OpenRouter ${model} failed after ${maxRetries} retries`);
}

// Robust JSON extraction from LLM response — handles markdown wrapping, preamble text
export function extractJSON(raw: string): string {
  let s = raw.trim();

  // Strip markdown code blocks (case-insensitive, handles whitespace)
  s = s.replace(/^\s*```(?:json)?\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "");

  // If response starts with non-JSON text (conversational preamble), find first { or [
  const firstBrace = s.indexOf("{");
  const firstBracket = s.indexOf("[");
  let startIdx = -1;

  if (firstBrace >= 0 && firstBracket >= 0) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace >= 0) {
    startIdx = firstBrace;
  } else if (firstBracket >= 0) {
    startIdx = firstBracket;
  }

  if (startIdx > 0) {
    s = s.slice(startIdx);
  }

  // Find the matching closing brace/bracket
  if (s.startsWith("{")) {
    const lastBrace = s.lastIndexOf("}");
    if (lastBrace > 0) s = s.slice(0, lastBrace + 1);
  } else if (s.startsWith("[")) {
    const lastBracket = s.lastIndexOf("]");
    if (lastBracket > 0) s = s.slice(0, lastBracket + 1);
  }

  return s.trim();
}

// Cost constants (per 1M tokens)
export const MODEL_COSTS = {
  "anthropic/claude-haiku-4.5": { input: 0.80, output: 4.00 },
  "anthropic/claude-sonnet-4.5": { input: 3.00, output: 15.00 },
} as const;

export function estimateCost(
  model: ModelId,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = MODEL_COSTS[model];
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}
