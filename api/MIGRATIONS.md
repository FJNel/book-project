# TypeORM Migrations

The backend still uses direct `pg` queries for application data access, but schema changes are now managed through TypeORM migrations. This keeps production schema changes explicit and reviewable without enabling unsafe auto-sync.

## Why this was added

- The project previously depended on manually applying PostgreSQL DDL.
- TypeORM now provides a tracked migration history through the `migrations` table.
- Deployment on the Raspberry Pi can apply pending migrations automatically before the API restarts.
- `synchronize: true` is not used. Schema changes only happen through migrations.

## Where things live

- Data source: `api/typeorm/data-source.js`
- Shared DB connection options: `api/db-connection-options.js`
- Entity schemas used for migration generation: `api/typeorm/entities/index.js`
- Migrations: `api/typeorm/migrations/`
- Deploy-time migration runner: `api/scripts/run-migrations-if-needed.js`
- Schema reference: `api/database-tables.txt`

## Commands

Run these from `api/`.

- `npm run db:migrate`
  Applies pending migrations.
- `npm run db:revert`
  Reverts the most recent migration. The baseline migration intentionally refuses automatic revert.
- `npm run db:show`
  Shows migration status from TypeORM.
- `npm run db:create -- add-new-column`
  Creates a new empty migration file.
- `npm run db:generate -- add-new-column`
  Generates a migration from the TypeORM entity schema definitions.

## Local workflow

1. Update the entity schemas in `api/typeorm/entities/index.js` when the relational schema changes.
2. Create a migration:
   - Empty/manual: `npm run db:create -- describe-change`
   - Generated from entities: `npm run db:generate -- describe-change`
3. Review the generated SQL carefully.
4. Apply it locally with `npm run db:migrate`.

For manual migrations, prefer explicit SQL over clever logic.

## Baseline migration

The baseline migration is `api/typeorm/migrations/1743000000000-baseline-schema.js`.

It is written manually and is intentionally idempotent:

- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- guarded enum creation
- guarded trigger creation

That makes it safe for an already-existing production database where the tables may already exist. On an existing environment, the migration should mostly no-op, then TypeORM records it in the migrations table so future migrations can run normally.

## Deployment behavior on the Raspberry Pi

`deploy.sh` now runs `node ./scripts/run-migrations-if-needed.js` after `npm install --production --prefix api` and before restarting `book-api.service`.

The script hashes the contents of these DB-relevant inputs:

- `api/typeorm/data-source.js`
- `api/typeorm/entities/`
- `api/typeorm/migrations/`
- `api/db-connection-options.js`
- `api/database-tables.txt`

It stores the last deployed fingerprint in:

- `api/.deploy-state/typeorm-schema-state.json`

Behavior:

- If the fingerprint is unchanged, migration execution is skipped.
- If the fingerprint changed, the script initializes the TypeORM `DataSource` and checks for pending migrations.
- If migrations are pending, they run before the backend restart.
- If migration execution fails, the script exits non-zero and the deploy stops before the service restart.

You can inspect the fingerprint logic without touching the DB:

- `node ./scripts/run-migrations-if-needed.js --check-only`

## Production safety notes

- `synchronize: false` is enforced in the TypeORM data source.
- Migrations fail loudly; deployment does not continue silently on error.
- The baseline migration refuses automatic revert to avoid destructive rollback of an established production schema.
- `db:generate` depends on the entity schemas in `api/typeorm/entities/index.js` staying aligned with the live relational schema.
- Trigger/function behavior such as `update_timestamp()` is maintained manually in migrations; it is not inferred from entity metadata.

## Assumptions

- The live production schema is broadly aligned with the tables and columns currently used by the app.
- The Pi deployment path uses `deploy.sh` and `book-api.service`, as referenced in the repository.
- Future schema changes will be committed as migrations rather than manual SQL edits on the server.
