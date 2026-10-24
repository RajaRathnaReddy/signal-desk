import { describe, expect, it } from "vitest";
import { expandQuery, searchDocs, suggest, type SearchDoc } from "@/lib/search";

describe("Search Engine", () => {
  const sampleDocs: SearchDoc[] = [
    {
      id: "doc-1",
      title: "Understanding Retrieval-Augmented Generation Architecture",
      deck: "How vector embeddings and external indexing ground large language models in factual documents.",
      body: "Retrieval-augmented generation pairs generative models with retrieval systems, querying vector databases to assemble relevant context windows.",
      tags: ["ai", "rag", "embeddings", "llm"],
      companies: [],
      category: "ai",
      publishedAt: new Date("2026-03-01T10:00:00Z"),
    },
    {
      id: "doc-2",
      title: "Inside the Neural Processing Unit: Why Dedicated Silicon Matters",
      deck: "Modern client processors include dedicated NPUs to accelerate matrix multiplication locally.",
      body: "Unlike CPUs and GPUs, NPUs are designed specifically for low-power tensor arithmetic and quantization.",
      tags: ["hardware", "semiconductors", "npu", "chips"],
      companies: ["Qualcomm", "Apple", "Intel"],
      category: "hardware",
      publishedAt: new Date("2026-03-02T10:00:00Z"),
    },
    {
      id: "doc-3",
      title: "Model Context Protocol: Standardizing Tool Calling for AI Agents",
      deck: "Anthropic open-source standard for connecting language models to external data sources.",
      body: "The Model Context Protocol defines standardized JSON-RPC communication between agent hosts and external resources.",
      tags: ["ai", "mcp", "agents", "protocols"],
      companies: ["Anthropic"],
      category: "ai",
      publishedAt: new Date("2026-03-03T10:00:00Z"),
    },
  ];

  describe("expandQuery", () => {
    it("expands terms with relevant domain synonyms", () => {
      const { terms, related } = expandQuery("llm agents");
      expect(terms).toContain("llm");
      expect(terms).toContain("agents");
      expect(related).toContain("model");
      expect(related).toContain("language");
    });
  });

  describe("searchDocs", () => {
    it("ranks exact title matches highest", () => {
      const results = searchDocs(sampleDocs, "retrieval augmented");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].doc.id).toBe("doc-1");
    });

    it("matches via tags and company metadata", () => {
      const results = searchDocs(sampleDocs, "Qualcomm chips");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].doc.id).toBe("doc-2");
    });

    it("handles typos gracefully via Levenshtein distance", () => {
      // "protcol" instead of "protocol", "agentic" matching "agents"
      const results = searchDocs(sampleDocs, "protcol standard");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].doc.id).toBe("doc-3");
    });

    it("returns empty array when query is empty or has no matches", () => {
      const results = searchDocs(sampleDocs, "submarine biology oceanography");
      expect(results).toHaveLength(0);
    });
  });

  describe("suggest ('Did you mean')", () => {
    it("suggests the correct vocabulary term for a misspelled query", () => {
      // In vocabulary from sampleDocs: "retrieval", "embeddings", "anthropic", "processors"
      const suggestion = suggest(sampleDocs, "antrhopic");
      expect(suggestion).toBe("anthropic");
    });

    it("returns null if query terms are already valid vocabulary", () => {
      const suggestion = suggest(sampleDocs, "anthropic");
      expect(suggestion).toBeNull();
    });
  });
});
