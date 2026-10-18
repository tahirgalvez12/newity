import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AccountLink, NavLinks, type NavItem } from "@/components/NavLinks";
import { SignOutButton } from "@/components/SignOutButton";
import { badge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SBA Program Matcher",
  description: "Find the SBA loan programs a borrower qualifies for, while they're on the phone.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 px-4 pt-2.5 md:h-14 md:flex-nowrap md:pt-0">
            <Link href="/" className="flex shrink-0 items-center gap-2.5 pb-2.5 font-semibold tracking-tight text-ink md:pb-0">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-ink">N</span>
              <span className="hidden sm:inline">SBA Program Matcher</span>
            </Link>
            <Suspense fallback={null}>
              <UserNav />
            </Suspense>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

const REP_NAV: NavItem[] = [
  { href: "/", label: "Matcher" },
  { href: "/history", label: "My recommendations" },
];

const MANAGER_NAV: NavItem[] = [
  { href: "/manager", label: "Dashboard" },
  { href: "/manager/team", label: "Team" },
  { href: "/", label: "Matcher" },
  { href: "/history", label: "My recommendations" },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

async function UserNav() {
  const user = await getCurrentUser();
  if (!user) return null;
  const manager = user.role === "manager";

  return (
    <>
      <NavLinks items={manager ? MANAGER_NAV : REP_NAV} />
      <div className="ml-auto flex shrink-0 items-center gap-3 pb-2.5 text-sm md:pb-0">
        <AccountLink name={user.name} email={user.email} initials={initials(user.name)} />
        <span className={manager ? badge.violet : badge.neutral}>{manager ? "Manager" : "Rep"}</span>
        <span aria-hidden className="h-5 w-px bg-line" />
        <SignOutButton />
      </div>
    </>
  );
}
