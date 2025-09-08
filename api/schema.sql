-- schema.sql
-- Intended for PostgreSQL
-- Run as a DB superuser (or a user with CREATE privileges).
-- Example: psql -h localhost -U bookuser -d bookapp -f schema.sql

BEGIN;

-- Optional extensions (if you want trigram similarity / search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'user');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'copy_status') THEN
    CREATE TYPE copy_status AS ENUM ('available','borrowed','reserved','lost','reading','read');
  END IF;
END$$;

-- Users (application users who can log in)
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  phone           TEXT,
  password_hash   TEXT NOT NULL,
  role            user_role NOT NULL DEFAULT 'user',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_login      TIMESTAMP WITH TIME ZONE,
  metadata        JSONB
);

-- 1:1 preferences per user (separated for normalization and easy swapping)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  language        VARCHAR(8) NOT NULL DEFAULT 'en',    -- 'en' or 'af'
  theme           VARCHAR(20) NOT NULL DEFAULT 'light',-- 'light'/'dark'
  timezone        TEXT DEFAULT 'Africa/Johannesburg',
  extra           JSONB
);

-- Publishers
CREATE TABLE IF NOT EXISTS publishers (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  country         TEXT,
  website         TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata        JSONB
);

-- Series (optional)
CREATE TABLE IF NOT EXISTS series (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  description     TEXT
);

-- Authors
CREATE TABLE IF NOT EXISTS authors (
  id              SERIAL PRIMARY KEY,
  first_name      TEXT,
  last_name       TEXT,
  full_name       TEXT NOT NULL,
  birth_date      DATE,
  death_date      DATE,
  biography       TEXT,
  country         TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata        JSONB,
  CONSTRAINT authors_fullname_unique UNIQUE (full_name)
);

-- Books (bibliographic / edition level)
CREATE TABLE IF NOT EXISTS books (
  id              SERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  description     TEXT,
  publisher_id    INTEGER REFERENCES publishers(id) ON DELETE SET NULL,
  series_id       INTEGER REFERENCES series(id) ON DELETE SET NULL,
  series_index    INTEGER,                -- volume number in series
  language        VARCHAR(10),
  pages           INTEGER,
  edition         TEXT,                   -- e.g., "2nd", "Revised"
  isbn_10         VARCHAR(20),
  isbn_13         VARCHAR(20),
  external_ids    JSONB,                  -- place to store Google Books / OpenLibrary IDs
  published_date  DATE,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata        JSONB
);

-- Many-to-many: books <-> authors
CREATE TABLE IF NOT EXISTS book_authors (
  book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  author_id       INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  author_order    SMALLINT NOT NULL DEFAULT 1,
  role            VARCHAR(50) DEFAULT 'author', -- author, editor, translator...
  PRIMARY KEY (book_id, author_id)
);

-- Genres
CREATE TABLE IF NOT EXISTS genres (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  description     TEXT
);

-- Many-to-many: books <-> genres
CREATE TABLE IF NOT EXISTS book_genres (
  book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  genre_id        INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, genre_id)
);

-- Tags (user-defined)
CREATE TABLE IF NOT EXISTS tags (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL, -- optional owner of tag
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (name, user_id)
);

CREATE TABLE IF NOT EXISTS book_tags (
  book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
);

-- Storage locations (room -> shelf -> box)
CREATE TABLE IF NOT EXISTS locations (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  parent_id       INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  type            VARCHAR(30), -- e.g., 'room','shelf','box'
  description     TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Physical copies (items) — allows multiple copies of the same book
CREATE TABLE IF NOT EXISTS book_copies (
  id              SERIAL PRIMARY KEY,
  book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  location_id     INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  acquisition_date DATE,
  purchase_price  NUMERIC(10,2),
  condition       VARCHAR(50), -- 'new','good','worn', etc.
  barcode         TEXT UNIQUE,  -- optional label / barcode / RFID
  status          copy_status NOT NULL DEFAULT 'available',
  notes           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Borrowers (people who borrow books; don't need to have an account)
CREATE TABLE IF NOT EXISTS borrowers (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL, -- if borrower also has account
  notes           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Borrow transactions / lending history (immutable history)
CREATE TABLE IF NOT EXISTS borrow_transactions (
  id              SERIAL PRIMARY KEY,
  book_copy_id    INTEGER NOT NULL REFERENCES book_copies(id) ON DELETE RESTRICT,
  borrower_id     INTEGER REFERENCES borrowers(id) ON DELETE SET NULL,
  processed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL, -- who recorded the loan
  borrow_date     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  due_date        TIMESTAMP WITH TIME ZONE,
  expected_return_date TIMESTAMP WITH TIME ZONE,
  actual_return_date  TIMESTAMP WITH TIME ZONE,
  returned        BOOLEAN NOT NULL DEFAULT FALSE,
  late_fee        NUMERIC(8,2) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Attachments (images, receipts, ebook files)
CREATE TABLE IF NOT EXISTS attachments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id         INTEGER REFERENCES books(id) ON DELETE CASCADE,
  book_copy_id    INTEGER REFERENCES book_copies(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  mime_type       TEXT,
  storage_path    TEXT NOT NULL,
  file_size       INTEGER,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata        JSONB
);

-- Audit log (simple)
CREATE TABLE IF NOT EXISTS audit_logs (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,      -- e.g., 'create_book', 'borrow', 'return'
  entity_type     TEXT,               -- 'book','book_copy','borrow_transaction'
  entity_id       INTEGER,
  details         JSONB,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Optional user session store for JWT invalidation or tracking
CREATE TABLE IF NOT EXISTS user_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_fingerprint TEXT NOT NULL,    -- store part of JWT or hashed token
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at      TIMESTAMP WITH TIME ZONE,
  revoked         BOOLEAN NOT NULL DEFAULT FALSE
);

-- App-level settings (key-value)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_books_isbn13 ON books(isbn_13);
CREATE INDEX IF NOT EXISTS idx_books_isbn10 ON books(isbn_10);
CREATE INDEX IF NOT EXISTS idx_books_title_lower ON books (lower(title));
CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies (status);
CREATE INDEX IF NOT EXISTS idx_book_copies_book_id ON book_copies (book_id);
CREATE INDEX IF NOT EXISTS idx_borrow_transactions_bookcopy ON borrow_transactions (book_copy_id);
CREATE INDEX IF NOT EXISTS idx_borrow_transactions_borrower ON borrow_transactions (borrower_id);
CREATE INDEX IF NOT EXISTS idx_borrow_transactions_borrow_date ON borrow_transactions (borrow_date);

-- Trigram indexes (for fuzzy search)
CREATE INDEX IF NOT EXISTS idx_books_title_trgm ON books USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_authors_fullname_trgm ON authors USING gin (full_name gin_trgm_ops);

-- Trigger to auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION trg_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to tables that have updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_books_set_timestamp'
  ) THEN
    CREATE TRIGGER trg_books_set_timestamp
      BEFORE UPDATE ON books
      FOR EACH ROW EXECUTE FUNCTION trg_set_timestamp();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_book_copies_set_timestamp'
  ) THEN
    CREATE TRIGGER trg_book_copies_set_timestamp
      BEFORE UPDATE ON book_copies
      FOR EACH ROW EXECUTE FUNCTION trg_set_timestamp();
  END IF;
END$$;

-- Useful view: book with aggregated author and genre lists + availability counts
CREATE OR REPLACE VIEW view_book_summary AS
SELECT
  b.*,
  COALESCE( (
    SELECT string_agg(a.full_name, ', ' ORDER BY ba.author_order)
    FROM book_authors ba JOIN authors a ON a.id = ba.author_id
    WHERE ba.book_id = b.id
  ), '') AS authors,
  COALESCE( (
    SELECT string_agg(g.name, ', ' ORDER BY g.name)
    FROM book_genres bg JOIN genres g ON g.id = bg.genre_id
    WHERE bg.book_id = b.id
  ), '') AS genres,
  (SELECT COUNT(*) FROM book_copies bc WHERE bc.book_id = b.id) AS copies_total,
  (SELECT COUNT(*) FROM book_copies bc WHERE bc.book_id = b.id AND bc.status = 'available') AS copies_available
FROM books b;

COMMIT;

CREATE TABLE approved_users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE
);