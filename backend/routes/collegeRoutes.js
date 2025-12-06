// File: educhain-backend/routes/collegeRoutes.js
const express = require('express');
const {
    registerCollege,
    approveCollege,
    rejectCollege,
    queryCollege,
    getAllColleges, // For CollegeSummary
    getDetailsOfColleges, // For full College details
    queryCollegeCertificate,
    collegeLogin,
    resetCollegePassword
} = require('../controllers/collegeController');
const router = express.Router();

// College Application & Management
router.post('/register', registerCollege);
router.post('/admin/approve/:id', approveCollege);
router.post('/admin/reject/:id', rejectCollege);
router.get('/query/:id', queryCollege); // Query single college by ID
router.get('/getAll', getAllColleges); // Get summary of approved/pending colleges
router.get('/details/all', getDetailsOfColleges); // Get full details of all colleges (including rejected)
router.get('/certificate/:id', queryCollegeCertificate); // Query college blockchain certificate

// College Admin Authentication
router.post('/login', collegeLogin);
router.post('/reset-password', resetCollegePassword);

module.exports = router;