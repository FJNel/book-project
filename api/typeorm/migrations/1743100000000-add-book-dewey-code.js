module.exports = class AddBookDeweyCode1743100000000 {
	name = "AddBookDeweyCode1743100000000";

	async up(queryRunner) {
		await queryRunner.query(`
			ALTER TABLE "books"
			ADD COLUMN IF NOT EXISTS "dewey_code" character varying(32)
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`
			ALTER TABLE "books"
			DROP COLUMN IF EXISTS "dewey_code"
		`);
	}
};
