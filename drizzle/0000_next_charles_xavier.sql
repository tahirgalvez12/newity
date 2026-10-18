CREATE TYPE "public"."collateral_requirement" AS ENUM('Yes', 'No', 'Varies');--> statement-breakpoint
CREATE TYPE "public"."credit_tier" AS ENUM('Excellent', 'Good', 'Fair');--> statement-breakpoint
CREATE TABLE "lender_programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"lender_name" text NOT NULL,
	"program_type" text NOT NULL,
	"min_loan_amount" integer NOT NULL,
	"max_loan_amount" integer NOT NULL,
	"min_credit_score" integer NOT NULL,
	"credit_tier_required" "credit_tier" NOT NULL,
	"min_years_in_business" numeric NOT NULL,
	"interest_rate_min" numeric NOT NULL,
	"interest_rate_max" numeric NOT NULL,
	"max_term_months" integer NOT NULL,
	"sba_guarantee_pct" integer NOT NULL,
	"eligible_business_types" text NOT NULL,
	"requires_collateral" "collateral_requirement" NOT NULL,
	"max_existing_debt_ratio" numeric,
	"turnaround_days" integer NOT NULL,
	"special_requirements" text,
	"last_updated" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"rep_name" text NOT NULL,
	"borrower_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_program_id_lender_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."lender_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lender_programs_lender_program_uq" ON "lender_programs" USING btree ("lender_name","program_type");--> statement-breakpoint
CREATE INDEX "recommendations_created_at_idx" ON "recommendations" USING btree ("created_at");