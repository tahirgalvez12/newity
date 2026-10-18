import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { lenderPrograms } from "@/db/schema";

export async function getPrograms() {
  return db.select().from(lenderPrograms).orderBy(asc(lenderPrograms.id));
}
