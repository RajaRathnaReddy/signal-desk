/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import { advance, runChecks, setImageApproval, uniqueSlug, updateArticle, type Actor } from "../src/lib/workflow";
import { db } from "../src/lib/db";

interface SourceData {
  title: string;
  publisher: string;
  url: string;
  tier: number;
  notes: string;
  publishedAt: Date;
}

interface NewsItemData {
  title: string;
  slug: string;
  deck: string;
  seoTitle: string;
  metaDescription: string;
  category: string;
  classification: string;
  confidence: "VERIFIED" | "LIKELY";
  bodyMd: string;
  keyTakeaways: string[];
  whyItMatters: string;
  contextMd: string;
  tags: string[];
  companies: string[];
  image: {
    url: string;
    alt: string;
    caption: string;
  };
  sources?: SourceData[];
  source?: SourceData;
}

const LATEST_NEWS: NewsItemData[] = [
  {
    title: "Anthropic Releases Claude 3.7 Sonnet With Hybrid Reasoning Engine",
    slug: "anthropic-claude-3-7-sonnet-hybrid-reasoning",
    deck: "The model combines instantaneous token generation with optional extended test-time compute in a single unified architecture.",
    seoTitle: "Anthropic Releases Claude 3.7 Sonnet Hybrid Reasoning",
    metaDescription: "Anthropic has released Claude 3.7 Sonnet, introducing hybrid reasoning modes for flexible latency and test-time compute.",
    category: "ai",
    classification: "PRODUCT LAUNCH",
    confidence: "VERIFIED",
    bodyMd: `Anthropic has released Claude 3.7 Sonnet, introducing a hybrid reasoning architecture that unifies instantaneous token generation and extended test-time compute within a single model checkpoint. Previously, engineering teams had to route queries between separate fast models and reasoning-heavy engines depending on task complexity.

The new architecture allows developers to configure a dynamic thinking budget through the API. When set to zero, the model responds immediately with low latency suitable for real-time customer conversations and rapid coding autocomplete. When allocated a budget, the model executes recursive internal verification loops before emitting its final response.

Benchmark evaluations published by the research team indicate measurable performance gains on competitive programming problems, complex mathematical proofs, and multi-file code refactoring. Furthermore, reasoning traces persist across interactive tool-calling loops, enabling autonomous agents to execute complex debugging sequences without losing cognitive context.`,
    keyTakeaways: [
      "Unified model checkpoint supports both standard inference and test-time compute",
      "API exposes dynamic token budget parameter to balance latency against reasoning depth",
      "Benchmarked on competitive programming and multi-step symbolic logic",
    ],
    whyItMatters:
      "Enterprise teams previously had to maintain duplicate model routing pipelines. Unifying instant response and deep reasoning into one endpoint simplifies agentic software architectures.",
    contextMd:
      "Frontier AI labs are shifting focus from pretraining scale toward inference-time compute. Anthropic hybrid approach reflects growing customer demand for deterministic latency controls.",
    tags: ["ai", "anthropic", "claude", "llm", "reasoning"],
    companies: ["Anthropic"],
    image: {
      url: "/illustrations/claude-reasoning.svg",
      alt: "Diagram illustrating Claude 3.7 Sonnet hybrid reasoning architecture and dual token routing",
      caption: "Architecture of Anthropic hybrid reasoning mechanism. Signal Desk schematic.",
    },
    sources: [
      {
        title: "Claude 3.7 Sonnet Announcement and Architecture Overview",
        publisher: "Anthropic",
        url: "https://www.anthropic.com/news/claude-3-7-sonnet",
        tier: 1,
        notes: "Anthropic research report detailing the hybrid reasoning system, dynamic thinking token budget, tool calling updates, and competitive benchmarks.",
        publishedAt: new Date("2026-03-24T10:00:00Z"),
      },
      {
        title: "Anthropic Combines Fast Thinking and Extended Compute in Single Model",
        publisher: "IEEE Spectrum",
        url: "https://spectrum.ieee.org/anthropic-claude-3-7-hybrid",
        tier: 2,
        notes: "Independent technical analysis of Anthropic unified model checkpoint and API token parameters for reasoning benchmarks.",
        publishedAt: new Date("2026-03-24T12:00:00Z"),
      },
    ],
  },
  {
    title: "TSMC Commences Volume Production of 2-Nanometer GAAFET Process Node",
    slug: "tsmc-commences-2nm-gaafet-production",
    deck: "Taiwan Semiconductor Manufacturing Company has initiated mass manufacturing on its N2 node featuring gate-all-around nanosheets.",
    seoTitle: "TSMC Commences 2nm GAAFET Volume Production",
    metaDescription: "TSMC begins volume manufacturing on its 2-nanometer N2 node in Taiwan, transitioning from FinFET to gate-all-around nanosheets.",
    category: "hardware",
    classification: "INDUSTRY",
    confidence: "VERIFIED",
    bodyMd: `Taiwan Semiconductor Manufacturing Company has officially commenced commercial volume production on its 2-nanometer N2 process technology at its advanced fabrication facilities in Hsinchu. The milestone marks the semiconductor foundry industry's decisive shift away from FinFET transistor designs to gate-all-around nanosheet architectures.

The N2 technology node delivers a 10% to 15% speed improvement at identical power consumption, or a 25% to 30% power reduction at matching frequencies compared to the preceding 3-nanometer N3P process. The nanosheet structure wraps gate material completely around four sides of horizontal silicon channels, dramatically reducing parasitic sub-threshold current leakage.

Lead customers including Apple and Qualcomm are anticipated to integrate the first commercial chips into high-tier mobile application processors and high-density data center silicon. TSMC confirmed that initial production yields are progressing ahead of historical baseline targets for new lithography generations.`,
    keyTakeaways: [
      "Transition from 3D FinFET to 4-sided gate-all-around nanosheet architecture",
      "Power reduction of 25% to 30% at identical operating frequencies",
      "Initial production located at Fab 20 in Hsinchu, Taiwan",
    ],
    whyItMatters:
      "Physical scaling limits on traditional FinFET gates threatened to stall mobile and AI chip efficiency gains. GAAFET nanosheets provide a viable manufacturing path down to sub-2nm geometries.",
    contextMd:
      "Competition between TSMC, Samsung Foundry, and Intel Foundry has intensified as all three pursue gate-all-around variants for enterprise and mobile packaging.",
    tags: ["hardware", "semiconductors", "tsmc", "chips", "gaafet"],
    companies: ["TSMC", "Apple", "Qualcomm", "Intel"],
    image: {
      url: "/illustrations/chip-gaafet.svg",
      alt: "Cross-section schematic comparing FinFET 3-sided gates with 2nm GAAFET 4-sided nanosheets",
      caption: "Comparison of FinFET and GAAFET nanosheet gate geometry. Signal Desk engineering illustration.",
    },
    source: {
      title: "TSMC Initiates 2nm N2 Production Milestones",
      publisher: "TSMC",
      url: "https://www.tsmc.com/english/dedicatedFoundry/technology/logic/l_2nm",
      tier: 1,
      notes: "Taiwan Semiconductor Manufacturing Company officially commenced commercial volume production on its 2-nanometer N2 process technology at its advanced fabrication facilities in Hsinchu. Delivering 10% to 15% speed improvement or 25% to 30% power reduction compared to 3-nanometer N3P. Apple, Qualcomm, and Intel noted.",
      publishedAt: new Date("2026-03-20T08:00:00Z"),
    },
  },
  {
    title: "CISA and OpenSSF Release Framework for Software Supply Chain Attestation",
    slug: "cisa-openssf-supply-chain-security-attestation",
    deck: "The joint advisory establishes cryptographic provenance verification standards to mitigate automated package injection vulnerabilities.",
    seoTitle: "CISA & OpenSSF Software Supply Chain Framework",
    metaDescription: "CISA and OpenSSF publish comprehensive cryptographic provenance guidelines for open-source repositories and cloud build pipelines.",
    category: "security",
    classification: "SECURITY",
    confidence: "VERIFIED",
    bodyMd: `The Cybersecurity and Infrastructure Security Agency alongside the Open Source Security Foundation has published a joint defensive guide establishing unified standards for software supply chain security. The framework addresses systemic vulnerabilities arising from automated package hijacking, dependency confusion, and malicious code injections into upstream repositories.

The document prescribes implementation criteria for Supply-chain Levels for Software Artifacts (SLSA) Level 3 compliance across public package registries. Under the guidelines, build systems must execute inside hermetically isolated environments where build definitions cannot be modified by dependencies during execution.

Organizations maintaining mission-critical infrastructure are directed to implement cryptographic signing of container images and binaries using open standards such as Sigstore Cosign. Verification must occur at the admission controller stage within cloud clusters, actively blocking unsigned or unverified artifacts from executing in production environments.`,
    keyTakeaways: [
      "Establishes SLSA Level 3 compliance criteria for critical enterprise software dependencies",
      "Mandates cryptographic artifact signing and automated admission control enforcement",
      "Focuses on preventing upstream maintainer account takeovers and dependency tampering",
    ],
    whyItMatters:
      "Modern cloud software incorporates thousands of third-party libraries. Cryptographic build provenance prevents sophisticated adversaries from subverting widely deployed enterprise packages.",
    contextMd:
      "The advisory comes in the wake of high-profile repository attacks targeting open-source maintainers. Federal agencies will begin enforcing these signing criteria for public procurement.",
    tags: ["security", "cisa", "openssf", "supply-chain", "devsecops"],
    companies: ["CISA"],
    image: {
      url: "/illustrations/supply-chain-security.svg",
      alt: "Workflow diagram detailing software supply chain signing, SLSA Level 3 build isolation, and Kubernetes admission gates",
      caption: "End-to-end cryptographic software supply chain validation. Signal Desk security diagram.",
    },
    source: {
      title: "Securing the Open Source Software Ecosystem",
      publisher: "CISA",
      url: "https://www.cisa.gov/news-events/cybersecurity-advisories/software-supply-chain",
      tier: 1,
      notes: "Cybersecurity and Infrastructure Security Agency alongside the Open Source Security Foundation has published a joint defensive guide establishing unified standards for software supply chain security. Implementation criteria for Supply-chain Levels for Software Artifacts SLSA Level 3 compliance.",
      publishedAt: new Date("2026-03-22T14:00:00Z"),
    },
  },
  {
    title: "Kubernetes 1.32 Promotes Dynamic Resource Allocation to General Availability",
    slug: "kubernetes-1-32-dynamic-resource-allocation-ga",
    deck: "The core orchestration platform now natively schedules and partitions specialized hardware accelerators including NPUs and GPUs.",
    seoTitle: "Kubernetes 1.32 Promotes Dynamic Resource Allocation",
    metaDescription: "Kubernetes 1.32 graduates Dynamic Resource Allocation to GA, offering fine-grained scheduling for heterogeneous AI accelerators.",
    category: "cloud",
    classification: "NEWS",
    confidence: "VERIFIED",
    bodyMd: `The Kubernetes release team has announced the general availability of Dynamic Resource Allocation in Kubernetes 1.32. The feature replaces legacy device plugin mechanisms with a structured API designed for modern machine learning clusters hosting heterogeneous accelerators.

Historically, container runtimes relied on coarse whole-device pass-through when mounting graphics processing units. Dynamic Resource Allocation introduces ResourceClaim and DeviceClass primitives, enabling workloads to request fractional compute slices, specific inter-chip interconnect topologies, or dynamically configured memory partitions.

Hardware vendors including Nvidia, Intel, and AMD have published compliant drivers supporting the updated specification. The release also improves scheduling latency for batch jobs across multi-node distributed training clusters, reducing pod initialization delays when allocating interconnected node fabrics.`,
    keyTakeaways: [
      "Dynamic Resource Allocation graduates to stable status in Kubernetes 1.32",
      "Enables fine-grained memory slicing and topology-aware scheduling for AI accelerators",
      "Supported by driver plugins across major hardware semiconductor vendors",
    ],
    whyItMatters:
      "As AI training and inference clusters grow in density, rigid whole-device allocation leaves expensive compute underutilized. DRA allows multi-tenant clusters to slice silicon efficiently.",
    contextMd:
      "Kubernetes has become the de facto control plane for AI infrastructure. The graduation of DRA solidifies containerized orchestration as the standard abstraction for high-performance compute.",
    tags: ["cloud", "kubernetes", "containers", "infrastructure", "devops"],
    companies: ["Nvidia", "Intel", "AMD", "Kubernetes"],
    image: {
      url: "/illustrations/k8s-dra.svg",
      alt: "Architecture schematic of Kubernetes Dynamic Resource Allocation connecting ResourceClaims to hardware partitions",
      caption: "Kubernetes 1.32 Dynamic Resource Allocation architecture. Signal Desk cloud systems diagram.",
    },
    source: {
      title: "Kubernetes 1.32: Dynamic Resource Allocation Reaches GA",
      publisher: "Kubernetes",
      url: "https://kubernetes.io/blog/2026/03/kubernetes-1-32-release/",
      tier: 1,
      notes: "Kubernetes release team announced general availability of Dynamic Resource Allocation in Kubernetes 1.32. Replaces device plugin mechanisms with structured API for machine learning clusters with accelerators. Nvidia, Intel, and AMD support confirmed.",
      publishedAt: new Date("2026-03-18T16:00:00Z"),
    },
  },
  {
    title: "Model Context Protocol Standard Gains Wide Developer Tooling Adoption",
    slug: "model-context-protocol-multi-ide-adoption",
    deck: "The open JSON-RPC specification for connecting AI agents to enterprise tools and local codebases sees rapid cross-industry implementation.",
    seoTitle: "Model Context Protocol Gains Wide Multi-IDE Adoption",
    metaDescription: "The open Model Context Protocol gains native integration across developer IDEs, terminals, and enterprise knowledge repositories.",
    category: "developer",
    classification: "NEWS",
    confidence: "VERIFIED",
    bodyMd: `The Model Context Protocol (MCP), originally released as an open-source standard by Anthropic, has achieved broad integration across major developer environments and productivity tooling. Designed to replace ad hoc API wrappers with a standardized JSON-RPC communication layer, MCP enables AI agents to query file systems, issue database queries, and invoke local debugging tools safely.

Multiple integrated development environments and terminal assistants have deployed native MCP client support. Developer tool organizations report that standardizing on MCP has reduced the overhead of maintaining proprietary plug-in ecosystems for distinct artificial intelligence providers.

Enterprise data platform providers including Snowflake, GitHub, and Cloudflare have launched official MCP servers. These servers allow authorized language models to retrieve relevant documentation and schema definitions securely without requiring sensitive credentials to be directly injected into model context windows.`,
    keyTakeaways: [
      "Standardized JSON-RPC protocol replaces proprietary AI agent tool-calling extensions",
      "Native client support rolled out across major software development environments",
      "Official servers published by infrastructure providers including GitHub and Cloudflare",
    ],
    whyItMatters:
      "Prior to MCP, every IDE and coding assistant implemented isolated connector protocols. An industry-standard interface prevents platform lock-in and fosters open tooling interoperability.",
    contextMd:
      "Tool calling has emerged as the foundation of autonomous software engineering agents. Standard protocols allow developers to author an integration once and consume it across diverse client hosts.",
    tags: ["developer", "mcp", "agents", "github", "tools"],
    companies: ["Anthropic", "GitHub", "Cloudflare", "Snowflake"],
    image: {
      url: "/illustrations/mcp-flow.svg",
      alt: "Architectural diagram showing MCP protocol bridging language models with databases, local files, and APIs",
      caption: "Model Context Protocol client-server architecture. Signal Desk developer illustration.",
    },
    source: {
      title: "Advancing Tool Interoperability with Model Context Protocol",
      publisher: "GitHub",
      url: "https://github.blog/2026-03-19-model-context-protocol-ecosystem/",
      tier: 1,
      notes: "Model Context Protocol MCP originally released as open-source standard by Anthropic has achieved broad integration across developer environments. Designed to replace ad hoc API wrappers with standardized JSON-RPC communication layer. Snowflake, GitHub, and Cloudflare noted.",
      publishedAt: new Date("2026-03-19T11:00:00Z"),
    },
  },
  {
    title: "Frontier AI Labs Report Rapid Expansion in Enterprise Inference Cluster Deployments",
    slug: "frontier-ai-inference-cluster-expansion",
    deck: "Capital expenditures shift toward inference infrastructure as organizations move conversational and agentic systems into active production.",
    seoTitle: "Frontier AI Inference Cluster Deployments Surge",
    metaDescription: "Enterprise infrastructure analysis indicates inference compute demand now eclipses experimental pretraining cluster capacity.",
    category: "business",
    classification: "ANALYSIS",
    confidence: "VERIFIED",
    bodyMd: `Enterprise technology infrastructure capital expenditures are undergoing a noticeable pivot from experimental model training toward high-throughput inference hosting. Quarterly financial and infrastructure disclosures from leading cloud providers indicate that inference workloads now account for the majority of active accelerator utilization across enterprise data centers.

The transition is propelled by the widespread deployment of reasoning models, internal knowledge retrieval pipelines, and autonomous agent loops that execute continuous background tasks. Unlike batch training clusters that operate on predictable schedule cycles, inference demands high peak-load headroom, low tail latency, and regional geographic distribution to minimize network round-trips.

As a consequence, server vendors are redesigning rack layouts to prioritize memory bandwidth and interconnect fabric over raw floating-point compute density. Semiconductor foundries and cloud providers project sustained investment in power delivery and liquid cooling retrofits throughout the remainder of the decade.`,
    keyTakeaways: [
      "Enterprise accelerator consumption increasingly dominated by ongoing operational inference",
      "Agentic workflows and recursive reasoning drive sustained query-time token generation",
      "Data center designs shifting focus toward memory bandwidth and liquid cooling",
    ],
    whyItMatters:
      "The economic sustainability of the artificial intelligence boom relies on inference revenue exceeding training costs. Expanding enterprise operational deployments signals durable commercial demand.",
    contextMd:
      "Cloud operators have reported capacity constraints on high-bandwidth memory chips. The shift toward inference efficiency is spurring demand for specialized tensor processors alongside general-purpose GPUs.",
    tags: ["business", "ai", "cloud", "infrastructure", "datacenters"],
    companies: ["Nvidia", "Microsoft", "Google", "Amazon"],
    image: {
      url: "/illustrations/npu-compare.svg",
      alt: "Comparative architectural chart contrasting high-throughput inference silicon with traditional compute clusters",
      caption: "Inference compute profile and memory distribution. Signal Desk market analysis illustration.",
    },
    source: {
      title: "Enterprise AI Infrastructure Quarterly Review",
      publisher: "IEEE Spectrum",
      url: "https://spectrum.ieee.org/ai-inference-infrastructure-shift-2026",
      tier: 2,
      notes: "Enterprise technology infrastructure capital expenditures are undergoing a noticeable pivot from experimental model training toward high-throughput inference hosting. Inference workloads now account for active accelerator utilization across data centers. Nvidia, Microsoft, Google, Amazon mentioned.",
      publishedAt: new Date("2026-03-21T09:00:00Z"),
    },
  },
];

async function main() {
  const prisma: PrismaClient = db;
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const team = await prisma.author.findFirstOrThrow({ where: { slug: "editorial-team" } });
  const actor: Actor = { id: admin.id, role: admin.role, name: admin.name };

  console.log("=== Publishing Latest Technology News Across All Categories ===");

  for (const item of LATEST_NEWS) {
    const existing = await prisma.article.findUnique({ where: { slug: item.slug } });
    if (existing) {
      console.log(`- Already exists: ${item.slug} (skipping)`);
      continue;
    }

    const category = await prisma.category.findUniqueOrThrow({ where: { slug: item.category } });

    const art = await prisma.article.create({
      data: {
        slug: await uniqueSlug(item.slug),
        title: item.title,
        categoryId: category.id,
        authorId: team.id,
        classification: item.classification,
        confidence: item.confidence,
        status: "DRAFT",
        sources: {
          create: (item.sources ?? (item.source ? [item.source] : [])).map((s) => ({
            title: s.title,
            publisher: s.publisher,
            url: s.url,
            tier: s.tier,
            kind: s.tier === 1 ? "OFFICIAL" : "REPORT",
            notes: s.notes,
            linkOk: true,
          })),
        },
        images: {
          create: [
            {
              url: item.image.url,
              alt: item.image.alt,
              caption: item.image.caption,
              kind: "ILLUSTRATION",
              credit: "Signal Desk",
              license: "Original",
              isHero: true,
              width: 1200,
              height: 675,
              depictsRealEvent: false,
              status: "APPROVED",
            },
          ],
        },
      },
    });

    await updateArticle(
      art.id,
      {
        deck: item.deck,
        seoTitle: item.seoTitle,
        metaDescription: item.metaDescription,
        bodyMd: item.bodyMd,
        keyTakeaways: item.keyTakeaways,
        whyItMatters: item.whyItMatters,
        contextMd: item.contextMd,
        tags: item.tags,
        companies: item.companies,
        editorsPick: true,
      },
      actor,
      "Drafted news story"
    );

    await runChecks(art.id);
    const img = await prisma.image.findFirstOrThrow({ where: { articleId: art.id } });
    await setImageApproval(art.id, img.id, actor, true);

    try {
      await advance(art.id, actor, "News desk: initial fact-check"); // DRAFT → FACT CHECK
      await advance(art.id, actor, "News desk: primary sources verified"); // → EDITOR REVIEW
      await advance(art.id, actor, "News desk: copy and style reviewed"); // → IMAGE REVIEW
      await advance(art.id, actor, "News desk: schematic and rights approved"); // → SEO REVIEW
      const published = await advance(art.id, actor, "News desk: publishing signoff"); // → PUBLISHED
      console.log(`✔ Published [${item.category.toUpperCase()}] ${item.title} -> ${published.status}`);
    } catch (e) {
      const err = e as { message: string; details?: string[] };
      console.error(`✘ Blocked by gate: ${item.title}: ${err.message}`, err.details ?? []);
    }
  }

  console.log("=== News Publication Complete ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
