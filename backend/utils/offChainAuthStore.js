// File: educhain-backend/utils/offChainAuthStore.js
// This is a simulated off-chain store for student and faculty login credentials.
// In a real application, this would be a proper database.

const fs = require('fs');
const path = require('path');

// This file will be created in the root of educhain-backend
const USER_CREDENTIALS_FILE = path.resolve(__dirname, '../user_credentials.json');

// Initialize the file if it doesn't exist when the module is loaded
if (!fs.existsSync(USER_CREDENTIALS_FILE)) {
    try {
        fs.writeFileSync(USER_CREDENTIALS_FILE, JSON.stringify({}), 'utf8');
        console.log('Created empty user_credentials.json file.');
    } catch (err) {
        console.error('Error creating user_credentials.json file:', err);
    }
}

async function getUserCredentials() {
    try {
        const data = await fs.promises.readFile(USER_CREDENTIALS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If file is empty or corrupted, return empty object
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            console.warn('user_credentials.json not found or corrupted. Initializing as empty.');
            return {};
        }
        console.error('Error reading user credentials file:', error);
        return {}; // Return empty object on other errors
    }
}

async function saveUserCredentials(credentials) {
    try {
        await fs.promises.writeFile(USER_CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing user credentials file:', error);
    }
}

/**
 * Adds or updates a user's off-chain login credential.
 * @param {string} email - The user's email (used as key).
 * @param {string} password - The user's password.
 * @param {'student'|'faculty'} type - The type of user.
 * @param {string} id - The user's blockchain ID (studentID or facultyID).
 * @param {string} collegeID - The user's college ID.
 */
async function addUserCredential(email, password, type, id, collegeID) {
    const credentials = await getUserCredentials();
    credentials[email] = { password, type, id, collegeID };
    await saveUserCredentials(credentials);
    console.log(`[offChainAuthStore] Added/Updated credential for ${type} ${id} (${email}).`);
}

/**
 * Retrieves a user's off-chain login credential by email.
 * @param {string} email - The user's email.
 * @returns {object|undefined} The user's credential object or undefined if not found.
 */
async function getUserByEmail(email) {
    const credentials = await getUserCredentials();
    return credentials[email];
}

module.exports = {
    addUserCredential,
    getUserByEmail,
};
