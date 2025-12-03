-- ==============================
-- USERS
-- ==============================

INSERT INTO users (email, password_hash, full_name, student_number, phone_number, role, status, email_verified)
VALUES
('student1@itu.edu.tr', 'hash1', 'Ahmet Yılmaz', '150210001', '5550000001', 'Student', 'Verified', TRUE),
('student2@itu.edu.tr', 'hash2', 'Ece Kara', '150210002', '5550000002', 'Student', 'Verified', TRUE),
('manager1@itu.edu.tr', 'hash3', 'Mert Aksoy', NULL, '5550000003', 'Space_Manager', 'Verified', TRUE),
('admin1@itu.edu.tr', 'hash4', 'Admin User', NULL, '5550000004', 'Administrator', 'Verified', TRUE);

-- ==============================
-- CAMPUSES
-- ==============================

INSERT INTO campuses (campus_name, address)
VALUES
('Ayazağa Campus', 'Maslak, İstanbul'),
('Gümüşsuyu Campus', 'Beyoglu, İstanbul'),
('Maçka Campus', 'Maçka, İstanbul');

-- ==============================
-- BUILDINGS
-- ==============================

INSERT INTO buildings (campus_id, building_name, floor_count,
    operating_hours_weekday_start, operating_hours_weekday_end,
    operating_hours_weekend_start, operating_hours_weekend_end)
VALUES
(1, 'A Block', 5, '08:00', '22:00', '10:00', '18:00'),
(1, 'Library Building', 4, '08:00', '23:30', '10:00', '20:00'),
(2, 'Main Building', 3, '09:00', '21:00', NULL, NULL),
(3, 'Tech Lab Building', 6, '08:00', '22:00', '10:00', '20:00');

-- ==============================
-- STUDY SPACES
-- ==============================

INSERT INTO study_spaces
(building_id, created_by, space_name, room_number, floor, capacity,
 room_type, noise_level, amenities, accessibility_features, status,
 maintenance_start_date, maintenance_end_date)
VALUES
(1, 3, 'Quiet Study Room 1', 'A101', 1, 20, 'Quiet_Study', 'Silent',
    '["WiFi", "AirConditioning"]', '["WheelchairAccess"]', 'Available',
    NULL, NULL),

(1, 3, 'Group Study Room 2', 'A203', 2, 10, 'Group_Study', 'Moderate',
    '["Whiteboard", "WiFi"]', '[]', 'Available',
    NULL, NULL),

(2, 3, 'Library Silent Room', 'L-B1', 1, 30, 'Quiet_Study', 'Silent',
    '["WiFi"]', '["ElevatorNearby"]', 'Available',
    NULL, NULL),

(2, 3, 'Library Group Room', 'L-G2', 2, 12, 'Group_Study', 'Moderate',
    '["Projector", "WiFi"]', '[]', 'Available',
    NULL, NULL),

(3, 3, 'Gümüşsuyu Study Hall', 'G101', 1, 40, 'Quiet_Study', 'Quiet',
    '["WiFi", "Heater"]', '[]', 'Available',
    NULL, NULL),

-- THIS ONE WAS BROKEN – NOW FIXED
(4, 3, 'Tech Lab Meeting Room', 'T302', 3, 8, 'Meeting_Room', 'Moderate',
    '["Monitor", "HDMI", "WiFi"]', '[]', 'Maintenance',
    NOW(), NOW() + INTERVAL '2 hours');

-- ==============================
-- BOOKINGS
-- ==============================

-- Use space_id = 1,2,3 from above
INSERT INTO bookings
(user_id, space_id, confirmation_number, status, start_time, end_time, purpose)
VALUES
(1, 1, 'CN12345678', 'Confirmed',
    NOW() + INTERVAL '1 hour',
    NOW() + INTERVAL '2 hours',
    'Studying for exam'),

(2, 2, 'CN87654321', 'Confirmed',
    NOW() + INTERVAL '3 hours',
    NOW() + INTERVAL '5 hours',
    'Group project meeting'),

(1, 3, 'CN11223344', 'Cancelled',
    NOW() - INTERVAL '5 hours',
    NOW() - INTERVAL '3 hours',
    'Past booking test');

UPDATE bookings
SET cancellation_reason = 'User_Requested', cancelled_at = NOW()
WHERE confirmation_number = 'CN11223344';

-- ==============================
-- NOTIFICATIONS
-- ==============================

-- Booking IDs = 1, 2, 3
INSERT INTO notifications
(user_id, booking_id, notification_type, subject, message, status, retry_count)
VALUES
(1, 1, 'Booking_Confirmation', 'Booking Confirmed', 'Your booking has been confirmed.', 'Sent', 0),
(2, 2, 'Booking_Reminder', 'Upcoming Booking Reminder', 'Your booking starts soon.', 'Pending', 0),
(1, 3, 'Booking_Cancellation', 'Booking Cancelled', 'Your booking was cancelled.', 'Sent', 0),
(1, NULL, 'Account_Security', 'Login Attempt', 'A new login was detected.', 'Failed', 1);

-- ==============================
-- AUDIT LOGS
-- ==============================

INSERT INTO audit_logs
(user_id, action_type, target_entity_type, target_entity_id, ip_address,
 before_state, after_state, result)
VALUES
(1, 'Login_Success', 'User', 1, '192.168.1.10', NULL, NULL, 'Success'),
(3, 'Space_Updated', 'Study_Space', 1, '192.168.1.15',
 '{"status":"Available"}', '{"status":"Maintenance"}', 'Success'),
(4, 'Role_Changed', 'User', 3, '192.168.1.30',
 '{"role":"Student"}', '{"role":"Space_Manager"}', 'Success');
INSERT INTO bookings (user_id, space_id, confirmation_number, start_time, end_time)
VALUES (1, 5, 'ABC123', '2025-01-01 10:00', '2025-01-01 12:00');

