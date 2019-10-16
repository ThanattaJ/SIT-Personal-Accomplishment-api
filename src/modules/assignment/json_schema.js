const joi = require('joi')

module.exports = {
  createAssignmentSchema: joi.object().keys({
    lecturer_course_id: joi.number().required(),
    academic_term_id: joi.number().required(),
    course_id: joi.number().required(),
    assignment_name: joi.string().required().trim()
  }),

  getAssignmentByIdSchema: joi.object().keys({
    assignment_id: joi.number().required()
  }),

  updateLecturerApproverSchema: joi.object().keys({
    assignment_id: joi.number().required(),
    lecturer_course_id: joi.number().required(),
    isApprove: joi.boolean().required()
  }),

  joinAssignmentSchema: joi.object().keys({
    join_code: joi.string().required().trim()
  })
}
