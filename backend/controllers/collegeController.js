   // File: educhain-backend/controllers/collegeController.js
   const { Gateway, Wallets } = require('fabric-network');
   const path = require('path');
   const fs = require('fs');
   const { v4: uuidv4 } = require('uuid');
   const { addCollegeCredential, updateCollegePassword, getCollegeByEmail } = require('../utils/collegeAuthStore');

   const ccpPath = path.resolve(__dirname, '../connection.json');

   // Helper function to connect to the Fabric network (now with robust logging/error handling)
   async function connectToNetwork(userIdentity) {
       const walletPath = path.resolve('/home/Fabric/educhain-backend/wallet'); // IMPORTANT: Verify this absolute path
       const wallet = await Wallets.newFileSystemWallet(walletPath);
       
       console.log(`[connectToNetwork] Attempting connection as: ${userIdentity}`);
       const gateway = new Gateway();
       try {
           const identity = await wallet.get(userIdentity);
           if (!identity) {
               console.error(`[connectToNetwork] ERROR: Identity for user "${userIdentity}" not found in wallet.`);
               throw new Error(`Identity for user "${userIdentity}" not found in wallet. Ensure it is enrolled and copied correctly.`);
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
           console.error(`[connectToNetwork] FATAL ERROR for ${userIdentity}:`, connError.message);
           if (gateway) {
               gateway.disconnect(); // Ensure gateway is disconnected on error
           }
           throw connError; // Re-throw to propagate error to the API handler
       }
   }

   // Ensure 'admin' and 'collegeUser' identities are in the wallet on backend startup
   async function ensureIdentitiesInWallet() {
       const walletPath = path.resolve('/home/Fabric/educhain-backend/wallet');
       const wallet = await Wallets.newFileSystemWallet(walletPath);

       // Ensure 'admin' identity (Org1 Admin)
       const adminIdentityExists = await wallet.get('admin');
       if (!adminIdentityExists) {
           try {
               const cert = fs.readFileSync('/home/Fabric/educhain-backend/wallet/admin/signcerts/cert.pem', 'utf8');
               const key = fs.readFileSync('/home/Fabric/educhain-backend/wallet/admin/keystore/priv_sk', 'utf8');
               const identity = { credentials: { certificate: cert, privateKey: key }, mspId: 'Org1MSP', type: 'X.509' };
               await wallet.put('admin', identity);
               console.log('Admin identity (Org1) ADDED TO WALLET successfully.');
           } catch (err) {
               console.error("Failed to add Org1 Admin identity. Ensure crypto material exists and path is correct:", err.message);
           }
       } else {
           console.log('Admin identity (Org1) ALREADY EXISTS in wallet, skipping add.');
       }

       // Ensure 'collegeUser' identity (Org2 User)
       const collegeUserIdentityExists = await wallet.get('collegeUser');
       if (!collegeUserIdentityExists) {
           try {
               const cert = fs.readFileSync('/home/Fabric/educhain-backend/wallet/collegeUser/signcerts/cert.pem', 'utf8');
               const key = fs.readFileSync('/home/Fabric/educhain-backend/wallet/collegeUser/keystore/priv_sk', 'utf8');
               const identity = { credentials: { certificate: cert, privateKey: key }, mspId: 'Org2MSP', type: 'X.509' };
               await wallet.put('collegeUser', identity);
               console.log('College User identity (Org2) ADDED TO WALLET successfully.');
           } catch (err) {
               console.error("Failed to add Org2 User identity. Ensure crypto material exists and path is correct. You might need to enroll 'User1' in Org2 first:", err.message);
           }
       } else {
           console.log('College User identity (Org2) ALREADY EXISTS in wallet, skipping add.');
       }
   }
   ensureIdentitiesInWallet(); // Run this on startup

   // --- College Management APIs ---

   exports.registerCollege = async (req, res) => {
       let contract;
       try {
           const { name, address, accreditationStatus, contactEmail } = req.body;
           const collegeID = uuidv4();
           contract = await connectToNetwork('admin');
           
           await contract.submitTransaction('RegisterCollege', collegeID, name, address, accreditationStatus, contactEmail);
           
           res.status(200).send({ message: `College ${name} registration submitted with ID ${collegeID}. Status: Pending`, applicationId: collegeID });
       } catch (error) {
           console.error(`Error registering college: ${error.message}`);
           res.status(500).send({ message: 'Failed to register college', error: error.message });
       } finally {
           if (contract && contract.gateway) contract.gateway.disconnect(); // Ensure gateway disconnection
       }
   };

   exports.approveCollege = async (req, res) => {
       let contract;
       try {
           const collegeID = req.params.id;
           contract = await connectToNetwork('admin');

           await contract.submitTransaction('ApproveCollege', collegeID);
           console.log(`College ${collegeID} approved on ledger.`);

           const collegeDetailsResult = await contract.evaluateTransaction('QueryCollege', collegeID);
           const collegeDetails = JSON.parse(collegeDetailsResult.toString());
           const contactEmail = collegeDetails.contactEmail; // Corrected to lowercase 'c'

           const generatedPassword = Math.random().toString(36).substring(2, 10);
           await addCollegeCredential(collegeID, contactEmail, generatedPassword);
           console.log(`College ${collegeID} approved. Admin password generated: ${generatedPassword}. Stored for email: ${contactEmail}`);

           const issuedDate = new Date().toISOString().split('T')[0];
           const certificateTxID = uuidv4();
           await contract.submitTransaction('IssueCollegeCertificate', collegeID, issuedDate, certificateTxID);
           console.log(`Certificate issued for college ${collegeID} on ledger.`);

           res.status(200).send({
               message: `College ${collegeID} approved and certificate issued successfully! Admin password: ${generatedPassword}. Please use this password to log in.`,
               certificateID: `COLLEGECERT_${collegeID}`,
               approvalTransactionID: certificateTxID
           });
       } catch (error) {
           console.error(`Error approving college or issuing certificate: ${error.message}`);
           res.status(500).send({ message: 'Failed to approve college or issue certificate', error: error.message });
       } finally {
           if (contract && contract.gateway) contract.gateway.disconnect();
       }
   };

   exports.rejectCollege = async (req, res) => {
       let contract;
       try {
           const collegeID = req.params.id;
           contract = await connectToNetwork('admin');
           await contract.submitTransaction('RejectCollege', collegeID);
           res.status(200).send({ message: `College ${collegeID} rejected successfully!` });
       } catch (error) {
           console.error(`Error rejecting college: ${error.message}`);
           res.status(500).send({ message: 'Failed to reject college', error: error.message });
       } finally {
           if (contract && contract.gateway) contract.gateway.disconnect();
       }
   };

   exports.queryCollege = async (req, res) => {
       let contract;
       try {
           const collegeId = req.params.id;
           contract = await connectToNetwork('admin');
           const result = await contract.evaluateTransaction('QueryCollege', collegeId);
           // Robust JSON parsing: if result is empty/invalid, default to empty object
           res.status(200).send(JSON.parse(result.toString() || '{}'));
       } catch (error) {
           console.error(`Error querying college: ${error.message}`);
           res.status(500).send({ message: 'Failed to query college', error: error.message });
       } finally {
           if (contract && contract.gateway) contract.gateway.disconnect();
       }
   };

   exports.getAllColleges = async (req, res) => {
       let contract;
       try {
           contract = await connectToNetwork('admin');
           const result = await contract.evaluateTransaction('GetAllColleges');
           // Robust JSON parsing: if result is empty/invalid, default to empty array
           res.status(200).send(JSON.parse(result.toString() || '[]'));
       } catch (error) {
           console.error(`Error retrieving all colleges (summary): ${error.message}`);
           res.status(500).send({ message: 'Failed to retrieve colleges (summary)', error: error.message });
       } finally {
           if (contract && contract.gateway) contract.gateway.disconnect();
       }
   };

   exports.getDetailsOfColleges = async (req, res) => {
       let contract;
       try {
           contract = await connectToNetwork('admin');
           const result = await contract.evaluateTransaction('GetDetailsOfColleges');
           // Robust JSON parsing: if result is empty/invalid, default to empty array
           res.status(200).send(JSON.parse(result.toString() || '[]'));
       } catch (error) {
           console.error(`Error retrieving all colleges (details): ${error.message}`);
           res.status(500).send({ message: 'Failed to retrieve colleges (details)', error: error.message });
       } finally {
           if (contract && contract.gateway) contract.gateway.disconnect();
       }
   };

   exports.queryCollegeCertificate = async (req, res) => {
       let contract;
       try {
           const collegeID = req.params.id;
           contract = await connectToNetwork('admin');
           const result = await contract.evaluateTransaction('QueryCollegeCertificate', collegeID);
           // Robust JSON parsing: if result is empty/invalid, default to empty object
           res.status(200).send(JSON.parse(result.toString() || '{}'));
       } catch (error) {
           console.error(`Error querying college certificate: ${error.message}`);
           res.status(500).send({ message: 'Failed to retrieve college certificate', error: error.message });
       } finally {
           if (contract && contract.gateway) contract.gateway.disconnect();
       }
   };

   // --- College Admin Login & Password Reset APIs ---

   exports.collegeLogin = async (req, res) => {
       try {
           const { email, password } = req.body;
           const collegeCredential = await getCollegeByEmail(email);

           if (collegeCredential && collegeCredential.password === password) {
               res.status(200).send({
                   message: 'College admin login successful!',
                   collegeId: collegeCredential.collegeId,
                   email: email,
                   passwordReset: collegeCredential.passwordReset
               });
           } else {
               res.status(401).send({ message: 'Invalid email or password.' });
           }
       } catch (error) {
           console.error(`Error during college login: ${error.message}`);
           res.status(500).send({ message: 'Login failed', error: error.message });
       }
   };

   exports.resetCollegePassword = async (req, res) => {
       try {
           const { email, oldPassword, newPassword } = req.body;
           const collegeCredential = await getCollegeByEmail(email);

           if (!collegeCredential || collegeCredential.password !== oldPassword) {
               return res.status(401).send({ message: 'Invalid email or old password.' });
           }
           if (collegeCredential.passwordReset) {
               return res.status(403).send({ message: 'Password has already been reset. Cannot reset again.' });
           }

           const success = await updateCollegePassword(email, newPassword);
           if (success) {
               res.status(200).send({ message: 'Password reset successfully!' });
           } else {
               res.status(500).send({ message: 'Failed to reset password.' });
           }
       } catch (error) {
           console.error(`Error during password reset: ${error.message}`);
           res.status(500).send({ message: 'Password reset failed', error: error.message });
       }
   };
   