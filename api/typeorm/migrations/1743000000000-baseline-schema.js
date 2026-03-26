class BaselineSchema1743000000000 {
	name = "BaselineSchema1743000000000";

	async up(queryRunner) {
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
					CREATE TYPE user_role AS ENUM ('user', 'admin');
				END IF;
			END $$;
		`);

		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'token_type') THEN
					CREATE TYPE token_type AS ENUM ('email_verification', 'password_reset');
				END IF;
			END $$;
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS users (
				id SERIAL PRIMARY KEY,
				full_name VARCHAR(255) NOT NULL,
				preferred_name VARCHAR(100),
				email VARCHAR(255) UNIQUE NOT NULL,
				password_hash TEXT,
				role user_role NOT NULL DEFAULT 'user',
				is_verified BOOLEAN NOT NULL DEFAULT FALSE,
				is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
				api_key_ban_enabled BOOLEAN NOT NULL DEFAULT FALSE,
				api_key_ban_reason TEXT,
				api_key_ban_applied_at TIMESTAMPTZ,
				api_key_ban_applied_by INT REFERENCES users(id) ON DELETE SET NULL,
				usage_lockout_until TIMESTAMPTZ,
				usage_lockout_reason TEXT,
				usage_lockout_applied_by INT REFERENCES users(id) ON DELETE SET NULL,
				email_pref_account_updates BOOLEAN NOT NULL DEFAULT TRUE,
				email_pref_dev_features BOOLEAN NOT NULL DEFAULT FALSE,
				email_pref_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				email_pref_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				theme_preference VARCHAR(16) NOT NULL DEFAULT 'device',
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				password_updated TIMESTAMPTZ,
				last_login TIMESTAMPTZ,
				metadata JSONB
			);
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS verification_tokens (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				token VARCHAR(255) NOT NULL UNIQUE,
				token_type token_type NOT NULL,
				expires_at TIMESTAMPTZ NOT NULL,
				used BOOLEAN NOT NULL DEFAULT FALSE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS oauth_accounts (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				provider VARCHAR(50) NOT NULL,
				provider_user_id VARCHAR(255) NOT NULL,
				access_token TEXT,
				refresh_token TEXT,
				scopes JSONB,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				UNIQUE(provider, provider_user_id)
			);
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS refresh_tokens (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				token_fingerprint VARCHAR(128) NOT NULL UNIQUE,
				issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				expires_at TIMESTAMPTZ NOT NULL,
				revoked BOOLEAN NOT NULL DEFAULT FALSE,
				ip_address INET,
				user_agent TEXT
			);
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS languages (
				id SERIAL PRIMARY KEY,
				name VARCHAR(100) NOT NULL,
				name_normalized VARCHAR(100) NOT NULL UNIQUE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS book_types (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				name VARCHAR(100) NOT NULL,
				description TEXT,
				deleted_at TIMESTAMPTZ,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`);

		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS book_types_unique_active_name
				ON book_types (user_id, name)
				WHERE deleted_at IS NULL;
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS dates (
				id SERIAL PRIMARY KEY,
				day INT,
				month INT,
				year INT,
				text VARCHAR(100) NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				CHECK (day IS NULL OR (day BETWEEN 1 AND 31)),
				CHECK (month IS NULL OR (month BETWEEN 1 AND 12)),
				CHECK (year IS NULL OR (year BETWEEN 1 AND 9999)),
				CHECK (day IS NULL OR month IS NOT NULL),
				CHECK (month IS NULL OR year IS NOT NULL)
			);
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS authors (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				display_name VARCHAR(150) NOT NULL,
				first_names VARCHAR(150),
				last_name VARCHAR(100),
				birth_date_id INT REFERENCES dates(id) ON DELETE SET NULL,
				deceased BOOLEAN NOT NULL DEFAULT FALSE,
				death_date_id INT REFERENCES dates(id) ON DELETE SET NULL,
				bio TEXT,
				deleted_at TIMESTAMPTZ,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`);

		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS authors_unique_active_display_name
				ON authors (user_id, display_name)
				WHERE deleted_at IS NULL;
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS publishers (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				name VARCHAR(150) NOT NULL,
				founded_date_id INT REFERENCES dates(id) ON DELETE SET NULL,
				website VARCHAR(300),
				notes TEXT,
				deleted_at TIMESTAMPTZ,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`);

		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS publishers_unique_active_name
				ON publishers (user_id, name)
				WHERE deleted_at IS NULL;
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS books (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				title VARCHAR(255) NOT NULL,
				subtitle VARCHAR(255),
				isbn VARCHAR(20),
				publication_date_id INT REFERENCES dates(id) ON DELETE SET NULL,
				page_count INT,
				cover_image_url TEXT,
				description TEXT,
				book_type_id INT REFERENCES book_types(id) ON DELETE SET NULL,
				publisher_id INT REFERENCES publishers(id) ON DELETE SET NULL,
				deleted_at TIMESTAMPTZ,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`);

		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS books_unique_active_isbn
				ON books (user_id, isbn)
				WHERE deleted_at IS NULL AND isbn IS NOT NULL;
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS book_authors (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
				author_id INT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
				role VARCHAR(100),
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				UNIQUE (user_id, book_id, author_id)
			);
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS book_series (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				name VARCHAR(150) NOT NULL,
				description TEXT,
				website VARCHAR(300),
				deleted_at TIMESTAMPTZ,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`);

		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS book_series_unique_active_name
				ON book_series (user_id, name)
				WHERE deleted_at IS NULL;
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS book_series_books (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				series_id INT NOT NULL REFERENCES book_series(id) ON DELETE CASCADE,
				book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
				book_order INT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				UNIQUE (user_id, series_id, book_id)
			);
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS storage_locations (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				name VARCHAR(150) NOT NULL,
				parent_id INT REFERENCES storage_locations(id) ON DELETE CASCADE,
				notes TEXT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				UNIQUE (user_id, parent_id, name)
			);
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS book_copies (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
				storage_location_id INT REFERENCES storage_locations(id) ON DELETE SET NULL,
				acquisition_story TEXT,
				acquisition_date_id INT REFERENCES dates(id) ON DELETE SET NULL,
				acquired_from VARCHAR(255),
				acquisition_type VARCHAR(100),
				acquisition_location VARCHAR(255),
				notes TEXT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS book_languages (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
				language_id INT NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				UNIQUE (user_id, book_id, language_id)
			);
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS tags (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				name VARCHAR(50) NOT NULL,
				name_normalized VARCHAR(50) NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				UNIQUE (user_id, name_normalized)
			);
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS book_tags (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
				tag_id INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				UNIQUE (user_id, book_id, tag_id)
			);
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS user_api_keys (
				id SERIAL PRIMARY KEY,
				user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				name VARCHAR(120) NOT NULL,
				key_prefix VARCHAR(12) NOT NULL,
				key_hash VARCHAR(128) NOT NULL,
				last_used_at TIMESTAMPTZ,
				expires_at TIMESTAMPTZ,
				revoked_at TIMESTAMPTZ,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				UNIQUE (user_id, name),
				UNIQUE (key_hash)
			);
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS request_logs (
				id BIGSERIAL PRIMARY KEY,
				logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				level VARCHAR(10) NOT NULL,
				category VARCHAR(40) NOT NULL,
				correlation_id VARCHAR(64),
				method VARCHAR(10),
				path TEXT,
				route_pattern TEXT,
				query JSONB,
				headers JSONB,
				body JSONB,
				body_truncated BOOLEAN NOT NULL DEFAULT FALSE,
				ip INET,
				user_agent TEXT,
				actor_type VARCHAR(20) NOT NULL,
				user_id INT REFERENCES users(id) ON DELETE SET NULL,
				user_email VARCHAR(255),
				user_role user_role,
				api_key_id INT REFERENCES user_api_keys(id) ON DELETE SET NULL,
				api_key_label VARCHAR(120),
				api_key_prefix VARCHAR(12),
				status_code INT,
				response_body JSONB,
				response_truncated BOOLEAN NOT NULL DEFAULT FALSE,
				duration_ms NUMERIC(10,2),
				error_summary TEXT,
				request_bytes INT,
				response_bytes INT,
				cost_units INT
			);
		`);

		await queryRunner.query(`CREATE INDEX IF NOT EXISTS request_logs_logged_at_idx ON request_logs (logged_at);`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS request_logs_user_id_idx ON request_logs (user_id);`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS request_logs_user_email_idx ON request_logs (user_email);`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS request_logs_api_key_id_idx ON request_logs (api_key_id);`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS request_logs_method_path_idx ON request_logs (method, path);`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS request_logs_status_code_idx ON request_logs (status_code);`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS request_logs_level_idx ON request_logs (level);`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS request_logs_category_idx ON request_logs (category);`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS email_send_history (
				id SERIAL PRIMARY KEY,
				job_id UUID,
				email_type VARCHAR(120) NOT NULL,
				recipient_email VARCHAR(255) NOT NULL,
				target_user_id INT REFERENCES users(id) ON DELETE SET NULL,
				template_signature TEXT,
				queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				sent_at TIMESTAMPTZ,
				status VARCHAR(20) NOT NULL,
				failure_reason TEXT,
				retry_count INT NOT NULL DEFAULT 0
			);
		`);

		await queryRunner.query(`CREATE INDEX IF NOT EXISTS email_send_history_queued_at_idx ON email_send_history (queued_at);`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS email_send_history_type_idx ON email_send_history (email_type);`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS email_send_history_target_user_idx ON email_send_history (target_user_id);`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS email_send_history_template_sig_idx ON email_send_history (template_signature);`);

		await queryRunner.query(`
			CREATE OR REPLACE FUNCTION update_timestamp()
			RETURNS TRIGGER AS $$
			BEGIN
				NEW.updated_at = now();
				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql;
		`);

		for (const [triggerName, tableName] of [
			["update_users_modtime", "users"],
			["update_oauth_accounts_modtime", "oauth_accounts"],
			["update_book_types_modtime", "book_types"],
			["update_dates_modtime", "dates"],
			["update_authors_modtime", "authors"],
			["update_publishers_modtime", "publishers"],
			["update_book_authors_modtime", "book_authors"],
			["update_book_series_modtime", "book_series"],
			["update_book_series_books_modtime", "book_series_books"],
			["update_storage_locations_modtime", "storage_locations"],
			["update_book_copies_modtime", "book_copies"],
			["update_languages_modtime", "languages"],
			["update_books_modtime", "books"],
			["update_book_languages_modtime", "book_languages"],
			["update_tags_modtime", "tags"],
			["update_book_tags_modtime", "book_tags"],
			["update_user_api_keys_modtime", "user_api_keys"],
		]) {
			await queryRunner.query(`
				DO $$
				BEGIN
					IF NOT EXISTS (
						SELECT 1
						FROM pg_trigger
						WHERE tgname = '${triggerName}'
					) THEN
						CREATE TRIGGER ${triggerName}
						BEFORE UPDATE ON ${tableName}
						FOR EACH ROW
						EXECUTE FUNCTION update_timestamp();
					END IF;
				END $$;
			`);
		}
	}

	async down() {
		throw new Error("Refusing to revert the baseline schema migration automatically.");
	}
}

module.exports = { BaselineSchema1743000000000 };
