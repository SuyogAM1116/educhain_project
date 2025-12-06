// File: educhain-backend/routes/verificationRoutes.js
const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');

// 1. College Verification
// Verifies an approved college using its ID and an optional approval transaction ID
router.get('/college/:collegeId', verificationController.verifyCollege);

// 2. Student Verification
// 2a. Basic Student Enrollment Verification
// Confirms if a student is associated with a specific college
router.get('/student/enrollment', verificationController.verifyStudentEnrollment); // Expects ?studentId=X&collegeId=Y

// 2b. Student Course Certificate Verification (by Certificate ID)
// Verifies a specific course certificate issued to a student using the certificate's unique ID
router.get('/student/certificate/:certificateId', verificationController.verifyStudentCertificateById);

// 2c. Student Course Certificate Verification (by Details - Alternative)
// Verifies a specific course certificate using student details and the certificate's transaction ID
router.get('/student/certificate-by-details', verificationController.verifyStudentCertificateByDetails); // Expects ?studentId=X&courseName=Y&transactionId=Z

// 3. Faculty Verification
// Confirms if a faculty member is associated with a specific college
router.get('/faculty/association', verificationController.verifyFacultyAssociation); // Expects ?facultyId=X&collegeId=Y

module.exports = router;