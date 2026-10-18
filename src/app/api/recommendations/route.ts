import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lenderPrograms, recommendations } from "@/db/schema";

const MAX_NAME = 60;

// POST { programId, repName, borrower } → logs that a rep recommended a program to a borrower.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { programId, repName, borrower } = (body ?? {}) as Record<string, unknown>;
  const name = typeof repName === "string" ? repName.trim() : "";
  if (!Number.isInteger(programId) || (programId as number) <= 0) {
    return Response.json({ error: "programId must be a positive integer" }, { status: 400 });
  }
  if (!name || name.length > MAX_NAME) {
    return Response.json({ error: `repName is required (max ${MAX_NAME} characters)` }, { status: 400 });
  }
  if (typeof borrower !== "object" || borrower === null || Array.isArray(borrower)) {
    return Response.json({ error: "borrower must be an object" }, { status: 400 });
  }

  const [program] = await db
    .select({ id: lenderPrograms.id })
    .from(lenderPrograms)
    .where(eq(lenderPrograms.id, programId as number));
  if (!program) return Response.json({ error: "Program not found" }, { status: 404 });

  // Only keep the borrower fields we know about; never persist arbitrary client JSON.
  const b = borrower as Record<string, unknown>;
  const snapshot = {
    loanAmount: typeof b.loanAmount === "number" ? b.loanAmount : null,
    businessType: typeof b.businessType === "string" ? b.businessType.slice(0, 100) : null,
    yearsInBusiness: typeof b.yearsInBusiness === "number" ? b.yearsInBusiness : null,
    creditTier: typeof b.creditTier === "string" ? b.creditTier.slice(0, 20) : null,
    creditScore: typeof b.creditScore === "number" ? b.creditScore : null,
  };

  const [row] = await db
    .insert(recommendations)
    .values({ programId: program.id, repName: name, borrowerSnapshot: snapshot })
    .returning({ id: recommendations.id, createdAt: recommendations.createdAt });

  return Response.json(row, { status: 201 });
}
