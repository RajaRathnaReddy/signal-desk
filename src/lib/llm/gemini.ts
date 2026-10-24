import { z } from "zod";
import { ARTICLE_SYSTEM_PROMPT, type DraftOutput, type DraftSource, type LlmProvider } from "./provider";

const schema = z.object({
  title: z.string().min(10).max(160),
  deck: z.string().max(300).default(""),
  bodyMd: z.string().min(50),
  keyTakeaways: z.array(z.string()).max(6).default([]),
  whyItMatters: z.string().default(""),
  contextMd: z.string().default(""),
  seoTitle: z.string().max(80).default(""),
  metaDescription: z.string().max(200).default(""),
  tags: z.array(z.string()).max(8).default([]),
  companies: z.array(z.string()).max(8).default([]),
  suggestedClassification: z.string().default("NEWS"),
  suggestedCategory: z.string().default("business"),
  unknowns: z.array(z.string()).default([]),
});

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" }, deck: { type: "STRING" }, bodyMd: { type: "STRING" },
    keyTakeaways: { type: "ARRAY", items: { type: "STRING" } },
    whyItMatters: { type: "STRING" }, contextMd: { type: "STRING" }, seoTitle: { type: "STRING" }, metaDescription: { type: "STRING" },
    tags: { type: "ARRAY", items: { type: "STRING" } }, companies: { type: "ARRAY", items: { type: "STRING" } },
    suggestedClassification: { type: "STRING" }, suggestedCategory: { type: "STRING" },
    unknowns: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["title", "deck", "bodyMd", "keyTakeaways", "whyItMatters", "seoTitle", "metaDescription", "suggestedClassification", "suggestedCategory"],
};

export class GeminiProvider implements LlmProvider {
  readonly name = "Gemini";
  isConfigured() {
    return !!process.env.GEMINI_API_KEY;
  }

  async draft(sources: DraftSource[]): Promise<DraftOutput> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not configured");
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const material = sources
      .map((s, i) => `SOURCE ${i + 1} — ${s.publisher} (tier ${s.tier})${s.publishedAt ? ` — published ${s.publishedAt}` : ""}\nTitle: ${s.title}\nURL: ${s.url}\nExcerpt: ${s.excerpt || "(no excerpt available)"}`)
      .join("\n\n");
    const user = `Categories you may suggest: ai, business, security, cloud, hardware, science, startups, developer, vfx-cg.\nClassifications you may suggest: NEWS, PRODUCT LAUNCH, RESEARCH, SECURITY, POLICY, INDUSTRY, STARTUPS, FUNDING, REPORT, RUMOR.\nIf the sources describe a report or rumour rather than a confirmation, suggest REPORT or RUMOR.\n\n${material}`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: ARTICLE_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.4, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Gemini request failed (HTTP ${res.status})`);
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("Gemini returned no content");
    return schema.parse(JSON.parse(text));
  }
}

export function getProvider(): LlmProvider {
  return new GeminiProvider();
}
