import { describe, expect, it } from "vitest";
import { trendingScore, TREND_WEIGHTS, type TrendInputs } from "@/lib/trending";

describe("Trending Score Algorithm", () => {
  it("rewards high engagement and reading time alongside raw views", () => {
    // Story A: high views but zero dwell time (bounce)
    const shallowItem: TrendInputs = {
      views: 1000,
      readSeconds: 0,
      readEvents: 0,
      shares: 5,
      searchHits: 5,
      ageHours: 2,
    };

    // Story B: moderate views but deep reading and high completion
    const deepItem: TrendInputs = {
      views: 500,
      readSeconds: 45000, // 45000 / 300 = 150s avg read
      readEvents: 300,
      shares: 40,
      searchHits: 25,
      ageHours: 2,
    };

    const shallowScore = trendingScore(shallowItem);
    const deepScore = trendingScore(deepItem);

    expect(deepScore.score).toBeGreaterThan(shallowScore.score);
    expect(deepScore.components.reading).toBeGreaterThan(shallowScore.components.reading);
    expect(deepScore.components.engagement).toBeGreaterThan(shallowScore.components.engagement);
  });

  it("applies full freshness for stories <= 6 hours old", () => {
    const freshInput: TrendInputs = {
      views: 200,
      readSeconds: 18000,
      readEvents: 100,
      shares: 10,
      searchHits: 10,
      ageHours: 4,
    };

    const res = trendingScore(freshInput);
    expect(res.components.freshness).toBe(1);
  });

  it("decays smoothly for older stories without dropping below the 0.25 floor", () => {
    const base: Omit<TrendInputs, "ageHours"> = {
      views: 5000,
      readSeconds: 500000,
      readEvents: 2500,
      shares: 200,
      searchHits: 150,
    };

    const scoreDay1 = trendingScore({ ...base, ageHours: 24 });
    const scoreDay3 = trendingScore({ ...base, ageHours: 72 });
    const scoreDay30 = trendingScore({ ...base, ageHours: 720 });

    expect(scoreDay1.score).toBeGreaterThan(scoreDay3.score);
    expect(scoreDay3.score).toBeGreaterThan(scoreDay30.score);
    // Recency floor guarantees significant stories remain discoverable
    expect(scoreDay30.components.freshness).toBe(0.25);
  });

  it("verifies weight distribution sums to 1.0", () => {
    const totalWeight = Object.values(TREND_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });
});
