// File: educhain-backend/routes/studentRoutes.js
const express = require('express');
const {
    registerStudent,
    removeStudent,
    updateAttendance,
    updateGrades,
    issueStudentCourseCertificate,
    queryStudent,
    getAllStudents,
    getStudentsByDepartment,
    queryStudentCourseCertificate,
    studentLogin,
    getStudentDetailedAttendance
} = require('../controllers/studentController');
const router = express.Router();

// Student Management
router.post('/register', registerStudent);
router.delete('/remove/:id', removeStudent);
router.post('/attendance', updateAttendance); // Expects { facultyID, studentID, courseName, isPresent }
router.post('/grades', updateGrades);       // Expects { studentID, courseName, phase, grade }
router.post('/certificate/issue', issueStudentCourseCertificate); // Expects { studentID, courseName }
router.post('/login', studentLogin); // NEW: Student login route

// Student Queries
router.get('/query/:id', queryStudent); // Query single student by ID
router.get('/getAll', getAllStudents); // Get all students
router.get('/department/:collegeId/:department', getStudentsByDepartment); // Get students by college and department
router.get('/certificate/:studentId/:courseName', queryStudentCourseCertificate); // Query student course certificate
router.get('/attendance/details/:studentId', getStudentDetailedAttendance);

module.exports = router;