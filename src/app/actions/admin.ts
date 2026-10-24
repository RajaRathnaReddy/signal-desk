"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { login, logout, requirePermission, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  advance,
  createFromCluster,
  draftWithLlm,
  reject,
  requestChanges,
  resolveFactCheck,
  setImageApproval,
  unpublish,
  updateArticle,
  addLiveUpdate,
  WorkflowError,
  type Actor,
} from "@/lib/workflow";
import { ingestAll, ingestSource } from "@/lib/ingest/run";
import { audit } from "@/lib/audit";
import { buildImageBrief } from "@/lib/imageprompt";

export async function loginAction(_prev: { error?: string } | null, form: FormData) {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const res = await login(email, password);
  if (!res.ok) return { error: res.error };
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

export async function createFromClusterAction(clusterId: string, useLlm = false) {
  const u = await requirePermission("article:write");
  const actor: Actor = { id: u.id, role: u.role, name: u.name };
  try {
    const articleId = await createFromCluster(clusterId, actor, { useLlm });
    revalidatePath("/admin");
    redirect(`/admin/articles/${articleId}`);
  } catch (e) {
    if (e instanceof WorkflowError) {
      return { error: e.message, details: e.details };
    }
    throw e;
  }
}

export async function advanceAction(articleId: string, notes = "") {
  const u = await requireUser();
  const actor: Actor = { id: u.id, role: u.role, name: u.name };
  try {
    const res = await advance(articleId, actor, notes);
    revalidatePath(`/admin/articles/${articleId}`);
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, status: res.status, published: res.published };
  } catch (e) {
    if (e instanceof WorkflowError) {
      return { ok: false, error: e.message, details: e.details };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function requestChangesAction(articleId: string, notes: string) {
  const u = await requirePermission("article:review");
  const actor: Actor = { id: u.id, role: u.role, name: u.name };
  try {
    await requestChanges(articleId, actor, notes);
    revalidatePath(`/admin/articles/${articleId}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function rejectAction(articleId: string, reason: string) {
  const u = await requirePermission("article:reject");
  const actor: Actor = { id: u.id, role: u.role, name: u.name };
  try {
    await reject(articleId, actor, reason);
    revalidatePath(`/admin/articles/${articleId}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function unpublishAction(articleId: string, reason: string) {
  const u = await requirePermission("article:publish");
  const actor: Actor = { id: u.id, role: u.role, name: u.name };
  try {
    await unpublish(articleId, actor, reason);
    revalidatePath(`/admin/articles/${articleId}`);
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function addLiveUpdateAction(articleId: string, text: string) {
  const u = await requirePermission("article:publish");
  const actor: Actor = { id: u.id, role: u.role, name: u.name };
  try {
    await addLiveUpdate(articleId, text, actor);
    revalidatePath(`/admin/articles/${articleId}`);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function resolveFactCheckAction(flagId: string, articleId: string, note: string) {
  const u = await requirePermission("article:review");
  const actor: Actor = { id: u.id, role: u.role, name: u.name };
  try {
    await resolveFactCheck(flagId, actor, note);
    revalidatePath(`/admin/articles/${articleId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function setImageApprovalAction(articleId: string, imageId: string, approve: boolean) {
  const u = await requirePermission("article:review");
  const actor: Actor = { id: u.id, role: u.role, name: u.name };
  try {
    await setImageApproval(articleId, imageId, actor, approve);
    revalidatePath(`/admin/articles/${articleId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function triggerAiDraftAction(articleId: string) {
  const u = await requirePermission("article:write");
  const actor: Actor = { id: u.id, role: u.role, name: u.name };
  try {
    await draftWithLlm(articleId, actor);
    revalidatePath(`/admin/articles/${articleId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateArticleFormAction(articleId: string, form: FormData) {
  const u = await requirePermission("article:write");
  const actor: Actor = { id: u.id, role: u.role, name: u.name };

  const rawTags = String(form.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const rawTakeaways = String(form.get("keyTakeaways") ?? "").split("\n").map((t) => t.trim()).filter(Boolean);
  const publishAtStr = String(form.get("publishAt") ?? "");

  const patch = {
    title: String(form.get("title") ?? "").trim(),
    deck: String(form.get("deck") ?? "").trim(),
    bodyMd: String(form.get("bodyMd") ?? ""),
    whyItMatters: String(form.get("whyItMatters") ?? "").trim(),
    contextMd: String(form.get("contextMd") ?? "").trim(),
    technicalMd: String(form.get("technicalMd") ?? "").trim(),
    seoTitle: String(form.get("seoTitle") ?? "").trim(),
    metaDescription: String(form.get("metaDescription") ?? "").trim(),
    slug: String(form.get("slug") ?? "").trim(),
    categoryId: String(form.get("categoryId") ?? ""),
    classification: String(form.get("classification") ?? "NEWS"),
    confidence: String(form.get("confidence") ?? "UNCONFIRMED"),
    isDeveloping: form.get("isDeveloping") === "on",
    isLive: form.get("isLive") === "on",
    editorsPick: form.get("editorsPick") === "on",
    tags: rawTags,
    keyTakeaways: rawTakeaways,
    publishAt: publishAtStr ? new Date(publishAtStr) : null,
  };

  try {
    await updateArticle(articleId, patch, actor, "Manual editor update");
    revalidatePath(`/admin/articles/${articleId}`);
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    if (e instanceof WorkflowError) {
      return { ok: false, error: e.message, details: e.details };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateImageAction(articleId: string, imageId: string, form: FormData) {
  const u = await requirePermission("article:write");
  await db.image.update({
    where: { id: imageId },
    data: {
      url: String(form.get("url") ?? "").trim(),
      alt: String(form.get("alt") ?? "").trim(),
      caption: String(form.get("caption") ?? "").trim(),
      credit: String(form.get("credit") ?? "").trim(),
      kind: String(form.get("kind") ?? "ILLUSTRATION"),
      depictsRealEvent: form.get("depictsRealEvent") === "on",
      status: "PENDING", // resetting approval on edit
    },
  });
  await audit("image.update", { userId: u.id, entity: "image", entityId: imageId });
  revalidatePath(`/admin/articles/${articleId}`);
  return { ok: true };
}

export async function generateImageBriefAction(articleId: string) {
  const u = await requirePermission("article:write");
  const art = await db.article.findUnique({ where: { id: articleId }, include: { category: true, images: true } });
  if (!art) return { error: "Article not found" };

  const brief = buildImageBrief({
    title: art.title,
    category: art.category.name,
    classification: art.classification,
  });

  if (art.images.length) {
    await db.image.update({
      where: { id: art.images[0].id },
      data: { prompt: brief.prompt, kind: brief.recommendedKind },
    });
  } else {
    await db.image.create({
      data: {
        articleId,
        url: "",
        kind: brief.recommendedKind,
        prompt: brief.prompt,
        status: "PENDING",
      },
    });
  }

  await audit("image.brief-generated", { userId: u.id, entity: "article", entityId: articleId });
  revalidatePath(`/admin/articles/${articleId}`);
  return { ok: true, prompt: brief.prompt, guidance: brief.guidance };
}

export async function addSourceToArticleAction(articleId: string, form: FormData) {
  const u = await requirePermission("article:write");
  const title = String(form.get("title") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const publisher = String(form.get("publisher") ?? "").trim();
  const tier = parseInt(String(form.get("tier") ?? "2"), 10);
  const kind = String(form.get("kind") ?? "REPORT");
  const notes = String(form.get("notes") ?? "").trim();

  if (!title || !url || !publisher) return { ok: false, error: "Title, URL and publisher are required." };

  await db.articleSource.create({
    data: { articleId, title, url, publisher, tier, kind, notes },
  });

  await audit("article.source-added", { userId: u.id, entity: "article", entityId: articleId, meta: { url } });
  revalidatePath(`/admin/articles/${articleId}`);
  return { ok: true };
}

export async function triggerIngestAction(sourceId?: string) {
  await requirePermission("ingest:run");
  if (sourceId) {
    const res = await ingestSource(sourceId);
    revalidatePath("/admin");
    revalidatePath("/admin/sources");
    return res;
  }
  const summary = await ingestAll();
  revalidatePath("/admin");
  revalidatePath("/admin/sources");
  return summary;
}

export async function createSourceAction(form: FormData): Promise<void> {
  const u = await requirePermission("source:manage");
  const name = String(form.get("name") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const feedUrl = String(form.get("feedUrl") ?? "").trim();
  const type = String(form.get("type") ?? "RSS");
  const tier = parseInt(String(form.get("tier") ?? "2"), 10);
  const categorySlug = String(form.get("categorySlug") ?? "") || null;

  if (!name || !url || !feedUrl) return;

  await db.source.create({
    data: { name, url, feedUrl, type, tier, categorySlug, active: true },
  });

  await audit("source.created", { userId: u.id, entity: "source", meta: { name, feedUrl } });
  revalidatePath("/admin/sources");
}

export async function toggleSourceAction(sourceId: string, active: boolean) {
  const u = await requirePermission("source:manage");
  await db.source.update({ where: { id: sourceId }, data: { active } });
  await audit("source.toggled", { userId: u.id, entity: "source", entityId: sourceId, meta: { active } });
  revalidatePath("/admin/sources");
  return { ok: true };
}
