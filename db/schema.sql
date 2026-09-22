-- =============================================================================
-- LinkedIn Automation Database Schema (linkedin_db)
-- Database: MySQL 8.0+
-- Encoding: UTF-8 Unicode (utf8mb4)
-- =============================================================================

-- 1. Create database if it does not exist
CREATE DATABASE IF NOT EXISTS `linkedin_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `linkedin_db`;

-- -----------------------------------------------------------------------------
-- Table: linkedin_test_users
-- Stores registered LinkedIn test accounts, login credentials, automation flags,
-- and serialized session state (Playwright storageState JSON & cookies).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `linkedin_test_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `login_try` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = target user for login cron; 0 = skip in cron',
  `status` ENUM('active', 'inactive', 'locked', 'checkpoint', 'failed') NOT NULL DEFAULT 'active',
  `storage_state_json` LONGTEXT NULL COMMENT 'Serialized Playwright storageState JSON (cookies + origins)',
  `session_cookies_json` LONGTEXT NULL COMMENT 'Extracted session cookies JSON',
  `li_at_token` VARCHAR(512) NULL COMMENT 'LinkedIn li_at authentication session cookie',
  `user_agent` TEXT NULL COMMENT 'Browser user-agent string used during session capture',
  `two_factor_secret` VARCHAR(255) NULL COMMENT '2FA TOTP secret key if enabled',
  `proxy` VARCHAR(255) NULL COMMENT 'Optional HTTP/SOCKS proxy server (http://user:pass@host:port)',
  `last_login_at` DATETIME NULL COMMENT 'Timestamp of the last login attempt',
  `last_login_status` ENUM('never_attempted', 'success', 'failed', 'checkpoint', 'expired') NOT NULL DEFAULT 'never_attempted',
  `last_error` TEXT NULL COMMENT 'Last error message or checkpoint failure detail',
  `login_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total count of successful logins executed',
  `meta_data` JSON NULL COMMENT 'Custom JSON metadata (tags, account profile URL, owner, etc.)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_login_try_status` (`login_try`, `status`),
  INDEX `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: loggedin_details
-- Granular key-value storage for extracted browser session artifacts:
-- individual cookies, localStorage items, sessionStorage items, secret tokens.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `loggedin_details` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `data_category` ENUM('cookie', 'local_storage', 'session_storage', 'secret_key', 'session_meta', 'full_state') NOT NULL DEFAULT 'cookie',
  `data_key` VARCHAR(255) NOT NULL,
  `data_value` LONGTEXT NULL,
  `is_secret` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = sensitive security token (li_at, JSESSIONID, etc.)',
  `extra_metadata` JSON NULL COMMENT 'Cookie attributes (domain, path, secure, httpOnly, expires) or context metadata',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_user_data_key` (`user_id`, `data_key`),
  INDEX `idx_user_category` (`user_id`, `data_category`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_updated_at` (`updated_at`),
  CONSTRAINT `fk_loggedin_details_user`
    FOREIGN KEY (`user_id`)
    REFERENCES `linkedin_test_users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: connection_tracking
-- Lifecycle tracking for sent connection requests and detected acceptances.
-- Cross-references notifications, sent invitation diffs, and connections snapshots.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `connection_tracking` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `sender_user_id` INT NOT NULL,
  `recipient_name` VARCHAR(255) NOT NULL,
  `recipient_vanity_name` VARCHAR(255) NULL,
  `recipient_profile_url` VARCHAR(512) NULL,
  `recipient_headline` TEXT NULL,
  `status` ENUM('pending', 'accepted', 'withdrawn', 'rejected') NOT NULL DEFAULT 'pending',
  `invite_sent_at` DATETIME NULL COMMENT 'When we sent the connection request',
  `accepted_at` DATETIME NULL COMMENT 'When the recipient accepted',
  `detected_via` VARCHAR(64) NULL COMMENT 'notification | sent_diff | connections_diff | manual | invite_api',
  `note_sent` TEXT NULL COMMENT 'Optional note included with the invite',
  `meta_data` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_sender_recipient` (`sender_user_id`, `recipient_vanity_name`),
  INDEX `idx_sender_status` (`sender_user_id`, `status`),
  INDEX `idx_sender_name` (`sender_user_id`, `recipient_name`),
  INDEX `idx_accepted_at` (`accepted_at`),
  CONSTRAINT `fk_ct_sender` FOREIGN KEY (`sender_user_id`)
    REFERENCES `linkedin_test_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

