PRAGMA foreign_keys = ON;

CREATE TABLE students (
    student_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY,
    course_name TEXT NOT NULL UNIQUE
);
CREATE TABLE enrolments (
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade INTEGER NOT NULL CHECK (grade BETWEEN 0 AND 100),
    PRIMARY KEY (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students (student_id),
    FOREIGN KEY (course_id) REFERENCES courses (course_id)
);

CREATE INDEX enrolments_course_id_idx ON enrolments (course_id);

INSERT INTO students (student_id, name, email) VALUES
    (1, 'Amina Patel', 'amina.patel@example.com'),
    (2, 'Daniel Kim', 'daniel.kim@example.com'),
    (3, 'Sofia Garcia', 'sofia.garcia@example.com'),
    (4, 'Noah Johnson', 'noah.johnson@example.com');

INSERT INTO courses (course_id, course_name) VALUES
    (1, 'Database Fundamentals'),
    (2, 'Web Development'),
    (3, 'Data Structures');

INSERT INTO enrolments (student_id, course_id, grade) VALUES
    (1, 1, 92),
    (1, 2, 88),
    (2, 1, 79),
    (2, 3, 85),
    (3, 2, 95);

-- All courses for a student by name.
SELECT c.course_name
FROM courses AS c
JOIN enrolments AS e ON e.course_id = c.course_id
JOIN students AS s ON s.student_id = e.student_id
WHERE s.name = 'Amina Patel'
ORDER BY c.course_name;

-- All students enrolled on a course.
SELECT s.name
FROM students AS s
JOIN enrolments AS e ON e.student_id = s.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE c.course_name = 'Database Fundamentals'
ORDER BY s.name;

-- Number of students per course, including courses with no enrolments.
SELECT c.course_name, COUNT(e.student_id) AS student_count
FROM courses AS c
LEFT JOIN enrolments AS e ON e.course_id = c.course_id
GROUP BY c.course_id, c.course_name
ORDER BY c.course_name;

-- Students who have no enrolments.
SELECT s.name
FROM students AS s
LEFT JOIN enrolments AS e ON e.student_id = s.student_id
WHERE e.student_id IS NULL
ORDER BY s.name;

-- Update one enrolment's grade.
UPDATE enrolments
SET grade = 90
WHERE student_id = 1
  AND course_id = 1;