import { Suspense } from "react";
import { Matcher } from "@/components/Matcher";
import { requireUser } from "@/lib/auth/session";
import { getPrograms } from "@/lib/programs";

async function MatcherWithData({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await requireUser(); // reads the session, so this always renders per request with the latest rates
  const [programs, params] = await Promise.all([getPrograms(), searchParams]);
  return (
    <>
      {params.denied === "manager" && (
        <p role="status" className="mx-auto mt-4 max-w-7xl rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
          That page is for sales managers. Ask your manager if you need access.
        </p>
      )}
      <Matcher programs={programs} />
    </>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-7xl px-4 py-8 text-slate-500">Loading lender programs…</p>}>
      <MatcherWithData searchParams={searchParams} />
    </Suspense>
  );
}
