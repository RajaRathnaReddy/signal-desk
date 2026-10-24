import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { uniqueSlug, type Actor } from "@/lib/workflow";
import { CATEGORIES } from "@/lib/constants";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  await requirePermission("article:write");

  async function createStory(form: FormData) {
    "use server";
    const u = await requirePermission("article:write");
    const actor: Actor = { id: u.id, role: u.role, name: u.name };

    const title = String(form.get("title") ?? "").trim();
    const categorySlug = String(form.get("category") ?? "ai");
    const classification = String(form.get("classification") ?? "NEWS");

    if (!title) return;

    const category = await db.category.findUniqueOrThrow({ where: { slug: categorySlug } });
    const teamAuthor = (await db.author.findFirst({ where: { isTeam: true } })) ??
      (await db.author.create({ data: { slug: "editorial-team", name: "Editorial Team", isTeam: true } }));

    const article = await db.article.create({
      data: {
        title,
        slug: await uniqueSlug(title),
        categoryId: category.id,
        authorId: teamAuthor.id,
        classification,
        status: "DRAFT",
        confidence: classification === "EXPLAINER" ? "VERIFIED" : "UNCONFIRMED",
      },
    });

    await audit("article.create-manual", { userId: actor.id, entity: "article", entityId: article.id });
    redirect(`/admin/articles/${article.id}`);
  }

  return (
    <div className="admin-content" style={{ maxWidth: "42rem", margin: "var(--s6) auto" }}>
      <header className="page-head">
        <p className="kicker">Editorial Desk</p>
        <h1>Create New Article</h1>
        <p>Start a new original story, explainer, or analysis from scratch.</p>
      </header>

      <form action={createStory} className="editor-card" style={{ marginTop: "var(--s5)" }}>
        <div className="field">
          <label htmlFor="title">Working Headline</label>
          <input id="title" type="text" name="title" required placeholder="e.g. How Cloudflare Defended Against the Largest Recorded DDoS" autoFocus />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s4)" }}>
          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" name="category">
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="classification">Classification</label>
            <select id="classification" name="classification">
              {["NEWS", "PRODUCT LAUNCH", "RESEARCH", "ANALYSIS", "EXPLAINER", "SECURITY", "REVIEW", "REPORT", "RUMOR", "POLICY"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" className="btn btn-accent" style={{ marginTop: "var(--s4)" }}>
          Initialize Story Draft →
        </button>
      </form>
    </div>
  );
}
