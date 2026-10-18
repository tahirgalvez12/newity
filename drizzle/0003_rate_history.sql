CREATE TABLE "rate_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"old_interest_rate_min" numeric NOT NULL,
	"new_interest_rate_min" numeric NOT NULL,
	"old_interest_rate_max" numeric NOT NULL,
	"new_interest_rate_max" numeric NOT NULL,
	"old_max_term_months" integer NOT NULL,
	"new_max_term_months" integer NOT NULL,
	"old_last_updated" date NOT NULL,
	"new_last_updated" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_history" ADD CONSTRAINT "rate_history_program_id_lender_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."lender_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rate_history_program_changed_idx" ON "rate_history" USING btree ("program_id","changed_at");