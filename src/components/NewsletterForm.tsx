"use client";

import { useActionState } from "react";
import { subscribe, type SubscribeState } from "@/app/actions/public";

export interface NewsletterOption { slug: string; name: string; description: string; cadence: string }

export function NewsletterForm({ options, defaultSlugs, idPrefix = "nl" }: { options: NewsletterOption[]; defaultSlugs?: string[]; idPrefix?: string }) {
  const [state, action, pending] = useActionState<SubscribeState | null, FormData>(subscribe, null);
  return (
    <form action={action} noValidate>
      <fieldset className="nl-options" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: "0.75rem", color: "inherit" }}>Choose your newsletters</legend>
        {options.map((o) => (
          <label className="check" key={o.slug} htmlFor={`${idPrefix}-${o.slug}`}>
            <input id={`${idPrefix}-${o.slug}`} type="checkbox" name="lists" value={o.slug} defaultChecked={defaultSlugs?.includes(o.slug)} />
            <span>{o.name}<small>{o.description} · {o.cadence}</small></span>
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor={`${idPrefix}-email`}>Email address</label>
        <input id={`${idPrefix}-email`} type="email" name="email" autoComplete="email" required aria-invalid={state?.fieldError === "email"} aria-describedby={`${idPrefix}-status`} />
      </div>
      <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
        <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? "Subscribing…" : "Subscribe"}</button>
      <div id={`${idPrefix}-status`} role="status" aria-live="polite" style={{ marginTop: "1rem" }}>
        {state && <div className={`alert ${state.ok ? "alert-ok" : "alert-bad"}`}>{state.message}</div>}
      </div>
    </form>
  );
}
