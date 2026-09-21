-- =====================================================================
-- CallVault  ·  Full Cloud SQL Schema for Supabase (PostgreSQL)
-- Database : PostgreSQL 15+ / Supabase
-- Target   : https://supabase.com/dashboard/project/sxrioshopkjczrdjcbp
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
    false,                         -- Strictly private; requires signed URLs to stream
    104857600,                     -- Max 100MB per audio file
    ARRAY['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/x-m4a']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 104857600,
    allowed_mime_types = ARRAY['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/x-m4a'];


-- ─────────────────────────────────────────────────────────────────────
-- 1. PROFILES / USERS EXTENSION
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.callvault_profiles (
    id                UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email             TEXT,
    device_id         TEXT,
    backup_enabled    BOOLEAN DEFAULT true,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.callvault_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own profile"
    ON public.callvault_profiles
    FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);


-- ─────────────────────────────────────────────────────────────────────
-- 2. CALL RECORDS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.callvault_records (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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

-- Row Level Security
ALTER TABLE public.callvault_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view their own call records"
    ON public.callvault_records
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own call records"
    ON public.callvault_records
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own call records"
    ON public.callvault_records
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own call records"
    ON public.callvault_records
    FOR DELETE
    USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────
-- 3. CONTACT RULES TABLE (Cloud Backup for Whitelist / Blacklist)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.callvault_contact_rules (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    phone_number   TEXT NOT NULL,
    contact_name   TEXT,
    rule_type      TEXT NOT NULL CHECK (rule_type IN ('ALWAYS_RECORD', 'NEVER_RECORD', 'BLOCK')),
    is_active      BOOLEAN DEFAULT true,
    notes          TEXT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    CONSTRAINT uq_user_phone UNIQUE (user_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_callvault_rules_user ON public.callvault_contact_rules (user_id);

ALTER TABLE public.callvault_contact_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own contact rules"
    ON public.callvault_contact_rules
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────
-- 4. CALL BOOKMARKS TABLE (Timestamp Markers)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.callvault_bookmarks (
    id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    record_id          UUID REFERENCES public.callvault_records(id) ON DELETE CASCADE NOT NULL,
    user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    timestamp_seconds  INTEGER NOT NULL CHECK (timestamp_seconds >= 0),
    title              TEXT NOT NULL,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_callvault_bookmarks_record ON public.callvault_bookmarks (record_id);

ALTER TABLE public.callvault_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage bookmarks of their own recordings"
    ON public.callvault_bookmarks
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────
-- 5. APP SETTINGS BACKUP TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.callvault_settings (
    user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
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

ALTER TABLE public.callvault_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own settings"
    ON public.callvault_settings
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────
-- 6. STORAGE POLICIES (Supabase Storage RLS)
-- ─────────────────────────────────────────────────────────────────────
-- Allow authenticated users to upload recordings only into their own folder: {userId}/*
CREATE POLICY "Users can upload their own recordings"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'callvault_recordings' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow users to stream/download their own recordings
CREATE POLICY "Users can read their own recordings"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'callvault_recordings' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow users to delete their own stored recordings
CREATE POLICY "Users can delete their own recordings"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'callvault_recordings' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );


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
