"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

/** "/" and "/manager" match exactly (so /manager/team doesn't light up Dashboard); others by prefix. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/" || href === "/manager") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      // Phones: its own full-width row under the logo. md+: inline next to the logo.
      className="order-last -mx-4 flex w-[calc(100%+2rem)] items-center gap-1 overflow-x-auto border-t border-line px-4 py-2 text-sm [scrollbar-width:none] md:order-none md:mx-0 md:w-auto md:border-0 md:p-0"
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 transition-colors ${
              active
                ? "bg-surface-2 font-medium text-ink shadow-[inset_0_-2px_0_var(--color-accent)]"
                : "text-ink-3 hover:bg-surface-2/60 hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AccountLink({ name, email, initials }: { name: string; email: string; initials: string }) {
  const active = usePathname() === "/account";
  return (
    <Link href="/account" aria-current={active ? "page" : undefined} className="group flex items-center gap-2" title="Account settings">
      <span
        aria-hidden
        className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold transition-colors ${
          active ? "border-accent bg-accent-soft text-accent" : "border-line-strong bg-surface-2 text-ink-2 group-hover:border-ink-3"
        }`}
      >
        {initials}
      </span>
      <span className="hidden flex-col leading-tight lg:flex">
        <span className={`group-hover:underline ${active ? "text-accent" : "text-ink"}`}>{name}</span>
        <span className="text-xs text-ink-3">{email}</span>
      </span>
      <span className="sr-only">Account settings</span>
    </Link>
  );
}
