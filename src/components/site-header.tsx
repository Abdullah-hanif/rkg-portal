"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="brand-mark" aria-hidden="true">R</span>
        <span className="brand-name">
          <strong>RKG</strong>
          <small>Portal</small>
        </span>
      </Link>
      <p className="market-pill">Atlanta, GA</p>
      <nav className="site-nav" aria-label="Primary">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
          Book
        </Link>
        <Link href="/dispatch" aria-current={pathname.startsWith("/dispatch") ? "page" : undefined}>
          Dispatch
        </Link>
      </nav>
    </header>
  );
}
