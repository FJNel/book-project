module.exports = class AddUserDeweyEnabled1743200000000 {
	name = "AddUserDeweyEnabled1743200000000";

	async up(queryRunner) {
		await queryRunner.query(`
			ALTER TABLE "users"
			ADD COLUMN IF NOT EXISTS "dewey_enabled" boolean NOT NULL DEFAULT FALSE
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`
			ALTER TABLE "users"
			DROP COLUMN IF EXISTS "dewey_enabled"
		`);
	}
};
