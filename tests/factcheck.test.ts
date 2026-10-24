import { describe, expect, it } from "vitest";
import {
  checkUnsupportedNumbers,
  checkUnsupportedDates,
  extractQuotes,
  checkQuotes,
  checkSpeculation,
  checkEntities,
  checkSourceConflicts,
  checkLinks,
  runFactChecks,
  type SourceMaterial,
  type DraftText,
} from "@/lib/factcheck";

describe("Fact Check Engine", () => {
  const baseDraft: DraftText = {
    title: "Nvidia Announces Next-Gen AI Accelerator",
    deck: "The new accelerator doubles memory bandwidth for large cluster deployments.",
    body: "The chip delivers 128GB of high-bandwidth memory and draws 700W under peak workload.",
    confidence: "VERIFIED",
    classification: "NEWS",
    evergreen: false,
  };

  const baseSource: SourceMaterial = {
    publisher: "Nvidia Technical Blog",
    title: "Architecture Deep Dive",
    text: "The processor includes 128GB of HBM3e memory and operates at a TDP of 700W.",
    url: "https://example.com/source",
    tier: 1,
    publishedAt: new Date("2026-03-15T12:00:00Z"),
    linkOk: true,
  };

  describe("checkUnsupportedNumbers", () => {
    it("flags numbers not found in attached sources", () => {
      const draft: DraftText = {
        ...baseDraft,
        body: "The chip delivers 256GB of high-bandwidth memory and costs $40,000.",
      };
      const flags = checkUnsupportedNumbers(draft, [baseSource]);
      expect(flags.some((f) => f.message.includes("256gb"))).toBe(true);
      expect(flags.some((f) => f.message.includes("40000") || f.message.includes("$40,000"))).toBe(true);
    });

    it("passes when numbers are fully backed by sources", () => {
      const flags = checkUnsupportedNumbers(baseDraft, [baseSource]);
      expect(flags).toHaveLength(0);
    });

    it("skips checks for evergreen explainers", () => {
      const draft: DraftText = {
        ...baseDraft,
        body: "Architectures typically allocate 32GB to 64GB of memory.",
        evergreen: true,
      };
      const flags = checkUnsupportedNumbers(draft, [baseSource]);
      expect(flags).toHaveLength(0);
    });
  });

  describe("checkUnsupportedDates", () => {
    it("flags dates mentioned in body that do not match sources", () => {
      const draft: DraftText = {
        ...baseDraft,
        body: "Shipments will begin on November 24 across European data centers.",
      };
      const flags = checkUnsupportedDates(draft, [baseSource]);
      expect(flags.length).toBeGreaterThan(0);
      expect(flags[0].kind).toBe("UNSUPPORTED_DATE");
    });

    it("accepts dates matching source publication date or text", () => {
      const draft: DraftText = {
        ...baseDraft,
        body: "The announcement was made on March 15 during the keynote.",
      };
      const flags = checkUnsupportedDates(draft, [baseSource]);
      expect(flags).toHaveLength(0);
    });
  });

  describe("extractQuotes and checkQuotes", () => {
    it("extracts curly and straight quotes properly", () => {
      const text = 'CEO said "We are scaling compute infrastructure faster than ever before." while CTO noted “Our latency dropped noticeably.”';
      const quotes = extractQuotes(text);
      expect(quotes).toHaveLength(2);
      expect(quotes[0]).toBe("We are scaling compute infrastructure faster than ever before.");
    });

    it("flags quotes that are not verbatim in source text", () => {
      const draft: DraftText = {
        ...baseDraft,
        body: 'The CEO stated: "We will dominate all cloud datacenter installations this year."',
      };
      const flags = checkQuotes(draft, [baseSource]);
      expect(flags.some((f) => f.kind === "UNSUPPORTED_QUOTE")).toBe(true);
      expect(flags[0].severity).toBe("CRITICAL");
    });

    it("accepts verbatim quotes present in source text", () => {
      const sourceWithQuote: SourceMaterial = {
        ...baseSource,
        text: 'The company stated: "The processor includes 128GB of HBM3e memory and operates at high efficiency."',
      };
      const draft: DraftText = {
        ...baseDraft,
        body: 'The company stated: "The processor includes 128GB of HBM3e memory and operates at high efficiency."',
      };
      const flags = checkQuotes(draft, [sourceWithQuote]);
      expect(flags).toHaveLength(0);
    });
  });

  describe("checkSpeculation", () => {
    it("flags definitive future statements when story confidence is not VERIFIED", () => {
      const draft: DraftText = {
        ...baseDraft,
        confidence: "UNCONFIRMED",
        body: "The company will launch a new quantum chip next quarter.",
      };
      const flags = checkSpeculation(draft);
      expect(flags.some((f) => f.kind === "SPECULATION_AS_FACT")).toBe(true);
    });

    it("allows definitive future statements when properly hedged", () => {
      const draft: DraftText = {
        ...baseDraft,
        confidence: "UNCONFIRMED",
        body: "The company is reportedly planning to launch a new quantum chip next quarter according to people familiar with the matter.",
      };
      const flags = checkSpeculation(draft);
      expect(flags).toHaveLength(0);
    });

    it("allows statements when confidence is VERIFIED", () => {
      const draft: DraftText = {
        ...baseDraft,
        confidence: "VERIFIED",
        body: "The company will launch its developer preview tomorrow.",
      };
      const flags = checkSpeculation(draft);
      expect(flags).toHaveLength(0);
    });
  });

  describe("checkEntities", () => {
    it("flags known entity names mentioned without source support", () => {
      const draft: DraftText = {
        ...baseDraft,
        body: "The chip will integrate with OpenAI and Anthropic workloads natively.",
      };
      const flags = checkEntities(draft, [baseSource]);
      expect(flags.some((f) => f.message.includes("OpenAI"))).toBe(true);
      expect(flags.some((f) => f.message.includes("Anthropic"))).toBe(true);
    });
  });

  describe("checkSourceConflicts", () => {
    it("detects conflicting specifications between sources (e.g. 32GB vs 64GB)", () => {
      const sourceA: SourceMaterial = {
        publisher: "TechOutlet A",
        title: "Report A",
        text: "The new device features 32GB of unified memory.",
        url: "https://example.com/a",
        tier: 2,
      };
      const sourceB: SourceMaterial = {
        publisher: "TechOutlet B",
        title: "Report B",
        text: "The new device features 64GB of unified memory.",
        url: "https://example.com/b",
        tier: 2,
      };
      const flags = checkSourceConflicts([sourceA, sourceB]);
      expect(flags.some((f) => f.kind === "SPECIFICATION_CONFLICT")).toBe(true);
      expect(flags[0].detail).toContain("32");
      expect(flags[0].detail).toContain("64");
    });

    it("does not flag when sources agree on specifications", () => {
      const sourceA: SourceMaterial = {
        publisher: "TechOutlet A",
        title: "Report A",
        text: "The new device features 32GB of unified memory.",
        url: "https://example.com/a",
        tier: 2,
      };
      const sourceB: SourceMaterial = {
        publisher: "TechOutlet B",
        title: "Report B",
        text: "Specifications confirm 32GB of memory on the baseline model.",
        url: "https://example.com/b",
        tier: 2,
      };
      const flags = checkSourceConflicts([sourceA, sourceB]);
      expect(flags).toHaveLength(0);
    });
  });

  describe("checkLinks", () => {
    it("flags sources with broken links", () => {
      const badSource: SourceMaterial = {
        ...baseSource,
        linkOk: false,
      };
      const flags = checkLinks([badSource]);
      expect(flags).toHaveLength(1);
      expect(flags[0].kind).toBe("LINK_BROKEN");
    });
  });

  describe("runFactChecks aggregate", () => {
    it("runs complete suite cleanly on verified, supported draft", () => {
      const flags = runFactChecks(baseDraft, [baseSource]);
      expect(flags).toHaveLength(0);
    });
  });
});
