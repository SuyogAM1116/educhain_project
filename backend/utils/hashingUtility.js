   // File: educhain-backend/utils/hashingUtility.js
   const crypto = require('crypto');

   function generateHash(data) {
       // Ensure data is stringified consistently for hashing
       const dataString = JSON.stringify(data);
       return crypto.createHash('sha256').update(dataString).digest('hex');
   }

   module.exports = {
       generateHash
   };
   