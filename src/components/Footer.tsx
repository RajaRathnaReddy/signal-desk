import Link from "next/link";
import { CATEGORIES, SITE_NAME } from "@/lib/constants";
import { Logo } from "./Header";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div>
          <Logo />
          <p>An independent technology publication. Every story is checked against its sources and reviewed by an editor before it is published, and we say plainly when something is unconfirmed.</p>
        </div>
        <div>
          <h2>Sections</h2>
          <ul>{CATEGORIES.map((c) => <li key={c.slug}><Link href={`/${c.slug}`}>{c.name}</Link></li>)}</ul>
        </div>
        <div>
          <h2>Read</h2>
          <ul>
            <li><Link href="/latest">Latest</Link></li>
            <li><Link href="/analysis">Analysis</Link></li>
            <li><Link href="/explainers">Explainers</Link></li>
            <li><Link href="/reviews">Reviews</Link></li>
            <li><Link href="/search">Search</Link></li>
          </ul>
        </div>
        <div>
          <h2>{SITE_NAME}</h2>
          <ul>
            <li><Link href="/about">About</Link></li>
            <li><Link href="/standards">Editorial standards</Link></li>
            <li><Link href="/standards#corrections">Corrections</Link></li>
            <li><Link href="/newsletters">Newsletters</Link></li>
            <li><a href="/rss.xml">RSS feed</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
          <span>Illustrations are labelled as such. We do not present generated images as photographs.</span>
          <Link href="/admin">Newsroom sign-in</Link>
        </div>
      </div>
    </footer>
  );
}
