"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Aanvragen" },
  { href: "/customers", label: "Klanten" },
  { href: "/orders", label: "Orders" },
  { href: "/planning", label: "Planning" },
  { href: "/inventory", label: "Voorraad" },
  { href: "/tasks", label: "Taken" },
  { href: "/inbox", label: "Inbox" },
  { href: "/ai-studio", label: "AI Studio" },
  { href: "/agent-chat", label: "Agents" },
  { href: "/knowledge", label: "Kennisbank" },
  { href: "/settings", label: "Instellingen" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="nav-scroll flex flex-nowrap items-center gap-2">
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn("nav-pill", active && "nav-pill-active")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
