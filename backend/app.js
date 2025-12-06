// File: educhain-backend/app.js (or index.js)
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv'); // Import dotenv

// Load environment variables from .env file (if you have one)
dotenv.config();

// Import route modules
const studentRoutes = require('./routes/studentRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const collegeRoutes = require('./routes/collegeRoutes');
const verificationRoutes = require('./routes/verificationRoutes');

console.log('Current working directory:', process.cwd()); // Keep if you find it useful for debugging

const app = express();

// Middleware
app.use(express.json()); // Built-in Express middleware for JSON body parsing
app.use(cors({ origin: '*' })); // Allow all origins for development

// Mount route modules
app.use('/api/students', studentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/colleges', collegeRoutes);
app.use('/api/verification', verificationRoutes);

// Basic root route for testing server (optional, but good for health checks)
app.get('/', (req, res) => {
    res.send('EduChain Backend is running!');
});

const PORT = process.env.PORT || 5000; // Use port from environment variable or default to 5000

// Start the server
app.listen(PORT, '0.0.0.0', () => { // Listen on all network interfaces
    console.log(`EduChain Backend server running on port ${PORT}`);
});

// Global Error Handling Middleware
// This catches unhandled errors from your routes and sends a generic 500 response
app.use((err, req, res, next) => {
    console.error(`Unhandled Error: ${err.message}`);
    // You might want more detailed error logging here in a real application
    res.status(500).send({ message: 'Internal Server Error', error: err.message });
});
