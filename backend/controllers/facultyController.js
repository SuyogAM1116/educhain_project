// File: educhain-backend/controllers/facultyController.js
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const { addUserCredential, getUserByEmail } = require('../utils/offChainAuthStore');

const ccpPath = path.resolve(__dirname, '../connection.json');

async function connectToNetwork(userIdentity) {
    const walletPath = path.resolve('/home/Fabric/educhain-backend/wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    
    console.log(`[connectToNetwork] Attempting connection as: ${userIdentity}`);
    const gateway = new Gateway();
    try {
        const identity = await wallet.get(userIdentity);
        if (!identity) {
            console.error(`[connectToNetwork] ERROR: Identity for user "${userIdentity}" not found in wallet.`);
            throw new Error(`Identity for user "${userIdentity}" not found in wallet.`);
        }
        console.log(`[connectToNetwork] Identity for ${userIdentity} retrieved from wallet.`);
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        await gateway.connect(ccp, { wallet, identity: userIdentity, discovery: { enabled: true, asLocalhost: true } });
        console.log(`[connectToNetwork] Gateway connected for ${userIdentity}.`);
        const network = await gateway.getNetwork('mychannel');
        console.log(`[connectToNetwork] Network (channel) 'mychannel' obtained for ${userIdentity}.`);
        const contract = network.getContract('educhain');
        console.log(`[connectToNetwork] Contract 'educhain' obtained for ${userIdentity}.`);
        return contract;
    } catch (connError) {
        console.error(`[connectToNetwork] FATAL ERROR for ${userIdentity}:`, connError.message || connError);
        if (gateway) {
            gateway.disconnect();
        }
        throw connError;
    }
}

exports.registerFaculty = async (req, res) => {
    let contract;
    try {
        // Fields from College Admin: FacultyID, Name, email, department
        // collegeID will also be needed, assumed to be passed in req.body or available from admin's session
        const { facultyID, name, email, department, collegeID } = req.body;

        if (!facultyID || !name || !email || !department || !collegeID) {
            return res.status(400).send({ message: 'FacultyID, Name, Email, Department, and CollegeID are required.' });
        }

        const facultyPassword = Math.random().toString(36).substring(2, 10);

        contract = await connectToNetwork('collegeUser'); // College Admin uses 'collegeUser'

        // Chaincode function signature: RegisterFaculty(ctx, id, name, dept, collegeID, email)
        // 'department' from input maps to 'dept' in chaincode
        await contract.submitTransaction('RegisterFaculty', facultyID, name, department, collegeID, email);

        // Store faculty login credentials off-chain using the provided email
        await addUserCredential(email, facultyPassword, 'faculty', facultyID, collegeID);
        console.log(`Faculty ${facultyID} registered. Email: ${email}, Password: ${facultyPassword} (stored off-chain for college ${collegeID})`);

        res.status(200).send({
            message: `Faculty ${name} (ID: ${facultyID}) registered successfully for college ${collegeID}! Login Email: ${email}, Password: ${facultyPassword}`
        });
    } catch (error) {
        console.error('Error registering faculty (full error object):', error);
        res.status(500).send({ message: 'Failed to register faculty', error: error.message || String(error) });
    } finally {
        if (contract && contract.gateway) contract.gateway.disconnect();
    }
};

// ... (rest of facultyController.js remains the same for now)
// Make sure to include all previous functions like removeFaculty, facultyLogin etc.

exports.removeFaculty = async (req, res) => {
    let contract;
    try {
        const { id } = req.params;
        contract = await connectToNetwork('admin'); // Or 'collegeUser'
        await contract.submitTransaction('RemoveFaculty', id);
        res.status(200).send({ message: `Faculty ${id} removed successfully!` });
    } catch (error) {
        console.error('Error removing faculty (full error object):', error);
        res.status(500).send({ message: 'Failed to remove faculty', error: error.message || String(error) });
    } finally {
        if (contract && contract.gateway) contract.gateway.disconnect();
    }
};

exports.facultyLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const userCredential = await getUserByEmail(email);

        if (userCredential && userCredential.password === password && userCredential.type === 'faculty') {
            res.status(200).send({
                message: 'Faculty login successful!',
                facultyId: userCredential.id, // This is facultyID
                collegeId: userCredential.collegeID,
                email: email
            });
        } else {
            res.status(401).send({ message: 'Invalid email or password for faculty.' });
        }
    } catch (error) {
        console.error(`Error during faculty login: ${error.message || error}`);
        res.status(500).send({ message: 'Faculty login failed', error: error.message || String(error) });
    }
};

exports.queryFaculty = async (req, res) => {
    let contract;
    try {
        const facultyId = req.params.id;
        contract = await connectToNetwork('admin'); // Or 'collegeUser'
        const result = await contract.evaluateTransaction('QueryDetails', facultyId);
        res.status(200).send(JSON.parse(result.toString() || '{}'));
    } catch (error) {
        console.error('Error querying faculty (full error object):', error);
        res.status(500).send({ message: 'Failed to query faculty', error: error.message || String(error) });
    } finally {
        if (contract && contract.gateway) contract.gateway.disconnect();
    }
};

exports.getAllFaculty = async (req, res) => {
    let contract;
    try {
        contract = await connectToNetwork('admin'); // Or 'collegeUser'
        const result = await contract.evaluateTransaction('GetAllFaculty');
        res.status(200).send(JSON.parse(result.toString() || '[]'));
    } catch (error) {
        console.error('Error retrieving all faculty (full error object):', error);
        res.status(500).send({ message: 'Failed to retrieve faculty', error: error.message || String(error) });
    } finally {
        if (contract && contract.gateway) contract.gateway.disconnect();
    }
};

exports.getFacultyByDepartment = async (req, res) => {
    let contract;
    try {
        const { collegeId, department } = req.params;
        contract = await connectToNetwork('admin'); // Or 'collegeUser'
        const result = await contract.evaluateTransaction('GetFacultyByDepartment', collegeId, department);
        res.status(200).send(JSON.parse(result.toString() || '[]'));
    } catch (error) {
        console.error('Error retrieving faculty by department (full error object):', error);
        res.status(500).send({ message: 'Failed to retrieve faculty by department', error: error.message || String(error) });
    } finally {
        if (contract && contract.gateway) contract.gateway.disconnect();
    }
};