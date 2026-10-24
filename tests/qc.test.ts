import { describe, expect, it } from "vitest";
import { evaluateQc, findBannedPhrases, repeatedOpenings, duplicateParagraphs, type QcInput } from "@/lib/qc";

describe("Editorial QC Engine", () => {
  it("detects banned AI/hype phrases", () => {
    const text = "OpenAI released a groundbreaking model. Here's what you need to know in a rapidly evolving landscape.";
    const found = findBannedPhrases(text);
    expect(found).toContain("groundbreaking");
    expect(found).toContain("here's what you need to know");
    expect(found).toContain("rapidly evolving landscape");
  });

  it("detects repeated openings across paragraphs", () => {
    const text = `The company announced a new chip architecture today.\n\nThe company announced additional cloud partnerships later.\n\nThe company announced price reductions across all tiers.`;
    expect(repeatedOpenings(text)).toBeGreaterThanOrEqual(1);
  });

  it("detects duplicate paragraphs", () => {
    const para = "Nvidia introduced its next generation graphics processing unit targeting high density enterprise server deployments across cloud providers.";
    const text = `${para}\n\nSome other text.\n\n${para}`;
    expect(duplicateParagraphs(text)).toBeGreaterThanOrEqual(1);
  });

  it("passes high quality original evergreen article", () => {
    const input: QcInput = {
      article: {
        title: "How GPU Memory Bandwidth Shapes Large Language Model Inference",
        slug: "gpu-memory-bandwidth-llm-inference",
        deck: "Compute is rarely the bottleneck for autoregressive generation. Memory bandwidth dictates actual throughput.",
        seoTitle: "How GPU Memory Bandwidth Shapes LLM Inference",
        metaDescription: "An engineering breakdown of why memory bandwidth, not raw FLOPS, governs large language model generation speed.",
        bodyMd: `When generating text with an autoregressive language model, every token produced requires streaming the model's entire weight matrix from memory into compute cores. This memory-bandwidth-bound regime means a processor with astronomical FLOPS will sit idle if high-bandwidth memory cannot supply weights quickly enough.\n\nModern architectures address this with High Bandwidth Memory stacked directly on the interposer, yet cluster architects continually balance cost against memory throughput.`,
        keyTakeaways: ["Autoregressive decoding is memory-bandwidth bound", "Weight streaming determines per-token latency"],
        whyItMatters: "Understanding memory bottlenecks prevents over-provisioning compute for inference workloads.",
        contextMd: "Hardware vendors continue to release specialized memory configurations for serving clusters.",
        classification: "EXPLAINER",
        confidence: "VERIFIED",
        hasCategory: true,
        hasAuthor: true,
      },
      sources: [
        {
          publisher: "IEEE Micro",
          title: "Hardware Architectures for Deep Learning",
          text: "Autoregressive generation streams weights continuously, making memory bandwidth the limiting factor.",
          url: "https://example.com/ieee-paper",
          tier: 1,
          linkOk: true,
        },
      ],
      image: {
        url: "/illustrations/sample.svg",
        alt: "Memory bandwidth diagram showing weight transfer speeds",
        caption: "Diagram of HBM memory bandwidth transfer rates. Signal Desk illustration.",
        kind: "ILLUSTRATION",
        status: "APPROVED",
        depictsRealEvent: false,
        credit: "Signal Desk",
      },
      factChecks: [],
      unresolvedCritical: 0,
      unresolvedWarnings: 0,
      duplicateOfLiveArticle: false,
      evergreen: true,
    };

    const report = evaluateQc(input);
    expect(report.criticalFailures).toHaveLength(0);
    expect(report.score).toBeGreaterThanOrEqual(85);
    expect(report.passes).toBe(true);
  });

  it("fails QC when critical fact check flag is unresolved", () => {
    const input: QcInput = {
      article: {
        title: "Company Reports Strong Hardware Growth",
        slug: "company-hardware-growth",
        deck: "Quarterly figures show expansion across data center divisions.",
        seoTitle: "Company Reports Hardware Growth",
        metaDescription: "Quarterly figures show expansion across high density data center computing hardware divisions.",
        bodyMd: "Revenue surged by 150% reaching $50 billion in quarterly server sales.",
        keyTakeaways: ["Growth led by servers"],
        whyItMatters: "Signal for capital expenditure trends.",
        contextMd: "Competitors also reporting next week.",
        classification: "NEWS",
        confidence: "VERIFIED",
        hasCategory: true,
        hasAuthor: true,
      },
      sources: [],
      image: null,
      factChecks: [],
      unresolvedCritical: 1,
      unresolvedWarnings: 0,
      duplicateOfLiveArticle: false,
      evergreen: false,
    };

    const report = evaluateQc(input);
    expect(report.passes).toBe(false);
    expect(report.criticalFailures.length).toBeGreaterThan(0);
  });
});
