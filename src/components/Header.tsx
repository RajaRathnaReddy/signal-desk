import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants";
import { NavLinks, type NavItem } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

const today = () =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label={`${SITE_NAME} home`}>
      <div className="logo-icon-wrap" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
          <path d="M7 20h4l3-9 4 15 3-8h4" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="25" cy="8" r="2.5" fill="var(--accent)" />
        </svg>
      </div>
      <span>
        SIGNAL <span className="accent">DESK</span>
      </span>
    </Link>
  );
}

export function Header() {
  const items: NavItem[] = [
    { href: "/latest", label: "Latest" },
    { href: "/ai", label: "AI" },
    { href: "/hardware", label: "Hardware" },
    { href: "/security", label: "Security" },
    { href: "/cloud", label: "Cloud" },
    { href: "/developer", label: "Developer" },
    { href: "/business", label: "Business" },
    { href: "/startups", label: "Startups" },
    { href: "/science", label: "Science" },
    { href: "/vfx-cg", label: "VFX / CG" },
    { href: "/reviews", label: "Reviews" },
    { href: "/analysis", label: "Analysis" },
    { href: "/explainers", label: "Explainers" },
  ];

  return (
    <header>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="topbar">
        <div className="container">
          <div className="topbar-ticker">
            <span className="live-radar-dot" aria-hidden="true"></span>
            <span className="radar-tag">TECH DISPATCH:</span>
            <span>TSMC 2nm GAAFET · Claude 3.7 Sonnet Hybrid Reasoning · OpenSSF Attestation · K8s 1.32 DRA</span>
          </div>
          <nav aria-label="Secondary">
            <span className="tagline"><time suppressHydrationWarning>{today()}</time> · {SITE_TAGLINE} · </span>
            <Link href="/standards">Standards</Link>
            <Link href="/newsletters">Newsletters</Link>
            <Link href="/about">About</Link>
          </nav>
        </div>
      </div>
      <div className="masthead">
        <div className="container">
          <Logo />
          <div className="masthead-meta">
            <span className="subtitle">INDEPENDENT ENGINEERING & TECH JOURNALISM</span>
            <span className="verified-pill">15-Point Deterministic Publishing Gate</span>
          </div>
          <div className="masthead-actions">
            <Link href="/search" className="icon-btn" aria-label="Search articles" id="search-link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>
      <nav className="site-nav" aria-label="Sections">
        <div className="container">
          <NavLinks items={items} />
          <form className="nav-search" action="/search" role="search">
            <label className="sr-only" htmlFor="nav-q">
              Search
            </label>
            <input id="nav-q" type="search" name="q" placeholder="Quick search..." autoComplete="off" />
          </form>
        </div>
      </nav>
    </header>
  );
}
