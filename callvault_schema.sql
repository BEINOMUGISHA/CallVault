-- =====================================================================
-- CallVault  ·  Full Production SQL Schema
-- Compatibility: SQLite 3 (Android Room) & PostgreSQL (Cloud / Supabase)
-- Version      : 2.0.0
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────────────
-- 1. CALL RECORDS (Core Recording Metadata & Audio Attributes)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `call_records` (
    `id`                 INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    `phone_number`       TEXT NOT NULL,                           -- Target or caller number (E.164 or raw digits)
    `contact_name`       TEXT,                                    -- Matched address book contact name
    `call_type`          TEXT NOT NULL,                           -- 'INCOMING', 'OUTGOING', 'MISSED'
    `file_path`          TEXT NOT NULL,                           -- Local absolute path to the .mp3/.m4a file
    `audio_format`       TEXT NOT NULL DEFAULT 'mp3',             -- 'mp3', 'm4a', 'aac'
    `sample_rate`        INTEGER NOT NULL DEFAULT 44100,          -- Audio sample rate (Hz)
    `bitrate_kbps`       INTEGER NOT NULL DEFAULT 128,            -- Audio encoding bitrate (kbps)
    `duration_seconds`   INTEGER NOT NULL DEFAULT 0,              -- Call duration in seconds
    `file_size_bytes`    INTEGER NOT NULL DEFAULT 0,              -- Storage footprint on disk
    `start_time`         INTEGER NOT NULL,                        -- Call start epoch timestamp (ms)
    `end_time`           INTEGER NOT NULL,                        -- Call end epoch timestamp (ms)
    
    -- Organization & Protection
    `is_favorite`        INTEGER NOT NULL DEFAULT 0,              -- 1 = starred / pinned
    `is_locked`          INTEGER NOT NULL DEFAULT 0,              -- 1 = protected from auto-cleanup / retention deletion
    `is_trashed`         INTEGER NOT NULL DEFAULT 0,              -- 1 = soft deleted (in recycle bin)
    `trashed_at`         INTEGER,                                 -- Epoch timestamp when moved to trash
    
    -- Content & Annotations
    `note`               TEXT,                                    -- User-written note / memo
    `tags`               TEXT,                                    -- Comma-separated or JSON array of tags (e.g., "work,client")
    `transcript`         TEXT,                                    -- Speech-to-text transcript (Whisper / Local STT)
    
    -- Cloud Sync & Remote Storage (Convex / Supabase)
    `sync_status`        TEXT NOT NULL DEFAULT 'local_only',      -- 'local_only', 'pending', 'uploading', 'synced', 'failed'
    `cloud_storage_id`   TEXT,                                    -- Convex storageId or Supabase storage path
    `cloud_record_id`    TEXT,                                    -- Remote database record UUID/ID
    `synced_at`          INTEGER,                                 -- Epoch timestamp when remote upload succeeded
    
    -- Timestamps
    `created_at`         INTEGER NOT NULL,                        -- Local row creation epoch (ms)
    `updated_at`         INTEGER NOT NULL                         -- Last modified epoch (ms)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS `idx_call_records_phone_number` ON `call_records` (`phone_number`);
CREATE INDEX IF NOT EXISTS `idx_call_records_start_time`   ON `call_records` (`start_time`);
CREATE INDEX IF NOT EXISTS `idx_call_records_call_type`    ON `call_records` (`call_type`);
CREATE INDEX IF NOT EXISTS `idx_call_records_is_favorite`  ON `call_records` (`is_favorite`);
CREATE INDEX IF NOT EXISTS `idx_call_records_is_trashed`   ON `call_records` (`is_trashed`);
CREATE INDEX IF NOT EXISTS `idx_call_records_sync_status`  ON `call_records` (`sync_status`);


-- ─────────────────────────────────────────────────────────────────────
-- 2. CONTACT RULES (Auto-Record Whitelist, Blacklist & Custom Rules)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `contact_rules` (
    `id`             INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    `phone_number`   TEXT NOT NULL UNIQUE,                        -- Normalized phone number
    `contact_name`   TEXT,                                        -- Contact label or name
    `rule_type`      TEXT NOT NULL,                               -- 'ALWAYS_RECORD', 'NEVER_RECORD', 'BLOCK'
    `is_active`      INTEGER NOT NULL DEFAULT 1,                  -- 1 = rule enabled, 0 = disabled
    `notes`          TEXT,                                        -- Reason or notes
    `created_at`     INTEGER NOT NULL                             -- Epoch ms
);

CREATE INDEX IF NOT EXISTS `idx_contact_rules_phone`     ON `contact_rules` (`phone_number`);
CREATE INDEX IF NOT EXISTS `idx_contact_rules_rule_type` ON `contact_rules` (`rule_type`);


-- ─────────────────────────────────────────────────────────────────────
-- 3. CALL BOOKMARKS (Audio Timestamps & Highlights Within a Call)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `call_bookmarks` (
    `id`                 INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    `record_id`          INTEGER NOT NULL,                        -- References call_records(id)
    `timestamp_seconds`  INTEGER NOT NULL,                        -- Point in time within the audio (0 to duration)
    `title`              TEXT NOT NULL,                           -- Bookmark label (e.g. "Discussed price")
    `created_at`         INTEGER NOT NULL,                        -- Epoch ms
    FOREIGN KEY (`record_id`) REFERENCES `call_records` (`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `idx_call_bookmarks_record_id` ON `call_bookmarks` (`record_id`);


-- ─────────────────────────────────────────────────────────────────────
-- 4. CLOUD SYNC QUEUE (Resilient Offline-First Upload Queue)
-- ─────────────────────────────────────────────────────────────────────
-- Used by Android WorkManager to upload calls to Convex / Supabase when internet connects
CREATE TABLE IF NOT EXISTS `sync_queue` (
    `id`             INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    `record_id`      INTEGER NOT NULL UNIQUE,                     -- References call_records(id)
    `file_path`      TEXT NOT NULL,                               -- Local audio path to upload
    `status`         TEXT NOT NULL DEFAULT 'QUEUED',              -- 'QUEUED', 'UPLOADING', 'COMPLETED', 'FAILED'
    `retry_count`    INTEGER NOT NULL DEFAULT 0,                  -- Number of failed attempts
    `last_error`     TEXT,                                        -- Error message if upload failed
    `queued_at`      INTEGER NOT NULL,                            -- When enqueued (epoch ms)
    `last_attempt_at`INTEGER,                                     -- Last upload attempt epoch (ms)
    FOREIGN KEY (`record_id`) REFERENCES `call_records` (`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `idx_sync_queue_status` ON `sync_queue` (`status`);


-- ─────────────────────────────────────────────────────────────────────
-- 5. APP SETTINGS & CONFIGURATION (Persistent Native Settings)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `app_settings` (
    `id`                   INTEGER PRIMARY KEY NOT NULL DEFAULT 1,
    -- Recording switches
    `auto_record`          INTEGER NOT NULL DEFAULT 1,            -- 1 = enabled, 0 = disabled
    `record_incoming`      INTEGER NOT NULL DEFAULT 1,            -- 1 = record incoming calls
    `record_outgoing`      INTEGER NOT NULL DEFAULT 1,            -- 1 = record outgoing calls
    `record_unknown_only`  INTEGER NOT NULL DEFAULT 0,            -- 1 = only record numbers not in address book
    
    -- Audio Engine Settings
    `audio_format`         TEXT NOT NULL DEFAULT 'mp3',           -- 'mp3', 'm4a', 'aac'
    `audio_source`         TEXT NOT NULL DEFAULT 'VOICE_RECOGNITION', -- 'VOICE_RECOGNITION', 'MIC', 'COMMUNICATION'
    `audio_quality`        TEXT NOT NULL DEFAULT 'high',          -- 'high', 'medium', 'low'
    `auto_speakerphone`    INTEGER NOT NULL DEFAULT 0,            -- 1 = auto turn on speakerphone for 2-way clarity
    
    -- Stealth & Security
    `app_visible`          INTEGER NOT NULL DEFAULT 1,            -- 1 = visible in launcher, 0 = hidden
    `secret_code`          TEXT NOT NULL DEFAULT '9999',          -- Dialer passkey code
    `pin_lock_enabled`     INTEGER NOT NULL DEFAULT 0,            -- 1 = require PIN on app launch
    `pin_hash`             TEXT,                                  -- SHA-256 hashed PIN
    
    -- Auto-Cleanup & Storage Management
    `auto_delete_days`     INTEGER NOT NULL DEFAULT 0,            -- 0 = disabled, 30/60/90 days retention
    `max_storage_mb`       INTEGER NOT NULL DEFAULT 0,            -- 0 = unlimited, or cap e.g. 5000 MB
    
    -- Remote Cloud Backup (Convex / Supabase)
    `cloud_sync_enabled`   INTEGER NOT NULL DEFAULT 0,            -- 0 = offline only, 1 = upload to cloud
    `cloud_sync_wifi_only` INTEGER NOT NULL DEFAULT 1,            -- 1 = only upload when on Wi-Fi
    `delete_local_on_sync` INTEGER NOT NULL DEFAULT 0,            -- 1 = delete local MP3 once uploaded
    
    `updated_at`           INTEGER NOT NULL
);

-- Ensure default configuration row exists
INSERT OR IGNORE INTO `app_settings` (`id`, `updated_at`) VALUES (1, 0);


-- ─────────────────────────────────────────────────────────────────────
-- 6. USEFUL ANALYTICAL VIEWS
-- ─────────────────────────────────────────────────────────────────────

-- View: Active (non-trashed) recordings summary
CREATE VIEW IF NOT EXISTS `view_active_recordings` AS
SELECT 
    id,
    phone_number,
    contact_name,
    call_type,
    duration_seconds,
    file_size_bytes,
    file_path,
    start_time,
    is_favorite,
    is_locked,
    sync_status,
    note
FROM `call_records`
WHERE `is_trashed` = 0
ORDER BY `start_time` DESC;

-- View: Storage & Call Volume Statistics
CREATE VIEW IF NOT EXISTS `view_call_statistics` AS
SELECT 
    COUNT(*) AS total_calls,
    SUM(CASE WHEN call_type = 'INCOMING' THEN 1 ELSE 0 END) AS total_incoming,
    SUM(CASE WHEN call_type = 'OUTGOING' THEN 1 ELSE 0 END) AS total_outgoing,
    SUM(CASE WHEN call_type = 'MISSED' THEN 1 ELSE 0 END) AS total_missed,
    SUM(duration_seconds) AS total_duration_seconds,
    SUM(file_size_bytes) AS total_storage_bytes,
    SUM(CASE WHEN sync_status = 'synced' THEN 1 ELSE 0 END) AS total_synced,
    SUM(CASE WHEN sync_status = 'pending' THEN 1 ELSE 0 END) AS total_pending_sync
FROM `call_records`
WHERE `is_trashed` = 0;
