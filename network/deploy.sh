#!/bin/bash
# EduChain Deployment Script
# AUTOMATES: Network Start, Chaincode Deploy, AND Manual Wallet Creation
# Usage: ./deploy.sh

set -e

# --- CONFIGURATION ---
TEST_NETWORK_DIR="$HOME/fabric-samples/test-network"
CHAINCODE_SRC_DIR="$(pwd)/../chaincode/educhain"
BACKEND_DIR="$(pwd)/../backend"
CHANNEL_NAME="mychannel"
CC_NAME="educhain"

echo "🎓 EduChain Full Setup Starting..."

# 1. Validation
if [ ! -d "$TEST_NETWORK_DIR" ]; then
    echo "❌ Error: fabric-samples not found at $TEST_NETWORK_DIR"
    exit 1
fi

# 2. Start Network
echo "🚀 Starting Fabric Network..."
cd "$TEST_NETWORK_DIR"
./network.sh down
./network.sh up createChannel -c $CHANNEL_NAME -ca -s couchdb

# 3. Deploy Chaincode (Using the simplified script provided by test-network)
echo "📜 Deploying Chaincode..."
./network.sh deployCC \
    -c $CHANNEL_NAME \
    -ccn $CC_NAME \
    -ccp "$CHAINCODE_SRC_DIR" \
    -ccl go \
    -ccep "OR('Org1MSP.peer','Org2MSP.peer')"

# 4. MANUAL WALLET GENERATION (Replicating your manual commands)
echo "🔑 Generating Identities & Wallet Keys..."

# Setup Environment for Org2 CA Client
export FABRIC_CA_CLIENT_HOME=${TEST_NETWORK_DIR}/organizations/peerOrganizations/org2.example.com/

# Enroll Admin & Register User1
echo "   -> Registering User1 on Org2 CA..."
fabric-ca-client enroll -u https://admin:adminpw@localhost:8054 --caname ca-org2 --tls.certfiles ${TEST_NETWORK_DIR}/organizations/fabric-ca/org2/tls-cert.pem
fabric-ca-client register --caname ca-org2 --id.name User1 --id.secret user1pw --id.type client --tls.certfiles ${TEST_NETWORK_DIR}/organizations/fabric-ca/org2/tls-cert.pem || true

# Enroll User1 to get the certs
echo "   -> Enrolling User1 to get certificates..."
fabric-ca-client enroll -u https://User1:user1pw@localhost:8054 --caname ca-org2 --tls.certfiles ${TEST_NETWORK_DIR}/organizations/fabric-ca/org2/tls-cert.pem -M ${TEST_NETWORK_DIR}/organizations/peerOrganizations/org2.example.com/users/User1@org2.example.com/msp --enrollment.profile tls --csr.cn peer0.org2.example.com

# 5. COPY KEYS TO BACKEND WALLET
echo "📂 Copying Crypto Material to Backend Wallet..."

# Create Directories
mkdir -p "$BACKEND_DIR/wallet/collegeUser/signcerts"
mkdir -p "$BACKEND_DIR/wallet/collegeUser/keystore"
mkdir -p "$BACKEND_DIR/wallet/admin/signcerts"
mkdir -p "$BACKEND_DIR/wallet/admin/keystore"

# Copy Org2 User1 (College User) Certs
cp "${TEST_NETWORK_DIR}/organizations/peerOrganizations/org2.example.com/users/User1@org2.example.com/msp/signcerts/cert.pem" "$BACKEND_DIR/wallet/collegeUser/signcerts/cert.pem"

# Copy Org2 User1 Private Key (Find the file ending in _sk)
PRIV_KEY_FILE=$(find "${TEST_NETWORK_DIR}/organizations/peerOrganizations/org2.example.com/users/User1@org2.example.com/msp/keystore" -name "*_sk" | head -n 1)
cp "$PRIV_KEY_FILE" "$BACKEND_DIR/wallet/collegeUser/keystore/priv_sk"

# Copy Org1 Admin Certs
cp "${TEST_NETWORK_DIR}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/cert.pem" "$BACKEND_DIR/wallet/admin/signcerts/cert.pem"

# Copy Org1 Admin Private Key
PRIV_KEY_FILE_ORG1=$(find "${TEST_NETWORK_DIR}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore" -name "*_sk" | head -n 1)
cp "$PRIV_KEY_FILE_ORG1" "$BACKEND_DIR/wallet/admin/keystore/priv_sk"

# Copy Connection Profile
cp "${TEST_NETWORK_DIR}/organizations/peerOrganizations/org1.example.com/connection-org1.json" "$BACKEND_DIR/connection.json"

echo "✅ Deployment & Setup Complete!"
echo "--------------------------------------------------------"
echo "The network is up, chaincode is deployed, and wallet keys are generated."
echo "NEXT STEPS:"
echo "1. cd ../backend"
echo "2. npm install"
echo "3. node app.js"
