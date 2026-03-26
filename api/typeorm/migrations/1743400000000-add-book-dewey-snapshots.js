module.exports = class AddBookDeweySnapshots1743400000000 {
	name = "AddBookDeweySnapshots1743400000000";

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "dewey_resolved" boolean`);
		await queryRunner.query(`ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "dewey_matched_code" character varying(32)`);
		await queryRunner.query(`ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "dewey_caption" text`);
		await queryRunner.query(`ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "dewey_path" jsonb`);
		await queryRunner.query(`ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "dewey_source_used" character varying(20)`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_books_dewey_code" ON "books" ("dewey_code")`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX IF EXISTS "idx_books_dewey_code"`);
		await queryRunner.query(`ALTER TABLE "books" DROP COLUMN IF EXISTS "dewey_source_used"`);
		await queryRunner.query(`ALTER TABLE "books" DROP COLUMN IF EXISTS "dewey_path"`);
		await queryRunner.query(`ALTER TABLE "books" DROP COLUMN IF EXISTS "dewey_caption"`);
		await queryRunner.query(`ALTER TABLE "books" DROP COLUMN IF EXISTS "dewey_matched_code"`);
		await queryRunner.query(`ALTER TABLE "books" DROP COLUMN IF EXISTS "dewey_resolved"`);
	}
};
