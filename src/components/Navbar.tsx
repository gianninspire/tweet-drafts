"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Compose" },
  { href: "/tweets", label: "Tweet Drafts" },
  { href: "/threads", label: "Thread Drafts" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-800 bg-[#0a0a0b]/95 backdrop-blur">
      <nav className="mx-auto flex h-12 max-w-2xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-neutral-100"
        >
          Content Studio
        </Link>

        <div className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                  active
                    ? "bg-sky-500/10 text-sky-400"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
