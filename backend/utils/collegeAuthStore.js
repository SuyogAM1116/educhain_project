// File: educhain-backend/utils/collegeAuthStore.js
const fs = require('fs');
const path = require('path');

const COLLEGE_CREDENTIALS_FILE = path.resolve(__dirname, '../college_credentials.json');

// Initialize the file if it doesn't exist
if (!fs.existsSync(COLLEGE_CREDENTIALS_FILE)) {
    fs.writeFileSync(COLLEGE_CREDENTIALS_FILE, JSON.stringify({}), 'utf8');
}

async function getCollegeCredentials() {
    try {
        const data = await fs.promises.readFile(COLLEGE_CREDENTIALS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading college credentials file:', error);
        return {}; // Return empty object on error
    }
}

async function saveCollegeCredentials(credentials) {
    try {
        await fs.promises.writeFile(COLLEGE_CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing college credentials file:', error);
    }
}

async function addCollegeCredential(collegeId, email, password) {
    const credentials = await getCollegeCredentials();
    credentials[email] = { collegeId, password, passwordReset: false }; // passwordReset: false initially
    await saveCollegeCredentials(credentials);
}

async function updateCollegePassword(email, newPassword) {
    const credentials = await getCollegeCredentials();
    if (credentials[email]) {
        credentials[email].password = newPassword;
        credentials[email].passwordReset = true; // Mark as reset
        await saveCollegeCredentials(credentials);
        return true;
    }
    return false;
}

async function getCollegeByEmail(email) {
    const credentials = await getCollegeCredentials();
    return credentials[email];
}

module.exports = {
    addCollegeCredential,
    updateCollegePassword,
    getCollegeByEmail,
};