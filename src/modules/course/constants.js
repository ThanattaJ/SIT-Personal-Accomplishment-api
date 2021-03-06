const knex = require('../../db/knex')

module.exports = {
  queryGetCourse: [
    'courses.id as course_id',
    'course_code',
    'course_name',
    'course_detail',
    'isDelete'
  ],

  queryGetCourseHaveAssignment: [
    'courses.id as course_id',
    'course_code',
    'course_name',
    'course_detail',
    'lecturer_course.academic_term_id',
    knex.raw('CONCAT(academic_year.academic_year_en,\'/\',term.term_number) as academic_term')
  ],

  queryGetProjectInCourse: [
    'projects.id',
    'projects.project_name_th',
    'projects.project_name_en',
    'projects.project_abstract',
    'projects.project_detail',
    'projects.count_viewer',
    'projects.count_clap',
    'status_project.status_name'
  ],

  querySemester: [
    'academic_term.id as academic_term_id',
    knex.raw('CONCAT(academic_year.academic_year_en,\'/\',term.term_number) as academic_term')
  ],

  queryGetCourseSemester: [
    'lecturer_course.academic_term_id',
    'courses.id as course_id',
    knex.raw('CONCAT(courses.course_code,\' \',courses.course_name) as course'),
    knex.raw('GROUP_CONCAT(lecturer_course.id) as course_map_lecturer'),
    knex.raw('GROUP_CONCAT(lecturer_course.lecturer_id) as lecturers_id'),
    knex.raw('GROUP_CONCAT(CONCAT(lecturers.firstname,\' \',lecturers.lastname)) as lecturers')
  ],

  queryGetLecturerCourse: [
    knex.raw('GROUP_CONCAT(lecturer_course.id) as lecturer_course_id'),
    'lecturer_course.academic_term_id',
    knex.raw('CONCAT(academic_year.academic_year_en,\'/\',term.term_number) as academic_term'),
    knex.raw('GROUP_CONCAT(courses.id) as course_id'),
    knex.raw('GROUP_CONCAT(CONCAT(courses.course_code,\' \',courses.course_name)) as courses')
  ],

  queryGetCourseAssignment: [
    'lecturer_assignment.assignment_id as assignment_id'
  ],

  queryGetCourseLecturer: [
    'lecturer_course.id as lecturer_course_id'
  ]
}
