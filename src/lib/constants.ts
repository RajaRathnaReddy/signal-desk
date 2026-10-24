export const SITE_NAME = "Signal Desk";
export const SITE_TAGLINE = "Independent technology reporting and analysis";

export const CLASSIFICATIONS = [
  "BREAKING", "NEWS", "PRODUCT LAUNCH", "RESEARCH", "ANALYSIS", "EXPLAINER", "INDUSTRY",
  "STARTUPS", "FUNDING", "SECURITY", "POLICY", "OPINION", "RUMOR", "REPORT", "INTERVIEW", "REVIEW",
] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const STATUSES = [
  "COLLECTED", "RESEARCHING", "DRAFT", "FACT CHECK", "EDITOR REVIEW", "IMAGE REVIEW",
  "SEO REVIEW", "SCHEDULED", "PUBLISHED", "UPDATED", "REJECTED", "ARCHIVED",
] as const;
export type Status = (typeof STATUSES)[number];

/** Statuses visible to readers. */
export const LIVE_STATUSES: Status[] = ["PUBLISHED", "UPDATED"];

/** Ordered pipeline: SOURCE → COLLECT → VERIFY → CLASSIFY → DRAFT → FACT CHECK → EDITORIAL QC → IMAGE → SEO → PUBLISH → UPDATE */
export const PIPELINE: Status[] = [
  "COLLECTED", "RESEARCHING", "DRAFT", "FACT CHECK", "EDITOR REVIEW", "IMAGE REVIEW", "SEO REVIEW", "SCHEDULED", "PUBLISHED",
];

export const CONFIDENCE = ["VERIFIED", "LIKELY", "UNCONFIRMED", "RUMOR", "DO NOT PUBLISH"] as const;
export type Confidence = (typeof CONFIDENCE)[number];

export const CONFIDENCE_HELP: Record<Confidence, string> = {
  VERIFIED: "Multiple reliable sources or primary-source confirmation.",
  LIKELY: "Strong reporting, not fully confirmed.",
  UNCONFIRMED: "Credible report without sufficient independent confirmation.",
  RUMOR: "Speculative information.",
  "DO NOT PUBLISH": "Insufficient evidence, suspicious source, or unverifiable claim.",
};

export const ROLES = ["ADMIN", "EDITOR", "WRITER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const IMAGE_KINDS = ["PHOTO_OFFICIAL", "PHOTO_LICENSED", "PHOTO_EDITORIAL", "ILLUSTRATION", "CONCEPTUAL"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export const SOURCE_KINDS = ["OFFICIAL", "DOCUMENTATION", "PAPER", "FILING", "REPORT", "SOCIAL_OFFICIAL"] as const;

export const SOURCE_TIERS: Record<number, string> = {
  1: "Tier 1 · Primary source",
  2: "Tier 2 · Reputable press",
  3: "Tier 3 · Lead only",
};

/** Classifications that are allowed to carry a lower confidence label (always shown to readers). */
export const LABELLED_UNCERTAIN: Classification[] = ["RUMOR", "REPORT"];

export const MIN_PUBLISH_SCORE = 85;

export const CATEGORIES = [
  { slug: "ai", name: "AI", description: "Models, agents, research and the companies building them.", sortOrder: 1 },
  { slug: "business", name: "Business", description: "Major technology companies, acquisitions and industry shifts.", sortOrder: 2 },
  { slug: "security", name: "Security", description: "Vulnerabilities, breaches, advisories and defensive practice.", sortOrder: 3 },
  { slug: "cloud", name: "Cloud", description: "Infrastructure, platforms, databases and data engineering.", sortOrder: 4 },
  { slug: "hardware", name: "Hardware", description: "Chips, GPUs, devices, networking and telecom.", sortOrder: 5 },
  { slug: "science", name: "Science", description: "Quantum, robotics, space, biotech and research breakthroughs.", sortOrder: 6 },
  { slug: "startups", name: "Startups", description: "Funding, launches and acquisitions.", sortOrder: 7 },
  { slug: "developer", name: "Developer", description: "Programming, open source, GitHub, APIs and tooling.", sortOrder: 8 },
  { slug: "vfx-cg", name: "VFX / CG", description: "Rendering, game engines, procedural tools and digital humans.", sortOrder: 9 },
] as const;

/** Sections derived from classification rather than category. */
export const SECTIONS = {
  analysis: { name: "Analysis", description: "Reasoned interpretation, clearly separated from reporting.", classifications: ["ANALYSIS", "OPINION"] as string[] },
  reviews: { name: "Reviews", description: "Hands-on evaluation of products and tools.", classifications: ["REVIEW"] as string[] },
  explainers: { name: "Explainers", description: "Plain-language guides to how the technology actually works.", classifications: ["EXPLAINER"] as string[] },
} as const;

export const RESERVED_SLUGS = new Set([
  "admin", "api", "search", "newsletters", "about", "standards", "corrections", "rss.xml", "feed.xml", "sitemap.xml",
  "robots.txt", "media", "analysis", "reviews", "explainers", "latest", "trending", "_next", "unsubscribe", "confirm",
]);

export const NEWSLETTERS = [
  { slug: "daily-brief", name: "Daily Technology Brief", description: "The day's verified stories in one short read.", cadence: "Weekdays" },
  { slug: "ai-daily", name: "AI Daily", description: "Models, agents, research and policy in AI.", cadence: "Weekdays" },
  { slug: "security-brief", name: "Security Brief", description: "Advisories, breaches and what to patch.", cadence: "Twice weekly" },
  { slug: "developer-brief", name: "Developer Brief", description: "Tools, frameworks, releases and open source.", cadence: "Weekly" },
  { slug: "weekly-review", name: "Weekly Technology Review", description: "The week's most significant stories with context.", cadence: "Weekly" },
];

/** Known entities used for duplicate detection and search. Extend freely; unknown entities are still handled by token overlap. */
export const KNOWN_ENTITIES = [
  "OpenAI", "Anthropic", "Google", "DeepMind", "Gemini", "Microsoft", "Copilot", "Apple", "Amazon", "AWS", "Meta", "Nvidia",
  "AMD", "Intel", "Qualcomm", "TSMC", "Samsung", "Tesla", "Waymo", "SpaceX", "Cloudflare", "GitHub", "GitLab", "Oracle",
  "IBM", "Cisco", "Salesforce", "Snowflake", "Databricks", "Stripe", "Mistral", "xAI", "Hugging Face", "Unity",
  "Unreal Engine", "Epic Games", "Adobe", "Autodesk", "Houdini", "SideFX", "Blender", "Linux", "Kubernetes", "Rust",
  "Python", "TypeScript", "JavaScript", "PostgreSQL", "Docker", "CISA", "NIST", "OpenSSL", "Android", "iOS", "Windows",
];
