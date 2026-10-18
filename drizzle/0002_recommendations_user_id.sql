-- Recommendations made before accounts existed only had a free-text rep name and can't be
-- attributed to a user. They were demo data (npm run db:seed-demo), so they are removed.
DELETE FROM "recommendations" WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "recommendations" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recommendations" DROP COLUMN "rep_name";
