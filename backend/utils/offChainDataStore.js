   // File: educhain-backend/utils/offChainDataStore.js
   // This is a simulated off-chain store for granular attendance/grade data.
   // In a real application, this would be a database (SQL, NoSQL, etc.).

   // Structure:
   // {
   //   "studentID_courseName": {
   //     "attendance": [
   //       { date: "2024-05-20", isPresent: true, facultyID: "F001" },
   //       { date: "2024-05-21", isPresent: false, facultyID: "F001" }
   //     ],
   //     "grades": [
   //       { phase: "Phase1", grade: "85", facultyID: "F001" },
   //       { phase: "Phase2", grade: "90", facultyID: "F001" }
   //     ]
   //   }
   // }
   const offChainData = {}; // In-memory store for simplicity

   function addAttendanceEntry(studentID, courseName, date, isPresent, facultyID) {
       const key = `${studentID}_${courseName}`;
       if (!offChainData[key]) {
           offChainData[key] = { attendance: [], grades: [] };
       }
       offChainData[key].attendance.push({ date, isPresent, facultyID });
       console.log(`Off-chain: Added attendance for ${studentID} in ${courseName} on ${date}.`);
   }

   function addGradeEntry(studentID, courseName, phase, grade, facultyID) {
       const key = `${studentID}_${courseName}`;
       if (!offChainData[key]) {
           offChainData[key] = { attendance: [], grades: [] };
       }
       offChainData[key].grades.push({ phase, grade, facultyID });
       console.log(`Off-chain: Added grade for ${studentID} in ${courseName} (Phase ${phase}).`);
   }

   function getOffChainData(studentID, courseName) {
       const key = `${studentID}_${courseName}`;
       return offChainData[key] || { attendance: [], grades: [] };
   }

   // For demonstration, you might want to clear this on backend restart.
   // Or save to a file for persistence (more complex for 1-day).
   // console.log("Off-chain data store initialized.");

   module.exports = {
       addAttendanceEntry,
       addGradeEntry,
       getOffChainData
   };
   