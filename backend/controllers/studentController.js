// File: educhain-backend/controllers/studentController.js
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid'); // For generating transaction ID if needed
const { addAttendanceEntry, addGradeEntry, getOffChainData } = require('../utils/offChainDataStore'); //
const { generateHash } = require('../utils/hashingUtility'); //
const { addUserCredential, getUserByEmail } = require('../utils/offChainAuthStore'); //

const ccpPath = path.resolve(__dirname, '../connection.json'); //

async function connectToNetwork(userIdentity) { //
    const walletPath = path.resolve('/home/Fabric/educhain-backend/wallet'); //
    const wallet = await Wallets.newFileSystemWallet(walletPath); //
   
    console.log(`[connectToNetwork] Attempting connection as: ${userIdentity}`); //
    const gateway = new Gateway(); //
    try {
        const identity = await wallet.get(userIdentity); //
        if (!identity) { //
            console.error(`[connectToNetwork] ERROR: Identity for user "${userIdentity}" not found in wallet.`); //
            throw new Error(`Identity for user "${userIdentity}" not found in wallet.`); //
        }
        console.log(`[connectToNetwork] Identity for ${userIdentity} retrieved from wallet.`); //
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8')); //
        await gateway.connect(ccp, { wallet, identity: userIdentity, discovery: { enabled: true, asLocalhost: true } }); //
        console.log(`[connectToNetwork] Gateway connected for ${userIdentity}.`); //
        const network = await gateway.getNetwork('mychannel'); //
        console.log(`[connectToNetwork] Network (channel) 'mychannel' obtained for ${userIdentity}.`); //
        const contractInstance = network.getContract('educhain'); // Renamed to avoid shadowing
        console.log(`[connectToNetwork] Contract 'educhain' obtained for ${userIdentity}.`); //
       
        // **MODIFIED LINE: Return an object containing both contract and gateway**
        return { contract: contractInstance, gateway: gateway }; //
    } catch (connError) { //
        console.error(`[connectToNetwork] FATAL ERROR for ${userIdentity}:`, connError.message || connError); //
        if (gateway && gateway.isConnected()) { // Check if gateway exists and is connected
            gateway.disconnect(); //
        }
        throw connError; //
    }
}

exports.registerStudent = async (req, res) => { //
    let networkConnection; // Will hold { contract, gateway }
    try {
        const { studentID, name, email, department, collegeID } = req.body; //

        if (!studentID || !name || !email || !department || !collegeID) { //
            return res.status(400).send({ message: 'StudentID, Name, Email, Department, and CollegeID are required.' }); //
        }

        const studentPassword = Math.random().toString(36).substring(2, 10); //

        networkConnection = await connectToNetwork('collegeUser'); //
        const contract = networkConnection.contract; // Access contract instance

        await contract.submitTransaction('RegisterStudent', studentID, name, department, collegeID, email); //

        await addUserCredential(email, studentPassword, 'student', studentID, collegeID); //
        console.log(`Student ${studentID} registered. Email: ${email}, Password: ${studentPassword} (stored off-chain for college ${collegeID})`); //

        res.status(200).send({ //
            message: `Student ${name} (ID: ${studentID}) registered successfully for college ${collegeID}! Login Email: ${email}, Password: ${studentPassword}` //
        });
    } catch (error) { //
        console.error('Error registering student:', error.message || error); //
        res.status(500).send({ message: 'Failed to register student', error: error.message || String(error) }); //
    } finally { //
        if (networkConnection && networkConnection.gateway) { // Check gateway on the returned object
            networkConnection.gateway.disconnect(); //
        }
    }
};

exports.removeStudent = async (req, res) => { //
    let networkConnection;
    try {
        const { id } = req.params; //
        networkConnection = await connectToNetwork('admin'); //
        const contract = networkConnection.contract;
        await contract.submitTransaction('RemoveStudent', id); //
        res.status(200).send({ message: `Student ${id} removed successfully!` }); //
    } catch (error) { //
        console.error('Error removing student:', error.message || error); //
        res.status(500).send({ message: 'Failed to remove student', error: error.message || String(error) }); //
    } finally { //
        if (networkConnection && networkConnection.gateway) {
            networkConnection.gateway.disconnect();
        }
    }
};

exports.updateAttendance = async (req, res) => { //
    let networkConnection;
    try {
        const { facultyID, studentID, courseName, isPresent } = req.body; //
        networkConnection = await connectToNetwork('collegeUser'); //
        const contract = networkConnection.contract;
        await contract.submitTransaction('UpdateAttendance', facultyID, studentID, courseName, String(isPresent)); //

        const attendanceDate = new Date().toISOString().split('T')[0]; //
        addAttendanceEntry(studentID, courseName, attendanceDate, isPresent, facultyID); //

        res.status(200).send({ message: `Attendance for student ${studentID} in ${courseName} updated successfully!` }); //
    } catch (error) { //
        console.error('Error updating attendance:', error.message || error); //
        res.status(500).send({ message: 'Failed to update attendance', error: error.message || String(error) }); //
    } finally { //
        if (networkConnection && networkConnection.gateway) {
            networkConnection.gateway.disconnect();
        }
    }
};

exports.updateGrades = async (req, res) => { //
    let networkConnection;
    try {
        const { facultyID, studentID, courseName, phase, grade } = req.body; //

        if (!facultyID || !studentID || !courseName || !phase || grade === undefined) { //
            return res.status(400).send({ message: 'FacultyID, StudentID, CourseName, Phase, and Grade are required.' }); //
        }
        const validPhases = ["Phase1", "Phase2", "Final"]; //
        if (!validPhases.includes(phase)) { //
            return res.status(400).send({ message: `Invalid phase value. Must be one of: ${validPhases.join(', ')}` }); //
        }

        networkConnection = await connectToNetwork('collegeUser'); //
        const contract = networkConnection.contract;
        await contract.submitTransaction('UpdateGrades', facultyID, studentID, courseName, phase, grade); //

        addGradeEntry(studentID, courseName, phase, grade, facultyID); //

        res.status(200).send({ message: `Grades for student ${studentID} in ${courseName} (Phase: ${phase}) updated by ${facultyID} to ${grade}!` }); //
    } catch (error) { //
        console.error('Error updating grades:', error.message || error); //
        res.status(500).send({ message: 'Failed to update grades', error: error.message || String(error) }); //
    } finally { //
        if (networkConnection && networkConnection.gateway) {
            networkConnection.gateway.disconnect();
        }
    }
};

exports.issueStudentCourseCertificate = async (req, res) => { //
    let networkConnection;
    try {
        const { issuerID, studentID, courseName } = req.body; //
        const issuedDate = new Date().toISOString().split('T')[0]; //
        const externalTransactionID = uuidv4(); //

        if (!issuerID || !studentID || !courseName) { //
            return res.status(400).send({ message: 'IssuerID, StudentID, and CourseName are required.' }); //
        }

        const granularData = getOffChainData(studentID, courseName); //
        const offChainDataHash = generateHash(granularData); //
        console.log(`Generated hash for off-chain data for ${studentID}, ${courseName}: ${offChainDataHash}`); //

        networkConnection = await connectToNetwork('collegeUser'); //
        const contract = networkConnection.contract;
       
        const certificateResultBytes = await contract.submitTransaction('IssueStudentCourseCertificate', issuerID, studentID, courseName, issuedDate, externalTransactionID, offChainDataHash); //
       
        const certificateResult = JSON.parse(certificateResultBytes.toString()); //

        res.status(200).send({ //
            message: `Certificate issued for student ${studentID} in ${courseName}!`, //
            certificate: certificateResult //
        });
    } catch (error) { //
        console.error('Error issuing student course certificate:', error.message || error); //
        res.status(500).send({ message: 'Failed to issue student course certificate', error: error.message || String(error) }); //
    } finally { //
        if (networkConnection && networkConnection.gateway) {
            networkConnection.gateway.disconnect();
        }
    }
};

exports.studentLogin = async (req, res) => { //
    try {
        const { email, password } = req.body; //
        const userCredential = await getUserByEmail(email); //

        if (userCredential && userCredential.password === password && userCredential.type === 'student') { //
            res.status(200).send({ //
                message: 'Student login successful!', //
                studentId: userCredential.id, //
                collegeId: userCredential.collegeID, //
                email: email //
            });
        } else { //
            res.status(401).send({ message: 'Invalid email or password for student.' }); //
        }
    } catch (error) { //
        console.error(`Error during student login: ${error.message || error}`); //
        res.status(500).send({ message: 'Student login failed', error: error.message || String(error) }); //
    }
};

exports.queryStudent = async (req, res) => { //
    let networkConnection;
    try {
        const studentId = req.params.id; //
        networkConnection = await connectToNetwork('admin'); //
        const contract = networkConnection.contract;
        const result = await contract.evaluateTransaction('QueryDetails', studentId); //
        res.status(200).send(JSON.parse(result.toString() || '{}')); //
    } catch (error) { //
        console.error('Error querying student:', error.message || error); //
        res.status(500).send({ message: 'Failed to query student', error: error.message || String(error) }); //
    } finally { //
        if (networkConnection && networkConnection.gateway) {
            networkConnection.gateway.disconnect();
        }
    }
};

exports.getAllStudents = async (req, res) => { //
    let networkConnection;
    try {
        networkConnection = await connectToNetwork('admin'); //
        const contract = networkConnection.contract;
        const result = await contract.evaluateTransaction('GetAllStudents'); //
        res.status(200).send(JSON.parse(result.toString() || '[]')); //
    } catch (error) { //
        console.error('Error retrieving all students:', error.message || error); //
        res.status(500).send({ message: 'Failed to retrieve students', error: error.message || String(error) }); //
    } finally { //
        if (networkConnection && networkConnection.gateway) {
            networkConnection.gateway.disconnect();
        }
    }
};

exports.getStudentsByDepartment = async (req, res) => { //
    let networkConnection;
    try {
        const { collegeId, department } = req.params; //
        networkConnection = await connectToNetwork('admin'); //
        const contract = networkConnection.contract;
        const result = await contract.evaluateTransaction('GetStudentsByDepartment', collegeId, department); //
        res.status(200).send(JSON.parse(result.toString() || '[]')); //
    } catch (error) { //
        console.error('Error retrieving students by department:', error.message || error); //
        res.status(500).send({ message: 'Failed to retrieve students by department', error: error.message || String(error) }); //
    } finally { //
        if (networkConnection && networkConnection.gateway) {
            networkConnection.gateway.disconnect();
        }
    }
};

exports.queryStudentCourseCertificate = async (req, res) => { //
    let networkConnection;
    try {
        const { studentId, courseName } = req.params; //

        if (!studentId || !courseName) { //
            return res.status(400).send({ message: "Student ID and Course Name are required parameters." }); //
        }
        networkConnection = await connectToNetwork('admin'); //
        const contract = networkConnection.contract; // **Correctly access contract from the returned object**

        console.log(`[QueryStudentCert] Querying certificate for Student ID: ${studentId}, Course: ${courseName}`); //
        const certificateResultBytes = await contract.evaluateTransaction('QueryStudentCourseCertificate', studentId, courseName); //
       
        if (!certificateResultBytes || certificateResultBytes.length === 0) { //
            return res.status(404).send({ message: `Student course certificate not found for Student ${studentId}, Course ${courseName}.` }); //
        }
       
        const certificate = JSON.parse(certificateResultBytes.toString()); //

        res.status(200).send(certificate); //

    } catch (error) { //
        console.error(`Error querying student course certificate: ${error.message}`); //
        if (error.message && error.message.includes("does not exist")) { //
             return res.status(404).send({ message: `Student course certificate not found.` }); //
        }
        res.status(500).send({ message: 'Failed to query student course certificate', error: error.message }); //
    } finally { //
        if (networkConnection && networkConnection.gateway) { // **Correctly access gateway for disconnection**
            networkConnection.gateway.disconnect(); //
        }
    }
};

exports.getStudentDetailedAttendance = async (req, res) => { //
    try {
        const { studentId } = req.params; //
        const { courseName } = req.query; //

        if (!courseName) { //
            return res.status(400).send({ message: "Course name is required as a query parameter." }); //
        }

        const courseData = getOffChainData(studentId, courseName); //

        if (!courseData || !courseData.attendance) { //
            return res.status(404).send({ message: `No detailed attendance records found for student ${studentId} in course ${courseName}.` }); //
        }

        res.status(200).send({ //
            studentId: studentId, //
            courseName: courseName, //
            detailedAttendance: courseData.attendance //
        });

    } catch (error) { //
        console.error(`Error fetching detailed attendance for student ${studentId}:`, error.message || error); //
        res.status(500).send({ message: 'Failed to fetch detailed attendance', error: error.message || String(error) }); //
    }
};