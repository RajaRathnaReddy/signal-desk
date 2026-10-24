/**
 * Evergreen explainers. They describe how a technology works, make no claims about current events, and cite primary
 * references. They still go through the same QC, review and publishing gate as any other article (see seed.ts).
 */
export interface SeedExplainer {
  slug: string;
  category: string;
  title: string;
  deck: string;
  seoTitle: string;
  metaDescription: string;
  tags: string[];
  companies: string[];
  keyTakeaways: string[];
  whyItMatters: string;
  contextMd: string;
  bodyMd: string;
  sources: { title: string; url: string; publisher: string; tier: number; kind: string; notes: string }[];
  image: { url: string; alt: string; caption: string };
}

export const EXPLAINERS: SeedExplainer[] = [
  {
    slug: "what-is-an-ai-agent",
    category: "ai",
    title: "What Is an AI Agent, and How Is It Different From a Chatbot?",
    deck: "The word is used for everything from a scripted workflow to software that plans its own work. Here is what the term can reasonably mean.",
    seoTitle: "What Is an AI Agent? A Plain-Language Explainer",
    metaDescription: "An AI agent lets a language model choose its own next steps and call tools. How agents work, where they fail, and how they differ from chatbots.",
    tags: ["AI agents", "Explainer", "Large language models"],
    companies: ["Anthropic"],
    keyTakeaways: [
      "An agent is a language model placed in a loop where it can choose actions, use tools and see the results.",
      "A fixed sequence of model calls is a workflow, not an agent. The difference is who decides the next step.",
      "More autonomy means more cost, more latency and more ways to go wrong, so many useful products deliberately stay simpler.",
    ],
    whyItMatters: "Products described as agents are being sold to businesses and consumers with very different levels of autonomy. Knowing the basic mechanism helps readers judge what a given system can actually be trusted to do unattended.",
    contextMd: "There is no formal industry definition of an agent. Vendors, researchers and engineers draw the line in different places, so a product's label tells you little on its own. What matters is how much of the decision-making is left to the model and what it is allowed to touch.",
    bodyMd: `A chatbot answers a message. An agent is asked to get something done.

That is the shortest useful distinction, and it hides a real technical difference. When you ask a chatbot a question, a language model produces a reply and the exchange ends. An agent wraps the same kind of model in a loop. The model looks at a goal, picks an action such as running a search or editing a file, receives the result, and decides what to do next. It repeats until it judges the job finished or hits a limit someone set in advance.

## The loop itself

Strip away the branding and most agents share the same skeleton. There is a model, a set of tools it is allowed to call, and some memory of what has happened so far. The tools are ordinary software: a web search, a database query, a code interpreter, a calendar. The model does not run them directly. It emits a structured request, the surrounding program carries it out, and the output is fed back as text for the next step.

An early and influential description of this pattern came from the ReAct paper, which showed that letting a model alternate between reasoning in words and taking actions improved results on tasks that needed outside information. Most modern agent frameworks are descendants of that idea, with better tooling around it.

## Workflows are not agents

Anthropic's engineering team has drawn a distinction that many practitioners now borrow. In a workflow, the steps are laid out in code ahead of time: summarise this document, then classify the summary, then draft a reply. The model fills in each step but does not choose the route. In an agent, the model directs its own process and decides which tools to use and in what order.

This matters because the two behave differently. A workflow is predictable, cheaper and easier to test. An agent can handle open-ended problems where the steps cannot be known beforehand, but it is harder to bound. Plenty of products marketed as agents are, on inspection, workflows with a friendly name, and that is often the sensible engineering choice.

## Where agents go wrong

Errors compound. If each step has a small chance of going off track, a twenty-step task has a much larger chance of ending somewhere unintended, and the model may not notice. Cost and latency grow with every loop, because each pass is another model call. And an agent that can act on the world, by sending email or changing records, can do damage that a chatbot's wrong answer cannot.

Security is a separate concern. Because an agent reads text from the outside world, such as web pages or incoming messages, a malicious page can contain instructions aimed at the model. This is usually called prompt injection, and no one has a complete fix for it. The practical defences are limiting what the agent can do, requiring human approval for consequential actions, and keeping untrusted content away from privileged tools.

## How to read an agent claim

A few questions cut through most marketing. What tools can it call, and with whose permissions? Does it ask before doing anything irreversible? Is there a cap on steps and spending? How was it tested, and on what tasks? An agent that books a meeting after you confirm the time is a different proposition from one that reorganises your files while you are away.

The idea is not new, and the underlying models are still prone to confident mistakes. What has changed is that models are now good enough at following instructions and calling tools that the loop is worth building. How much of the loop should be left to the model, and how much should stay in ordinary code, is the central design question, and the answer will vary by task.`,
    sources: [
      { title: "ReAct: Synergizing Reasoning and Acting in Language Models", url: "https://arxiv.org/abs/2210.03629", publisher: "arXiv", tier: 1, kind: "PAPER", notes: "Research paper proposing that language models interleave reasoning traces with actions." },
      { title: "Building effective agents", url: "https://www.anthropic.com/engineering/building-effective-agents", publisher: "Anthropic", tier: 1, kind: "DOCUMENTATION", notes: "Engineering guidance distinguishing predefined workflows from agents that direct their own process." },
    ],
    image: { url: "/illustrations/agent-loop.svg", alt: "Diagram of a loop in which a model chooses a tool, receives its result and decides the next step", caption: "Diagram: the basic agent loop. Illustration by Signal Desk." },
  },
  {
    slug: "how-retrieval-augmented-generation-works",
    category: "ai",
    title: "How Retrieval-Augmented Generation Works, and Where It Falls Short",
    deck: "RAG lets a language model look things up before it answers. The idea is simple. Making it reliable is the hard part.",
    seoTitle: "How RAG (Retrieval-Augmented Generation) Actually Works",
    metaDescription: "Retrieval-augmented generation gives a language model relevant documents before it answers. The pipeline step by step, and how it fails.",
    tags: ["RAG", "Explainer", "Language models", "Search"],
    companies: [],
    keyTakeaways: [
      "RAG retrieves passages from a document collection and places them in the model's prompt so the answer can draw on them.",
      "Most failures come from retrieval, not generation: if the right passage is not found, the model has nothing reliable to use.",
      "Citations in a RAG answer show what was retrieved. They do not guarantee the model summarised it faithfully.",
    ],
    whyItMatters: "RAG is the most common way companies connect a language model to their own documents. Understanding its structure explains why such assistants can be impressively useful on one question and confidently wrong on the next.",
    contextMd: "The term comes from a 2020 research paper, but today it is used loosely for any system that fetches information and hands it to a model. Implementations differ widely, and published quality claims are hard to compare because they depend on the documents and questions used.",
    bodyMd: `A language model knows what was in its training data and nothing after. It also has no access to your company's wiki, your support tickets or last week's policy change. Retrieval-augmented generation, usually shortened to RAG, is the standard workaround: find the relevant text first, then show it to the model along with the question.

The name comes from a 2020 paper by researchers then at Facebook AI Research, who combined a text generator with a retrieval component that could pull in passages from a large collection. The same basic shape now sits behind many enterprise chat tools.

## Preparing the library

Before anyone asks a question, the documents have to be made searchable. They are cut into chunks, often a few paragraphs each, because a whole manual would not fit into a prompt and would drown the useful part anyway. Each chunk is then converted into an embedding, a long list of numbers produced by a separate model. The useful property of an embedding is that passages with similar meaning end up with similar numbers, even if they share few words.

Those vectors are stored in an index built for fast similarity search. Many teams use a dedicated vector database for this. Others add a vector column to a database they already run.

## Answering a question

When a question arrives, the system embeds it the same way and asks the index for the closest chunks, typically somewhere between a handful and a few dozen. Those passages are pasted into the prompt, along with an instruction to answer only from the material provided and to say so when the answer is not there. The language model then writes a reply grounded in that supplied text.

Better systems add steps around this core. A keyword search can run alongside the vector search, since exact terms like part numbers are something embeddings handle poorly. A reranking model can reorder the candidates. The system might rewrite a vague question into a clearer one before searching at all.

## Why it fails

Here is the part that vendor demos tend to skip. If retrieval misses the right passage, the model is left guessing, and it may do so fluently. Chunking choices matter more than they sound: split a table from its heading, or a rule from its exception, and the retrieved text can be misleading on its own. Documents go stale, and an index that is not refreshed will happily serve last year's answer.

Then there is the generation step. Models can ignore the supplied text, blend it with memorised knowledge, or summarise it loosely. A RAG answer that cites a document has shown you what was retrieved. It has not proven the answer matches that document, which is why careful teams check the cited passage themselves.

Access control is easy to overlook. If the index contains documents that different employees are permitted to see, retrieval has to respect those permissions, or the assistant becomes a way to read files you should not be able to open.

## Is it the right tool

RAG suits questions whose answers live in a body of text that changes. It is a poor fit when the answer requires combining many documents into a calculation, or when precision matters more than convenience. Some teams now feed much larger amounts of text directly into long-context models and skip retrieval, trading cost and speed for simplicity. Neither approach has clearly won, and the better choice depends on the size of the collection and how much error is tolerable.`,
    sources: [
      { title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", url: "https://arxiv.org/abs/2005.11401", publisher: "arXiv", tier: 1, kind: "PAPER", notes: "Lewis et al., 2020. Introduces RAG, combining a generator with a retriever over a document collection." },
    ],
    image: { url: "/illustrations/rag-pipeline.svg", alt: "Diagram of a retrieval pipeline: documents are chunked and indexed, a question retrieves passages, and the model answers from them", caption: "Diagram: the stages of a basic RAG pipeline. Illustration by Signal Desk." },
  },
  {
    slug: "what-is-an-npu",
    category: "hardware",
    title: "What Is an NPU, and Does Your Laptop Actually Need One?",
    deck: "Neural processing units are now a selling point for phones and PCs. What they do well, and what the headline numbers leave out.",
    seoTitle: "What Is an NPU? Neural Processing Units Explained",
    metaDescription: "An NPU is a chip block built to run neural networks efficiently. How it differs from a CPU and GPU, what TOPS means, and what it is good for.",
    tags: ["NPU", "Explainer", "AI hardware", "Semiconductors"],
    companies: [],
    keyTakeaways: [
      "An NPU is specialised hardware for the arithmetic neural networks rely on, built to do it with far less power than a CPU or GPU.",
      "TOPS figures describe a peak rate at a particular numeric precision. They do not predict how a real application will perform.",
      "For large language models, memory capacity and bandwidth often limit speed more than raw compute does.",
    ],
    whyItMatters: "Device makers now advertise NPU capability on par with CPU speed. Readers deciding what to buy need to know which everyday tasks actually use the NPU and which numbers are marketing.",
    contextMd: "NPUs from different vendors differ in design, supported number formats and software tools. A figure that is meaningful for one chip may not be comparable with another, and software support often decides whether the hardware is used at all.",
    bodyMd: `Open the spec sheet of a recent laptop or phone and you will probably find a line for the NPU, sometimes with a number attached. The term stands for neural processing unit, and it refers to a block of silicon built to run the calculations behind neural networks.

Those calculations are mostly one operation repeated at enormous scale: multiplying large grids of numbers and adding up the results. Neural networks, whether they recognise a voice or generate text, spend most of their time on this. An NPU is arranged so that this work flows through many small arithmetic units in parallel, with data kept close by so that less energy is wasted moving it around.

## CPU, GPU, NPU

A CPU is the generalist. It handles unpredictable code well, such as your operating system and your browser, but it has relatively few cores. A GPU has thousands of simpler ones and became the default for training and running AI models because the same grid arithmetic is what graphics needs. It is fast and flexible, and it is also power hungry.

The NPU sits at the other end. It does fewer kinds of things, but it does them while drawing little power, which is the whole point on a battery. That is why the first tasks given to NPUs were small and constant: removing background noise on a call, blurring a video background, transcribing speech, recognising what is in a photo. Running those on a CPU would work, but it would warm the machine and drain it faster.

## Reading the TOPS number

Marketing tends to boil an NPU down to a single figure in TOPS, or trillions of operations per second. It is a real measurement, but a narrow one. It is a peak rate, reached under ideal conditions, and usually quoted for low-precision integer arithmetic, which is cheaper than the formats used elsewhere. Two chips quoting the same number may be counting differently, and neither number says how quickly your actual app will run.

Precision matters for another reason. Neural networks can often be squeezed into smaller number formats with modest loss of quality, and NPUs are built to take advantage of that. But it means a model usually has to be converted and tested for the chip, not simply dropped on.

## The memory problem

Large language models bring a different limit. Generating text one word at a time means reading the model's weights from memory again and again, so how fast memory can deliver data often matters more than how fast the chip can calculate. A model also has to fit in memory at all. This is why a laptop with a strong NPU can still be slow at running a big model locally.

## Software decides

Hardware is only used if software targets it. Each vendor ships its own toolchain, and apps must be written or updated to use it, either directly or through a runtime layer. Until that happens, a task may quietly fall back to the CPU or GPU. When shopping, the sensible questions are which of the features you care about actually run on the NPU today, and whether they run acceptably without one. For many people the answer is still that they run fine either way.`,
    sources: [
      { title: "AI accelerator", url: "https://en.wikipedia.org/wiki/AI_accelerator", publisher: "Wikipedia", tier: 2, kind: "DOCUMENTATION", notes: "Reference overview of hardware designed to accelerate neural-network workloads, including NPUs." },
    ],
    image: { url: "/illustrations/npu-compare.svg", alt: "Diagram comparing CPU, GPU and NPU by flexibility and power efficiency", caption: "Diagram: where each processor type sits between flexibility and efficiency. Illustration by Signal Desk." },
  },
  {
    slug: "what-is-an-mcp-server",
    category: "developer",
    title: "What Is an MCP Server? A Plain-Language Guide to the Model Context Protocol",
    deck: "Anthropic's open protocol for connecting AI applications to tools and data has been adopted well beyond its creator. Here is what it does.",
    seoTitle: "What Is an MCP Server? Model Context Protocol Explained",
    metaDescription: "The Model Context Protocol is an open standard for connecting AI applications to tools and data. What MCP servers do, and the security trade-offs.",
    tags: ["MCP", "Explainer", "Developer tools", "AI agents"],
    companies: ["Anthropic"],
    keyTakeaways: [
      "MCP is an open protocol that lets an AI application discover and use tools, data and prompts offered by separate programs called servers.",
      "It standardises the connection so a tool built once can work with many AI applications, instead of each pairing needing custom code.",
      "An MCP server runs with real permissions, so installing one is closer to installing software than to adding a setting.",
    ],
    whyItMatters: "MCP is becoming a common way for AI assistants to reach files, databases and services. The security and permission choices it surfaces apply to any user or developer connecting a model to real systems.",
    contextMd: "The protocol is young and still changing, and the official specification is versioned. Details such as transport options and authorisation have been revised, so developers should read the current documentation rather than rely on older tutorials.",
    bodyMd: `Before a language model can check a calendar, read a spreadsheet or file a ticket, someone has to connect it to those things. For a while, every connection was custom work. A developer wrote glue code to link one assistant to one service, and wrote it again for the next assistant.

The Model Context Protocol, or MCP, is an attempt to replace that with a shared standard. Anthropic introduced it in November 2024 as an open protocol, and it has since been taken up by other AI companies and a growing number of tool makers. A common comparison is a universal port: build to the standard once, and anything that speaks it can plug in.

## Clients, hosts and servers

Three roles appear in the specification. The host is the AI application you are using, such as a chat assistant or a coding tool. Inside it, a client manages the connection to one server. The server is a separate program that offers capabilities to the model. An MCP server might wrap a company's issue tracker, a folder of local files, or a database.

Servers can offer three kinds of things. Tools are actions the model can request, like creating a record or running a query. Resources are data the application can read, such as a file or a database row. Prompts are reusable templates a user can choose. Most of the attention goes to tools, since they are what let a model do something rather than just say something.

## What happens on the wire

The messages are plain structured text, exchanged using JSON-RPC. When a client connects, the two sides first agree on which features they support. The client then asks the server what tools exist, receives names, descriptions and the shape of the inputs each expects, and passes that to the model. When the model decides to use one, the client sends the request to the server, which runs it and returns the result.

A server can run on your own machine, talking to the application over standard input and output, or on the web, reached over HTTP. The local style is simple to set up. The remote style lets a company run one server for many users and handle sign-in properly.

## Why developers care

The practical gain is reuse. A team that publishes an MCP server for its product makes it available to every compatible application at once, and an application that supports MCP gains access to every server without bespoke integration. It also gives the model a consistent description of what each tool does, which tends to produce better tool use than ad hoc wrappers.

## The security catch

An MCP server is code, and it runs with whatever access you gave it. A server connected to your email can read your email. A server that is poorly written, or malicious, can leak data or take actions you did not intend. Tool descriptions are also text that the model reads, which means a dishonest description can try to steer the model, a risk related to prompt injection.

Sensible habits follow from this. Install servers from sources you trust. Grant the narrowest access that works. Prefer applications that show you each action and ask before anything consequential. And treat the content a tool returns as untrusted, because it may have been written by someone else entirely.

MCP does not make a model smarter or more reliable. It makes the plumbing consistent, and that is valuable precisely because the plumbing is where so much of the work, and so much of the risk, has been.`,
    sources: [
      { title: "Model Context Protocol: documentation", url: "https://modelcontextprotocol.io/", publisher: "Model Context Protocol", tier: 1, kind: "DOCUMENTATION", notes: "Official documentation and specification for the open protocol." },
      { title: "Introducing the Model Context Protocol", url: "https://www.anthropic.com/news/model-context-protocol", publisher: "Anthropic", tier: 1, kind: "OFFICIAL", notes: "Anthropic's November 2024 announcement of MCP as an open standard." },
    ],
    image: { url: "/illustrations/mcp-flow.svg", alt: "Diagram of an AI application connecting through MCP clients to separate tool, file and database servers", caption: "Diagram: a host application connects to several MCP servers. Illustration by Signal Desk." },
  },
];
