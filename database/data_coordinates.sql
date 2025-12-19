-- 1. Add columns 

ALTER TABLE buildings 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(8, 6),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(9, 6);

-- 2. Update Ayazağa Campus
-- Mustafa İnan Library Entrance
UPDATE buildings SET latitude = 41.103760, longitude = 29.020991 WHERE building_name = 'Mustafa Inan Central Library';

-- MED A (Central Lecture Hall A)
UPDATE buildings SET latitude = 41.105543, longitude = 29.023305 WHERE building_name = 'Central Lecture Hall A (MED A)';

-- MED B (Central Lecture Hall B)
UPDATE buildings SET latitude = 41.102735, longitude = 29.028043 WHERE building_name = 'Central Lecture Hall B (MED B)';

-- BBB (Computer and Informatics Faculty)
UPDATE buildings SET latitude = 41.103061, longitude = 29.025982 WHERE building_name = 'Computer and Informatics Faculty (BBB)';

-- EEB (Electrical-Electronics Faculty)
UPDATE buildings SET latitude = 41.104644, longitude = 29.024406 WHERE building_name = 'Electrical-Electronics Faculty (EEB)';

-- Civil Engineering Faculty
UPDATE buildings SET latitude = 41.104988, longitude = 29.018683 WHERE building_name = 'Civil Engineering Faculty';

-- Chemical-Metallurgical Engineering Faculty
UPDATE buildings SET latitude = 41.104551, longitude = 29.027463 WHERE building_name = 'Chemical-Metallurgical Engineering Faculty';

-- Mining Engineering Faculty
UPDATE buildings SET latitude = 41.104902, longitude = 29.026133 WHERE building_name = 'Mining Engineering Faculty';

-- UUB (Aeronautics and Astronautics Faculty)
UPDATE buildings SET latitude = 41.101510, longitude = 29.021794 WHERE building_name = 'Aeronautics and Astronautics Faculty (UUB)';

-- Naval Architecture and Marine Sciences Faculty
UPDATE buildings SET latitude = 41.102765, longitude = 29.027331 WHERE building_name = 'Naval Architecture and Marine Sciences Faculty';

-- FEB (Science and Letters Faculty)
UPDATE buildings SET latitude = 41.106781, longitude = 29.024299 WHERE building_name = 'Science and Letters Faculty (FEB)';


-- 3. Update Gümüşsuyu Campus
-- Mechanical Engineering Faculty (Historic Entrance)
UPDATE buildings SET latitude = 41.037284, longitude = 28.991745 WHERE building_name = 'Mechanical Engineering Faculty (GSU)';

-- Textile Technologies and Design
UPDATE buildings SET latitude = 41.037289, longitude = 28.991743 WHERE building_name = 'Textile Technologies and Design Building';


-- 4. Update Taşkışla Campus
-- Architecture Faculty (Main Historic Gate)
UPDATE buildings SET latitude = 41.041257, longitude = 28.989573 WHERE building_name = 'Architecture Faculty (Taskisla)';


-- 5. Update Maçka Campus
-- Business Faculty (Historic School Building)
UPDATE buildings SET latitude = 41.043756, longitude = 28.996700 WHERE building_name = 'Business Faculty';

-- School of Foreign Languages
UPDATE buildings SET latitude = 41.045192, longitude = 28.994798 WHERE building_name = 'School of Foreign Languages';