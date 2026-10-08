# School database design

## Tables

- **`students`** stores each student's ID, name, and unique email address.
- **`courses`** stores each course's ID and unique name.
- **`enrolments`** records which student is taking which course and the student's grade for that course. Its composite primary key (`student_id`, `course_id`) prevents a student from enrolling in the same course twice; its foreign keys require both referenced records to exist.

## Relationships

One student can have many enrolments, and one course can have many enrolments. Those are one-to-many relationships from `students` and `courses` to `enrolments`. Together, students and courses have a many-to-many relationship: each student can take multiple courses, and each course can have multiple students. The `enrolments` join table is needed to represent that relationship and to store attributes of each pairing, such as the grade.

## Index

I would add an index on `enrolments(course_id)` to speed up finding the students on a course and counting enrolments by course. It also helps SQLite find referencing enrolments when checking course foreign keys.

## SQL or NoSQL?

I would choose a relational SQL database for this system. Students, courses, and enrolments have clear relationships, and enrolments must reference valid students and courses. SQL constraints enforce unique emails, valid references, and one enrolment per student-course pair; joins make course rosters and enrolment counts straightforward. A NoSQL database could store the data, but it would require more application-level work to preserve these relational rules and answer these queries reliably.