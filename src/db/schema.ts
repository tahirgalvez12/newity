import {
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
    repName: text("rep_name").notNull(),
    borrowerSnapshot: jsonb("borrower_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recommendations_created_at_idx").on(t.createdAt)],
);

export type LenderProgramRow = typeof lenderPrograms.$inferSelect;
export type NewLenderProgramRow = typeof lenderPrograms.$inferInsert;
