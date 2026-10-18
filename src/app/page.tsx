import { Suspense } from "react";
import { connection } from "next/server";
import { Matcher } from "@/components/Matcher";
import { getPrograms } from "@/lib/programs";

async function MatcherWithData() {
  await connection(); // always read the latest rates from the DB, never a build-time snapshot
  const programs = await getPrograms();
  return <Matcher programs={programs} />;
}

export default function Home() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-7xl px-4 py-8 text-slate-500">Loading lender programs…</p>}>
      <MatcherWithData />
    </Suspense>
  );
}
