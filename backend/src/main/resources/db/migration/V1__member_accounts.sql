CREATE TABLE jibro_members (
 id VARCHAR(128) PRIMARY KEY,
 email VARCHAR(254) NOT NULL UNIQUE,
 nickname VARCHAR(64) NOT NULL,
 password_hash VARCHAR(512) NOT NULL,
 email_verified BOOLEAN NOT NULL DEFAULT FALSE,
 terms_version VARCHAR(64) NOT NULL,
 privacy_version VARCHAR(64) NOT NULL,
 accepted_at VARCHAR(64) NOT NULL,
 created_at BIGINT NOT NULL,
 test_account BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE jibro_sessions (
 token_hash VARCHAR(64) PRIMARY KEY,
 member_id VARCHAR(128) NOT NULL REFERENCES jibro_members(id) ON DELETE CASCADE,
 expires_at BIGINT NOT NULL
);
CREATE INDEX jibro_sessions_member ON jibro_sessions(member_id);
CREATE TABLE jibro_notebooks (
 member_id VARCHAR(128) PRIMARY KEY REFERENCES jibro_members(id) ON DELETE CASCADE,
 payload TEXT NOT NULL,
 revision BIGINT NOT NULL,
 updated_at VARCHAR(64) NOT NULL
);
CREATE TABLE jibro_mail_tokens (
 token_hash VARCHAR(64) PRIMARY KEY,
 member_id VARCHAR(128) NOT NULL REFERENCES jibro_members(id) ON DELETE CASCADE,
 kind VARCHAR(16) NOT NULL,
 expires_at BIGINT NOT NULL
);
CREATE INDEX jibro_mail_tokens_member ON jibro_mail_tokens(member_id);
CREATE TABLE jibro_rate_limits (
 bucket_key VARCHAR(64) PRIMARY KEY,
 until_ms BIGINT NOT NULL,
 hits INTEGER NOT NULL
);
CREATE TABLE jibro_member_imports (
 source_member_id VARCHAR(128) PRIMARY KEY REFERENCES jibro_members(id) ON DELETE CASCADE,
 source_digest VARCHAR(64) NOT NULL,
 imported_at VARCHAR(64) NOT NULL
);
