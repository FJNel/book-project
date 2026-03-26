module.exports = class AddUserDeweySources1743300000000 {
	name = "AddUserDeweySources1743300000000";

	async up(queryRunner) {
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "user_dewey_sources" (
				"id" SERIAL PRIMARY KEY,
				"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
				"original_filename" character varying(255) NOT NULL,
				"status" character varying(20) NOT NULL,
				"is_active" boolean NOT NULL DEFAULT FALSE,
				"validation_report" jsonb,
				"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
			)
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "user_dewey_entries" (
				"id" SERIAL PRIMARY KEY,
				"source_id" integer NOT NULL REFERENCES "user_dewey_sources"("id") ON DELETE CASCADE,
				"code" character varying(32) NOT NULL,
				"caption" text NOT NULL,
				"parent_code" character varying(32),
				"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
			)
		`);

		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS "user_dewey_entries_source_code_unique"
			ON "user_dewey_entries" ("source_id", "code")
		`);

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "user_dewey_entries_source_idx"
			ON "user_dewey_entries" ("source_id")
		`);

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "user_dewey_sources_user_created_idx"
			ON "user_dewey_sources" ("user_id", "created_at")
		`);

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "user_dewey_sources_user_active_idx"
			ON "user_dewey_sources" ("user_id", "is_active")
		`);

		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS "user_dewey_sources_one_active_per_user"
			ON "user_dewey_sources" ("user_id")
			WHERE "is_active" = TRUE
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX IF EXISTS "user_dewey_sources_one_active_per_user"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "user_dewey_sources_user_active_idx"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "user_dewey_sources_user_created_idx"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "user_dewey_entries_source_idx"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "user_dewey_entries_source_code_unique"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "user_dewey_entries"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "user_dewey_sources"`);
	}
};
