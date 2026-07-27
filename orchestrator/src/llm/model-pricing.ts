/**
 * Model pricing (Phase AT).
 *
 * FactoryPilot was built against free models, so cost control meant counting
 * tokens against a quota. On a paid key that number says nothing useful — 6,500
 * tokens is either a rounding error or real money depending on the model.
 *
 * These are list prices in USD per 1M tokens, correct when written. They are
 * NOT billed amounts: providers change prices, discount, and bill on their own
 * token accounting. Everything derived from this table is labelled an estimate,
 * and a model that is not listed reports null rather than guessing — an
 * invented cost is worse than an absent one.
 */
export interface ModelPrice {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
}

const PRICES: Record<string, ModelPrice> = {
  // OpenAI
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'gpt-4.1': { input: 2, output: 8 },
  // Anthropic
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-opus-4-8': { input: 5, output: 25 },
};

/**
 * Models that cost nothing per call: the OpenRouter free tier, and self-hosted
 * inference (Ollama tags like `llama3.2:3b`) where the compute is the user's
 * own. Both are genuinely $0, which is different from "we have no price".
 */
const LOCAL_MODEL_PATTERN = /^(llama|mistral|qwen|phi|gemma|deepseek|codellama)[\w.\-]*:[\w.\-]+$/i;

/**
 * BYOM usage is recorded under a composite label — `my-own-router
 * (poolside/laguna-m.1:free)`. Pull the real model id out so those calls are
 * priced like any other instead of counted as unknown.
 */
function resolveModelId(model: string): string {
  const wrapped = /\(([^)]+)\)\s*$/.exec(model.trim());
  return (wrapped ? wrapped[1] : model).trim();
}

export function isFreeModel(model: string): boolean {
  const id = resolveModelId(model);
  return /:free$/i.test(id) || LOCAL_MODEL_PATTERN.test(id);
}

/**
 * Price for a model id, or null when we have no entry. Provider prefixes
 * ("openai/gpt-4o-mini") and dated suffixes are tolerated.
 */
export function priceFor(model: string): ModelPrice | null {
  if (!model) return null;
  if (isFreeModel(model)) return { input: 0, output: 0 };

  const id = resolveModelId(model);
  const bare = id.includes('/') ? id.slice(id.lastIndexOf('/') + 1) : id;
  if (PRICES[bare]) return PRICES[bare];

  // "gpt-4o-mini-2024-07-18" → "gpt-4o-mini"
  const match = Object.keys(PRICES).find((k) => bare.startsWith(k));
  return match ? PRICES[match] : null;
}

/**
 * Estimated USD for one call. Null when the model is unknown, so callers can
 * show "not priced" instead of a fabricated 0.00.
 */
export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number | null {
  const price = priceFor(model);
  if (!price) return null;
  return (promptTokens / 1_000_000) * price.input + (completionTokens / 1_000_000) * price.output;
}

/** Models we can price, for surfacing coverage in the admin UI. */
export function pricedModels(): string[] {
  return Object.keys(PRICES).sort();
}
