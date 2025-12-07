-- ==========================================
-- 0. EXTENSIONS
-- ==========================================

-- Enable UUID extension if we decided to use UUIDs later (optional)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. CLEANUP (DROP IN ORDER)
-- ==========================================

-- Drop tables if they exist to start fresh
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS study_spaces CASCADE;
DROP TABLE IF EXISTS buildings CASCADE;
DROP TABLE IF EXISTS campuses CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop types if they exist (optional, for full reset)
DROP TYPE IF EXISTS audit_action_type CASCADE;
DROP TYPE IF EXISTS notification_status CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS booking_cancellation_reason CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;
DROP TYPE IF EXISTS space_status CASCADE;
DROP TYPE IF EXISTS space_noise_level CASCADE;
DROP TYPE IF EXISTS space_room_type CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Drop trigger function if exists (clean reset)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ==========================================
-- 2. ENUM TYPES (Based on Requirements)
-- ==========================================

CREATE TYPE user_role AS ENUM ('Student', 'Space_Manager', 'Administrator');
CREATE TYPE user_status AS ENUM ('Unverified', 'Verified', 'Suspended', 'Deleted');

CREATE TYPE space_room_type AS ENUM ('Quiet_Study', 'Group_Study', 'Lab', 'Meeting_Room', 'Seminar_Room');
CREATE TYPE space_noise_level AS ENUM ('Silent', 'Quiet', 'Moderate');
CREATE TYPE space_status AS ENUM ('Available', 'Maintenance', 'Deleted');

CREATE TYPE booking_status AS ENUM ('Confirmed', 'Cancelled', 'Completed', 'No_Show');
CREATE TYPE booking_cancellation_reason AS ENUM ('User_Requested', 'Administrative', 'Space_Maintenance');

CREATE TYPE notification_type AS ENUM (
    'Booking_Confirmation',
    'Booking_Reminder',
    'Booking_Cancellation',
    'Administrative_Cancellation',
    'Account_Security',
    'Password_Reset'
);
CREATE TYPE notification_status AS ENUM ('Pending', 'Sent', 'Failed', 'Retry_Queued');

CREATE TYPE audit_action_type AS ENUM (
    'Login_Success',
    'Login_Failed',
    'Logout',
    'Booking_Created',
    'Booking_Cancelled',
    'Space_Created',
    'Space_Updated',
    'Space_Deleted',
    'Status_Changed',
    'Role_Changed',
    'Account_Suspended',
    'Password_Reset'
);

-- ==========================================
-- 3. TABLES
-- ==========================================

-- USERS TABLE
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    student_number VARCHAR(50), -- Nullable, admins may not have one
    phone_number VARCHAR(20),

    role   user_role   NOT NULL DEFAULT 'Student',
    status user_status NOT NULL DEFAULT 'Unverified',

    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    verification_code VARCHAR(6),
    verification_token_expiry TIMESTAMP WITH TIME ZONE,
    password_reset_token VARCHAR(255),
    password_reset_token_expiry TIMESTAMP WITH TIME ZONE,
    refresh_token TEXT, -- Current active refresh token
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login        TIMESTAMP WITH TIME ZONE,

    -- Notification preferences
    notification_preferences JSONB DEFAULT '{"emailNotifications": true, "webNotifications": true}'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Only @itu.edu.tr emails
    CONSTRAINT check_email_domain
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@itu\.edu\.tr$')
);

-- Unique index for student_number that ignores NULLs
CREATE UNIQUE INDEX idx_users_student_number
    ON users(student_number)
    WHERE student_number IS NOT NULL;

-- CAMPUS TABLE
CREATE TABLE campuses (
    campus_id SERIAL PRIMARY KEY,
    campus_name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- BUILDING TABLE
CREATE TABLE buildings (
    building_id SERIAL PRIMARY KEY,
    campus_id INTEGER NOT NULL
        REFERENCES campuses(campus_id) ON DELETE RESTRICT,

    building_name VARCHAR(100) NOT NULL,
    floor_count   INTEGER NOT NULL DEFAULT 1,

    -- Operating Hours (as TIME)
    operating_hours_weekday_start TIME NOT NULL DEFAULT '08:00:00',
    operating_hours_weekday_end   TIME NOT NULL DEFAULT '22:00:00',
    operating_hours_weekend_start TIME,
    operating_hours_weekend_end   TIME,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- STUDY SPACE TABLE
CREATE TABLE study_spaces (
    space_id SERIAL PRIMARY KEY,

    building_id INTEGER NOT NULL
        REFERENCES buildings(building_id) ON DELETE RESTRICT,

    created_by INTEGER
        REFERENCES users(user_id) ON DELETE SET NULL, -- Space Manager

    space_name  VARCHAR(100) NOT NULL,
    room_number VARCHAR(20)  NOT NULL,
    floor       INTEGER      NOT NULL,
    capacity    INTEGER      NOT NULL,

    room_type  space_room_type   NOT NULL,
    noise_level space_noise_level NOT NULL DEFAULT 'Quiet',
    description TEXT,

    -- JSONB for amenities / features
    amenities              JSONB DEFAULT '[]'::jsonb,
    accessibility_features JSONB DEFAULT '[]'::jsonb,

    status space_status NOT NULL DEFAULT 'Available',

    -- Space-specific overrides for operating hours
    operating_hours_weekday_start TIME,
    operating_hours_weekday_end   TIME,
    operating_hours_weekend_start TIME,
    operating_hours_weekend_end   TIME,

    maintenance_start_date TIMESTAMP WITH TIME ZONE,
    maintenance_end_date   TIMESTAMP WITH TIME ZONE,

    -- Soft delete metadata (for Use Case 8c)
    deleted_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,

    version    INTEGER DEFAULT 1, -- For optimistic locking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints from Section 5.1.5
    CONSTRAINT check_capacity_range
        CHECK (capacity >= 1 AND capacity <= 100),

    CONSTRAINT unique_room_in_building
        UNIQUE (building_id, room_number),

    -- Maintenance status must have valid dates
    CONSTRAINT check_maintenance_dates CHECK (
        (status <> 'Maintenance')
        OR (
            maintenance_start_date IS NOT NULL
            AND maintenance_end_date   IS NOT NULL
            AND maintenance_end_date > maintenance_start_date
        )
    )
);

-- BOOKINGS TABLE
CREATE TABLE bookings (
    booking_id SERIAL PRIMARY KEY,

    user_id INTEGER
        REFERENCES users(user_id) ON DELETE SET NULL,

    space_id INTEGER NOT NULL
        REFERENCES study_spaces(space_id) ON DELETE RESTRICT,

    confirmation_number VARCHAR(10) NOT NULL UNIQUE,
    status booking_status NOT NULL DEFAULT 'Confirmed',

    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time   TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Derived duration (minutes) using immutable expression
    duration_minutes INTEGER GENERATED ALWAYS AS (
        (EXTRACT(EPOCH FROM (end_time - start_time)) / 60)::INT
    ) STORED,

    purpose             TEXT,
    cancellation_reason booking_cancellation_reason,
    cancelled_at        TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_booking_times
        CHECK (end_time > start_time),

    -- Booking duration between 60 and 180 minutes
    CONSTRAINT check_booking_duration CHECK (
        (EXTRACT(EPOCH FROM (end_time - start_time)) / 60)
            BETWEEN 60 AND 180
    )
);

-- AFTER the bookings table is created:

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
ADD CONSTRAINT no_double_booking
EXCLUDE USING gist (
    space_id WITH =,
    tstzrange(start_time, end_time) WITH &&
)
WHERE (status = 'Confirmed');

-- NOTIFICATIONS TABLE
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(user_id) ON DELETE CASCADE,

    booking_id INTEGER
        REFERENCES bookings(booking_id) ON DELETE SET NULL,

    notification_type notification_type   NOT NULL,
    subject           VARCHAR(255)        NOT NULL,
    message           TEXT                NOT NULL,
    status            notification_status NOT NULL DEFAULT 'Pending',

    sent_at     TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Retry attempts max 3 (Use Case 9)
    CONSTRAINT check_retry_range
        CHECK (retry_count >= 0 AND retry_count <= 3)
);

-- AUDIT LOGS TABLE
CREATE TABLE audit_logs (
    log_id SERIAL PRIMARY KEY,

    user_id INTEGER
        REFERENCES users(user_id) ON DELETE SET NULL, -- Null for system events

    action_type        audit_action_type NOT NULL,
    target_entity_type VARCHAR(50)      NOT NULL, -- e.g. 'Booking', 'User'
    target_entity_id   INTEGER,

    ip_address   INET,
    before_state JSONB,
    after_state  JSONB,

    result        VARCHAR(20) NOT NULL DEFAULT 'Success', -- 'Success', 'Failed'
    error_message TEXT,

    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 4. INDEXES (Performance)
-- ==========================================

-- Users: login/email lookups
CREATE INDEX idx_users_email
    ON users(email);

-- Users: verification token lookups
CREATE INDEX idx_users_verification_token
    ON users(verification_token)
    WHERE verification_token IS NOT NULL;

-- Users: password reset token lookups
CREATE INDEX idx_users_password_reset_token
    ON users(password_reset_token)
    WHERE password_reset_token IS NOT NULL;

-- Study spaces can also benefit from building/status lookups (optional, but useful)
CREATE INDEX idx_study_spaces_building_status
    ON study_spaces(building_id, status);

-- Bookings: availability checks for a specific space/time range
CREATE INDEX idx_bookings_availability
    ON bookings (space_id, start_time, end_time)
    WHERE status = 'Confirmed';

-- Bookings: user's upcoming bookings
CREATE INDEX idx_bookings_user_start_time
    ON bookings (user_id, start_time);

-- Audit logs: latest first
CREATE INDEX idx_audit_logs_timestamp
    ON audit_logs (timestamp DESC);

-- Pending / queued notifications for worker jobs
CREATE INDEX idx_notifications_pending
    ON notifications (status)
    WHERE status IN ('Pending', 'Retry_Queued');

-- Optional: retry count index
CREATE INDEX idx_notifications_retry_count
    ON notifications (retry_count);

-- ==========================================
-- 5. FUNCTION & TRIGGERS FOR updated_at
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spaces_updated_at
    BEFORE UPDATE ON study_spaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
