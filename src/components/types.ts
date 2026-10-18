import type { LenderProgramRow, RateHistoryRow } from "@/db/schema";

/** The latest recorded rate/term change for a program; `changedAt` is an ISO timestamp. */
export type RateChangeView = Omit<RateHistoryRow, "changedAt"> & { changedAt: string };

/** A program as the client receives it: the DB row plus its latest rate change, serialized from the server component. */
export type ProgramView = LenderProgramRow & { rateChange: RateChangeView | null };

export type RecommendState = "saving" | "done" | "error";
