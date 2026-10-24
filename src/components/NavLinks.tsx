"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem { href: string; label: string }

export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <ul className="nav-list">
      {items.map((i) => {
        const current = i.href === "/" ? path === "/" : path === i.href || path.startsWith(`${i.href}/`);
        return (
          <li key={i.href}>
            <Link href={i.href} aria-current={current ? "page" : undefined}>{i.label}</Link>
          </li>
        );
      })}
    </ul>
  );
}
