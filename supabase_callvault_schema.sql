-- =====================================================================
-- CallVault  ·  Full Cloud SQL Schema & Migration for Supabase (PostgreSQL)
-- Database : PostgreSQL 15+ / Supabase
-- Target   : https://supabase.com/dashboard/project/jgirfajcvqfflpbrasvb
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS & STORAGE BUCKET
-- ─────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create Private Storage Bucket for Audio Recordings (MP3/M4A)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'callvault_recordings',
    'callvault_recordings',
    false,                         -- Strictly private; accessed via signed URLs or client SDK
    104857600,                     -- Max 100MB per audio file
    ARRAY['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 104857600,
    allowed_mime_types = ARRAY['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'application/octet-stream'];


-- ─────────────────────────────────────────────────────────────────────
-- 1. PROFILES / USERS EXTENSION
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.callvault_profiles (
    id                UUID PRIMARY KEY,
    email             TEXT,
    device_id         TEXT,
    backup_enabled    BOOLEAN DEFAULT true,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Drop foreign key if it was strictly referencing auth.users to allow anonymous device profiles
DO $$
BEGIN
    ALTER TABLE public.callvault_profiles DROP CONSTRAINT IF EXISTS callvault_profiles_id_fkey;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.callvault_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own profile" ON public.callvault_profiles;
DROP POLICY IF EXISTS "Allow profile access" ON public.callvault_profiles;

CREATE POLICY "Allow profile access"
    ON public.callvault_profiles
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────
-- 2. CALL RECORDS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.callvault_records (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             UUID NOT NULL,                             -- Device UUID or Auth User UUID
    local_id            BIGINT,                                    -- Android Room SQLite ID
    phone_number        TEXT NOT NULL,                             -- Normalized phone number
    contact_name        TEXT,                                      -- Contact name from phonebook
    call_type           TEXT NOT NULL CHECK (call_type IN ('INCOMING', 'OUTGOING', 'MISSED')),
    audio_path          TEXT,                                      -- Supabase Storage path: {userId}/{fileName}
    audio_format        TEXT DEFAULT 'mp3',                        -- 'mp3', 'm4a', 'aac'
    sample_rate         INTEGER DEFAULT 44100,                     -- Audio sample rate (Hz)
    bitrate_kbps        INTEGER DEFAULT 128,                       -- Encoding bitrate (kbps)
    duration_seconds    INTEGER DEFAULT 0 CHECK (duration_seconds >= 0),
    file_size_bytes     BIGINT DEFAULT 0,
    start_time          BIGINT NOT NULL,                           -- Epoch ms from device
    end_time            BIGINT NOT NULL,                           -- Epoch ms from device
    
    -- Organization & Protection
    is_favorite         BOOLEAN DEFAULT false,
    is_locked           BOOLEAN DEFAULT false,                     -- Prevents auto-deletion
    is_trashed          BOOLEAN DEFAULT false,
    trashed_at          TIMESTAMP WITH TIME ZONE,
    
    -- Annotations & Content
    note                TEXT,
    tags                TEXT[],                                    -- Array of tags: e.g. ARRAY['work', 'client']
    transcript          TEXT,                                      -- AI Speech-to-text transcript
    
    -- Remote Auditing
    synced_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Drop strict foreign key to auth.users if present, so anonymous device UUIDs sync seamlessly
DO $$
BEGIN
    ALTER TABLE public.callvault_records DROP CONSTRAINT IF EXISTS callvault_records_user_id_fkey;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Indexes for Fast Filtering & Search
CREATE INDEX IF NOT EXISTS idx_callvault_records_user_id      ON public.callvault_records (user_id);
CREATE INDEX IF NOT EXISTS idx_callvault_records_phone_number ON public.callvault_records (phone_number);
CREATE INDEX IF NOT EXISTS idx_callvault_records_start_time   ON public.callvault_records (start_time DESC);
CREATE INDEX IF NOT EXISTS idx_callvault_records_call_type    ON public.callvault_records (call_type);
CREATE INDEX IF NOT EXISTS idx_callvault_records_favorite     ON public.callvault_records (user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_callvault_records_trashed      ON public.callvault_records (user_id, is_trashed) WHERE is_trashed = false;

-- Trigram index for fast fuzzy searching over phone numbers & contact names
CREATE INDEX IF NOT EXISTS idx_callvault_records_search ON public.callvault_records USING gin (
    (phone_number || ' ' || coalesce(contact_name, '')) gin_trgm_ops
);

-- Row Level Security for call records
ALTER TABLE public.callvault_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only view their own call records" ON public.callvault_records;
DROP POLICY IF EXISTS "Users can insert their own call records" ON public.callvault_records;
DROP POLICY IF EXISTS "Users can update their own call records" ON public.callvault_records;
DROP POLICY IF EXISTS "Users can delete their own call records" ON public.callvault_records;
DROP POLICY IF EXISTS "Allow anon and auth call record select" ON public.callvault_records;
DROP POLICY IF EXISTS "Allow anon and auth call record insert" ON public.callvault_records;
DROP POLICY IF EXISTS "Allow anon and auth call record update" ON public.callvault_records;
DROP POLICY IF EXISTS "Allow anon and auth call record delete" ON public.callvault_records;

-- Policies allowing both anonymous device syncing and authenticated users
CREATE POLICY "Allow anon and auth call record select"
    ON public.callvault_records
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Allow anon and auth call record insert"
    ON public.callvault_records
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Allow anon and auth call record update"
    ON public.callvault_records
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow anon and auth call record delete"
    ON public.callvault_records
    FOR DELETE
    TO anon, authenticated
    USING (true);


-- ─────────────────────────────────────────────────────────────────────
-- 3. CONTACT RULES TABLE (Cloud Backup for Whitelist / Blacklist)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.callvault_contact_rules (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id        UUID NOT NULL,
    phone_number   TEXT NOT NULL,
    contact_name   TEXT,
    rule_type      TEXT NOT NULL CHECK (rule_type IN ('ALWAYS_RECORD', 'NEVER_RECORD', 'BLOCK')),
    is_active      BOOLEAN DEFAULT true,
    notes          TEXT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    CONSTRAINT uq_user_phone UNIQUE (user_id, phone_number)
);

DO $$
BEGIN
    ALTER TABLE public.callvault_contact_rules DROP CONSTRAINT IF EXISTS callvault_contact_rules_user_id_fkey;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_callvault_rules_user ON public.callvault_contact_rules (user_id);

ALTER TABLE public.callvault_contact_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own contact rules" ON public.callvault_contact_rules;
DROP POLICY IF EXISTS "Allow contact rules access" ON public.callvault_contact_rules;

CREATE POLICY "Allow contact rules access"
    ON public.callvault_contact_rules
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────
-- 4. CALL BOOKMARKS TABLE (Timestamp Markers)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.callvault_bookmarks (
    id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    record_id          UUID REFERENCES public.callvault_records(id) ON DELETE CASCADE NOT NULL,
    user_id            UUID NOT NULL,
    timestamp_seconds  INTEGER NOT NULL CHECK (timestamp_seconds >= 0),
    title              TEXT NOT NULL,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

DO $$
BEGIN
    ALTER TABLE public.callvault_bookmarks DROP CONSTRAINT IF EXISTS callvault_bookmarks_user_id_fkey;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_callvault_bookmarks_record ON public.callvault_bookmarks (record_id);

ALTER TABLE public.callvault_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage bookmarks of their own recordings" ON public.callvault_bookmarks;
DROP POLICY IF EXISTS "Allow bookmarks access" ON public.callvault_bookmarks;

CREATE POLICY "Allow bookmarks access"
    ON public.callvault_bookmarks
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────
-- 5. APP SETTINGS BACKUP TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.callvault_settings (
    user_id               UUID PRIMARY KEY,
    auto_record           BOOLEAN DEFAULT true,
    record_incoming       BOOLEAN DEFAULT true,
    record_outgoing       BOOLEAN DEFAULT true,
    audio_format          TEXT DEFAULT 'mp3',
    audio_quality         TEXT DEFAULT 'high',
    auto_speakerphone     BOOLEAN DEFAULT false,
    app_visible           BOOLEAN DEFAULT true,
    auto_delete_days      INTEGER DEFAULT 0,
    cloud_sync_enabled    BOOLEAN DEFAULT true,
    cloud_sync_wifi_only  BOOLEAN DEFAULT true,
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

DO $$
BEGIN
    ALTER TABLE public.callvault_settings DROP CONSTRAINT IF EXISTS callvault_settings_user_id_fkey;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.callvault_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own settings" ON public.callvault_settings;
DROP POLICY IF EXISTS "Allow settings access" ON public.callvault_settings;

CREATE POLICY "Allow settings access"
    ON public.callvault_settings
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────
-- 6. STORAGE POLICIES (Supabase Storage RLS for callvault_recordings)
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can upload their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Allow device recording uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow device recording downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow device recording deletes" ON storage.objects;

-- Allow upload of audio files to callvault_recordings bucket
CREATE POLICY "Allow device recording uploads"
    ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'callvault_recordings');

-- Allow stream / download of recordings
CREATE POLICY "Allow device recording downloads"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'callvault_recordings');

-- Allow delete of recordings
CREATE POLICY "Allow device recording deletes"
    ON storage.objects
    FOR DELETE
    TO anon, authenticated
    USING (bucket_id = 'callvault_recordings');


-- ─────────────────────────────────────────────────────────────────────
-- 7. AUTO-UPDATE TIMESTAMP TRIGGER
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_callvault_records_updated_at ON public.callvault_records;
CREATE TRIGGER set_callvault_records_updated_at
    BEFORE UPDATE ON public.callvault_records
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
