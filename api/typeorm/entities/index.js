const { EntitySchema } = require("typeorm");

const userRoleEnum = {
	type: "enum",
	enum: ["user", "admin"],
	enumName: "user_role",
};

const tokenTypeEnum = {
	type: "enum",
	enum: ["email_verification", "password_reset"],
	enumName: "token_type",
};

const UsersEntity = new EntitySchema({
	name: "Users",
	tableName: "users",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		fullName: { name: "full_name", type: String, length: 255 },
		preferredName: { name: "preferred_name", type: String, length: 100, nullable: true },
		email: { type: String, length: 255, unique: true },
		passwordHash: { name: "password_hash", type: "text", nullable: true },
		role: { name: "role", ...userRoleEnum, default: "user" },
		isVerified: { name: "is_verified", type: Boolean, default: false },
		isDisabled: { name: "is_disabled", type: Boolean, default: false },
		apiKeyBanEnabled: { name: "api_key_ban_enabled", type: Boolean, default: false },
		apiKeyBanReason: { name: "api_key_ban_reason", type: "text", nullable: true },
		apiKeyBanAppliedAt: { name: "api_key_ban_applied_at", type: "timestamptz", nullable: true },
		apiKeyBanAppliedBy: { name: "api_key_ban_applied_by", type: Number, nullable: true },
		usageLockoutUntil: { name: "usage_lockout_until", type: "timestamptz", nullable: true },
		usageLockoutReason: { name: "usage_lockout_reason", type: "text", nullable: true },
		usageLockoutAppliedBy: { name: "usage_lockout_applied_by", type: Number, nullable: true },
		emailPrefAccountUpdates: { name: "email_pref_account_updates", type: Boolean, default: true },
		emailPrefDevFeatures: { name: "email_pref_dev_features", type: Boolean, default: false },
		emailPrefCreatedAt: { name: "email_pref_created_at", type: "timestamptz", default: () => "now()" },
		emailPrefUpdatedAt: { name: "email_pref_updated_at", type: "timestamptz", default: () => "now()" },
		themePreference: { name: "theme_preference", type: String, length: 16, default: "device" },
		deweyEnabled: { name: "dewey_enabled", type: Boolean, default: false },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
		passwordUpdated: { name: "password_updated", type: "timestamptz", nullable: true },
		lastLogin: { name: "last_login", type: "timestamptz", nullable: true },
		metadata: { type: "jsonb", nullable: true },
	},
	relations: {
		apiKeyBanAppliedByUser: {
			type: "many-to-one",
			target: "Users",
			joinColumn: { name: "api_key_ban_applied_by" },
			onDelete: "SET NULL",
		},
		usageLockoutAppliedByUser: {
			type: "many-to-one",
			target: "Users",
			joinColumn: { name: "usage_lockout_applied_by" },
			onDelete: "SET NULL",
		},
	},
});

const VerificationTokensEntity = new EntitySchema({
	name: "VerificationTokens",
	tableName: "verification_tokens",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		token: { type: String, length: 255, unique: true },
		tokenType: { name: "token_type", ...tokenTypeEnum },
		expiresAt: { name: "expires_at", type: "timestamptz" },
		used: { type: Boolean, default: false },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
	},
	relations: {
		user: {
			type: "many-to-one",
			target: "Users",
			joinColumn: { name: "user_id" },
			onDelete: "CASCADE",
		},
	},
});

const OauthAccountsEntity = new EntitySchema({
	name: "OauthAccounts",
	tableName: "oauth_accounts",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		provider: { type: String, length: 50 },
		providerUserId: { name: "provider_user_id", type: String, length: 255 },
		accessToken: { name: "access_token", type: "text", nullable: true },
		refreshToken: { name: "refresh_token", type: "text", nullable: true },
		scopes: { type: "jsonb", nullable: true },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	uniques: [{ name: "UQ_oauth_accounts_provider_provider_user_id", columns: ["provider", "providerUserId"] }],
	relations: {
		user: {
			type: "many-to-one",
			target: "Users",
			joinColumn: { name: "user_id" },
			onDelete: "CASCADE",
		},
	},
});

const RefreshTokensEntity = new EntitySchema({
	name: "RefreshTokens",
	tableName: "refresh_tokens",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		tokenFingerprint: { name: "token_fingerprint", type: String, length: 128, unique: true },
		issuedAt: { name: "issued_at", type: "timestamptz", default: () => "now()" },
		expiresAt: { name: "expires_at", type: "timestamptz" },
		revoked: { type: Boolean, default: false },
		ipAddress: { name: "ip_address", type: "inet", nullable: true },
		userAgent: { name: "user_agent", type: "text", nullable: true },
	},
	relations: {
		user: {
			type: "many-to-one",
			target: "Users",
			joinColumn: { name: "user_id" },
			onDelete: "CASCADE",
		},
	},
});

const LanguagesEntity = new EntitySchema({
	name: "Languages",
	tableName: "languages",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		name: { type: String, length: 100 },
		nameNormalized: { name: "name_normalized", type: String, length: 100, unique: true },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
});

const BookTypesEntity = new EntitySchema({
	name: "BookTypes",
	tableName: "book_types",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		name: { type: String, length: 100 },
		description: { type: "text", nullable: true },
		deletedAt: { name: "deleted_at", type: "timestamptz", nullable: true },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	indices: [{
		name: "book_types_unique_active_name",
		columns: ["userId", "name"],
		unique: true,
		where: "\"deleted_at\" IS NULL",
	}],
	relations: {
		user: {
			type: "many-to-one",
			target: "Users",
			joinColumn: { name: "user_id" },
			onDelete: "CASCADE",
		},
	},
});

const DatesEntity = new EntitySchema({
	name: "Dates",
	tableName: "dates",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		day: { type: Number, nullable: true },
		month: { type: Number, nullable: true },
		year: { type: Number, nullable: true },
		text: { type: String, length: 100 },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	checks: [
		{ expression: "\"day\" IS NULL OR (\"day\" BETWEEN 1 AND 31)" },
		{ expression: "\"month\" IS NULL OR (\"month\" BETWEEN 1 AND 12)" },
		{ expression: "\"year\" IS NULL OR (\"year\" BETWEEN 1 AND 9999)" },
		{ expression: "\"day\" IS NULL OR \"month\" IS NOT NULL" },
		{ expression: "\"month\" IS NULL OR \"year\" IS NOT NULL" },
	],
});

const AuthorsEntity = new EntitySchema({
	name: "Authors",
	tableName: "authors",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		displayName: { name: "display_name", type: String, length: 150 },
		firstNames: { name: "first_names", type: String, length: 150, nullable: true },
		lastName: { name: "last_name", type: String, length: 100, nullable: true },
		birthDateId: { name: "birth_date_id", type: Number, nullable: true },
		deceased: { type: Boolean, default: false },
		deathDateId: { name: "death_date_id", type: Number, nullable: true },
		bio: { type: "text", nullable: true },
		deletedAt: { name: "deleted_at", type: "timestamptz", nullable: true },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	indices: [{
		name: "authors_unique_active_display_name",
		columns: ["userId", "displayName"],
		unique: true,
		where: "\"deleted_at\" IS NULL",
	}],
	relations: {
		user: { type: "many-to-one", target: "Users", joinColumn: { name: "user_id" }, onDelete: "CASCADE" },
		birthDate: { type: "many-to-one", target: "Dates", joinColumn: { name: "birth_date_id" }, onDelete: "SET NULL" },
		deathDate: { type: "many-to-one", target: "Dates", joinColumn: { name: "death_date_id" }, onDelete: "SET NULL" },
	},
});

const PublishersEntity = new EntitySchema({
	name: "Publishers",
	tableName: "publishers",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		name: { type: String, length: 150 },
		foundedDateId: { name: "founded_date_id", type: Number, nullable: true },
		website: { type: String, length: 300, nullable: true },
		notes: { type: "text", nullable: true },
		deletedAt: { name: "deleted_at", type: "timestamptz", nullable: true },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	indices: [{
		name: "publishers_unique_active_name",
		columns: ["userId", "name"],
		unique: true,
		where: "\"deleted_at\" IS NULL",
	}],
	relations: {
		user: { type: "many-to-one", target: "Users", joinColumn: { name: "user_id" }, onDelete: "CASCADE" },
		foundedDate: { type: "many-to-one", target: "Dates", joinColumn: { name: "founded_date_id" }, onDelete: "SET NULL" },
	},
});

const BooksEntity = new EntitySchema({
	name: "Books",
	tableName: "books",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		title: { type: String, length: 255 },
		subtitle: { type: String, length: 255, nullable: true },
		isbn: { type: String, length: 20, nullable: true },
		deweyCode: { name: "dewey_code", type: String, length: 32, nullable: true },
		publicationDateId: { name: "publication_date_id", type: Number, nullable: true },
		pageCount: { name: "page_count", type: Number, nullable: true },
		coverImageUrl: { name: "cover_image_url", type: "text", nullable: true },
		description: { type: "text", nullable: true },
		bookTypeId: { name: "book_type_id", type: Number, nullable: true },
		publisherId: { name: "publisher_id", type: Number, nullable: true },
		deletedAt: { name: "deleted_at", type: "timestamptz", nullable: true },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	indices: [{
		name: "books_unique_active_isbn",
		columns: ["userId", "isbn"],
		unique: true,
		where: "\"deleted_at\" IS NULL AND \"isbn\" IS NOT NULL",
	}],
	relations: {
		user: { type: "many-to-one", target: "Users", joinColumn: { name: "user_id" }, onDelete: "CASCADE" },
		publicationDate: { type: "many-to-one", target: "Dates", joinColumn: { name: "publication_date_id" }, onDelete: "SET NULL" },
		bookType: { type: "many-to-one", target: "BookTypes", joinColumn: { name: "book_type_id" }, onDelete: "SET NULL" },
		publisher: { type: "many-to-one", target: "Publishers", joinColumn: { name: "publisher_id" }, onDelete: "SET NULL" },
	},
});

const BookAuthorsEntity = new EntitySchema({
	name: "BookAuthors",
	tableName: "book_authors",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		bookId: { name: "book_id", type: Number },
		authorId: { name: "author_id", type: Number },
		role: { type: String, length: 100, nullable: true },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	uniques: [{ name: "UQ_book_authors_user_book_author", columns: ["userId", "bookId", "authorId"] }],
	relations: {
		user: { type: "many-to-one", target: "Users", joinColumn: { name: "user_id" }, onDelete: "CASCADE" },
		book: { type: "many-to-one", target: "Books", joinColumn: { name: "book_id" }, onDelete: "CASCADE" },
		author: { type: "many-to-one", target: "Authors", joinColumn: { name: "author_id" }, onDelete: "CASCADE" },
	},
});

const BookSeriesEntity = new EntitySchema({
	name: "BookSeries",
	tableName: "book_series",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		name: { type: String, length: 150 },
		description: { type: "text", nullable: true },
		website: { type: String, length: 300, nullable: true },
		deletedAt: { name: "deleted_at", type: "timestamptz", nullable: true },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	indices: [{
		name: "book_series_unique_active_name",
		columns: ["userId", "name"],
		unique: true,
		where: "\"deleted_at\" IS NULL",
	}],
	relations: {
		user: { type: "many-to-one", target: "Users", joinColumn: { name: "user_id" }, onDelete: "CASCADE" },
	},
});

const BookSeriesBooksEntity = new EntitySchema({
	name: "BookSeriesBooks",
	tableName: "book_series_books",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		seriesId: { name: "series_id", type: Number },
		bookId: { name: "book_id", type: Number },
		bookOrder: { name: "book_order", type: Number, nullable: true },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	uniques: [{ name: "UQ_book_series_books_user_series_book", columns: ["userId", "seriesId", "bookId"] }],
	relations: {
		user: { type: "many-to-one", target: "Users", joinColumn: { name: "user_id" }, onDelete: "CASCADE" },
		series: { type: "many-to-one", target: "BookSeries", joinColumn: { name: "series_id" }, onDelete: "CASCADE" },
		book: { type: "many-to-one", target: "Books", joinColumn: { name: "book_id" }, onDelete: "CASCADE" },
	},
});

const StorageLocationsEntity = new EntitySchema({
	name: "StorageLocations",
	tableName: "storage_locations",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		name: { type: String, length: 150 },
		parentId: { name: "parent_id", type: Number, nullable: true },
		notes: { type: "text", nullable: true },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	uniques: [{ name: "UQ_storage_locations_user_parent_name", columns: ["userId", "parentId", "name"] }],
	relations: {
		user: { type: "many-to-one", target: "Users", joinColumn: { name: "user_id" }, onDelete: "CASCADE" },
		parent: { type: "many-to-one", target: "StorageLocations", joinColumn: { name: "parent_id" }, onDelete: "CASCADE" },
	},
});

const BookCopiesEntity = new EntitySchema({
	name: "BookCopies",
	tableName: "book_copies",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		bookId: { name: "book_id", type: Number },
		storageLocationId: { name: "storage_location_id", type: Number, nullable: true },
		acquisitionStory: { name: "acquisition_story", type: "text", nullable: true },
		acquisitionDateId: { name: "acquisition_date_id", type: Number, nullable: true },
		acquiredFrom: { name: "acquired_from", type: String, length: 255, nullable: true },
		acquisitionType: { name: "acquisition_type", type: String, length: 100, nullable: true },
		acquisitionLocation: { name: "acquisition_location", type: String, length: 255, nullable: true },
		notes: { type: "text", nullable: true },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	relations: {
		user: { type: "many-to-one", target: "Users", joinColumn: { name: "user_id" }, onDelete: "CASCADE" },
		book: { type: "many-to-one", target: "Books", joinColumn: { name: "book_id" }, onDelete: "CASCADE" },
		storageLocation: { type: "many-to-one", target: "StorageLocations", joinColumn: { name: "storage_location_id" }, onDelete: "SET NULL" },
		acquisitionDate: { type: "many-to-one", target: "Dates", joinColumn: { name: "acquisition_date_id" }, onDelete: "SET NULL" },
	},
});

const BookLanguagesEntity = new EntitySchema({
	name: "BookLanguages",
	tableName: "book_languages",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		bookId: { name: "book_id", type: Number },
		languageId: { name: "language_id", type: Number },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	uniques: [{ name: "UQ_book_languages_user_book_language", columns: ["userId", "bookId", "languageId"] }],
	relations: {
		user: { type: "many-to-one", target: "Users", joinColumn: { name: "user_id" }, onDelete: "CASCADE" },
		book: { type: "many-to-one", target: "Books", joinColumn: { name: "book_id" }, onDelete: "CASCADE" },
		language: { type: "many-to-one", target: "Languages", joinColumn: { name: "language_id" }, onDelete: "CASCADE" },
	},
});

const TagsEntity = new EntitySchema({
	name: "Tags",
	tableName: "tags",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		name: { type: String, length: 50 },
		nameNormalized: { name: "name_normalized", type: String, length: 50 },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	uniques: [{ name: "UQ_tags_user_name_normalized", columns: ["userId", "nameNormalized"] }],
	relations: {
		user: { type: "many-to-one", target: "Users", joinColumn: { name: "user_id" }, onDelete: "CASCADE" },
	},
});

const BookTagsEntity = new EntitySchema({
	name: "BookTags",
	tableName: "book_tags",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		bookId: { name: "book_id", type: Number },
		tagId: { name: "tag_id", type: Number },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	uniques: [{ name: "UQ_book_tags_user_book_tag", columns: ["userId", "bookId", "tagId"] }],
	relations: {
		user: { type: "many-to-one", target: "Users", joinColumn: { name: "user_id" }, onDelete: "CASCADE" },
		book: { type: "many-to-one", target: "Books", joinColumn: { name: "book_id" }, onDelete: "CASCADE" },
		tag: { type: "many-to-one", target: "Tags", joinColumn: { name: "tag_id" }, onDelete: "CASCADE" },
	},
});

const UserApiKeysEntity = new EntitySchema({
	name: "UserApiKeys",
	tableName: "user_api_keys",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		userId: { name: "user_id", type: Number },
		name: { type: String, length: 120 },
		keyPrefix: { name: "key_prefix", type: String, length: 12 },
		keyHash: { name: "key_hash", type: String, length: 128, unique: true },
		lastUsedAt: { name: "last_used_at", type: "timestamptz", nullable: true },
		expiresAt: { name: "expires_at", type: "timestamptz", nullable: true },
		revokedAt: { name: "revoked_at", type: "timestamptz", nullable: true },
		createdAt: { name: "created_at", type: "timestamptz", default: () => "now()" },
		updatedAt: { name: "updated_at", type: "timestamptz", default: () => "now()" },
	},
	uniques: [{ name: "UQ_user_api_keys_user_name", columns: ["userId", "name"] }],
	relations: {
		user: { type: "many-to-one", target: "Users", joinColumn: { name: "user_id" }, onDelete: "CASCADE" },
	},
});

const RequestLogsEntity = new EntitySchema({
	name: "RequestLogs",
	tableName: "request_logs",
	columns: {
		id: { type: "bigint", primary: true, generated: "increment" },
		loggedAt: { name: "logged_at", type: "timestamptz", default: () => "now()" },
		level: { type: String, length: 10 },
		category: { type: String, length: 40 },
		correlationId: { name: "correlation_id", type: String, length: 64, nullable: true },
		method: { type: String, length: 10, nullable: true },
		path: { type: "text", nullable: true },
		routePattern: { name: "route_pattern", type: "text", nullable: true },
		query: { type: "jsonb", nullable: true },
		headers: { type: "jsonb", nullable: true },
		body: { type: "jsonb", nullable: true },
		bodyTruncated: { name: "body_truncated", type: Boolean, default: false },
		ip: { type: "inet", nullable: true },
		userAgent: { name: "user_agent", type: "text", nullable: true },
		actorType: { name: "actor_type", type: String, length: 20 },
		userId: { name: "user_id", type: Number, nullable: true },
		userEmail: { name: "user_email", type: String, length: 255, nullable: true },
		userRole: { name: "user_role", ...userRoleEnum, nullable: true },
		apiKeyId: { name: "api_key_id", type: Number, nullable: true },
		apiKeyLabel: { name: "api_key_label", type: String, length: 120, nullable: true },
		apiKeyPrefix: { name: "api_key_prefix", type: String, length: 12, nullable: true },
		statusCode: { name: "status_code", type: Number, nullable: true },
		responseBody: { name: "response_body", type: "jsonb", nullable: true },
		responseTruncated: { name: "response_truncated", type: Boolean, default: false },
		durationMs: { name: "duration_ms", type: "numeric", precision: 10, scale: 2, nullable: true },
		errorSummary: { name: "error_summary", type: "text", nullable: true },
		requestBytes: { name: "request_bytes", type: Number, nullable: true },
		responseBytes: { name: "response_bytes", type: Number, nullable: true },
		costUnits: { name: "cost_units", type: Number, nullable: true },
	},
	indices: [
		{ name: "request_logs_logged_at_idx", columns: ["loggedAt"] },
		{ name: "request_logs_user_id_idx", columns: ["userId"] },
		{ name: "request_logs_user_email_idx", columns: ["userEmail"] },
		{ name: "request_logs_api_key_id_idx", columns: ["apiKeyId"] },
		{ name: "request_logs_method_path_idx", columns: ["method", "path"] },
		{ name: "request_logs_status_code_idx", columns: ["statusCode"] },
		{ name: "request_logs_level_idx", columns: ["level"] },
		{ name: "request_logs_category_idx", columns: ["category"] },
	],
	relations: {
		user: { type: "many-to-one", target: "Users", joinColumn: { name: "user_id" }, onDelete: "SET NULL" },
		apiKey: { type: "many-to-one", target: "UserApiKeys", joinColumn: { name: "api_key_id" }, onDelete: "SET NULL" },
	},
});

const EmailSendHistoryEntity = new EntitySchema({
	name: "EmailSendHistory",
	tableName: "email_send_history",
	columns: {
		id: { type: Number, primary: true, generated: "increment" },
		jobId: { name: "job_id", type: "uuid", nullable: true },
		emailType: { name: "email_type", type: String, length: 120 },
		recipientEmail: { name: "recipient_email", type: String, length: 255 },
		targetUserId: { name: "target_user_id", type: Number, nullable: true },
		templateSignature: { name: "template_signature", type: "text", nullable: true },
		queuedAt: { name: "queued_at", type: "timestamptz", default: () => "now()" },
		sentAt: { name: "sent_at", type: "timestamptz", nullable: true },
		status: { type: String, length: 20 },
		failureReason: { name: "failure_reason", type: "text", nullable: true },
		retryCount: { name: "retry_count", type: Number, default: 0 },
	},
	indices: [
		{ name: "email_send_history_queued_at_idx", columns: ["queuedAt"] },
		{ name: "email_send_history_type_idx", columns: ["emailType"] },
		{ name: "email_send_history_target_user_idx", columns: ["targetUserId"] },
		{ name: "email_send_history_template_sig_idx", columns: ["templateSignature"] },
	],
	relations: {
		targetUser: { type: "many-to-one", target: "Users", joinColumn: { name: "target_user_id" }, onDelete: "SET NULL" },
	},
});

module.exports = {
	UsersEntity,
	VerificationTokensEntity,
	OauthAccountsEntity,
	RefreshTokensEntity,
	LanguagesEntity,
	BookTypesEntity,
	DatesEntity,
	AuthorsEntity,
	PublishersEntity,
	BooksEntity,
	BookAuthorsEntity,
	BookSeriesEntity,
	BookSeriesBooksEntity,
	StorageLocationsEntity,
	BookCopiesEntity,
	BookLanguagesEntity,
	TagsEntity,
	BookTagsEntity,
	UserApiKeysEntity,
	RequestLogsEntity,
	EmailSendHistoryEntity,
};
