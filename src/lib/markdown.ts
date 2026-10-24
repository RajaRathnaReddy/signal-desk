import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

marked.setOptions({ gfm: true, breaks: false });

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["h2", "h3", "h4", "p", "a", "ul", "ol", "li", "blockquote", "strong", "em", "code", "pre", "hr", "br", "table", "thead", "tbody", "tr", "th", "td", "figure", "figcaption", "img", "sup", "span"],
  allowedAttributes: { a: ["href", "title", "rel", "target"], img: ["src", "alt", "width", "height", "loading"], th: ["scope"], span: ["class"] },
  allowedSchemes: ["https", "http", "mailto"],
  transformTags: {
    a: (tag, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:\/\//i.test(href);
      return { tagName: "a", attribs: { ...attribs, ...(external ? { rel: "noopener noreferrer nofollow ugc", target: "_blank" } : {}) } };
    },
    img: (tag, attribs) => ({ tagName: "img", attribs: { ...attribs, loading: "lazy" } }),
  },
  // h1 is reserved for the page headline.
  textFilter: undefined,
};

/** Markdown → sanitised HTML. Editors are trusted but never trusted with raw HTML or scripts. */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md.replace(/^# /gm, "## "), { async: false }) as string;
  return sanitizeHtml(html, OPTIONS);
}

export function renderInline(md: string): string {
  return sanitizeHtml(marked.parseInline(md, { async: false }) as string, { allowedTags: ["em", "strong", "code", "a"], allowedAttributes: { a: ["href"] }, allowedSchemes: ["https", "http"] });
}
