"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/app/actions/admin";

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState<{ error?: string } | null, FormData>(loginAction, null);

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "var(--bg)", padding: "var(--s4)" }}>
      <div style={{ width: "100%", maxWidth: "26rem", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", padding: "var(--s6)", boxShadow: "var(--shadow)" }}>
        <div style={{ textAlign: "center", marginBottom: "var(--s5)" }}>
          <p className="kicker" style={{ marginBottom: "0.25rem" }}>Signal Desk</p>
          <h1 style={{ fontSize: "var(--step-3)" }}>Editorial Sign-In</h1>
          <p style={{ color: "var(--muted)", fontSize: "var(--step--1)" }}>Authorized newsroom personnel only.</p>
        </div>

        {state?.error && (
          <div className="alert alert-bad" role="alert">
            {state.error}
          </div>
        )}

        <form action={action}>
          <div className="field">
            <label htmlFor="email">Work Email</label>
            <input id="email" type="email" name="email" required autoFocus autoComplete="username" />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" name="password" required autoComplete="current-password" />
          </div>

          <button type="submit" className="btn btn-accent" style={{ width: "100%", marginTop: "var(--s3)" }} disabled={pending}>
            {pending ? "Authenticating…" : "Enter Editorial Desk"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "var(--s5)", fontSize: "var(--step--1)" }}>
          <Link href="/" style={{ color: "var(--muted)" }}>← Return to public site</Link>
        </div>
      </div>
    </div>
  );
}
