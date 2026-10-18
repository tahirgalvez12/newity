import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const collateralEnum = pgEnum("collateral_requirement", ["Yes", "No", "Varies"]);
export const creditTierEnum = pgEnum("credit_tier", ["Excellent", "Good", "Fair"]);

// One row per lender program. Seeded from data/lenders.csv; (lender, program) is the natural key
// so a re-import updates rows in place instead of duplicating them.
export const lenderPrograms = pgTable(
  "lender_programs",
  {
    id: serial("id").primaryKey(),
    lenderName: text("lender_name").notNull(),
    programType: text("program_type").notNull(),
    minLoanAmount: integer("min_loan_amount").notNull(),
    maxLoanAmount: integer("max_loan_amount").notNull(),
    minCreditScore: integer("min_credit_score").notNull(),
    creditTierRequired: creditTierEnum("credit_tier_required").notNull(),
    minYearsInBusiness: numeric("min_years_in_business", { mode: "number" }).notNull(),
    interestRateMin: numeric("interest_rate_min", { mode: "number" }).notNull(),
    interestRateMax: numeric("interest_rate_max", { mode: "number" }).notNull(),
    maxTermMonths: integer("max_term_months").notNull(),
    sbaGuaranteePct: integer("sba_guarantee_pct").notNull(),
    eligibleBusinessTypes: text("eligible_business_types").notNull(),
    requiresCollateral: collateralEnum("requires_collateral").notNull(),
    maxExistingDebtRatio: numeric("max_existing_debt_ratio", { mode: "number" }),
    turnaroundDays: integer("turnaround_days").notNull(),
    specialRequirements: text("special_requirements"),
    lastUpdated: date("last_updated", { mode: "string" }).notNull(),
  },
  (t) => [uniqueIndex("lender_programs_lender_program_uq").on(t.lenderName, t.programType)],
);

export const recommendations = pgTable(
  "recommendations",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id")
      .notNull()
      .references(() => lenderPrograms.id, { onDelete: "cascade" }),
    // Users are deactivated (banned), never deleted, so history and manager stats stay intact.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    borrowerSnapshot: jsonb("borrower_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recommendations_created_at_idx").on(t.createdAt), index("recommendations_user_id_idx").on(t.userId)],
);

// One row per program whose rate or term changed on a CSV re-import (written by scripts/seed.ts).
// Old and new values are both stored so the UI can show "11% → 10.5%" without reconstructing history.
export const rateHistory = pgTable(
  "rate_history",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id")
      .notNull()
      .references(() => lenderPrograms.id, { onDelete: "cascade" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
    oldInterestRateMin: numeric("old_interest_rate_min", { mode: "number" }).notNull(),
    newInterestRateMin: numeric("new_interest_rate_min", { mode: "number" }).notNull(),
    oldInterestRateMax: numeric("old_interest_rate_max", { mode: "number" }).notNull(),
    newInterestRateMax: numeric("new_interest_rate_max", { mode: "number" }).notNull(),
    oldMaxTermMonths: integer("old_max_term_months").notNull(),
    newMaxTermMonths: integer("new_max_term_months").notNull(),
    oldLastUpdated: date("old_last_updated", { mode: "string" }).notNull(),
    newLastUpdated: date("new_last_updated", { mode: "string" }).notNull(),
  },
  (t) => [index("rate_history_program_changed_idx").on(t.programId, t.changedAt)],
);

export type LenderProgramRow = typeof lenderPrograms.$inferSelect;
export type NewLenderProgramRow = typeof lenderPrograms.$inferInsert;
export type RateHistoryRow = typeof rateHistory.$inferSelect;

// ---------------------------------------------------------------------------
// Auth tables, owned by Better Auth (core + admin plugin fields). Property names must
// match Better Auth's field names; SQL column names are ours.
// ---------------------------------------------------------------------------

export const ROLES = ["rep", "manager"] as const;
export type Role = (typeof ROLES)[number];

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // admin plugin
  role: text("role").notNull().default("rep"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // admin plugin
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof user.$inferSelect;
