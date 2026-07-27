import { describe, expect, it } from 'vitest';
import { estimateCostUsd, isFreeModel, priceFor } from './model-pricing';

describe('model pricing', () => {
  it('prices a known model from list rates', () => {
    // gpt-4o-mini: $0.15 / 1M in, $0.60 / 1M out.
    // 1M in + 1M out = 0.15 + 0.60
    expect(estimateCostUsd('gpt-4o-mini', 1_000_000, 1_000_000)).toBeCloseTo(0.75, 6);
  });

  it('prices a realistic turn in fractions of a cent', () => {
    // The measured plant-comparison turn: ~6,000 prompt + ~500 completion.
    const cost = estimateCostUsd('gpt-4o-mini', 6_000, 500)!;
    expect(cost).toBeCloseTo(0.0012, 4);
    expect(cost).toBeLessThan(0.01);
  });

  it('treats every :free model as costing nothing', () => {
    expect(isFreeModel('poolside/laguna-m.1:free')).toBe(true);
    expect(estimateCostUsd('nvidia/nemotron-nano-9b-v2:free', 50_000, 5_000)).toBe(0);
  });

  it('strips provider prefixes and dated suffixes', () => {
    expect(priceFor('openai/gpt-4o-mini')).toEqual({ input: 0.15, output: 0.6 });
    expect(priceFor('gpt-4o-mini-2024-07-18')).toEqual({ input: 0.15, output: 0.6 });
  });

  it('treats self-hosted models as free, not unpriced', () => {
    // Ollama inference runs on the user's own hardware — $0 per call, which is
    // a different fact from "we have no price for this".
    expect(isFreeModel('llama3.2:3b')).toBe(true);
    expect(estimateCostUsd('llama3.2:3b', 20_000, 2_000)).toBe(0);
    expect(isFreeModel('qwen2.5-coder:7b')).toBe(true);
  });

  it('sees through the BYOM composite label', () => {
    // Custom models are logged as "<alias> (<real/model:id>)"; without this the
    // whole of a BYOM user's spend reports as unpriced.
    expect(isFreeModel('my-own-router (poolside/laguna-m.1:free)')).toBe(true);
    expect(estimateCostUsd('my-own-router (poolside/laguna-m.1:free)', 10_000, 1_000)).toBe(0);
    expect(priceFor('my-router (openai/gpt-4o-mini)')).toEqual({ input: 0.15, output: 0.6 });
  });

  it('returns null for an unknown model rather than pretending it is free', () => {
    // The whole point: an unpriced model must be distinguishable from a free
    // one, or spend silently under-reports.
    expect(priceFor('some-new-model-v9')).toBeNull();
    expect(estimateCostUsd('some-new-model-v9', 10_000, 1_000)).toBeNull();
  });

  it('does not confuse a cheap model with an expensive one sharing a prefix', () => {
    expect(priceFor('gpt-4o')).toEqual({ input: 2.5, output: 10 });
    expect(priceFor('gpt-4o-mini')).toEqual({ input: 0.15, output: 0.6 });
  });
});
