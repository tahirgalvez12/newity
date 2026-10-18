import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/SignOutButton";
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
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-600 text-sm font-bold text-white">N</span>
              SBA Program Matcher
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

async function UserNav() {
  const user = await getCurrentUser();
  if (!user) return null;
  const links =
    user.role === "manager"
      ? [
          { href: "/", label: "Matcher" },
          { href: "/manager", label: "Dashboard" },
          { href: "/manager/team", label: "Team" },
          { href: "/history", label: "My recommendations" },
        ]
      : [
          { href: "/", label: "Matcher" },
          { href: "/history", label: "My recommendations" },
        ];

  return (
    <>
      <nav className="flex flex-wrap gap-4 text-sm text-slate-600">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-slate-900">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2 text-sm">
        <Link href="/account" className="text-slate-700 hover:text-slate-900" title="Account settings">
          {user.name}
        </Link>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.role === "manager" ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700"}`}
        >
          {user.role === "manager" ? "Manager" : "Rep"}
        </span>
        <SignOutButton />
      </div>
    </>
  );
}
