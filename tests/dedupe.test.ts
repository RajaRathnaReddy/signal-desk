import { describe, expect, it } from "vitest";
import {
  canonicalUrl,
  detectEntities,
  similarity,
  isSameEvent,
  clusterCandidates,
  type Candidate,
} from "@/lib/dedupe";

describe("Deduplication and Story Clustering Engine", () => {
  describe("canonicalUrl", () => {
    it("strips tracking query parameters, hashes, and www prefix", () => {
      const dirty = "https://www.reuters.com/technology/ai-chips-surge?utm_source=twitter&utm_medium=social&fbclid=12345#overview";
      const clean = canonicalUrl(dirty);
      expect(clean).toBe("https://reuters.com/technology/ai-chips-surge");
    });

    it("preserves legitimate non-tracking parameters", () => {
      const url = "https://example.com/item?id=49281&category=chips";
      expect(canonicalUrl(url)).toBe("https://example.com/item?id=49281&category=chips");
    });
  });

  describe("detectEntities", () => {
    it("detects known tech companies and organizations", () => {
      const text = "Anthropic and Google Cloud announced new TPUs for AI training, competing with Nvidia.";
      const entities = detectEntities(text);
      expect(entities).toContain("Anthropic");
      expect(entities).toContain("Google");
      expect(entities).toContain("Nvidia");
    });

    it("does not false-positive on substring matches within words", () => {
      const text = "He went to the cinema and ordered an orange.";
      const entities = detectEntities(text);
      expect(entities).not.toContain("Arm");
    });
  });

  describe("similarity & isSameEvent", () => {
    it("scores identical canonical URLs as 1.0", () => {
      const a: Candidate = { title: "Story A", url: "https://example.com/story?utm_source=rss" };
      const b: Candidate = { title: "Story B", url: "https://example.com/story?utm_medium=feed" };
      const res = similarity(a, b);
      expect(res.score).toBe(1);
      expect(isSameEvent(a, b)).toBe(true);
    });

    it("detects near-identical stories from different outlets", () => {
      const a: Candidate = {
        title: "Anthropic Releases Claude 3.7 Sonnet With Hybrid Reasoning",
        snippet: "Anthropic has launched Claude 3.7 Sonnet, introducing hybrid reasoning capabilities that allow developers to toggle between fast thinking and extended test-time compute.",
      };
      const b: Candidate = {
        title: "Anthropic Unveils Claude 3.7 Sonnet Featuring Hybrid Reasoning Engine",
        snippet: "Claude 3.7 Sonnet debuts from Anthropic, offering hybrid reasoning modes where models can think before answering or respond instantaneously.",
      };
      const res = similarity(a, b);
      expect(res.score).toBeGreaterThanOrEqual(0.55);
      expect(isSameEvent(a, b)).toBe(true);
      expect(res.reasons.length).toBeGreaterThan(0);
    });

    it("differentiates two different stories about the same company", () => {
      const a: Candidate = {
        title: "Apple Reports Record Quarterly Services Revenue",
        snippet: "Apple posted quarterly earnings driven by growth in subscription services and App Store sales.",
      };
      const b: Candidate = {
        title: "Apple Unveils M4 Max MacBook Pro in Space Black",
        snippet: "Apple introduced the redesigned MacBook Pro powered by the new 3nm M4 Max system-on-chip.",
      };
      const res = similarity(a, b);
      expect(res.score).toBeLessThan(0.55);
      expect(isSameEvent(a, b)).toBe(false);
    });
  });

  describe("clusterCandidates", () => {
    it("clusters multiple reports of the same event while separating distinct events", () => {
      const items: Candidate[] = [
        {
          title: "TSMC Begins High-Volume Production of 2nm GAAFET Nodes in Taiwan",
          snippet: "TSMC has initiated mass production on its 2-nanometer gate-all-around process node at Fab 20.",
        },
        {
          title: "OpenAI Launches SearchGPT For All ChatGPT Plus Subscribers",
          snippet: "SearchGPT is now natively built into ChatGPT offering real-time web citations and structured summaries.",
        },
        {
          title: "TSMC Commences 2nm Volume Manufacturing Using N2 GAAFET Architecture",
          snippet: "Volume manufacturing of TSMC 2nm N2 GAA chips has officially started in Hsinchu.",
        },
        {
          title: "ChatGPT Adds Real-Time Web Search Feature Powered By SearchGPT",
          snippet: "OpenAI has rolled out real-time web search capabilities inside ChatGPT for subscribers.",
        },
        {
          title: "Waymo Expands Driverless Commercial Robotaxi Operations to Austin",
          snippet: "Waymo driverless rides are now open to the general public in downtown Austin.",
        },
      ];

      const clusters = clusterCandidates(items);
      // Expected: TSMC cluster (0, 2), OpenAI cluster (1, 3), Waymo solo (4)
      expect(clusters).toHaveLength(3);

      const tsmcCluster = clusters.find((c) => c.includes(0));
      expect(tsmcCluster).toContain(2);

      const openaiCluster = clusters.find((c) => c.includes(1));
      expect(openaiCluster).toContain(3);

      const waymoCluster = clusters.find((c) => c.includes(4));
      expect(waymoCluster).toHaveLength(1);
    });
  });
});
