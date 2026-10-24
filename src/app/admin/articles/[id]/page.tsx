import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  loadArticle,
  gateFor,
  llmAvailable,
  type Actor,
} from "@/lib/workflow";
import { can } from "@/lib/rbac";
import {
  CLASSIFICATIONS,
  CONFIDENCE,
  CONFIDENCE_HELP,
  IMAGE_KINDS,
  PIPELINE,
  SOURCE_TIERS,
} from "@/lib/constants";
import { parseJsonArray } from "@/lib/text";
import { fmtDateTime } from "@/lib/format";
import { StatusBadge, ConfidenceChip } from "@/components/Badges";
import {
  advanceAction,
  requestChangesAction,
  unpublishAction,
  updateArticleFormAction,
  resolveFactCheckAction,
  setImageApprovalAction,
  updateImageAction,
  generateImageBriefAction,
  addSourceToArticleAction,
  addLiveUpdateAction,
  triggerAiDraftAction,
} from "@/app/actions/admin";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
}

export default async function ArticleEditorPage({ params, searchParams }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;

  const article = await loadArticle(id);
  if (!article) notFound();

  const actor: Actor = { id: user.id, role: user.role, name: user.name };
  const { qc, gate } = await gateFor(id, actor);
  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" } });
  const hasLlm = llmAvailable();

  const canPublish = can(user.role, "article:publish");
  const canReview = can(user.role, "article:review");

  const heroImage = article.images.find((i) => i.isHero) ?? article.images[0] ?? null;
  const tagsList = article.tags.map((t) => t.name).join(", ");
  const takeaways = parseJsonArray(article.keyTakeaways).join("\n");
  const isLive = article.status === "PUBLISHED" || article.status === "UPDATED";

  const nextStatusIdx = PIPELINE.indexOf(article.status as never) + 1;
  const nextStatus = PIPELINE[nextStatusIdx];

  return (
    <>
      <header className="admin-topbar">
        <div>
          <div style={{ display: "flex", gap: "var(--s2)", alignItems: "center", marginBottom: "0.2rem" }}>
            <Link href="/admin" style={{ fontSize: "var(--step--1)", color: "var(--muted)" }}>← Newsroom Desk</Link>
            <span style={{ color: "var(--line-strong)" }}>/</span>
            <span className="kicker">{article.category.name}</span>
            <StatusBadge status={article.status} />
            <ConfidenceChip value={article.confidence} />
          </div>
          <h1 className="admin-title" style={{ maxWidth: "44rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {article.title}
          </h1>
        </div>

        <div style={{ display: "flex", gap: "var(--s2)", alignItems: "center" }}>
          {isLive && (
            <Link href={`/${article.category.slug}/${article.slug}`} target="_blank" className="btn btn-ghost btn-sm">
              View Public Article ↗
            </Link>
          )}

          {/* Workflow Transitions */}
          {article.status !== "PUBLISHED" && article.status !== "REJECTED" && (
            <form action={async () => {
              "use server";
              await advanceAction(id, `Advanced from ${article.status}`);
            }}>
              <button type="submit" className="btn btn-accent btn-sm" disabled={!canReview && ["FACT CHECK", "EDITOR REVIEW", "IMAGE REVIEW", "SEO REVIEW"].includes(article.status)}>
                Advance to {nextStatus ?? "Publication"} →
              </button>
            </form>
          )}

          {canReview && !isLive && article.status !== "DRAFT" && (
            <form action={async (formData) => {
              "use server";
              const notes = String(formData.get("notes") ?? "Editor requested changes");
              await requestChangesAction(id, notes);
            }}>
              <input type="hidden" name="notes" value="Returned to draft by editor review" />
              <button type="submit" className="btn btn-ghost btn-sm">
                Request Changes (→ Draft)
              </button>
            </form>
          )}

          {canPublish && isLive && (
            <form action={async () => {
              "use server";
              await unpublishAction(id, "Unpublished by editor");
            }}>
              <button type="submit" className="btn btn-danger btn-sm">
                Unpublish
              </button>
            </form>
          )}
        </div>
      </header>

      <div className="admin-content">
        {sp.updated && <div className="alert alert-ok">Changes saved successfully.</div>}
        {sp.error && <div className="alert alert-bad">{sp.error}</div>}

        <div className="editor-grid">
          {/* Main Column: Content Editor */}
          <main>
            <form action={async (formData) => {
              "use server";
              await updateArticleFormAction(id, formData);
            }}>
              <div className="editor-card">
                <h2>Article Content</h2>

                <div className="field">
                  <label htmlFor="title">Headline (Informative, no clickbait)</label>
                  <input id="title" type="text" name="title" defaultValue={article.title} required />
                </div>

                <div className="field">
                  <label htmlFor="deck">Subheadline / Deck</label>
                  <textarea id="deck" name="deck" rows={2} defaultValue={article.deck} style={{ minHeight: "4rem" }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--s4)" }}>
                  <div className="field">
                    <label htmlFor="categoryId">Category</label>
                    <select id="categoryId" name="categoryId" defaultValue={article.categoryId}>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="classification">Classification</label>
                    <select id="classification" name="classification" defaultValue={article.classification}>
                      {CLASSIFICATIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="confidence">Editorial Confidence</label>
                    <select id="confidence" name="confidence" defaultValue={article.confidence} disabled={!canReview}>
                      {CONFIDENCE.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <span className="hint">{CONFIDENCE_HELP[article.confidence as keyof typeof CONFIDENCE_HELP]}</span>
                  </div>
                </div>

                <div className="field">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <label htmlFor="bodyMd">Article Body (Markdown)</label>
                    {hasLlm && !isLive && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: "var(--step--2)", padding: "0.2rem 0.5rem" }}
                        onClick={async () => {
                          "use server";
                          await triggerAiDraftAction(id);
                        }}
                      >
                        ✨ Redraft with Gemini
                      </button>
                    )}
                  </div>
                  <textarea id="bodyMd" name="bodyMd" rows={14} defaultValue={article.bodyMd} style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem" }} />
                </div>

                <div className="field">
                  <label htmlFor="keyTakeaways">Key Points / Takeaways (One per line)</label>
                  <textarea id="keyTakeaways" name="keyTakeaways" rows={3} defaultValue={takeaways} style={{ minHeight: "5rem" }} />
                </div>

                <div className="field">
                  <label htmlFor="whyItMatters">Why It Matters (Core editorial synthesis)</label>
                  <textarea id="whyItMatters" name="whyItMatters" rows={3} defaultValue={article.whyItMatters} style={{ minHeight: "5rem" }} />
                </div>

                <div className="field">
                  <label htmlFor="contextMd">Context &amp; What Is Not Known</label>
                  <textarea id="contextMd" name="contextMd" rows={3} defaultValue={article.contextMd} style={{ minHeight: "5rem" }} />
                </div>

                <div className="field">
                  <label htmlFor="technicalMd">Technical Deep Dive (Optional collapsible details)</label>
                  <textarea id="technicalMd" name="technicalMd" rows={3} defaultValue={article.technicalMd} style={{ minHeight: "4.5rem" }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s4)" }}>
                  <div className="field">
                    <label htmlFor="tags">Tags (Comma-separated)</label>
                    <input id="tags" type="text" name="tags" defaultValue={tagsList} />
                  </div>
                  <div className="field">
                    <label htmlFor="slug">URL Slug</label>
                    <input id="slug" type="text" name="slug" defaultValue={article.slug} disabled={isLive} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s4)" }}>
                  <div className="field">
                    <label htmlFor="seoTitle">SEO Title (max 65 chars)</label>
                    <input id="seoTitle" type="text" name="seoTitle" defaultValue={article.seoTitle} maxLength={65} />
                  </div>
                  <div className="field">
                    <label htmlFor="metaDescription">Meta Description (70-160 chars)</label>
                    <input id="metaDescription" type="text" name="metaDescription" defaultValue={article.metaDescription} maxLength={160} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "var(--s5)", margin: "var(--s4) 0 var(--s2)" }}>
                  <label className="check">
                    <input type="checkbox" name="isDeveloping" defaultChecked={article.isDeveloping} />
                    <span>Developing Story</span>
                  </label>
                  <label className="check">
                    <input type="checkbox" name="isLive" defaultChecked={article.isLive} />
                    <span>Live Event Coverage</span>
                  </label>
                  <label className="check">
                    <input type="checkbox" name="editorsPick" defaultChecked={article.editorsPick} disabled={!canReview} />
                    <span>Editor&apos;s Pick</span>
                  </label>
                </div>

                <div className="field" style={{ marginTop: "var(--s3)" }}>
                  <label htmlFor="publishAt">Schedule Publication (Leave blank for immediate)</label>
                  <input
                    id="publishAt"
                    type="datetime-local"
                    name="publishAt"
                    defaultValue={article.publishAt ? new Date(article.publishAt).toISOString().slice(0, 16) : ""}
                    style={{ maxWidth: "20rem" }}
                  />
                </div>

                <button type="submit" className="btn btn-accent" style={{ marginTop: "var(--s4)" }}>
                  Save Article Edits
                </button>
              </div>
            </form>

            {/* Live Developing Updates Dispatcher */}
            {isLive && (
              <div className="editor-card">
                <h2>Post Live Update</h2>
                <form action={async (formData) => {
                  "use server";
                  const text = String(formData.get("updateText") ?? "");
                  await addLiveUpdateAction(id, text);
                }}>
                  <div className="field">
                    <label htmlFor="updateText">New Update Timestamped Under Story</label>
                    <textarea id="updateText" name="updateText" rows={2} required placeholder="e.g. 14:15 UTC — Spokesperson confirms pricing tiers will begin at $40/month." />
                  </div>
                  <button type="submit" className="btn btn-ghost btn-sm">
                    Post Timestamped Update
                  </button>
                </form>

                {article.updates.length > 0 && (
                  <div style={{ marginTop: "var(--s4)" }}>
                    <h3 style={{ fontSize: "var(--step--1)" }}>Posted Timeline ({article.updates.length})</h3>
                    <ul style={{ paddingLeft: "1.2rem", fontSize: "var(--step--1)" }}>
                      {article.updates.map((u) => (
                        <li key={u.id} style={{ marginBottom: "0.4rem" }}>
                          <strong>{fmtDateTime(u.at)} ({u.authorName}):</strong> {u.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Version History */}
            {article.versions.length > 0 && (
              <div className="editor-card">
                <h2>Revision History ({article.versions.length})</h2>
                <ul style={{ paddingLeft: "1.2rem", fontSize: "var(--step--1)", margin: 0 }}>
                  {article.versions.map((v) => (
                    <li key={v.id} style={{ marginBottom: "0.35rem" }}>
                      <strong>v{v.version}:</strong> {v.note || "Edit snapshot"} — <time dateTime={v.createdAt.toISOString()}>{fmtDateTime(v.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </main>

          {/* Right Sidebar: QC, Gate, Fact Checks, Sources, Hero Image */}
          <aside>
            {/* 1. Quality Score & Checklist */}
            <div className="editor-card">
              <h2>Quality Control Score</h2>
              <div className="score-meter">
                <span className="score-num" style={{ color: qc.score >= 85 ? "var(--ok)" : "var(--warn)" }}>
                  {qc.score}
                </span>
                <span style={{ color: "var(--muted)", fontSize: "var(--step--1)" }}>/ 100 (Minimum to publish: 85)</span>
              </div>

              <div style={{ display: "grid", gap: "0.25rem", fontSize: "var(--step--2)", marginBottom: "var(--s4)" }}>
                {Object.entries(qc.breakdown).map(([label, b]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{label}</span>
                    <strong>{b.got}/{b.max}</strong>
                  </div>
                ))}
              </div>

              <h3>QC Checklist</h3>
              <ul className="qc-list">
                {qc.checklist.map((c) => (
                  <li key={c.id} className={`qc-item ${c.status}`}>
                    <span className="qc-icon">{c.status === "pass" ? "✔" : c.status === "fail" ? "✘" : "▲"}</span>
                    <div>
                      <div>{c.label} {c.critical && <strong style={{ color: "var(--bad)", fontSize: "0.7rem" }}>[CRITICAL]</strong>}</div>
                      {c.note && <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{c.note}</div>}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Final Gate Status Box */}
              <div className={`gate-box ${gate.allowed ? "allowed" : "blocked"}`}>
                <strong style={{ display: "block", marginBottom: "0.25rem" }}>
                  {gate.allowed ? "✔ Final Publishing Gate: PASSED" : "✘ Final Publishing Gate: BLOCKED"}
                </strong>
                {gate.blockers.length > 0 && (
                  <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.1rem", fontSize: "var(--step--2)" }}>
                    {gate.blockers.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* 2. Fact Check Warnings & Conflict Resolver */}
            <div className="editor-card">
              <h2>
                Fact-Check Engine
                <span className="badge badge-ink">{article.factChecks.length}</span>
              </h2>

              {article.factChecks.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "var(--step--1)", margin: 0 }}>
                  No unsupported numbers, dates, quotes, or specification conflicts detected in current draft.
                </p>
              ) : (
                <div style={{ display: "grid", gap: "var(--s3)" }}>
                  {article.factChecks.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        padding: "var(--s3)",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--radius)",
                        background: f.resolved ? "var(--surface-2)" : f.severity === "CRITICAL" ? "var(--bad-soft)" : "var(--warn-soft)",
                        fontSize: "var(--step--1)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.2rem" }}>
                        <span className={`badge ${f.severity === "CRITICAL" ? "badge-bad" : "badge-warn"}`}>
                          {f.kind}
                        </span>
                        {f.resolved ? (
                          <span className="badge badge-ok">Resolved</span>
                        ) : (
                          <span style={{ fontSize: "var(--step--2)", color: "var(--bad)", fontWeight: 700 }}>Action Required</span>
                        )}
                      </div>
                      <p style={{ margin: "0.2rem 0", fontWeight: 600 }}>{f.message}</p>
                      {f.detail && <p style={{ margin: 0, fontSize: "var(--step--2)", opacity: 0.85 }}>{f.detail}</p>}

                      {f.resolved ? (
                        <p style={{ margin: "0.3rem 0 0", fontSize: "var(--step--2)", color: "var(--ok)" }}>
                          Resolution: {f.resolutionNote}
                        </p>
                      ) : (
                        canReview && (
                          <form
                            action={async (formData) => {
                              "use server";
                              const note = String(formData.get("note") ?? "");
                              await resolveFactCheckAction(f.id, id, note);
                            }}
                            style={{ marginTop: "var(--s2)", display: "flex", gap: "var(--s2)" }}
                          >
                            <input type="text" name="note" placeholder="Explain verification (e.g. Checked 10-K filing)" required style={{ fontSize: "var(--step--2)", padding: "0.3rem 0.5rem" }} />
                            <button type="submit" className="btn btn-ghost btn-sm" style={{ padding: "0.2rem 0.5rem", fontSize: "var(--step--2)" }}>
                              Resolve
                            </button>
                          </form>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Hero Image Studio & Authenticity */}
            <div className="editor-card">
              <h2>Hero Image &amp; Authenticity</h2>

              {heroImage ? (
                <div>
                  {heroImage.url && (
                    <div style={{ marginBottom: "var(--s3)", borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--line)" }}>
                      <img src={heroImage.url} alt={heroImage.alt} style={{ width: "100%", maxHeight: "12rem", objectFit: "cover" }} />
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--s3)" }}>
                    <span className={`badge ${heroImage.status === "APPROVED" ? "badge-ok" : heroImage.status === "REJECTED" ? "badge-bad" : "badge-warn"}`}>
                      {heroImage.status}
                    </span>
                    {canReview && heroImage.url && (
                      <div style={{ display: "flex", gap: "var(--s2)" }}>
                        <form action={async () => {
                          "use server";
                          await setImageApprovalAction(id, heroImage.id, true);
                        }}>
                          <button type="submit" className="btn btn-ghost btn-sm" style={{ color: "var(--ok)" }}>
                            Approve Image
                          </button>
                        </form>
                        <form action={async () => {
                          "use server";
                          await setImageApprovalAction(id, heroImage.id, false);
                        }}>
                          <button type="submit" className="btn btn-ghost btn-sm" style={{ color: "var(--bad)" }}>
                            Reject
                          </button>
                        </form>
                      </div>
                    )}
                  </div>

                  <form action={async (formData) => {
                    "use server";
                    await updateImageAction(id, heroImage.id, formData);
                  }}>
                    <div className="field">
                      <label htmlFor="img-url">Image URL / Path</label>
                      <input id="img-url" type="text" name="url" defaultValue={heroImage.url} placeholder="/illustrations/... or https://..." required />
                    </div>

                    <div className="field">
                      <label htmlFor="img-alt">Alt Text (Accessible description)</label>
                      <input id="img-alt" type="text" name="alt" defaultValue={heroImage.alt} required />
                    </div>

                    <div className="field">
                      <label htmlFor="img-caption">Caption</label>
                      <input id="img-caption" type="text" name="caption" defaultValue={heroImage.caption} required />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s3)" }}>
                      <div className="field">
                        <label htmlFor="img-kind">Kind</label>
                        <select id="img-kind" name="kind" defaultValue={heroImage.kind}>
                          {IMAGE_KINDS.map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="img-credit">Credit / License</label>
                        <input id="img-credit" type="text" name="credit" defaultValue={heroImage.credit} />
                      </div>
                    </div>

                    <label className="check" style={{ marginBottom: "var(--s3)" }}>
                      <input type="checkbox" name="depictsRealEvent" defaultChecked={heroImage.depictsRealEvent} />
                      <span style={{ fontSize: "var(--step--1)" }}>Depicts Real Event (Must be authentic photograph)</span>
                    </label>

                    <button type="submit" className="btn btn-ghost btn-sm">Update Image Details</button>
                  </form>

                  {heroImage.prompt && (
                    <div style={{ marginTop: "var(--s4)", padding: "var(--s3)", background: "var(--surface-2)", borderRadius: "var(--radius)", fontSize: "var(--step--2)" }}>
                      <strong>Editorial Image Prompt Brief:</strong>
                      <p style={{ margin: "0.2rem 0" }}>{heroImage.prompt}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: "var(--step--1)", color: "var(--muted)" }}>No hero image attached.</p>
                  <form action={async () => {
                    "use server";
                    await generateImageBriefAction(id);
                  }}>
                    <button type="submit" className="btn btn-accent btn-sm">
                      Generate Image Brief &amp; Prompt
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* 4. Sources Inspector & Adder */}
            <div className="editor-card">
              <h2>
                Attached Sources
                <span className="badge badge-ink">{article.sources.length}</span>
              </h2>

              <ul style={{ padding: 0, listStyle: "none", margin: 0, fontSize: "var(--step--1)" }}>
                {article.sources.map((s) => (
                  <li key={s.id} style={{ padding: "var(--s2) 0", borderBottom: "1px solid var(--line)" }}>
                    <div>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>{s.title}</a>
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "var(--step--2)" }}>
                      {s.publisher} · {SOURCE_TIERS[s.tier]} · {s.kind}
                    </div>
                    {s.notes && (
                      <div style={{ background: "var(--surface-2)", padding: "0.25rem 0.5rem", borderRadius: "2px", margin: "0.25rem 0", fontSize: "0.75rem" }}>
                        {s.notes}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <h3 style={{ marginTop: "var(--s4)", fontSize: "var(--step--1)" }}>Attach Source</h3>
              <form action={async (formData) => {
                "use server";
                await addSourceToArticleAction(id, formData);
              }}>
                <div className="field">
                  <label htmlFor="src-title">Source Title</label>
                  <input id="src-title" type="text" name="title" required placeholder="e.g. Official Press Release" />
                </div>
                <div className="field">
                  <label htmlFor="src-url">URL</label>
                  <input id="src-url" type="url" name="url" required placeholder="https://..." />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s3)" }}>
                  <div className="field">
                    <label htmlFor="src-pub">Publisher</label>
                    <input id="src-pub" type="text" name="publisher" required placeholder="Company or Outlet" />
                  </div>
                  <div className="field">
                    <label htmlFor="src-tier">Tier</label>
                    <select id="src-tier" name="tier" defaultValue="1">
                      <option value="1">Tier 1 (Primary)</option>
                      <option value="2">Tier 2 (Reputable Press)</option>
                      <option value="3">Tier 3 (Lead only)</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="src-notes">Excerpt / Notes (For fact-check corroboration)</label>
                  <textarea id="src-notes" name="notes" rows={2} placeholder="Quote or summary of numbers/claims announced" />
                </div>
                <button type="submit" className="btn btn-ghost btn-sm">Attach Source</button>
              </form>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
