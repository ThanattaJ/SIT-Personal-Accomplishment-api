const moment = require('moment')
const _ = require('lodash')
const projectModel = require('./model')
const authenController = require('../authentication/controller')
const userModel = require('../users/model')
const tagsController = require('../tags/controller')
const filesController = require('../files/controller')
const notiController = require('../notification/controller')
const assignmentModel = require('../assignment/model')
const courseModel = require('../course/model')

const { validate } = require('../validation')
const { pageDefaultSchema, pageDefaultForAssignmentSchema, projectPageSchema, createProjectSchema, updateProjectDetailSchema, updateClapSchema, addExternalToAssignmentSchema, projectIsGroupSchema } = require('./json_schema')

module.exports = {

  getAllProjects: async (req, res) => {
    try {
      let result = {}
      const { checkStatus, err } = validate(req.params, pageDefaultSchema)
      if (!checkStatus) return res.send(err)
      const { page } = req.params
      const { year, by, search } = req.query || undefined

      let getYear = year
      if (year === 'present') {
        const present = moment().year()
        let years = await projectModel.getAllYearProject(year)
        if (years[0].year === present) {
          getYear = years[0].year
        } else {
          getYear = present
          years.push({ 'year': present })
          years = _.orderBy(years, 'year', 'desc')
        }
        result.years = years
      }

      if (page === 'all') {
        result.projects = await projectModel.getAllProjects(getYear)
      } else if (page === 'assignment') {
        const { checkStatus, err } = validate(req.query, pageDefaultForAssignmentSchema)
        if (!checkStatus) return res.send(err)
        const courseId = req.query.course_id || undefined
        const academicTermId = req.query.academic_term_id || undefined

        if (courseId === undefined) {
          const courses = await courseModel.getCourse()
          result.courses = []
          let coursesIdUniq = _.uniqBy(courses, 'course_id')
          coursesIdUniq.map(course => {
            let tmpCourse = []
            const courseId = course.course_id
            const specifyCourses = _.filter(courses, { 'course_id': courseId })
            tmpCourse = {
              course_id: specifyCourses[0].course_id,
              course_code: specifyCourses[0].course_code,
              course_name: specifyCourses[0].course_name,
              term: []
            }
            for (let i = 0; i < specifyCourses.length; i++) {
              const term = {
                academic_term_id: specifyCourses[i].academic_term_id,
                academic_term: specifyCourses[i].academic_term
              }
              tmpCourse['term'].push(term)
            }
            result.courses.push(tmpCourse)
          })
        } else {
          result.projects = await courseModel.getProjectInCourse(courseId, academicTermId)
          result.projects = await projectModel.getProjectsCover(result.projects)
        }
      } else if (page === 'search') {
        if (by === 'tags') {
          result.projects = await projectModel.getProjectByTag(search)
        } else if (by === 'projects') {
          result.projects = await projectModel.getProjectByName(search)
        }
      }
      if (page === 'profile') {
        result.profile = await userModel.getListStudent(search, false)
      }
      res.send(result)
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },
  getTopProject: async (req, res) => {
    try {
      const result = await projectModel.getTopProject()
      res.send(result)
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  getProjectPage: async (req, res) => {
    const { checkStatus, err } = validate(req.query, projectPageSchema)
    if (!checkStatus) return res.send(err)

    try {
      const auth = req.headers.authorization && req.headers.authorization !== 'null' ? await authenController.authorization(req.headers.authorization) : null
      const projectId = req.query.project_id
      const page = await getProjectDetail(projectId)
      page.access = false
      if (auth != null) {
        const access = !!_.find(page.students, { 'student_id': auth.uid })
        page.access = access
      }
      if (!page.access) {
        await projectModel.updateProjectCouting('viewer', projectId)
        page.project_detail.count_viewer++
      }
      res.send(page)
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  createProject: async (req, res, next) => {
    const { checkStatus, err } = validate(req.body, createProjectSchema)
    if (!checkStatus) return res.send(err)

    try {
      const { auth } = req
      // eslint-disable-next-line camelcase
      const { project_data, member, achievements } = req.body
      project_data.start_year_th = project_data.start_year_en + 543
      project_data.end_year_th = project_data.end_year_en + 543
      const assignmentId = project_data.assignment_id || ''
      const typeProject = project_data.assignment_id === null ? 'External' : 'Assignment'
      delete project_data.assignment_id
      if (member.students.length > 0) {
        project_data.isGroup = true
      } else {
        project_data.isGroup = false
      }
      const projectId = await projectModel.createProject(project_data)
      if (auth && member.students.length >= 0) {
        const students = member.students || []
        students.push({
          student_id: auth.uid
        })
        students.forEach((student) => {
          student.project_id = projectId
        })
        await projectModel.addProjectStudent(students)
      }

      if (project_data.haveOutsider && member.outsiders !== undefined && member.outsiders.length > 0) {
        await manageOutsider(member.outsiders, projectId)
      }

      if (achievements !== undefined) {
        await manageAchievement(projectId, achievements)
      }

      let assignment = null
      if (typeProject === 'Assignment') {
        await projectModel.mapProjectAndAssignment(projectId, assignmentId, 'create')
        assignment = await assignmentModel.getLecturerAssignmentsDetailById(assignmentId)
        delete assignment.lecturers
        delete assignment.students
        await checkMemberJoinAssignment(auth.uid, member, assignment)
      }

      const page = await projectModel.getShortProjectDetailById(projectId)
      page.project_detail.haveOutsider = page.project_detail.haveOutsider === 1
      if (page.project_detail.haveOutsider) {
        const outsiders = await userModel.getProjectOutsider(projectId)
        page.outsiders = outsiders[0] === undefined ? [] : outsiders
      }
      let projectAssignmentStatus = page.project_detail.status_name || null
      await notiController.sendEmail(projectId, auth.fullname, page, 'create', assignment, projectAssignmentStatus)
      res.status(200).send({
        status: 200,
        project_id: projectId
      })
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  updateProjectDetail: async (req, res, next) => {
    const { checkStatus, err } = validate(req.body, updateProjectDetailSchema)
    if (!checkStatus) return res.send(err)

    try {
      const { auth } = req
      // eslint-disable-next-line camelcase
      const { project_detail, outsiders, achievements, tags, video } = req.body
      const projectId = project_detail.id
      const type = project_detail.project_type_name
      await projectModel.updateProjectDetail(projectId, project_detail)
      await manageAchievement(projectId, achievements)
      if (project_detail.haveOutsider && outsiders !== undefined && outsiders.length > 0) {
        await manageOutsider(outsiders, projectId)
      }
      if (tags !== undefined) {
        const tagsCheked = await checkTag(tags)
        tagsCheked.forEach(tag => {
          delete tag.tag_name
          tag.project_id = projectId
        })
        await projectModel.updateProjectTag(tagsCheked, projectId)
      }
      await filesController.updateVideo(video, projectId)
      const newDetail = await getProjectDetail(projectId)
      newDetail.project_detail.haveOutsider = newDetail.project_detail.haveOutsider === 1
      if (newDetail.project_detail.haveOutsider) {
        const outsiders = await userModel.getProjectOutsider(projectId)
        newDetail.outsiders = outsiders[0] === undefined ? [] : outsiders
      }
      
      let assignment = null
      let projectAssignmentStatus = null
      if (type === 'Assignment') {
        await projectModel.mapProjectAndAssignment(projectId, project_detail.assignment_detail.assignment_id, 'update')
        assignment = await assignmentModel.getLecturerAssignmentsDetailById(project_detail.assignment_detail.assignment_id)
        projectAssignmentStatus = newDetail.project_detail.assignment_detail.project_status
        delete assignment.lecturers
        delete assignment.students
      }
      await notiController.sendEmail(projectId, auth.fullname, newDetail, 'update', assignment, projectAssignmentStatus)
      
      res.send(newDetail)
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  updateProjectClap: async (req, res) => {
    const { checkStatus, err } = validate(req.body, updateClapSchema)
    if (!checkStatus) return res.send(err)

    try {
      const projectId = req.body.project_id
      const result = await projectModel.updateProjectCouting('clap', projectId)
      res.send(result)
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  deleteProject: async (req, res) => {
    const { checkStatus, err } = validate(req.params, projectPageSchema)
    if (!checkStatus) return res.send(err)

    try {
      const projectId = req.params.id
      await projectModel.deleteProject(projectId)
      res.status(200).send({
        status: 500,
        message: 'Delete Success'
      })
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  addProjectExternalToAssignment: async (req, res) => {
    const { checkStatus, err } = validate(req.query, addExternalToAssignmentSchema)
    if (!checkStatus) return res.send(err)

    try {
      const { auth } = req
      const projectId = _.toNumber(req.query.project_id)
      const assignmentId = _.toNumber(req.query.assignment_id)
      console.log(assignmentId);
      console.log(projectId);
      await projectModel.mapProjectAndAssignment(projectId, assignmentId, 'create')
      await projectModel.changeProjectType(projectId)

      const project = await projectModel.getShortProjectDetailById(projectId)
      const projectAssignmentStatus = project.project_detail.status_name || null
      const assignment = await assignmentModel.getLecturerAssignmentsDetailById(assignmentId)
      delete assignment.lecturers
      delete assignment.students

      await checkMemberJoinAssignment(project.students, project, assignment)

      await notiController.sendEmail(projectId, auth.fullname, project, 'add', assignment, projectAssignmentStatus)
      res.status(200).send({
        status: 200,
        message: `Add project to assignment successs. please wait for lecturer approve `
      })
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  getProjectIsGroup: async (req, res) => {
    const { checkStatus, err } = validate(req.query, projectIsGroupSchema)
    if (!checkStatus) return res.send(err)
    try {
      const { auth } = req
      const isGroup = req.query.isGroup === 'true'

      const projects = await projectModel.getProjectIsGroup(auth.uid, isGroup)
      res.send(projects)
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  }
}

async function checkTag (tags) {
  try {
    const check = tags.map(async tag => {
      const tagId = await tagsController.checkTag(tag.tag_name)
      if (tagId.length > 0) {
        tag.tag_id = tagId[0].tag_id
      } else {
        const tagId = await tagsController.createTag(tag.tag_name)
        tag.tag_id = tagId[0].tag_id
      }
    })
    await Promise.all(check)
    return tags
  } catch (err) {
    throw new Error(err)
  }
}

async function getProjectDetail (projectId) {
  try {
    const result = await projectModel.getProjectsDetailById(projectId)
    result.project_detail.isShow = result.project_detail.isShow === 1
    result.project_detail.haveOutsider = result.project_detail.haveOutsider === 1
    if (result.project_detail.haveOutsider) {
      const outsiders = await userModel.getProjectOutsider(projectId)
      result.outsiders = outsiders[0] === undefined ? [] : outsiders
    }
    if (result.project_detail.references) {
      const ref = result.project_detail.references
      result.project_detail.references = _.split(ref, ',')
    }
    const assignmentId = result.project_detail.assignment_id
    let assignment = {}
    if (assignmentId !== null) {
      assignment = await assignmentModel.getLecturerAssignmentsDetailById(assignmentId)
      const newLecturers = assignment.lecturers
      newLecturers.map(newLecturer => {
        delete newLecturer.isCreator
        delete newLecturer.isApprover
      })
      assignment.lecturers = newLecturers
    }
    result.project_detail.assignment_detail = {
      assignment_id: assignmentId || null,
      assignment_name: assignment.assignment_name || null,
      academic_term_id: assignment.academic_term_id || null,
      academic_term: assignment.academic_term || null,
      course_id: assignment.course_id || null,
      course_name: assignment.course_name || null,
      lecturers: assignment.lecturers || null,
      project_status: result.project_detail.status_name || null,
      comment: result.project_detail.comment || null
    }
    delete result.project_detail.assignment_id
    delete result.project_detail.status_name
    delete result.project_detail.comment

    if (result.achievements.length > 0) {
      result.achievements.forEach(achievement => {
        achievement.date_of_event = achievement.date_of_event === '0000-00-00' ? null : moment(achievement.date_of_event).format('DD-MM-YYYY')
      })
    }

    result.project_detail.created_at = moment(result.project_detail.created_at).format('MMM Do YYYY, h:mm:ss a')
    result.project_detail.updated_at = moment(result.project_detail.updated_at).format('MMM Do YYYY, h:mm:ss a')
    return result
  } catch (err) {
    throw new Error(err)
  }
}

async function manageOutsider (outsiders, projectId) {
  try {
    const outsiderNotId = await outsiders.filter(outsider => outsider.id === undefined)
    if (outsiderNotId.length > 0) {
      outsiderNotId.forEach(outsider => {
        outsider.project_id = projectId
      })
      await userModel.addProjectOutsider(outsiderNotId)
    }

    const outsiderHaveId = await outsiders.filter(outsider => outsider.id !== undefined)
    if (outsiderHaveId.length > 0) {
      outsiderHaveId.forEach(async outsider => {
        await userModel.updateProjectOutsider(outsider)
      })
    }
  } catch (err) {
    throw new Error(err)
  }
}

async function manageAchievement (id, achievements) {
  try {
    if (achievements.length > 0) {
      achievements.forEach(achievement => {
        achievements.project_id = id
        const date = achievement.date_of_event
        achievement.date_of_event = moment(date, 'DD-MM-YYYY').format('YYYY-MM-DD')
      })
      await projectModel.manageProjectAchievement(id, achievements)
    }
  } catch (err) {
    throw new Error(err)
  }
}

async function checkMemberJoinAssignment (studentId, project, assignment) {
  try {
    const students = _.filter(project.students, function (student) { return student.student_id !== studentId })
    const joinAssignment = async _ => {
      const promises = students.map(async student => {
        await assignmentModel.joinAssignment(assignment.join_code, student.student_id)
      })
      await Promise.all(promises)
    }
    await joinAssignment()
  } catch (err) {
    throw new Error(err)
  }
}
