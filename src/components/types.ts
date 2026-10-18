import type { LenderProgramRow } from "@/db/schema";

/** A program as the client receives it: the DB row, serialized from the server component. */
export type ProgramView = LenderProgramRow;

export type RecommendState = "saving" | "done" | "error";
