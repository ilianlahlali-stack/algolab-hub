"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Tableau de bord", short: "Accueil", icon: "▦" },
  { href: "/documents", label: "Documents", short: "Docs", icon: "▤" },
  { href: "/calendrier", label: "Calendrier", short: "Agenda", icon: "▣" },
  { href: "/deadlines", label: "Deadlines", short: "Rendus", icon: "◔" },
  { href: "/journal", label: "Journal d'enquête", short: "Journal", icon: "✎" },
  { href: "/mur", label: "Mur", short: "Mur", icon: "✉" },
  { href: "/personnes", label: "Personnes", short: "Gens", icon: "☺" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Navigation principale">
      {ITEMS.map((i) => {
        const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
            <span aria-hidden="true" className="nav-icon">
              {i.icon}
            </span>
            <span className="nav-long">{i.label}</span>
            <span className="nav-short" aria-hidden="true">
              {i.short}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
