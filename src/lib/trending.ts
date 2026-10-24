/**
 * Trending score. No single signal may dominate: each is log-compressed, then capped at its weight,
 * and the sum is multiplied by a recency factor with a floor so that a significant older story is not erased.
 */
export interface TrendInputs {
  views: number;
  /** Total engaged seconds across READ events. */
  readSeconds: number;
  readEvents: number;
  shares: number;
  searchHits: number;
  ageHours: number;
}

export const TREND_WEIGHTS = { views: 0.3, reading: 0.25, shares: 0.15, search: 0.1, engagement: 0.2 };

function compress(x: number, halfPoint: number): number {
  // Saturating curve in [0,1): x == halfPoint gives 0.5.
  return 1 - 1 / (1 + Math.log1p(Math.max(0, x)) / Math.log1p(halfPoint));
}

export function trendingScore(i: TrendInputs): { score: number; components: Record<string, number> } {
  const avgRead = i.readEvents ? i.readSeconds / i.readEvents : 0;
  const readerRatio = i.views ? Math.min(1, i.readEvents / i.views) : 0;
  const c = {
    views: compress(i.views, 200) * TREND_WEIGHTS.views,
    reading: compress(avgRead, 90) * TREND_WEIGHTS.reading,
    shares: compress(i.shares, 15) * TREND_WEIGHTS.shares,
    search: compress(i.searchHits, 20) * TREND_WEIGHTS.search,
    engagement: readerRatio * TREND_WEIGHTS.engagement,
  };
  const base = Object.values(c).reduce((a, b) => a + b, 0);
  // Freshness: full strength for the first 6h, half-life of ~36h afterwards, floor at 0.25.
  const fresh = i.ageHours <= 6 ? 1 : Math.max(0.25, Math.pow(0.5, (i.ageHours - 6) / 36));
  return { score: Math.round(base * fresh * 10000) / 100, components: { ...c, freshness: fresh } };
}
