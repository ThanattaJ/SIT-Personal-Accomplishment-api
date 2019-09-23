/* eslint-disable camelcase */
const userModel = require('./model')
const moment = require('moment')
const projectController = require('../projects/controller')
const fileController = require('../files/controller')
const authenController = require('../authentication/controller')
const { validate } = require('../validation')
const { getUserIdSchema, getListStudentSchema, updateUserEmailSchema, updateStudentIdSchema, getStudentIdSchema } = require('./json_schema')

module.exports = {

  getUserDefaultInformation: async (req, res) => {
    try {
      const authen = req.headers.authorization ? await authenController.authorization(req.headers.authorization) : null
      let userData = {}
      let userRole
      if (authen === null) {
        const { checkStatus, err } = validate(req.query, getUserIdSchema)
        if (!checkStatus) return res.send(err)
        userRole = req.query.user_role
        const { id } = req.query
        userData = await userModel.getUserDefaultInformation(userRole, id)
      } else {
        userRole = authen.role
        userData = await userModel.getUserDefaultInformation(userRole, authen.uid)
        userData.access = true
      }
      if (userRole === 'student') {
        const project = await getProjectByStudentId(userData.profile.student_id)
        userData.projects = project.project
        userData.totalProject = project.totalProject
      }
      res.send(userData)
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  updateUserEmail: async (req, res) => {
    try {
      const { checkStatus, err } = validate(req.body, updateUserEmailSchema)
      if (!checkStatus) return res.send(err)

      const { email } = req.body
      const authen = await authenController.authorization(req.headers.authorization)
      const result = await userModel.updateUserEmail(authen.role, authen.uid, email) === 1 ? 'Update Success' : 'Updatee Fail'
      res.status(200).send({
        status: 200,
        message: result
      })
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  updateUserImage: async (req, res) => {
    try {
      const { file } = req
      if (file === undefined) {
        return res.status(500).send({
          status: 500,
          message: 'Dose Not Exsit File'
        })
      }
      const authen = await authenController.authorization(req.headers.authorization)
      const imageOldLink = await userModel.getUserImage(authen.role, authen.uid)
      if (imageOldLink !== null) {
        await fileController.deleteObjectStorage(imageOldLink, 'image')
      }
      const link = await fileController.uploadFileToStorage(file, 'image', authen.uid, true)
      const result = await userModel.updateUserImage(authen.role, authen.uid, link) === 1 ? 'Update Success' : 'Updatee Fail'
      res.status(200).send({
        status: 200,
        message: result
      })
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  getStudentInformation: async (req, res, next) => {
    try {
      const { checkStatus, err } = validate(req.params, getStudentIdSchema)
      if (!checkStatus) return res.send(err)
      const x = await authenController.login
      x()
      const authen = await authenController.authorization(req.headers.authorization)

      const userData = await userModel.getStudentInformationById(authen.uid)
      userData.profile.birthday = userData.profile.birthday === null ? null : moment(userData.profile.birthday).format('YYYY-MM-DD')
      const project = await getProjectByStudentId(authen.uid)
      userData.projects = project.project

      res.send(userData)
    } catch (err) {
      console.log('err', err)
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  updateStudentInformation: async (req, res) => {
    const { checkStatus, err } = validate(req.body, updateStudentIdSchema)
    if (!checkStatus) return res.send(err)
    try {
      const authen = await authenController.authorization(req.headers.authorization)
      if (!checkStatus) return res.send(err)
      const { profile, address, languages, educations } = req.body
      const profileId = await userModel.updateStudentInformation(profile, address)

      if (languages.length > 0) {
        console.log(languages)
        await userModel.deleteUserLanguage(profileId)
        languages.forEach(async language => {
          language.students_profile_id = profileId
        })
        await userModel.addUserLanguage(languages)
      }

      if (educations.length > 0) {
        const educationNotId = await educations.filter(education => education.id === undefined)
        if (educationNotId.length > 0) {
          educationNotId.forEach(education => {
            education.students_profile_id = profileId
          })
          await userModel.addUserEducation(educationNotId)
        }

        const educationHaveId = await educations.filter(education => education.id !== undefined)
        if (educationHaveId.length > 0) {
          educationHaveId.forEach(async education => {
            await userModel.updateUserEducation(education)
          })
        }
      }
      res.status(200).send({
        status: 200,
        message: 'Update Success'
      })
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  getListStudent: async (req, res) => {
    try {
      const { checkStatus, err } = validate(req.params, getListStudentSchema)
      if (!checkStatus) return res.send(err)

      const code = req.params.code
      const list = await userModel.getListStudent(code)
      res.send(list)
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  getListLecturer: async (req, res) => {
    try {
      const list = await userModel.getListLecturer()
      res.send(list)
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  getLanguages: async (req, res) => {
    try {
      const list_languages = await userModel.getLanguages()
      const list_level = await userModel.getLanguagesLevel()
      const list = {
        language: list_languages,
        level: list_level
      }
      res.send(list)
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  getEducationLevel: async (req, res) => {
    try {
      const list = await userModel.getEducationLevel()
      res.send(list)
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  },

  createOutsider: async (data) => {
    try {
      const result = await userModel.addProjectOutsider(data)
      return result
    } catch (err) {
      throw new Error(err)
    }
  },

  getOutsider: async (projectId) => {
    try {
      const outsiders = await userModel.getProjectOutsider(projectId)
      return outsiders
    } catch (err) {
      throw new Error(err)
    }
  },

  updateOutsider: async (outsiders) => {
    try {
      outsiders.forEach(async outsider => {
        await userModel.updateProjectOutsider(outsider)
      })
    } catch (err) {
      throw new Error(err)
    }
  },

  deleteOutsider: async (req, res) => {
    const { checkStatus, err } = validate(req.params, userModel)
    if (!checkStatus) return res.send(err)

    try {
      const id = req.params.outsider_id
      await userModel.deleteOutsider(id)
      res.status(200).send({
        status: 200,
        message: 'Delete Success'
      })
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: err.message
      })
    }
  }
}

async function getProjectByStudentId (userId) {
  const result = {}
  result.project = await projectController.getProjectsByStudentId(userId)
  result.totalProject = await projectController.getAmountProjectUser(userId)

  return result
}
