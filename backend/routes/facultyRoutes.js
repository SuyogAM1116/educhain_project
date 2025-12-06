// File: educhain-backend/routes/facultyRoutes.js
const express = require('express');
const {
    registerFaculty,
    removeFaculty,
    queryFaculty,
    getAllFaculty,
    getFacultyByDepartment,
    facultyLogin
} = require('../controllers/facultyController');
const router = express.Router();

// Faculty Management
router.post('/register', registerFaculty);
router.post('/login', facultyLogin); // NEW: Faculty login route
router.delete('/remove/:id', removeFaculty);

// Faculty Queries
router.get('/query/:id', queryFaculty); // Query single faculty by ID
router.get('/getAll', getAllFaculty); // Get all faculty
router.get('/department/:collegeId/:department', getFacultyByDepartment); // Get faculty by college and department

module.exports = router;