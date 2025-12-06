// File: educhain-backend/controllers/verificationController.js
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

const ccpPath = path.resolve(__dirname, '../connection.json'); //
const walletPath = path.resolve('/home/Fabric/educhain-backend/wallet'); // Make sure this path is correct for your setup

// Helper function to connect to the Fabric network
// Using 'admin' identity for queries by default, as verification is a public/UGC portal feature.
// Adjust identity if a less privileged query user is set up for this.
async function connectToNetwork(userIdentity = 'admin') { //
    const wallet = await Wallets.newFileSystemWallet(walletPath); //
    
    console.log(`[VerificationConnect] Attempting connection as: ${userIdentity}`);
    const gateway = new Gateway(); //
    try {
        const identity = await wallet.get(userIdentity); //
        if (!identity) {
            console.error(`[VerificationConnect] ERROR: Identity for user "${userIdentity}" not found in wallet.`);
            throw new Error(`Identity for user "${userIdentity}" not found in wallet.`);
        }
        console.log(`[VerificationConnect] Identity for ${userIdentity} retrieved.`);

        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8')); //
        
        await gateway.connect(ccp, { wallet, identity: userIdentity, discovery: { enabled: true, asLocalhost: true } }); //
        console.log(`[VerificationConnect] Gateway connected for ${userIdentity}.`);
        
        const network = await gateway.getNetwork('mychannel'); //
        console.log(`[VerificationConnect] Network 'mychannel' obtained.`);
        
        const contract = network.getContract('educhain'); //
        console.log(`[VerificationConnect] Contract 'educhain' obtained.`);
        
        return { contract, gateway }; // Return gateway to allow disconnection
    } catch (connError) {
        console.error(`[VerificationConnect] FATAL ERROR for ${userIdentity}:`, connError.message);
        if (gateway && gateway.isConnected()) {
            gateway.disconnect();
        }
        throw connError;
    }
}

// 1. College Verification
exports.verifyCollege = async (req, res) => {
    let networkConnection;
    try {
        const { collegeId } = req.params;
        const { approvalTransactionId } = req.query; // Optional

        if (!collegeId) {
            return res.status(400).send({ message: "College ID is required." });
        }

        networkConnection = await connectToNetwork();
        const contract = networkConnection.contract;

        console.log(`[VerifyCollege] Querying certificate for College ID: ${collegeId}`);
        const certificateResultBytes = await contract.evaluateTransaction('QueryCollegeCertificate', collegeId); //
        
        if (!certificateResultBytes || certificateResultBytes.length === 0) {
            return res.status(404).send({ verificationMessage: "College certificate not found on EduChain." });
        }
        
        const certificate = JSON.parse(certificateResultBytes.toString());

        if (approvalTransactionId && certificate.TransactionID !== approvalTransactionId) { //
            return res.status(400).send({ 
                verificationMessage: "College certificate found, but the provided approval transaction ID does not match.",
                details: {
                    collegeName: certificate.CollegeName, //
                    status: certificate.Status, //
                    issuedDate: certificate.IssuedDate //
                }
            });
        }

        res.status(200).send({
            collegeName: certificate.CollegeName, //
            status: certificate.Status, //
            issuedDate: certificate.IssuedDate, //
            matchedApprovalTransactionId: approvalTransactionId ? certificate.TransactionID : undefined, //
            verificationMessage: "College is verified as approved and active on EduChain."
        });

    } catch (error) {
        console.error(`Error verifying college: ${error.message}`);
        if (error.message.includes("not found")) {
            return res.status(404).send({ verificationMessage: "College certificate not found on EduChain." });
        }
        res.status(500).send({ message: 'Failed to verify college', error: error.message });
    } finally {
        if (networkConnection && networkConnection.gateway) {
            networkConnection.gateway.disconnect();
        }
    }
};

// 2a. Basic Student Enrollment Verification
exports.verifyStudentEnrollment = async (req, res) => {
    let networkConnection;
    try {
        const { studentId, collegeId } = req.query;

        if (!studentId || !collegeId) {
            return res.status(400).send({ message: "Student ID and College ID are required query parameters." });
        }

        networkConnection = await connectToNetwork();
        const contract = networkConnection.contract;

        console.log(`[VerifyStudentEnrollment] Querying details for Student ID: ${studentId}`);
        const studentResultBytes = await contract.evaluateTransaction('QueryDetails', studentId); //
        
        if (!studentResultBytes || studentResultBytes.length === 0) {
            return res.status(404).send({ verificationMessage: "Student ID not found on EduChain." });
        }

        const student = JSON.parse(studentResultBytes.toString());

        // Verify it's a student record (heuristic based on expected fields)
        if (!student.id || !student.branch || !student.collegeID) { //
             return res.status(404).send({ verificationMessage: "Record found, but it does not appear to be a valid student record." });
        }

        if (student.collegeID === collegeId) { //
            res.status(200).send({
                studentId: student.id, //
                collegeId: student.collegeID, //
                department: student.branch, //
                verificationMessage: "Student is verified as associated with the specified college and department on EduChain."
            });
        } else {
            res.status(200).send({ // Still 200 as student was found, but association is the key
                studentId: student.id, //
                actualCollegeId: student.collegeID, //
                verificationMessage: `Student found but is associated with College ID ${student.collegeID}, not the specified ${collegeId}.`
            });
        }

    } catch (error) {
        console.error(`Error verifying student enrollment: ${error.message}`);
         if (error.message.includes("not found")) {
            return res.status(404).send({ verificationMessage: "Student ID not found on EduChain." });
        }
        res.status(500).send({ message: 'Failed to verify student enrollment', error: error.message });
    } finally {
        if (networkConnection && networkConnection.gateway) {
            networkConnection.gateway.disconnect();
        }
    }
};

// 2b. Student Course Certificate Verification (by Certificate ID)
exports.verifyStudentCertificateById = async (req, res) => {
    let networkConnection;
    try {
        const { certificateId } = req.params;

        if (!certificateId) {
            return res.status(400).send({ message: "Certificate ID is required." });
        }
        
        // Certificate ID format is expected to be STUDENTCERT_<studentID>_<courseName>
        // We need to parse studentID and courseName if your chaincode QueryStudentCourseCertificate expects them separately.
        // Assuming your chaincode `QueryStudentCourseCertificate` takes studentID and courseName.
        // If it takes certificateID directly, this parsing isn't needed.
        // Based on studentController.js, it takes studentId and courseName.

        const parts = certificateId.split('_');
        if (parts.length < 3 || parts[0].toUpperCase() !== 'STUDENTCERT') {
            return res.status(400).send({ message: "Invalid Certificate ID format. Expected format: STUDENTCERT_studentID_courseName" });
        }
        const studentId = parts[1];
        const courseName = parts.slice(2).join('_'); // Handle course names with underscores

        networkConnection = await connectToNetwork();
        const contract = networkConnection.contract;
        
        console.log(`[VerifyStudentCertById] Querying certificate for Student ID: ${studentId}, Course: ${courseName}`);
        const certificateResultBytes = await contract.evaluateTransaction('QueryStudentCourseCertificate', studentId, courseName); //

        if (!certificateResultBytes || certificateResultBytes.length === 0) {
            return res.status(404).send({ verificationMessage: "Student course certificate not found." });
        }
        
        const certificate = JSON.parse(certificateResultBytes.toString());

        res.status(200).send({
            studentName: certificate.StudentName, //
            collegeId: certificate.CollegeID, //
            courseName: certificate.CourseName, //
            status: certificate.FinalGrade ? "Completed" : "Status Incomplete", // Or display FinalGrade if not sensitive
            finalGrade: certificate.FinalGrade, // Exposing this based on struct
            finalAttendance: certificate.FinalAttendance, //
            issuedDate: certificate.IssuedDate, //
            certificateTransactionId: certificate.TransactionID, //
            offChainDataHash: certificate.OffChainDataHash, //
            verificationMessage: "Student course certificate is verified on EduChain."
        });

    } catch (error) {
        console.error(`Error verifying student certificate by ID: ${error.message}`);
        if (error.message.includes("not found")) {
             return res.status(404).send({ verificationMessage: "Student course certificate not found." });
        }
        res.status(500).send({ message: 'Failed to verify student certificate', error: error.message });
    } finally {
        if (networkConnection && networkConnection.gateway) {
            networkConnection.gateway.disconnect();
        }
    }
};

// 2c. Student Course Certificate Verification (by Details)
exports.verifyStudentCertificateByDetails = async (req, res) => {
    let networkConnection;
    try {
        const { studentId, courseName, transactionId } = req.query;

        if (!studentId || !courseName || !transactionId) {
            return res.status(400).send({ message: "Student ID, Course Name, and Transaction ID are required." });
        }

        networkConnection = await connectToNetwork();
        const contract = networkConnection.contract;

        console.log(`[VerifyStudentCertByDetails] Querying certificate for Student ID: ${studentId}, Course: ${courseName}`);
        const certificateResultBytes = await contract.evaluateTransaction('QueryStudentCourseCertificate', studentId, courseName); //

        if (!certificateResultBytes || certificateResultBytes.length === 0) {
            return res.status(404).send({ verificationMessage: "Student course certificate not found for the given student and course." });
        }
        
        const certificate = JSON.parse(certificateResultBytes.toString());

        if (certificate.TransactionID !== transactionId) { //
            return res.status(400).send({ 
                verificationMessage: "Certificate found, but the provided transaction ID does not match.",
                details: { // Provide some non-sensitive details even on mismatch for context
                    studentName: certificate.StudentName, //
                    courseName: certificate.CourseName //
                }
            });
        }

        res.status(200).send({
            studentName: certificate.StudentName, //
            collegeId: certificate.CollegeID, //
            courseName: certificate.CourseName, //
            status: certificate.FinalGrade ? "Completed" : "Status Incomplete", //
            finalGrade: certificate.FinalGrade, //
            finalAttendance: certificate.FinalAttendance, //
            issuedDate: certificate.IssuedDate, //
            certificateTransactionId: certificate.TransactionID, //
            offChainDataHash: certificate.OffChainDataHash, //
            verificationMessage: "Student course certificate is verified on EduChain."
        });

    } catch (error) {
        console.error(`Error verifying student certificate by details: ${error.message}`);
         if (error.message.includes("not found")) {
             return res.status(404).send({ verificationMessage: "Student course certificate not found for the given student and course." });
        }
        res.status(500).send({ message: 'Failed to verify student certificate', error: error.message });
    } finally {
        if (networkConnection && networkConnection.gateway) {
            networkConnection.gateway.disconnect();
        }
    }
};

// 3. Faculty Association Verification
exports.verifyFacultyAssociation = async (req, res) => {
    let networkConnection;
    try {
        const { facultyId, collegeId } = req.query;

        if (!facultyId || !collegeId) {
            return res.status(400).send({ message: "Faculty ID and College ID are required query parameters." });
        }

        networkConnection = await connectToNetwork();
        const contract = networkConnection.contract;

        console.log(`[VerifyFacultyAssociation] Querying details for Faculty ID: ${facultyId}`);
        const facultyResultBytes = await contract.evaluateTransaction('QueryDetails', facultyId); //
        
        if (!facultyResultBytes || facultyResultBytes.length === 0) {
            return res.status(404).send({ verificationMessage: "Faculty ID not found on EduChain." });
        }

        const faculty = JSON.parse(facultyResultBytes.toString());
        
        // Verify it's a faculty record (heuristic)
        if (!faculty.id || !faculty.dept || !faculty.collegeID) { //
             return res.status(404).send({ verificationMessage: "Record found, but it does not appear to be a valid faculty record." });
        }

        if (faculty.collegeID === collegeId) { //
            res.status(200).send({
                facultyId: faculty.id, //
                collegeId: faculty.collegeID, //
                department: faculty.dept, //
                verificationMessage: "Faculty is verified as associated with the specified college and department on EduChain."
            });
        } else {
            res.status(200).send({ // Still 200 as faculty was found
                facultyId: faculty.id, //
                actualCollegeId: faculty.collegeID, //
                verificationMessage: `Faculty found but is associated with College ID ${faculty.collegeID}, not the specified ${collegeId}.`
            });
        }

    } catch (error) {
        console.error(`Error verifying faculty association: ${error.message}`);
        if (error.message.includes("not found")) {
             return res.status(404).send({ verificationMessage: "Faculty ID not found on EduChain." });
        }
        res.status(500).send({ message: 'Failed to verify faculty association', error: error.message });
    } finally {
        if (networkConnection && networkConnection.gateway) {
            networkConnection.gateway.disconnect();
        }
    }
};