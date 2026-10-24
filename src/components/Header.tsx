import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants";
import { NavLinks, type NavItem } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

const today = () => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label={`${SITE_NAME} home`}>
      <svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="12" fill="currentColor" /><path d="M14 40h8l6-18 8 28 6-16h8" fill="none" stroke="var(--bg)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><circle cx="50" cy="14" r="5" fill="var(--accent)" /></svg>
      <span>Signal <span className="accent">Desk</span></span>
    </Link>
  );
}

export function Header() {
  const items: NavItem[] = [
    { href: "/latest", label: "Latest" },
    { href: "/ai", label: "AI" },
    { href: "/business", label: "Business" },
    { href: "/security", label: "Security" },
    { href: "/cloud", label: "Cloud" },
    { href: "/hardware", label: "Hardware" },
    { href: "/science", label: "Science" },
    { href: "/startups", label: "Startups" },
    { href: "/developer", label: "Developer" },
    { href: "/vfx-cg", label: "VFX / CG" },
    { href: "/reviews", label: "Reviews" },
    { href: "/analysis", label: "Analysis" },
    { href: "/explainers", label: "Explainers" },
  ];
  return (
    <header>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="topbar">
        <div className="container">
          <span><time suppressHydrationWarning>{today()}</time><span className="tagline"> · {SITE_TAGLINE}</span></span>
          <nav aria-label="Secondary"><Link href="/standards">Editorial standards</Link><Link href="/newsletters">Newsletters</Link><Link href="/about">About</Link></nav>
        </div>
      </div>
      <div className="masthead">
        <div className="container">
          <Logo />
          <div className="masthead-actions">
            <Link href="/search" className="icon-btn" aria-label="Search" id="search-link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>
      <nav className="site-nav" aria-label="Sections">
        <div className="container">
          <NavLinks items={items} />
          <form className="nav-search" action="/search" role="search">
            <label className="sr-only" htmlFor="nav-q">Search</label>
            <input id="nav-q" type="search" name="q" placeholder="Search" autoComplete="off" />
          </form>
        </div>
      </nav>
    </header>
  );
}
